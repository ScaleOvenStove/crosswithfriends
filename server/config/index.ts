import path from 'path';
import {fileURLToPath} from 'url';

import * as dotenv from 'dotenv';
import {z} from 'zod';

import {logger} from '../utils/logger.js';

// Load environment variables from .env files
const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);
dotenv.config(); // Try loading .env from current directory
dotenv.config({path: path.resolve(currentDirname, '../../.env')}); // Try parent directory

// Configuration schema with validation and defaults
const configSchema = z.object({
  // Server configuration
  server: z.object({
    port: z.coerce.number().default(3000),
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
    isProduction: z.boolean(),
    isDevelopment: z.boolean(),
    isTest: z.boolean(),
  }),

  // Database configuration
  database: z.object({
    host: z.string().default('localhost'),
    user: z.string(),
    database: z.string(),
    password: z.string().optional(),
    sslMode: z.enum(['disable', 'require']).default('disable'),
    useSSL: z.boolean(),
    isLocalhost: z.boolean(),
    // Connection string (overrides individual params if provided)
    connectionString: z.string().optional(),
    // Pool configuration
    pool: z.object({
      max: z.coerce.number().min(1).max(100).default(20),
      min: z.coerce.number().min(0).max(50).default(5),
      idleTimeoutMillis: z.coerce.number().default(30000),
      connectionTimeoutMillis: z.coerce.number().default(10000),
      statementTimeout: z.coerce.number().default(30000),
    }),
  }),

  // Rate limiting configuration
  rateLimit: z.object({
    max: z.coerce.number().default(1000),
    timeWindowMs: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  }),
});

type Config = z.infer<typeof configSchema>;

/**
 * Build and validate configuration from environment variables
 */
function buildConfig(): Config {
  const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  const host = process.env.PGHOST || 'localhost';
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  const sslMode = process.env.PGSSLMODE === 'require' ? 'require' : 'disable';
  const useSSL = sslMode === 'require' && !isLocalhost;

  const rawConfig = {
    server: {
      port: process.env.PORT,
      nodeEnv,
      isProduction: nodeEnv === 'production',
      isDevelopment: nodeEnv === 'development',
      isTest: nodeEnv === 'test',
    },
    database: {
      host,
      user: process.env.PGUSER || process.env.USER,
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      sslMode,
      useSSL,
      isLocalhost,
      connectionString: process.env.DATABASE_URL,
      pool: {
        max: process.env.PGPOOL_MAX,
        min: process.env.PGPOOL_MIN,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statementTimeout: 30000,
      },
    },
    rateLimit: {
      max: process.env.RATE_LIMIT_MAX,
      timeWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
    },
  };

  try {
    const validated = configSchema.parse(rawConfig);
    logger.info(
      {
        nodeEnv: validated.server.nodeEnv,
        port: validated.server.port,
        dbHost: validated.database.host,
        dbName: validated.database.database,
        dbUser: validated.database.user,
        dbUseSSL: validated.database.useSSL,
        poolMax: validated.database.pool.max,
        poolMin: validated.database.pool.min,
      },
      'Configuration loaded and validated'
    );
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error({errors: error.issues}, 'Configuration validation failed');
      throw new Error(
        `Invalid configuration: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    throw error;
  }
}

// Export singleton config instance
export const config = buildConfig();

// Export types
export type {Config};
