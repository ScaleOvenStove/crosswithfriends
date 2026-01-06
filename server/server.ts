import crypto from 'crypto';
import {readFileSync} from 'fs';
import {Server as HTTPServer} from 'http';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastify from 'fastify';
import {Server as SocketIOServer} from 'socket.io';

import apiRouter from './api/router.js';
import {config} from './config/index.js';
import {closePool, createPool} from './model/pool.js';
import {correlationIdPlugin} from './plugins/correlationId.js';
import {securityHeaders} from './plugins/securityHeaders.js';
import {createRepositories} from './repositories/index.js';
import {createServices} from './services/index.js';
import SocketManager from './SocketManager.js';
import {getJwtOptions} from './utils/auth.js';
import {createSanitizedErrorResponse} from './utils/errorSanitizer.js';
import {initializeFirebaseAdmin} from './utils/firebaseAdmin.js';
import {logger} from './utils/logger.js';
import {runSecurityValidation} from './utils/securityValidation.js';
import {initRateLimiter, stopRateLimiter} from './utils/websocketRateLimit.js';

// ================== Logging ================

function logAllEvents(io: SocketIOServer): void {
  io.on('*', (event: string, ...args: unknown[]) => {
    try {
      const argsStr = JSON.stringify(args);
      logger.debug({event, args: argsStr.length > 100 ? argsStr.substring(0, 100) : argsStr}, `[${event}]`);
    } catch {
      logger.debug({event, args}, `[${event}]`);
    }
  });
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
    const app = await fastify({
      // Use built-in request ID generation with custom generator
      // This replaces the custom correlationId utility for HTTP requests
      requestIdHeader: 'x-request-id', // Check this header for incoming request IDs
      genReqId: () => crypto.randomUUID(), // Generate UUID if header not present
      logger: config.server.isProduction
        ? {
            level: 'info',
            // Pino serializers for request/response logging with header redaction
            serializers: {
              req(request: any) {
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
              req(request: any) {
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

    // Set custom error handler with sanitization for production
    app.setErrorHandler(
      (error: Error & {statusCode?: number; validation?: unknown}, request: any, reply: any) => {
        request.log.error(error);

        // Handle validation errors - sanitize validation details
        if (error.validation) {
          const response = createSanitizedErrorResponse(
            400,
            'Bad Request',
            'Validation error',
            error.validation as Array<{instancePath?: string; message?: string; keyword?: string}>
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
        {error, openApiPath, serverDirname},
        'Failed to load OpenAPI specification for Swagger. Swagger UI will not be available.'
      );
      // Continue without Swagger - the API will still work via fastify-openapi-glue
    }

    const swaggerEnabled = !config.server.isProduction || process.env.ENABLE_SWAGGER_UI === 'true';

    if (swaggerEnabled) {
      await app.register(swaggerUi, {
        routePrefix: '/api/docs',
        uiConfig: {
          docExpansion: 'list',
          deepLinking: true,
        },
        staticCSP: true,
      });

      if (config.server.isProduction) {
        logger.warn(
          'Swagger UI is enabled in production. Consider setting ENABLE_SWAGGER_UI=false for security.'
        );
      }
    } else {
      // In production without ENABLE_SWAGGER_UI, redirect to a 404
      app.get('/api/docs', (_request: any, reply: any) => {
        reply.code(404).send({error: 'Not Found', message: 'API documentation is not available'});
      });
      app.get('/api/docs/*', (_request: any, reply: any) => {
        reply.code(404).send({error: 'Not Found', message: 'API documentation is not available'});
      });
      logger.info('Swagger UI disabled in production. Set ENABLE_SWAGGER_UI=true to enable.');
    }

    // Register correlation ID plugin for request tracing
    await app.register(correlationIdPlugin);

    // Register security headers plugin
    // Adds essential security headers to all responses (X-Content-Type-Options, X-Frame-Options, etc.)
    await app.register(securityHeaders);

    // Helper function to validate CORS origins (used for both HTTP and WebSocket)
    const getAllowedOrigins = (): string[] => {
      // Use configured origins if provided, otherwise fall back to defaults
      if (config.cors.origins.length > 0) {
        return config.cors.origins;
      }
      // Default origins for backward compatibility using configured URLs
      return [config.urls.productionFrontend, config.urls.productionFrontendAlt, config.urls.stagingFrontend];
    };

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

    // Register CORS plugin
    // In development, allow all origins for easier local development
    // In production, this should be restricted to specific domains
    if (config.server.isDevelopment) {
      await app.register(cors, {
        origin: true, // Allow all origins in development
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      });
    } else {
      await app.register(cors, {
        origin: (origin: string | undefined): boolean => {
          const allowed = validateOrigin(origin);
          if (!allowed) {
            logger.warn({origin}, 'CORS request blocked from origin');
          }
          return allowed;
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      });
    }

    // Register JWT plugin for authentication (@fastify/jwt)
    await app.register(fastifyJwt, getJwtOptions());

    // Register rate limiting plugin with enhanced key generation
    // Uses both IP and user ID (when available) for more robust rate limiting
    await app.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.timeWindowMs,
      cache: 10000, // Cache up to 10000 different rate limit keys
      allowList: (req: any) => {
        // Allow health check endpoint to bypass rate limiting
        return req.url === '/api/health';
      },
      keyGenerator: (req: any) => {
        // Enhanced rate limiting: use user ID + IP for authenticated requests
        // This prevents both IP-based bypass (via VPN/proxy) and user-based abuse
        try {
          // Try to extract user ID from JWT token in Authorization header
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            // Decode JWT payload without full verification for performance
            // The actual verification happens in the route handlers
            const parts = token.split('.');
            if (parts.length === 3 && parts[1]) {
              const payloadB64 = parts[1];
              // payloadB64 is guaranteed to be string here due to check above
              const payloadJson = Buffer.from(payloadB64 as string, 'base64url').toString('utf8');
              const payload = JSON.parse(payloadJson) as {userId?: string};
              if (payload.userId && typeof payload.userId === 'string') {
                // Use both user ID and IP to prevent cross-user attacks
                // and to ensure unauthenticated requests from same IP are also limited
                return `user:${payload.userId}:${req.ip}`;
              }
            }
          }
        } catch {
          // If token parsing fails, fall back to IP-only
        }
        // Fall back to IP-based rate limiting for unauthenticated requests
        return `ip:${req.ip}`;
      },
      errorResponseBuilder: (_req: any, context: {ttl: number}) => {
        return {
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
          retryAfter: Math.ceil(context.ttl / 1000),
        };
      },
      // Only log when actually exceeded - onExceeding is too noisy for normal usage
      // The rate limit still enforces the limit, we just don't warn on every request
      onExceeded: (req: any, key: string) => {
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

    // Create database pool, repositories, and services
    const pool = createPool();
    const repositories = createRepositories(pool);
    const services = createServices(repositories);

    // Make repositories and services available to routes via Fastify decorator
    app.decorate('repositories', repositories);
    app.decorate('services', services);
    app.decorate('pool', pool);

    // Register API routes
    await app.register(apiRouter, {prefix: '/api'});

    // Store references for graceful shutdown
    let io: SocketIOServer | null = null;
    let socketManager: SocketManager | null = null;

    // Initialize Socket.IO after server is ready but before listening
    app.addHook('onReady', () => {
      const server = app.server as HTTPServer;
      io = new SocketIOServer(server, {
        pingInterval: 2000,
        pingTimeout: 5000,
        cors: {
          origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
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
        },
      });

      // Initialize rate limiter with automatic cleanup
      initRateLimiter();

      socketManager = new SocketManager(io, {
        game: repositories.game,
        room: repositories.room,
      });
      socketManager.listen();
      logAllEvents(io);
    });

    await app.listen({port: config.server.port, host: '0.0.0.0'});
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

        // 3. Close database pool
        logger.info('Closing database pool...');
        await closePool(pool);
        logger.info('Database pool closed');

        // 4. Clear force shutdown timeout
        clearTimeout(forceShutdownTimeout);

        logger.info('Graceful shutdown completed');
        process.kill(process.pid, signal as string);
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

void runServer();
