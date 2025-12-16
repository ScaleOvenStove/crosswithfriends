import type {CreateGameRequest, GetGameResponse, InfoJson} from '@crosswithfriends/shared/types';
import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {getPuzzleSolves} from '../model/puzzle_solve.js';
import {logRequest} from '../utils/sanitizedLogger.js';
import {extractUserIdFromRequest, isValidUserId} from '../utils/userAuth.js';

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
async function gameRouter(fastify: FastifyInstance): Promise<void> {
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
    async (request: FastifyRequest<{Body: CreateGameRequest}>, _reply: FastifyReply) => {
      logRequest(request);

      // Extract and validate user ID
      const userId = extractUserIdFromRequest(request);
      if (!isValidUserId(userId)) {
        throw createHttpError('User ID required. Provide userId in query, header (X-User-Id), or body.', 401);
      }

      const gid = await fastify.repositories.game.createInitialEvent(
        request.body.gid,
        request.body.pid,
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
    async (request: FastifyRequest<{Params: {gid: string}}>, _reply: FastifyReply) => {
      logRequest(request);
      const {gid} = request.params;

      const puzzleSolves = await getPuzzleSolves([gid]);

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
    async (request: FastifyRequest<{Params: {gid: string}}>, _reply: FastifyReply) => {
      logRequest(request);
      const {gid} = request.params;

      // Get game info which contains the puzzle ID
      const gameInfo = await fastify.repositories.game.getInfo(gid);
      // The pid is stored in the create event params, but getInfo doesn't return it
      // We need to get it from the events. For now, use the repository's getEvents method
      const {events} = await fastify.repositories.game.getEvents(gid, {limit: 1});
      const createEvent = events.find((e) => e.type === 'create');
      if (!createEvent || createEvent.type !== 'create') {
        throw createHttpError('Active game not found', 404);
      }

      const pid = createEvent.params.pid;
      if (!pid) {
        throw createHttpError('Puzzle ID not found in game create event', 500);
      }

      return {gid, pid};
    }
  );
}

export default gameRouter;
