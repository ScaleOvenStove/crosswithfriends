/**
 * Script to remove puzzles with empty clues from the database
 */

import {config} from '../config/index.js';
import {createPool} from '../model/pool.js';
import {logger} from '../utils/logger.js';

async function removeBadPuzzles(): Promise<void> {
  const pool = createPool(config);
  try {
    // Find puzzles with empty clues
    // A puzzle is "bad" if:
    // 1. It has no clues object, OR
    // 2. It has clues but both Across and Down arrays are empty or missing
    const {rows} = await pool.query(`
      SELECT pid, content->'clues' as clues
      FROM puzzles
      WHERE 
        content->'clues' IS NULL
        OR (
          (content->'clues'->'Across' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'Across', '[]'::jsonb)) = 0)
          AND (content->'clues'->'Down' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'Down', '[]'::jsonb)) = 0)
          AND (content->'clues'->'across' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'across', '[]'::jsonb)) = 0)
          AND (content->'clues'->'down' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'down', '[]'::jsonb)) = 0)
        )
    `);

    if (rows.length === 0) {
      logger.info('No puzzles with empty clues found');
      return;
    }

    logger.info({count: rows.length}, `Found ${rows.length} puzzle(s) with empty clues`);

    // Show what will be deleted
    for (const row of rows) {
      logger.info({pid: row.pid, clues: row.clues}, `Will delete puzzle ${row.pid}`);
    }

    // Delete the puzzles
    const pids = rows.map((row) => row.pid);
    const placeholders = pids.map((_, i) => `$${i + 1}`).join(', ');

    const deleteResult = await pool.query(`DELETE FROM puzzles WHERE pid IN (${placeholders})`, pids);

    logger.info(
      {deletedCount: deleteResult.rowCount},
      `Successfully deleted ${deleteResult.rowCount} puzzle(s)`
    );
  } catch (error) {
    logger.error({error}, 'Failed to remove bad puzzles');
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
removeBadPuzzles()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error({error}, 'Script failed');
    process.exit(1);
  });
