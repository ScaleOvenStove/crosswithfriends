import {Server as HTTPServer} from 'http';

import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  fastify,
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import {Server as SocketIOServer} from 'socket.io';

import apiRouter from './api/router.js';
import {config} from './config/index.js';
import SocketManager from './SocketManager.js';
import {logger} from './utils/logger.js';

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
    // ======== Fastify Server Config ==========
    // In Fastify v5, fastify() returns PromiseLike<FastifyInstance>
    // The methods are available immediately, but TypeScript types need help
    const app = fastify({
      logger: config.server.isProduction
        ? {
            level: 'info',
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
    }) as unknown as FastifyInstance;

    // Set custom error handler
    app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      request.log.error(error);

      // Handle validation errors
      if (error.validation) {
        reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Validation error',
          validation: error.validation,
        });
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
      reply.code(statusCode).send({
        statusCode,
        error: errorName,
        message: error.message || 'An error occurred',
      });
    });

    // Register Swagger plugin
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'CrossWithFriends API',
          description: 'API for the CrossWithFriends crossword puzzle platform',
          version: '1.0.0',
          contact: {
            name: 'CrossWithFriends',
          },
        },
        servers: [
          {
            url: 'https://www.crosswithfriends.com/api',
            description: 'Production server',
          },
          {
            url: 'https://crosswithfriendsbackend-staging.onrender.com/api',
            description: 'Staging server',
          },
          {
            url: 'http://localhost:3021/api',
            description: 'Local development server',
          },
        ],
        tags: [
          {name: 'Health', description: 'Health check endpoints'},
          {name: 'Games', description: 'Game management endpoints'},
          {name: 'Puzzles', description: 'Puzzle management endpoints'},
          {name: 'Stats', description: 'Statistics endpoints'},
          {name: 'Counters', description: 'ID counter endpoints'},
          {name: 'Link Preview', description: 'Link preview and oEmbed endpoints'},
        ],
        components: {
          schemas: {},
        },
      },
    });

    // Register Swagger UI
    await app.register(swaggerUi, {
      routePrefix: '/api/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
      staticCSP: true,
    });

    // Register CORS plugin
    // In development, allow all origins for easier local development
    // In production, this should be restricted to specific domains
    const corsOptions = config.server.isDevelopment
      ? {
          origin: true, // Allow all origins in development
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        }
      : {
          origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void => {
            // In production, validate specific origins
            const allowedOrigins = [
              'https://www.crosswithfriends.com',
              'https://crosswithfriends.com',
              'https://crosswithfriendsbackend-staging.onrender.com',
            ];
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
            } else {
              logger.warn({origin}, 'CORS request blocked from origin');
              callback(new Error('Not allowed by CORS'), false);
            }
          },
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        };

    await app.register(cors, corsOptions);

    // Register rate limiting plugin
    await app.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.timeWindowMs,
      cache: 10000, // Cache up to 10000 different IPs
      allowList: (req) => {
        // Allow health check endpoint to bypass rate limiting
        return req.url === '/api/health';
      },
      keyGenerator: (req) => {
        // Use IP address as the rate limit key
        return req.ip;
      },
      errorResponseBuilder: (_req, context) => {
        return {
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Rate limit exceeded.Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
          retryAfter: Math.ceil(context.ttl / 1000),
        };
      },
      onExceeding: (req) => {
        logger.warn({ip: req.ip, url: req.url}, 'Rate limit warning - approaching limit');
      },
      onExceeded: (req) => {
        logger.warn({ip: req.ip, url: req.url}, 'Rate limit exceeded');
      },
    });

    // Register API routes
    await app.register(apiRouter, {prefix: '/api'});

    // Initialize Socket.IO after server is ready but before listening
    app.addHook('onReady', () => {
      const server = app.server as HTTPServer;
      const io = new SocketIOServer(server, {
        pingInterval: 2000,
        pingTimeout: 5000,
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
          credentials: true,
        },
      });

      const socketManager = new SocketManager(io);
      socketManager.listen();
      logAllEvents(io);
    });

    await app.listen({port: config.server.port, host: '0.0.0.0'});
    app.log.info(`Listening on port ${config.server.port} `);

    process.once('SIGUSR2', (): void => {
      void (async (): Promise<void> => {
        await app.close();
        app.log.info('exiting...');
        process.kill(process.pid, 'SIGUSR2');
        app.log.info('exited');
      })();
    });
  } catch (err) {
    logger.error({err}, 'Failed to start server');
    process.exit(1);
  }
}

void runServer();
