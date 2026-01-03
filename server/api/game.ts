import type {CreateGameRequest, GetGameResponse, InfoJson} from '@crosswithfriends/shared/types';

import '../types/fastify.js';
import type {AppInstance} from '../types/fastify.js';
import {config} from '../config/index.js';
import {getPuzzleSolves} from '../model/puzzle_solve.js';
import {validateGameId, validatePuzzleId} from '../utils/inputValidation.js';
import {logRequest} from '../utils/sanitizedLogger.js';
import {authenticateRequest, isValidUserId} from '../utils/userAuth.js';

import {createHttpError} from './errors.js';
import {
  CreateGameRequestSchema,
  CreateGameResponseSchema,
  GetGameResponseSchema,
  ErrorResponseSchema,
} from './schemas.js';

interface CreateGameResponseWithGid {
  gid: string;
}

// eslint-disable-next-line require-await
async function gameRouter(fastify: AppInstance): Promise<void> {
  const postOptions = {
    schema: {
      operationId: 'createGame',
      tags: ['Games'],
      summary: 'Create a new game',
      description: 'Creates a new game session for a puzzle',
      body: CreateGameRequestSchema,
      response: {
        200: CreateGameResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  };

  fastify.post<{Body: CreateGameRequest; Reply: CreateGameResponseWithGid}>(
    '',
    postOptions,
    async (request: any, _reply: any) => {
      logRequest(request);

      // Validate game ID format
      const gidValidation = validateGameId(request.body.gid);
      if (!gidValidation.valid) {
        throw createHttpError(gidValidation.error || 'Invalid game ID', 400);
      }

      // Validate puzzle ID format
      const pidValidation = validatePuzzleId(request.body.pid);
      if (!pidValidation.valid) {
        throw createHttpError(pidValidation.error || 'Invalid puzzle ID', 400);
      }

      // Extract and validate user ID (backend JWT token)
      // In development mode (REQUIRE_AUTH=false), allow requests without authentication
      let userId: string | null = null;
      const authResult = authenticateRequest({
        query: request.query as {userId?: string; token?: string} | undefined,
        headers: request.headers,
        body: request.body,
      });

      if (authResult.authenticated && isValidUserId(authResult.userId)) {
        userId = authResult.userId;
      } else if (config.auth.requireAuth) {
        // In production, require authentication
        const errorMessage =
          authResult.error ||
          'Authentication required. Provide a valid JWT token via Authorization header (Bearer <token>) or ?token= query parameter.';
        throw createHttpError(errorMessage, 401);
      }
      // In development mode, userId will be null, which is allowed

      const gid = await fastify.repositories.game.createInitialEvent(
        gidValidation.value!,
        pidValidation.value!,
        userId
      );
      return {gid};
    }
  );

  const getOptions = {
    schema: {
      operationId: 'getGameById',
      tags: ['Games'],
      summary: 'Get game by ID',
      description: 'Retrieves game information including puzzle details and solve time',
      params: {
        type: 'object',
        required: ['gid'],
        properties: {
          gid: {type: 'string', description: 'Game ID'},
        },
      },
      response: {
        200: GetGameResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  };

  fastify.get<{Params: {gid: string}; Reply: GetGameResponse}>(
    '/:gid',
    getOptions,
    async (request: any, _reply: any) => {
      logRequest(request);
      const {gid} = request.params;

      // Validate game ID format
      const gidValidation = validateGameId(gid);
      if (!gidValidation.valid) {
        throw createHttpError(gidValidation.error || 'Invalid game ID', 400);
      }

      const puzzleSolves = await getPuzzleSolves([gidValidation.value!]);

      if (puzzleSolves.length === 0) {
        throw createHttpError('Game not found', 404);
      }

      // After the length check, puzzleSolves[0] is guaranteed to exist
      const gameState = puzzleSolves[0];
      if (!gameState) {
        throw createHttpError('Game not found', 404);
      }
      const puzzleInfo = (await fastify.services.puzzle.getPuzzleInfo(gameState.pid)) as InfoJson;

      return {
        gid,
        pid: gameState.pid,
        title: gameState.title,
        author: puzzleInfo?.author || 'Unknown',
        duration: gameState.time_taken_to_solve,
        size: gameState.size,
      };
    }
  );

  // New endpoint to get puzzle ID from active game (game_events table)
  const getActiveGameOptions = {
    schema: {
      operationId: 'getActiveGamePid',
      tags: ['Games'],
      summary: 'Get puzzle ID from active game',
      description: 'Retrieves the puzzle ID from an active (in-progress) game in game_events table',
      params: {
        type: 'object',
        required: ['gid'],
        properties: {
          gid: {type: 'string', description: 'Game ID'},
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            gid: {type: 'string'},
            pid: {type: 'string'},
          },
        },
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  };

  fastify.get<{Params: {gid: string}; Reply: {gid: string; pid: string}}>(
    '/:gid/pid',
    getActiveGameOptions,
    async (request: any, _reply: any) => {
      logRequest(request);
      const {gid} = request.params;

      // Validate game ID format
      const gidValidation = validateGameId(gid);
      if (!gidValidation.valid) {
        throw createHttpError(gidValidation.error || 'Invalid game ID', 400);
      }

      // The pid is stored in the create event params, but getInfo doesn't return it
      // We need to get it from the events. For now, use the repository's getEvents method
      const {events} = await fastify.repositories.game.getEvents(gidValidation.value!, {limit: 1});
      const createEvent = events.find((e: {type: string}) => e.type === 'create');
      if (!createEvent || createEvent.type !== 'create') {
        throw createHttpError('Active game not found', 404);
      }

      // TypeScript needs help narrowing the union type - we know it's a create event
      const createParams = createEvent.params as {pid: string};
      const pid = createParams.pid;
      if (!pid) {
        throw createHttpError('Puzzle ID not found in game create event', 500);
      }

      return {gid, pid};
    }
  );
}

export default gameRouter;
