import {readFileSync} from 'fs';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

import openapiGlue from 'fastify-openapi-glue';

import type {AppInstance} from '../types/fastify.js';

import {createHandlers} from './handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load OpenAPI spec from file (source of truth)
const specPath = join(__dirname, '..', 'openapi.json');
const specification = JSON.parse(readFileSync(specPath, 'utf-8'));

async function apiRouter(fastify: AppInstance): Promise<void> {
  // Create handlers with access to fastify instance (repositories, services, etc.)
  const handlers = createHandlers(fastify);

  // Register fastify-openapi-glue which:
  // 1. Parses the OpenAPI spec
  // 2. Creates routes automatically
  // 3. Calls handlers based on operationId
  // 4. Validates requests/responses against the spec
  await fastify.register(openapiGlue, {
    specification,
    service: handlers,
    // Don't prefix since paths in spec already include full path
    prefix: '',
  });
}

export default apiRouter;
