/**
 * API Handlers
 *
 * This module exports handler functions mapped by operationId.
 * These handlers are called by fastify-openapi-glue based on the OpenAPI spec.
 */

import type {InfoJson, ListPuzzleRequestFilters, PuzzleJson} from '@crosswithfriends/shared/types';

import {convertOldFormatToIpuz} from '../adapters/puzzleFormatAdapter.js';
import {config} from '../config/index.js';
import {getPuzzleSolves} from '../model/puzzle_solve.js';
import type {AppInstance} from '../types/fastify.js';
import {
  generateSecureUserId,
  isValidUserIdFormat,
  TOKEN_EXPIRY_SECONDS,
  type JwtPayload,
} from '../utils/auth.js';
import {isFirebaseAdminInitialized, verifyFirebaseToken} from '../utils/firebaseAdmin.js';
import {escapeHtml, escapeHtmlAttribute} from '../utils/htmlEscape.js';
import {validateGameId, validatePuzzleId} from '../utils/inputValidation.js';
import {isFBMessengerCrawler, isLinkExpanderBot} from '../utils/link_preview_util.js';
import {logRequest} from '../utils/sanitizedLogger.js';
import {authenticateRequest, isValidUserId} from '../utils/userAuth.js';

import {createHttpError} from './errors.js';
import {computePuzzleStats} from './stats.js';

// Re-export computePuzzleStats for use by the handlers
export {computePuzzleStats};

// ============================================================================
// Allowed domains for link preview (SSRF prevention)
// ============================================================================

const ALLOWED_SCHEMES = ['http:', 'https:'];
const isNonProduction = config.server.isDevelopment || config.server.isTest;

const ALLOWED_DOMAINS = [
  'downforacross.com',
  'www.downforacross.com',
  'foracross.com',
  'www.foracross.com',
  'api.foracross.com',
  'crosswithfriends.com',
  'www.crosswithfriends.com',
  ...(isNonProduction ? ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', 'example.com'] : []),
];

function validatePreviewUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw createHttpError('Invalid URL format', 400);
  }

  if (!ALLOWED_SCHEMES.includes(url.protocol)) {
    throw createHttpError(`Invalid URL scheme: ${url.protocol}. Only http and https are allowed.`, 400);
  }

  const hostname = url.hostname.toLowerCase();

  if (!isNonProduction) {
    if (
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      /^127\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      hostname === 'localhost' ||
      hostname === '0.0.0.0'
    ) {
      throw createHttpError('URLs pointing to internal networks are not allowed', 400);
    }

    if (
      hostname.startsWith('[') ||
      hostname.includes('::1') ||
      /^fe80:/i.test(hostname) ||
      /^fc00:/i.test(hostname) ||
      /^fd/i.test(hostname)
    ) {
      throw createHttpError('URLs pointing to internal networks are not allowed', 400);
    }
  }

  const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => {
    return (
      hostname === domain ||
      hostname.endsWith('.' + domain) ||
      (isNonProduction && hostname.split(':')[0] === domain)
    );
  });

  if (!isAllowedDomain) {
    throw createHttpError(`Domain not allowed for link preview: ${hostname}`, 400);
  }

  return url;
}

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Creates handlers that have access to Fastify app instance (repositories, services, etc.)
 */
