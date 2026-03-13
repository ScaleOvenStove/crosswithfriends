import {ListPuzzleResponse, ListPuzzleRequestFilters} from '@shared/types';
import express from 'express';
import _ from 'lodash';
import {listPuzzles} from '../model/puzzle';
import {optionalAuth} from '../auth/middleware';

const router = express.Router();

/**
 * @openapi
 * /puzzle_list:
 *   get:
 *     tags: [Puzzles]
 *     summary: List puzzles
 *     description: Returns a paginated list of puzzles with optional filters for size, type, day of week, and name/title search.
 *     parameters:
 *       - in: query
 *         name: page
 *         required: true
 *         schema: {type: integer}
 *         description: Zero-based page index
 *       - in: query
 *         name: pageSize
 *         required: true
 *         schema: {type: integer}
 *         description: Number of puzzles per page
 *       - in: query
 *         name: filter
 *         schema: {type: object}
 *         style: deepObject
 *         description: Nested filter object with sizeFilter, typeFilter, dayOfWeekFilter, nameOrTitleFilter
 *     responses:
 *       200:
 *         description: Paginated puzzle list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 puzzles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       pid: {type: string}
 *                       content: {type: object}
 *                       stats:
 *                         type: object
 *                         properties:
 *                           numSolves: {type: integer}
 *                       isPublic: {type: boolean}
 *       400: {description: Invalid page/pageSize}
 */
router.get<{}, ListPuzzleResponse>('/', optionalAuth, async (req, res, next) => {
  try {
    const page = Number.parseInt(req.query.page as string, 10);
    const pageSize = Number.parseInt(req.query.pageSize as string, 10);
    const rawFilters = req.query.filter as any;
    const filters: ListPuzzleRequestFilters = {
      sizeFilter: {
        Mini: rawFilters?.sizeFilter?.Mini === 'true',
        Midi: rawFilters?.sizeFilter?.Midi !== 'false',
        Standard: rawFilters?.sizeFilter?.Standard === 'true',
        Large: rawFilters?.sizeFilter?.Large !== 'false',
      },
      nameOrTitleFilter: (rawFilters?.nameOrTitleFilter as string) || '',
      typeFilter: {
        Standard: rawFilters?.typeFilter?.Standard !== 'false',
        Cryptic: rawFilters?.typeFilter?.Cryptic !== 'false',
        Contest: rawFilters?.typeFilter?.Contest !== 'false',
      },
      dayOfWeekFilter: {
        Mon: rawFilters?.dayOfWeekFilter?.Mon !== 'false',
        Tue: rawFilters?.dayOfWeekFilter?.Tue !== 'false',
        Wed: rawFilters?.dayOfWeekFilter?.Wed !== 'false',
        Thu: rawFilters?.dayOfWeekFilter?.Thu !== 'false',
        Fri: rawFilters?.dayOfWeekFilter?.Fri !== 'false',
        Sat: rawFilters?.dayOfWeekFilter?.Sat !== 'false',
        Sun: rawFilters?.dayOfWeekFilter?.Sun !== 'false',
        Unknown: rawFilters?.dayOfWeekFilter?.Unknown !== 'false',
      },
    };
    if (!(Number.isFinite(page) && Number.isFinite(pageSize))) {
      return next(_.assign(new Error('page and pageSize should be integers'), {statusCode: 400}));
    }
    const rawPuzzleList = await listPuzzles(filters, pageSize, page * pageSize, req.authUser?.userId);
    const puzzles = rawPuzzleList.map((puzzle) => ({
      pid: puzzle.pid,
      content: puzzle.content,
      stats: {numSolves: puzzle.times_solved},
      isPublic: puzzle.is_public,
    }));
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({
      puzzles,
    });
  } catch (err) {
    next(err);
  }
  return undefined;
});

export default router;
