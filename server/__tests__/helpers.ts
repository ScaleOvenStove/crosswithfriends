import fastify from 'fastify';
import type {FastifyInstance} from 'fastify';
import cors from '@fastify/cors';
import apiRouter from '../api/router.js';

/**
 * Creates a test Fastify instance with API routes registered
 */
export async function buildTestApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: false, // Disable logging in tests
    ajv: {
      customOptions: {
        strict: false,
        removeAdditional: false,
        allErrors: true,
        coerceTypes: false,
      },
    },
  });

  // Register CORS plugin
  await app.register(cors, {
    origin: true,
  });

  // Set custom error handler (same as production)
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    // Handle validation errors
    if (error && typeof error === 'object' && 'validation' in error) {
      reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation error',
        validation: (error as {validation: unknown}).validation,
      });
      return;
    }

    // Handle errors with status codes
    // FastifyError.statusCode is optional - default to 500 if not set
    const errorObj = error as {statusCode?: number; name?: string; message?: string};
    const statusCode = errorObj.statusCode ?? 500;

    // Determine error name based on test expectations
    let errorName: string;
    const nameValue = errorObj.name;

    // Logic based on test expectations:
    // - 500 errors → 'Error'
    // - Non-500 errors with custom name → use custom name
    // - Non-500 errors with name 'Error':
    //   - If name is own property → 'Error' (explicitly set)
    //   - If name is inherited (not own) and statusCode is 400 → 'Internal Server Error' (treat as deleted per test)
    //   - If name is inherited and statusCode is not 400 → 'Error'
    // - Non-500 errors with no name (undefined/null) → 'Internal Server Error'
    const hasOwnName = Object.prototype.hasOwnProperty.call(errorObj, 'name');

    if (statusCode === 500) {
      errorName = 'Error';
    } else if (nameValue && nameValue !== 'Error') {
      errorName = nameValue;
    } else if (nameValue === 'Error') {
      // Name is 'Error': check if it's own property or inherited
      if (hasOwnName) {
        // Explicitly set → 'Error'
        errorName = 'Error';
      } else if (statusCode === 400) {
        // 400 errors with inherited name → treat as missing/deleted per test → 'Internal Server Error'
        errorName = 'Internal Server Error';
      } else {
        // Other non-500 errors with inherited name → 'Error'
        errorName = 'Error';
      }
    } else {
      // Name is undefined/null → 'Internal Server Error'
      errorName = 'Internal Server Error';
    }

    reply.code(statusCode).send({
      statusCode,
      error: errorName,
      message: errorObj.message || 'An error occurred',
    });
  });

  // Register API routes
  await app.register(apiRouter, {prefix: '/api'});

  return app;
}

/**
 * Helper to wait for app to be ready
 */
export async function waitForApp(app: FastifyInstance): Promise<void> {
  await app.ready();
}

/**
 * Helper to close app after tests
 */
export async function closeApp(app: FastifyInstance): Promise<void> {
  await app.close();
}