export function createHandlers(fastify: AppInstance) {
  return {
    // ========================================================================
    // Health
    // ========================================================================
    getHealth: (_request: any, _reply: any) => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    },

    // ========================================================================
    // Authentication
    // ========================================================================
    createToken: (request: any, _reply: any) => {
      request.log.debug({body: request.body ? Object.keys(request.body) : []}, 'Creating auth token');

      let userId = request.body?.userId;

      if (userId) {
        if (!isValidUserIdFormat(userId)) {
          throw createHttpError(
            'Invalid userId format. Must be alphanumeric with hyphens/underscores, 1-200 characters.',
            400
          );
        }
        userId = userId.trim();
      } else {
        userId = generateSecureUserId();
      }

      const payload: JwtPayload = {userId};
      const token = fastify.jwt.sign(payload);
      const now = Date.now();
      const expiresAt = now + TOKEN_EXPIRY_SECONDS * 1000;

      return {token, userId, expiresAt};
    },

    exchangeFirebaseToken: async (request: any, _reply: any) => {
      request.log.debug('Exchanging Firebase token for backend JWT');

      const {firebaseToken} = request.body;

      if (!firebaseToken || typeof firebaseToken !== 'string' || !firebaseToken.trim()) {
        throw createHttpError('Firebase token is required', 400);
      }

      const isDevelopment = config.server.isDevelopment && !config.auth.requireAuth;
      if (!isFirebaseAdminInitialized() && !isDevelopment) {
        throw createHttpError(
          'Firebase Admin is not initialized. Set FIREBASE_CREDENTIALS_PATH or enable development mode (REQUIRE_AUTH=false).',
          503
        );
      }

      const firebaseUser = await verifyFirebaseToken(firebaseToken.trim());
      if (!firebaseUser) {
        throw createHttpError('Invalid or expired Firebase token', 401);
      }

      let userId = firebaseUser.uid;

      if (!isValidUserIdFormat(userId)) {
        const sanitizedUserId = userId.replace(/[^\w-]/g, '_');
        if (!isValidUserIdFormat(sanitizedUserId)) {
          throw createHttpError('Invalid Firebase UID format', 400);
        }
        userId = sanitizedUserId;
      }

      const payload: JwtPayload = {userId};
      const token = fastify.jwt.sign(payload);
      const now = Date.now();
      const expiresAt = now + TOKEN_EXPIRY_SECONDS * 1000;

      request.log.debug({userId, email: firebaseUser.email}, 'Firebase token exchanged successfully');

      return {token, userId, expiresAt};
    },

    validateToken: (request: any, _reply: any) => {
      request.log.debug('Validating auth token');

      const {token} = request.body;

      if (!token || typeof token !== 'string') {
        throw createHttpError('Token is required', 400);
      }

      try {
        const decoded = fastify.jwt.verify<JwtPayload>(token.trim());

        if (!decoded.userId) {
          return {valid: false};
        }

        const expiresAt = decoded.exp ? decoded.exp * 1000 : undefined;

        return {valid: true, userId: decoded.userId, expiresAt};
      } catch {
        return {valid: false};
      }
    },

    getCurrentUser: async (request: any, _reply: any) => {
      request.log.debug('Getting current user');

      try {
        await request.jwtVerify();
        const user = request.user as JwtPayload;

        if (!user.userId) {
          throw createHttpError('Invalid token payload', 401);
        }

        const expiresAt = user.exp ? user.exp * 1000 : Date.now() + TOKEN_EXPIRY_SECONDS * 1000;

        return {userId: user.userId, expiresAt};
      } catch (error) {
        if (error instanceof Error && error.message.includes('Authorization')) {
          throw createHttpError('Authorization header required', 401);
        }
        throw createHttpError('Invalid or expired token', 401);
      }
    },

    // ========================================================================
    // Puzzles
    // ========================================================================
    listPuzzles: async (request: any, _reply: any) => {
      const page = Number.parseInt(request.query.page, 10);
      const pageSize = Number.parseInt(request.query.pageSize, 10);

      if (!(Number.isFinite(page) && Number.isFinite(pageSize))) {
        throw createHttpError('page and pageSize should be integers', 400);
      }

      const sizeMini = request.query.sizeMini;
      const sizeStandard = request.query.sizeStandard;
      const filters: ListPuzzleRequestFilters = {
        sizeFilter: {
          Mini: sizeMini === 'true' && typeof sizeMini === 'string',
          Standard: sizeStandard === 'true' && typeof sizeStandard === 'string',
        },
        nameOrTitleFilter: (request.query.nameOrTitle ?? '') as string,
      };

      const result = await fastify.repositories.puzzle.list(filters, pageSize, page * pageSize);
      const rawPuzzleList = result.puzzles;

      const puzzles = rawPuzzleList.map(
        (puzzle: {
          pid: string;
          puzzle: PuzzleJson;
        }): {pid: string; content: PuzzleJson; stats: {numSolves: number}} => {
          const content = convertOldFormatToIpuz(puzzle.puzzle);
          return {pid: puzzle.pid, content, stats: {numSolves: 0}};
        }
      );

      return {puzzles};
    },

    createPuzzle: async (request: any, _reply: any) => {
      logRequest(request);

      if (request.body.pid) {
        const pidValidation = validatePuzzleId(request.body.pid);
        if (!pidValidation.valid) {
          throw createHttpError(pidValidation.error || 'Invalid puzzle ID', 400);
        }
      }

      const pid = await fastify.repositories.puzzle.create(
        request.body.pid || '',
        request.body.puzzle,
        request.body.isPublic ?? false
      );
      return {pid};
    },

    getPuzzleById: async (request: any, _reply: any) => {
      logRequest(request);
      const {pid} = request.params;

      const pidValidation = validatePuzzleId(pid);
      if (!pidValidation.valid) {
        throw createHttpError(pidValidation.error || 'Invalid puzzle ID', 400);
      }

      try {
        const puzzle = await fastify.repositories.puzzle.findById(pidValidation.value!);
        return puzzle;
      } catch (error) {
        request.log.error(error, `Failed to get puzzle ${pidValidation.value}`);
        throw createHttpError('Puzzle not found', 404);
      }
    },

    // ========================================================================
    // Games
    // ========================================================================
    createGame: async (request: any, _reply: any) => {
      logRequest(request);

      const gidValidation = validateGameId(request.body.gid);
      if (!gidValidation.valid) {
        throw createHttpError(gidValidation.error || 'Invalid game ID', 400);
      }

      const pidValidation = validatePuzzleId(request.body.pid);
      if (!pidValidation.valid) {
        throw createHttpError(pidValidation.error || 'Invalid puzzle ID', 400);
      }

      let userId: string | null = null;
      const authResult = authenticateRequest({
        query: request.query as {userId?: string; token?: string} | undefined,
        headers: request.headers,
        body: request.body,
      });

      if (authResult.authenticated && isValidUserId(authResult.userId)) {
        userId = authResult.userId;
      } else if (config.auth.requireAuth) {
        const errorMessage =
          authResult.error ||
          'Authentication required. Provide a valid JWT token via Authorization header (Bearer <token>) or ?token= query parameter.';
        throw createHttpError(errorMessage, 401);
      }

      const gid = await fastify.repositories.game.createInitialEvent(
        gidValidation.value!,
        pidValidation.value!,
        userId
      );
      return {gid};
    },

    getGameById: async (request: any, _reply: any) => {
      logRequest(request);
      const {gid} = request.params;

      const gidValidation = validateGameId(gid);
      if (!gidValidation.valid) {
        throw createHttpError(gidValidation.error || 'Invalid game ID', 400);
      }

      const puzzleSolves = await getPuzzleSolves([gidValidation.value!]);

      if (puzzleSolves.length === 0) {
        throw createHttpError('Game not found', 404);
      }

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
    },

    getActiveGamePid: async (request: any, _reply: any) => {
      logRequest(request);
      const {gid} = request.params;

      const gidValidation = validateGameId(gid);
      if (!gidValidation.valid) {
        throw createHttpError(gidValidation.error || 'Invalid game ID', 400);
      }

      const {events} = await fastify.repositories.game.getEvents(gidValidation.value!, {limit: 1});
      const createEvent = events.find((e: {type: string}) => e.type === 'create');
      if (!createEvent || createEvent.type !== 'create') {
        throw createHttpError('Active game not found', 404);
      }

      const createParams = createEvent.params as {pid: string};
      const pid = createParams.pid;
      if (!pid) {
        throw createHttpError('Puzzle ID not found in game create event', 500);
      }

      return {gid, pid};
    },

    // ========================================================================
    // Record Solve
    // ========================================================================
    recordPuzzleSolve: async (request: any, _reply: any) => {
      await fastify.repositories.puzzle.recordSolve(
        request.params.pid,
        request.body.gid,
        request.body.time_to_solve
      );
      return {};
    },

    // ========================================================================
    // Stats
    // ========================================================================
    submitStats: async (request: any, _reply: any) => {
      const {gids} = request.body;
      const startTime = Date.now();

      if (!Array.isArray(gids) || !gids.every((it) => typeof it === 'string')) {
        throw createHttpError('gids are invalid', 400);
      }

      const puzzleSolves = await getPuzzleSolves(gids);
      const puzzleStats = computePuzzleStats(puzzleSolves);
      const stats = puzzleStats.map((stat) => ({
        size: stat.size,
        nPuzzlesSolved: stat.n_puzzles_solved,
        avgSolveTime: stat.avg_solve_time,
        bestSolveTime: stat.best_solve_time,
        bestSolveTimeGameId: stat.best_solve_time_game,
        avgCheckedSquareCount: stat.avg_checked_square_count,
        avgRevealedSquareCount: stat.avg_revealed_square_count,
      }));
      const history = puzzleSolves.map((solve) => {
        const date = solve.solved_time;
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const dateSolved = `${year}-${month}-${day}`;

        return {
          puzzleId: solve.pid,
          gameId: solve.gid,
          title: solve.title,
          size: solve.size,
          dateSolved,
          solveTime: solve.time_taken_to_solve,
          checkedSquareCount: solve.checked_squares_count,
          revealedSquareCount: solve.revealed_squares_count,
        };
      });

      const ms = Date.now() - startTime;
      request.log.info({duration: ms, count: puzzleSolves.length}, 'overall /api/stats');

      return {stats, history};
    },

    // ========================================================================
    // Counters
    // ========================================================================
    getNewGameId: async (request: any, _reply: any) => {
      request.log.debug('increment gid');
      const gid = await fastify.repositories.counters.getNextGameId();
      return {gid};
    },

    getNewPuzzleId: async (request: any, _reply: any) => {
      request.log.debug('increment pid');
      const pid = await fastify.repositories.counters.getNextPuzzleId();
      return {pid};
    },

    // ========================================================================
    // Link Preview / OEmbed
    // ========================================================================
    getOembed: (request: any, _reply: any) => {
      logRequest(request);
      const author = request.query.author;
      return {type: 'link', version: '1.0', author_name: author};
    },

    getLinkPreview: async (request: any, reply: any) => {
      logRequest(request);

      const url = validatePreviewUrl(request.query.url);

      let info: InfoJson | null = null;
      const pathParts = url.pathname.split('/');
      if (pathParts[1] === 'game') {
        const gid = pathParts[2];
        if (!gid) {
          throw createHttpError('Invalid URL path: missing game ID', 400);
        }
        info = (await fastify.repositories.game.getInfo(gid)) as InfoJson;
      } else if (pathParts[1] === 'play') {
        const pid = pathParts[2];
        if (!pid) {
          throw createHttpError('Invalid URL path: missing puzzle ID', 400);
        }
        info = (await fastify.services.puzzle.getPuzzleInfo(pid)) as InfoJson;
      } else {
        throw createHttpError('Invalid URL path', 400);
      }

      if (!info || Object.keys(info).length === 0) {
        throw createHttpError('Game or puzzle not found', 404);
      }

      const ua = request.headers['user-agent'] as string | undefined;

      if (!isLinkExpanderBot(ua)) {
        return reply.code(302).header('Location', url.href).send();
      }

      const host = request.headers.host || '';
      const author = info.author || '';
      const protocol = 'https';
      const oembedEndpointUrl = `${protocol}://${host}/api/oembed?author=${encodeURIComponent(author)}`;

      const titlePropContent = isFBMessengerCrawler(ua)
        ? [info.title, info.author, info.description].filter(Boolean).join(' | ')
        : info.title || '';

      const safeTitle = escapeHtml(titlePropContent || '');
      const safeDescription = escapeHtml(info.description || '');
      const safeUrl = escapeHtmlAttribute(url.href || '');
      const safeOembedUrl = escapeHtmlAttribute(oembedEndpointUrl);

      return reply.type('text/html').send(String.raw`
        <html prefix="og: https://ogp.me/ns/website#">
            <head>
                <title>${safeTitle}</title>
                <meta property="og:title" content="${safeTitle}" />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="${safeUrl}" />
                <meta property="og:description" content="${safeDescription}" />
                <meta property="og:site_name" content="${escapeHtmlAttribute(config.urls.siteName)}" />
                <link type="application/json+oembed" href="${safeOembedUrl}" />
                <meta name="theme-color" content="#6aa9f4">
            </head>
        </html>
      `);
    },
  };
}

export type Handlers = ReturnType<typeof createHandlers>;
