import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import type {AddPuzzleResponse, AddPuzzleRequest} from '@shared/types';

import {addPuzzle} from '../model/puzzle.js';

async function puzzleRouter(fastify: FastifyInstance) {
  fastify.post<{Body: AddPuzzleRequest; Reply: AddPuzzleResponse}>(
    '/',
    async (request: FastifyRequest<{Body: AddPuzzleRequest}>, _reply: FastifyReply) => {
      // Sanitize headers: redact sensitive fields
      const sanitizedHeaders: Record<string, string | string[] | undefined> = {};
      const sensitiveHeaderKeys = ['authorization', 'cookie', 'set-cookie'];
      for (const [key, value] of Object.entries(request.headers)) {
        if (sensitiveHeaderKeys.includes(key.toLowerCase())) {
          sanitizedHeaders[key] = '[REDACTED]';
        } else {
          sanitizedHeaders[key] = value;
        }
      }

      // Create safe body summary: log keys and size instead of full payload
      const bodySummary = {
        keys: Object.keys(request.body || {}),
        size: JSON.stringify(request.body || {}).length,
      };

      request.log.debug(
        {
          method: request.method,
          url: request.url,
          id: request.id,
          headers: sanitizedHeaders,
          body: bodySummary,
        },
        'got req'
      );
      const pid = await addPuzzle(request.body.puzzle, request.body.isPublic, request.body.pid);
      return {pid};
    }
  );
}

export default puzzleRouter;
