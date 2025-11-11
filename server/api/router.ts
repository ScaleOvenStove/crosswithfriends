import type {FastifyInstance} from 'fastify';
import puzzleListRouter from './puzzle_list.js';
import puzzleRouter from './puzzle.js';
import gameRouter from './game.js';
import recordSolveRouter from './record_solve.js';
import statsRouter from './stats.js';
import oEmbedRouter from './oembed.js';
import linkPreviewRouter from './link_preview.js';
import countersRouter from './counters.js';
import healthRouter from './health.js';

async function apiRouter(fastify: FastifyInstance) {
  await fastify.register(healthRouter, {prefix: '/health'});
  await fastify.register(puzzleListRouter, {prefix: '/puzzle_list'});
  await fastify.register(puzzleRouter, {prefix: '/puzzle'});
  await fastify.register(gameRouter, {prefix: '/game'});
  await fastify.register(recordSolveRouter, {prefix: '/record_solve'});
  await fastify.register(statsRouter, {prefix: '/stats'});
  await fastify.register(oEmbedRouter, {prefix: '/oembed'});
  await fastify.register(linkPreviewRouter, {prefix: '/link_preview'});
  await fastify.register(countersRouter, {prefix: '/counters'});
}

export default apiRouter;
