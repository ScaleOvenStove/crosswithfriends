import type {CreateGameRequest, GetGameResponse, InfoJson} from '@crosswithfriends/shared/types';
import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {addInitialGameEvent} from '../model/game.js';
import {getPuzzleInfo} from '../model/puzzle.js';
import {getPuzzleSolves} from '../model/puzzle_solve.js';

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
      request.log.debug({headers: request.headers, body: request.body}, 'got req');
      const gid = await addInitialGameEvent(request.body.gid, request.body.pid);
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
      request.log.debug({headers: request.headers, params: request.params}, 'got req');
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
      const puzzleInfo = (await getPuzzleInfo(gameState.pid)) as InfoJson;

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
}

export default gameRouter;
