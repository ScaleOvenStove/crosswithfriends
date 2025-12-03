#!/usr/bin/env tsx
/**
 * Migration checker tool
 *
 * Checks if the database has all required migrations applied.
 * Exits with code 0 if up to date, 1 if migrations are missing.
 *
 * Usage:
 *   yarn check-migrations
 *   yarn check-migrations --apply  # Apply missing migrations
 */

/* eslint-disable no-console */

import {pool} from '../model/pool.js';
import {logger} from '../utils/logger.js';
import {applyMissingMigrations, checkMigrationStatus} from '../utils/migrations.js';

async function main(): Promise<void> {
  const shouldApply = process.argv.includes('--apply');

  try {
    const status = await checkMigrationStatus();

    console.log('\n📊 Migration Status:\n');
    console.log('Migration Name'.padEnd(40) + 'Status'.padEnd(15) + 'Applied At');
    console.log('-'.repeat(80));

    for (const migration of status.allMigrations) {
      const statusText = migration.applied ? '✅ Applied' : '❌ Missing';
      const appliedAt = migration.appliedAt ? migration.appliedAt.toISOString() : '-';
      console.log(migration.migrationName.padEnd(40) + statusText.padEnd(15) + appliedAt);
    }

    console.log('-'.repeat(80));
    console.log(
      `\nTotal: ${status.allMigrations.length} migrations, ${status.missingMigrations.length} missing\n`
    );

    if (status.upToDate) {
      console.log('✅ Database is up to date with all migrations!\n');
      process.exit(0);
    } else {
      console.log(`⚠️  Missing ${status.missingMigrations.length} migration(s):\n`);
      for (const missing of status.missingMigrations) {
        console.log(`   - ${missing}`);
      }
      console.log('');

      if (shouldApply) {
        console.log('Applying missing migrations...\n');
        await applyMissingMigrations();
        console.log('✅ All migrations applied successfully!\n');
        process.exit(0);
      } else {
        console.log('💡 Run with --apply flag to automatically apply missing migrations:\n');
        console.log('   yarn check-migrations --apply\n');
        process.exit(1);
      }
    }
  } catch (error) {
    logger.error({err: error}, 'Failed to check migrations');
    console.error('\n❌ Error checking migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();
