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

import 'dotenv-flow/config';
import {config} from '../config/index.js';
import {createPool} from '../model/pool.js';
import {logger} from '../utils/logger.js';
import {applyMissingMigrations, checkMigrationStatus} from '../utils/migrations.js';

async function main(): Promise<void> {
  const shouldApply = process.argv.includes('--apply');

  // Check database connection configuration
  const dbConfig = {
    host: config.database.host,
    user: config.database.user || 'unknown',
    database: config.database.database || 'unknown',
    hasPassword: !!config.database.password,
    hasDatabaseUrl: !!config.database.connectionString,
  };

  console.log('\n🔍 Database Configuration:');
  console.log(`   Host: ${dbConfig.host}`);
  console.log(`   User: ${dbConfig.user}`);
  console.log(`   Database: ${dbConfig.database}`);
  console.log(`   Password set: ${dbConfig.hasPassword ? '✅' : '❌'}`);
  console.log(`   DATABASE_URL set: ${dbConfig.hasDatabaseUrl ? '✅' : '❌'}`);

  // Check if connecting to Docker PostgreSQL
  if (dbConfig.host === 'localhost' && dbConfig.database === 'crosswithfriends') {
    console.log('\n💡 Detected Docker PostgreSQL configuration');
    console.log('   Default Docker password: "postgres"');
    console.log('   If password fails, check docker-compose.yml POSTGRES_PASSWORD');
  }
  console.log('');

  if (!dbConfig.hasPassword && !dbConfig.hasDatabaseUrl) {
    console.error('❌ Error: Database password not configured!');
    console.error('   Set PGPASSWORD environment variable or use DATABASE_URL');
    console.error('   Example: export PGPASSWORD=your_password');
    console.error('   Or source the .envrc file: source .envrc (from project root)');
    process.exit(1);
  }

  const pool = createPool(config);
  try {
    const status = await checkMigrationStatus(pool);

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
        await applyMissingMigrations(pool);
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

    // Provide helpful error messages for common issues
    if (error && typeof error === 'object' && 'code' in error) {
      const err = error as {code?: string; message?: string};
      if (err.code === '28P01') {
        console.error('\n💡 Authentication failed. Possible solutions:');
        console.error('   1. Check that PGPASSWORD is set correctly');
        console.error('   2. Verify the password matches your PostgreSQL user');
        console.error('   3. Source .envrc from project root: cd ../.. && source .envrc');
        console.error('   4. Or set DATABASE_URL with full connection string');
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        console.error('\n💡 Connection refused. Possible solutions:');
        console.error('   1. Ensure PostgreSQL is running');
        console.error('   2. Check PGHOST is correct (default: localhost)');
        console.error('   3. Verify PGPORT if using non-standard port');
      } else if (err.code === '3D000') {
        console.error('\n💡 Database does not exist. Possible solutions:');
        console.error('   1. Create the database: createdb ' + dbConfig.database);
        console.error('   2. Or set PGDATABASE to an existing database');
      }
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();
