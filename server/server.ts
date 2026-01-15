import crypto from 'crypto';
import {readFileSync} from 'fs';
import {Server as HTTPServer} from 'http';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastify, {type FastifyRequest, type FastifyReply} from 'fastify';
import {Server as SocketIOServer} from 'socket.io';

import apiRouter from './api/router.js';
import {config} from './config/index.js';
import configPlugin from './plugins/config.js';
import databasePlugin from './plugins/database.js';
import {createRepositories} from './repositories/index.js';
import {createServices} from './services/index.js';
import SocketManager from './SocketManager.js';
import {getJwtOptions} from './utils/auth.js';
import {createSanitizedErrorResponse} from './utils/errorSanitizer.js';
import {initializeFirebaseAdmin} from './utils/firebaseAdmin.js';
import {logger} from './utils/logger.js';
import {runSecurityValidation} from './utils/securityValidation.js';
import {hasStringProperty} from './utils/typeGuards.js';
import {initRateLimiter, stopRateLimiter} from './utils/websocketRateLimit.js';

// ================== Logging ================

function logAllEvents(io: SocketIOServer): void {
  if (config.server.isProduction) {
    return;
  }
  io.on('*', (event: string, ...args: unknown[]) => {
    try {
      const argsStr = JSON.stringify(args);
      logger.debug({event, args: argsStr.length > 100 ? argsStr.substring(0, 100) : argsStr}, `[${event}]`);
    } catch {
      logger.debug({event, args}, `[${event}]`);
    }
  });
}

function isHealthEndpoint(url: string): boolean {
  return url === '/api/health' || url === '/healthz' || url === '/api/healthz' || url === '/readyz';
}

function getRateLimitKey(request: FastifyRequest): string {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const parts = token.split('.');
      if (parts.length === 3 && parts[1]) {
        const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
        const payload = JSON.parse(payloadJson);
        if (hasStringProperty(payload, 'userId')) {
          return `user:${payload.userId}:${request.ip}`;
        }
      }
    }
  } catch {
    // If token parsing fails, fall back to IP-only
  }
  return `ip:${request.ip}`;
}

// ================== Main Entrypoint ================

