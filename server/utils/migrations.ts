import {createHash} from 'crypto';
import {readdir, readFile} from 'fs/promises';
import {join} from 'path';

import {pool} from '../model/pool.js';

import {logger} from './logger.js';

export interface MigrationStatus {
  migrationName: string;
  applied: boolean;
  appliedAt?: Date;
  checksum?: string;
}

/**
 * Get the list of migration files from the migrations directory
 */
export async function getMigrationFiles(): Promise<string[]> {
  const migrationsDir = join(process.cwd(), 'migrations');
  const files = await readdir(migrationsDir);
  return files.filter((file) => file.endsWith('.sql')).sort(); // Sort to ensure consistent ordering
}

/**
 * Calculate checksum of a migration file
 */
export async function calculateMigrationChecksum(migrationPath: string): Promise<string> {
  const content = await readFile(migrationPath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get migrations that have been applied to the database
 */
export async function getAppliedMigrations(): Promise<Map<string, {appliedAt: Date; checksum?: string}>> {
  // First, ensure the schema_migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations
    (
        migration_name text PRIMARY KEY,
        applied_at timestamp without time zone DEFAULT now() NOT NULL,
        checksum text
    )
  `);

  const result = await pool.query<{
    migration_name: string;
    applied_at: Date;
    checksum: string | null;
  }>(`
    SELECT migration_name, applied_at, checksum
    FROM schema_migrations
    ORDER BY migration_name
  `);

  const applied = new Map<string, {appliedAt: Date; checksum?: string}>();
  for (const row of result.rows) {
    applied.set(row.migration_name, {
      appliedAt: row.applied_at,
      checksum: row.checksum || undefined,
    });
  }

  return applied;
}

/**
 * Check migration status - returns which migrations are applied and which are missing
 */
export async function checkMigrationStatus(): Promise<{
  allMigrations: MigrationStatus[];
  missingMigrations: string[];
  upToDate: boolean;
}> {
  const migrationFiles = await getMigrationFiles();
  const appliedMigrations = await getAppliedMigrations();
  const migrationsDir = join(process.cwd(), 'migrations');

  const allMigrations: MigrationStatus[] = [];
  const missingMigrations: string[] = [];

  for (const migrationFile of migrationFiles) {
    const applied = appliedMigrations.get(migrationFile);
    const migrationPath = join(migrationsDir, migrationFile);

    let checksum: string | undefined;
    try {
      // eslint-disable-next-line no-await-in-loop
      checksum = await calculateMigrationChecksum(migrationPath);
    } catch (error) {
      logger.warn({err: error, migrationFile}, 'Failed to calculate checksum');
    }

    const status: MigrationStatus = {
      migrationName: migrationFile,
      applied: !!applied,
      appliedAt: applied?.appliedAt,
      checksum,
    };

    allMigrations.push(status);

    if (!applied) {
      missingMigrations.push(migrationFile);
    } else if (applied.checksum && checksum && applied.checksum !== checksum) {
      logger.warn(
        {migrationFile, dbChecksum: applied.checksum, fileChecksum: checksum},
        'Migration file checksum mismatch - file may have been modified after application'
      );
    }
  }

  return {
    allMigrations,
    missingMigrations,
    upToDate: missingMigrations.length === 0,
  };
}

/**
 * Apply a single migration file
 */
export async function applyMigration(migrationFile: string): Promise<void> {
  const migrationsDir = join(process.cwd(), 'migrations');
  const migrationPath = join(migrationsDir, migrationFile);

  logger.info({migrationFile}, 'Applying migration');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Read and execute the migration SQL
    const sql = await readFile(migrationPath, 'utf-8');
    await client.query(sql);

    // Calculate checksum
    const checksum = await calculateMigrationChecksum(migrationPath);

    // Record the migration
    await client.query(
      `INSERT INTO schema_migrations (migration_name, checksum)
       VALUES ($1, $2)
       ON CONFLICT (migration_name) DO NOTHING`,
      [migrationFile, checksum]
    );

    await client.query('COMMIT');
    logger.info({migrationFile}, 'Migration applied successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({err: error, migrationFile}, 'Failed to apply migration');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Apply all missing migrations
 */
export async function applyMissingMigrations(): Promise<void> {
  const status = await checkMigrationStatus();

  if (status.upToDate) {
    logger.info('All migrations are up to date');
    return;
  }

  logger.info({count: status.missingMigrations.length}, 'Applying missing migrations');

  // Migrations must be applied sequentially to maintain order dependencies
  for (const migrationFile of status.missingMigrations) {
    // eslint-disable-next-line no-await-in-loop
    await applyMigration(migrationFile);
  }

  logger.info('All migrations applied successfully');
}
