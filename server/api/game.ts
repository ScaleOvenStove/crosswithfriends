import type {FastifyReply, FastifyRequest} from 'fastify';

import '../types/fastify.js';
import {config} from '../config/index.js';
import {getPuzzleSolves} from '../model/puzzle_solve.js';
import type {AppInstance} from '../types/fastify.js';
import {validateGameId, validatePuzzleId} from '../utils/inputValidation.js';
import {logRequest} from '../utils/sanitizedLogger.js';
import {hasStringProperty, isObject} from '../utils/typeGuards.js';
import {authenticateRequest, isValidUserId} from '../utils/userAuth.js';

import {createHttpError} from './errors.js';
import type {CreateGameRequest, CreateGameResponse, GetGameResponse} from './generated/index.js';
import {
  CreateGameRequestSchema,
  CreateGameResponseSchema,
  GetGameResponseSchema,
  ErrorResponseSchema,
} from './schemas.js';

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

  fastify.post<{Body: CreateGameRequest; Reply: CreateGameResponse}>(
    '',
    postOptions,
    async (
      request: FastifyRequest<{Body: CreateGameRequest}>,
      _reply: FastifyReply
    ): Promise<CreateGameResponse> => {
      logRequest(request);

      // Validate game ID format
      const gidValidation = validateGameId(request.body.gid);
      const gidValue = gidValidation.value;
      if (!gidValidation.valid || !gidValue) {
        throw createHttpError(gidValidation.error || 'Invalid game ID', 400);
      }

      // Validate puzzle ID format
      const pidValidation = validatePuzzleId(request.body.pid);
      const pidValue = pidValidation.value;
      if (!pidValidation.valid || !pidValue) {
        throw createHttpError(pidValidation.error || 'Invalid puzzle ID', 400);
      }

      // Extract and validate user ID (backend JWT token)
      // In development mode (REQUIRE_AUTH=false), allow requests without authentication
      let userId: string | null = null;
      const query = isObject(request.query)
        ? {
            userId: hasStringProperty(request.query, 'userId') ? request.query.userId : undefined,
            token: hasStringProperty(request.query, 'token') ? request.query.token : undefined,
          }
        : undefined;

      const authResult = authenticateRequest({
        query,
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

      const gid = await fastify.repositories.game.createInitialEvent(gidValue, pidValue, userId);
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
    async (
      request: FastifyRequest<{Params: {gid: string}}>,
      _reply: FastifyReply
    ): Promise<GetGameResponse> => {
      logRequest(request);
      const {gid} = request.params;

      // Validate game ID format
      const gidValidation = validateGameId(gid);
      const gidValue = gidValidation.value;
      if (!gidValidation.valid || !gidValue) {
        throw createHttpError(gidValidation.error || 'Invalid game ID', 400);
      }

      const puzzleSolves = await getPuzzleSolves(fastify.db, [gidValue]);

      if (puzzleSolves.length === 0) {
        throw createHttpError('Game not found', 404);
      }

      // After the length check, puzzleSolves[0] is guaranteed to exist
      const gameState = puzzleSolves[0];
      if (!gameState) {
        throw createHttpError('Game not found', 404);
      }
      const puzzleInfo = await fastify.services.puzzle.getPuzzleInfo(gameState.pid);

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
    async (
      request: FastifyRequest<{Params: {gid: string}}>,
      _reply: FastifyReply
    ): Promise<{gid: string; pid: string}> => {
      logRequest(request);
      const {gid} = request.params;

      // Validate game ID format
      const gidValidation = validateGameId(gid);
      const gidValue = gidValidation.value;
      if (!gidValidation.valid || !gidValue) {
        throw createHttpError(gidValidation.error || 'Invalid game ID', 400);
      }
      const validGid = gidValue;

      // The pid is stored in the create event params, but getInfo doesn't return it
      // We need to get it from the events. For now, use the repository's getEvents method
      const {events} = await fastify.repositories.game.getEvents(validGid, {limit: 1});
      const createEvent = events.find((e: {type: string}) => e.type === 'create');
      if (!createEvent || createEvent.type !== 'create') {
        throw createHttpError('Active game not found', 404);
      }

      // TypeScript needs help narrowing the union type - we know it's a create event
      const createParams = createEvent.params;
      const pidValue = hasStringProperty(createParams, 'pid') ? createParams.pid : undefined;
      if (!pidValue) {
        throw createHttpError('Puzzle ID not found in game create event', 500);
      }

      return {gid: validGid, pid: pidValue};
    }
  );
}

export default gameRouter;