async function runServer(): Promise<void> {
  try {
    // Run security validation first - will throw in production if critical issues found
    runSecurityValidation();

    // Initialize Firebase Admin SDK for token verification
    await initializeFirebaseAdmin();

    // ======== Fastify Server Config ==========
    // In Fastify v5, fastify() returns a Promise
    type SerializedRequest =
      | {
          method: string;
          url: string;
          headers: Record<string, string | string[] | undefined>;
          remoteAddress: string;
        }
      | {error: string};

    const app = await fastify({
      // Use built-in request ID generation with custom generator
      // This replaces the custom correlationId utility for HTTP requests
      requestIdHeader: 'x-request-id', // Check this header for incoming request IDs
      genReqId: () => crypto.randomUUID(), // Generate UUID if header not present
      // Set connection timeout to prevent hanging requests (60 seconds)
      connectionTimeout: 60000,
      logger: config.server.isProduction
        ? {
            level: 'info',
            // Pino serializers for request/response logging with header redaction
            serializers: {
              req(request: FastifyRequest): SerializedRequest {
                try {
                  const headers = {...request.headers};
                  // Redact sensitive headers
                  const sensitiveHeaders = [
                    'authorization',
                    'cookie',
                    'set-cookie',
                    'x-api-key',
                    'x-auth-token',
                  ];
                  for (const key of Object.keys(headers)) {
                    if (sensitiveHeaders.some((sensitive) => key.toLowerCase().includes(sensitive))) {
                      headers[key] = '[REDACTED]';
                    }
                  }
                  return {
                    method: request.method,
                    url: request.url,
                    headers,
                    remoteAddress: request.ip,
                  };
                } catch {
                  return {error: 'Failed to serialize request'};
                }
              },
            },
          }
        : {
            level: 'debug',
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss.l',
                ignore: 'pid,hostname',
              },
            },
            // Pino serializers for request/response logging with header redaction
            serializers: {
              req(request: FastifyRequest): SerializedRequest {
                try {
                  const headers = {...request.headers};
                  // Redact sensitive headers
                  const sensitiveHeaders = [
                    'authorization',
                    'cookie',
                    'set-cookie',
                    'x-api-key',
                    'x-auth-token',
                  ];
                  for (const key of Object.keys(headers)) {
                    if (sensitiveHeaders.some((sensitive) => key.toLowerCase().includes(sensitive))) {
                      headers[key] = '[REDACTED]';
                    }
                  }
                  return {
                    method: request.method,
                    url: request.url,
                    headers,
                    remoteAddress: request.ip,
                  };
                } catch {
                  return {error: 'Failed to serialize request'};
                }
              },
            },
          },
      ajv: {
        customOptions: {
          // Allow OpenAPI keywords like 'example' in schemas
          strict: false,
          removeAdditional: false,
          coerceTypes: true,
          allErrors: true,
        },
      },
    });

    // Add response logging hook to track failed requests
    app.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply): void => {
      const statusCode = reply.statusCode;
      // Log errors
      if (statusCode >= 400) {
        logger.warn(
          {
            method: request.method,
            url: request.url,
            statusCode,
            reqId: request.id,
          },
          'Request failed'
        );
      }
    });

    // Set custom error handler with sanitization for production
    app.setErrorHandler(
      (
        error: Error & {statusCode?: number; validation?: unknown},
        request: FastifyRequest,
        reply: FastifyReply
      ): void => {
        request.log.error(
          {
            err: error,
            url: request.url,
            method: request.method,
            statusCode: error.statusCode ?? 500,
          },
          'Request error'
        );

        // Handle validation errors - sanitize validation details
        if (error.validation) {
          const validationDetails: Array<{instancePath?: string; message?: string; keyword?: string}> =
            Array.isArray(error.validation)
              ? error.validation
                  .filter(
                    (item): item is Record<string, unknown> => typeof item === 'object' && item !== null
                  )
                  .map((item) => ({
                    instancePath: typeof item.instancePath === 'string' ? item.instancePath : undefined,
                    message: typeof item.message === 'string' ? item.message : undefined,
                    keyword: typeof item.keyword === 'string' ? item.keyword : undefined,
                  }))
              : [];

          const response = createSanitizedErrorResponse(
            400,
            'Bad Request',
            'Validation error',
            validationDetails
          );
          reply.code(400).send(response);
          return;
        }

        // Handle errors with status codes
        // FastifyError.statusCode is optional - default to 500 if not set
        const statusCode = error.statusCode ?? 500;

        // Determine error name based on test expectations
        const nameValue = error.name;
        const hasOwnName = Object.prototype.hasOwnProperty.call(error, 'name');

        // Simplified error name logic:
        // 1. 500 errors always use 'Error'
        // 2. Custom names (not 'Error') are used as-is
        // 3. If name is 'Error' and explicitly set, use 'Error'
        // 4. If name is missing/inherited and status is 400, use 'Internal Server Error'
        // 5. Otherwise use 'Error' as fallback
        let errorName: string;
        if (statusCode === 500) {
          errorName = 'Error';
        } else if (nameValue && nameValue !== 'Error') {
          errorName = nameValue;
        } else if (nameValue === 'Error' && hasOwnName) {
          errorName = 'Error';
        } else if (!nameValue || (nameValue === 'Error' && !hasOwnName && statusCode === 400)) {
          errorName = 'Internal Server Error';
        } else {
          errorName = 'Error';
        }

        // Use sanitized error response to prevent information disclosure
        const response = createSanitizedErrorResponse(statusCode, errorName, error.message);
        reply.code(statusCode).send(response);
      }
    );

    if (config.features.swaggerUi && !config.server.isProduction) {
      const serverFilename = fileURLToPath(import.meta.url);
      const serverDirname = dirname(serverFilename);
      const openApiPath = join(serverDirname, 'openapi.json');
      try {
        const openApiSpec = JSON.parse(readFileSync(openApiPath, 'utf-8'));
        await app.register(swagger, {
          mode: 'static',
          specification: {
            document: openApiSpec,
          },
        });
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            openApiPath,
            serverDirname,
            cwd: process.cwd(),
          },
          'Failed to load OpenAPI specification for Swagger. Swagger UI will not be available.'
        );
        // Continue without Swagger - the API will still work via fastify-openapi-glue
      }

      await app.register(swaggerUi, {
        routePrefix: '/api/docs',
        uiConfig: {
          docExpansion: 'list',
          deepLinking: true,
        },
        staticCSP: true,
      });

    } else {
      // In production or when disabled, return 404 for docs
      app.get('/api/docs', async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        await reply.code(404).send({error: 'Not Found', message: 'API documentation is not available'});
      });
      app.get('/api/docs/*', async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        await reply.code(404).send({error: 'Not Found', message: 'API documentation is not available'});
      });
      logger.info('Swagger UI disabled.');
    }

    // Register config plugin first (centralized configuration)
    await app.register(configPlugin);

    // Register database plugin - creates pool and adds to Fastify decorators
    // This must be registered before any routes that need database access
    await app.register(databasePlugin);

    // Security headers via @fastify/helmet (replacement for custom plugin)
    await app.register(helmet, {
      contentSecurityPolicy: false, // API-only server; avoid CSP conflicts
      hsts: config.server.isProduction,
      crossOriginResourcePolicy: {policy: 'same-site'},
    });

    // Helper function to get allowed CORS origins
    const getAllowedOrigins = (): string[] => {
      // Use configured origins if provided, otherwise fall back to defaults
      if (config.cors.origins.length > 0) {
        return config.cors.origins;
      }
      // Default origins for backward compatibility using configured URLs
      return [config.urls.productionFrontend, config.urls.productionFrontendAlt, config.urls.stagingFrontend];
    };

    // Helper function to validate CORS origins (used for both HTTP and WebSocket)
    const validateOrigin = (origin: string | undefined): boolean => {
      if (config.server.isDevelopment) {
        // Allow all origins in development
        return true;
      }
      // In production, validate specific origins
      const allowedOrigins = getAllowedOrigins();
      // Allow requests with no origin (like mobile apps or curl requests)
      return !origin || allowedOrigins.includes(origin);
    };

    // Register CORS plugin (only if enabled)
    if (config.cors.enabled) {
      if (config.server.isDevelopment) {
        // In development, allow all origins for easier local development
        await app.register(cors, {
          origin: true,
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        });
      } else {
        // In production, validate specific origins
        const allowedOrigins = getAllowedOrigins();
        await app.register(cors, {
          origin: allowedOrigins,
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        });
      }
      logger.info({enabled: true, isDevelopment: config.server.isDevelopment}, 'CORS enabled');
    } else {
      logger.info('CORS disabled via DISABLE_CORS environment variable');
    }

    // Register JWT plugin for authentication (@fastify/jwt)
    await app.register(fastifyJwt, getJwtOptions());

    // Register rate limiting plugin with enhanced key generation
    // Uses both IP and user ID (when available) for more robust rate limiting
    await app.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.timeWindowMs,
      cache: 10000, // Cache up to 10000 different rate limit keys
      allowList: (req: FastifyRequest): boolean => isHealthEndpoint(req.url),
      keyGenerator: (req: FastifyRequest): string => getRateLimitKey(req),
      errorResponseBuilder: (_req: FastifyRequest, context: {ttl: number}) => {
        return {
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
          retryAfter: Math.ceil(context.ttl / 1000),
        };
      },
      // Only log when actually exceeded - onExceeding is too noisy for normal usage
      // The rate limit still enforces the limit, we just don't warn on every request
      onExceeded: (req: FastifyRequest, key: string): void => {
        // Note: The actual context with ttl is not available in onExceeded
        // We log the rate limit event without retryAfter
        logger.warn(
          {
            ip: req.ip,
            url: req.url,
            key,
          },
          'Rate limit exceeded'
        );
      },
    });

    // Create repositories and services using the injected database pool
    // The pool is now managed by the database plugin (app.db)
    const repositories = createRepositories(app.db);
    const services = createServices(repositories);

    // Make repositories and services available to routes via Fastify decorator
    app.decorate('repositories', repositories);
    app.decorate('services', services);

    // Health check endpoints (common paths for Kubernetes/Render)
    // These are lightweight and don't require database connections
    // Register these BEFORE the API router to ensure they're matched first
    app.get('/healthz', async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      await reply.code(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    app.get('/api/healthz', async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      await reply.code(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Direct health endpoint for Docker health checks
    // This is a workaround for fastify-openapi-glue route not responding
    // Must be registered BEFORE apiRouter to take precedence
    app.get('/api/health', (_request: FastifyRequest, reply: FastifyReply): void => {
      reply.code(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Register API routes
    await app.register(apiRouter, {prefix: '/api'});

    // Readiness endpoint - verifies database connectivity
    app.get('/readyz', async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        // Perform a lightweight database round-trip to verify connectivity
        await app.db.query('SELECT 1');
        await reply.code(200).send({
          status: 'ready',
          database: 'connected',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        // Log the full error server-side for debugging (may contain sensitive DB info)
        logger.error(
          {
            err: error,
            endpoint: '/readyz',
            context: 'Database readiness check failed',
          },
          'Database connection failed during readiness check'
        );
        // Database connection failed - return 503 Service Unavailable
        // Return generic message to avoid leaking sensitive database information
        await reply.code(503).send({
          status: 'not ready',
          database: 'disconnected',
          timestamp: new Date().toISOString(),
          error: 'Database connection failed',
        });
      }
    });

    // Root route handler - return API info
    // Fastify automatically handles HEAD requests for GET routes
    app.get('/', async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      await reply.code(200).send({
        name: 'Cross with Friends API',
        version: '1.0.0',
        status: 'ok',
        endpoints: {
          api: '/api',
          docs: '/api/docs',
          health: '/api/health',
        },
      });
    });

    // Catch-all 404 handler for unhandled routes
    app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply): void => {
      reply.code(404).send({
        error: 'Not Found',
        message: `Route ${request.method} ${request.url} not found`,
        availableEndpoints: {
          api: '/api',
          docs: '/api/docs',
          health: '/api/health',
        },
      });
    });

    // Store references for graceful shutdown
    let io: SocketIOServer | null = null;
    let socketManager: SocketManager | null = null;

    // Initialize Socket.IO after server is ready but before listening
    app.addHook('onReady', () => {
      try {
        const server: HTTPServer = app.server;
        const socketIOOptions: {
          pingInterval: number;
          pingTimeout: number;
          cors?: {
            origin: (
              origin: string | undefined,
              callback: (err: Error | null, allow?: boolean) => void
            ) => void;
            methods: string[];
            credentials: boolean;
          };
        } = {
          pingInterval: 2000,
          pingTimeout: 5000,
        };

        // Only add CORS configuration if CORS is enabled
        if (config.cors.enabled) {
          socketIOOptions.cors = {
            origin: (
              origin: string | undefined,
              callback: (err: Error | null, allow?: boolean) => void
            ): void => {
              // In development, allow all origins (including undefined/null for polling)
              if (config.server.isDevelopment) {
                callback(null, true);
                return;
              }
              // In production, validate origin
              if (validateOrigin(origin)) {
                callback(null, true);
              } else {
                logger.warn({origin}, 'WebSocket CORS request blocked from origin');
                callback(new Error('Not allowed by CORS'), false);
              }
            },
            methods: ['GET', 'POST'],
            credentials: true,
          };
        }

        io = new SocketIOServer(server, socketIOOptions);

        // Initialize rate limiter with automatic cleanup
        initRateLimiter();

        socketManager = new SocketManager(io, app.db, {
          game: repositories.game,
          room: repositories.room,
        });
        socketManager.listen();
        logAllEvents(io);
      } catch (error) {
        logger.error({err: error}, 'Error in onReady hook');
        throw error;
      }
    });

    const address = await app.listen({port: config.server.port, host: '0.0.0.0'});

    logger.info({
      address,
      port: config.server.port,
      host: '0.0.0.0',
      message: 'Server is listening on all interfaces (0.0.0.0)',
    });
    app.log.info(`Listening on port ${config.server.port} `);

    // Graceful shutdown handler
    const shutdown = async (signal: string): Promise<void> => {
      logger.info({signal}, 'Received shutdown signal, starting graceful shutdown...');

      // Set a timeout for forced shutdown (30 seconds)
      const forceShutdownTimeout = setTimeout(() => {
        logger.error('Forced shutdown timeout exceeded, exiting immediately');
        process.exit(1);
      }, 30000);

      try {
        // 1. Stop accepting new connections
        logger.info('Stopping server from accepting new connections...');
        await app.close();

        // 2. Close WebSocket connections and stop rate limiter
        if (io) {
          logger.info('Closing WebSocket connections...');
          void io.close(() => {
            logger.info('All WebSocket connections closed');
          });
        }
        stopRateLimiter();

        // Note: Database pool is automatically closed by the database plugin's onClose hook
        // which is triggered by app.close() above

        // 3. Clear force shutdown timeout
        clearTimeout(forceShutdownTimeout);

        logger.info('Graceful shutdown completed');
        process.kill(process.pid, signal);
      } catch (error) {
        logger.error({err: error}, 'Error during graceful shutdown');
        clearTimeout(forceShutdownTimeout);
        process.exit(1);
      }
    };

    // Handle SIGUSR2 (used by nodemon/pm2 for restart)
    process.once('SIGUSR2', () => {
      void shutdown('SIGUSR2');
    });

    // Handle SIGTERM (used by Docker/Kubernetes)
    process.once('SIGTERM', () => {
      void shutdown('SIGTERM');
    });

    // Handle SIGINT (Ctrl+C)
    process.once('SIGINT', () => {
      void shutdown('SIGINT');
    });
  } catch (err) {
    logger.error({err}, 'Failed to start server');
    process.exit(1);
  }
}

// Add global error handlers to catch unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error({err: reason, promise}, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({err: error}, 'Uncaught exception');
  process.exit(1);
});

void runServer();
