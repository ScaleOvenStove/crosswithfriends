import path from 'path';
import {fileURLToPath} from 'url';

import * as dotenv from 'dotenv';
import {z} from 'zod';

// Load environment variables from .env files (development/test only)
const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);
const runtimeNodeEnv = process.env.NODE_ENV || 'development';
if (runtimeNodeEnv !== 'production') {
  dotenv.config(); // Try loading .env from current directory
  dotenv.config({path: path.resolve(currentDirname, '../../.env')}); // Try parent directory
}

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
    user: z.string().optional(),
    database: z.string().optional(),
    password: z.string().optional(),
    sslMode: z.enum(['disable', 'require']).default('disable'),
    useSSL: z.boolean(),
    isLocalhost: z.boolean(),
    // SSL certificate verification - should be true in production for security
    // Only set to false for development/testing with self-signed certs
    sslRejectUnauthorized: z.boolean(),
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

  // CORS configuration
  cors: z.object({
    enabled: z
      .union([z.boolean(), z.string()])
      .transform((val) => {
        if (typeof val === 'boolean') return val;
        return val?.toLowerCase() !== 'false';
      })
      .pipe(z.boolean())
      .default('true'),
    origins: z
      .string()
      .transform((val) =>
        val
          ? val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []
      )
      .pipe(z.array(z.string()))
      .default(''),
  }),

  // Authentication configuration
  auth: z.object({
    // JWT secret for signing tokens (required in production)
    tokenSecret: z.string().optional(),
    // Whether to require authentication for API endpoints
    // In development, this can be set to false for easier testing
    requireAuth: z.boolean(),
    // Token expiry in milliseconds (default: 24 hours)
    tokenExpiryMs: z.coerce.number().default(24 * 60 * 60 * 1000),
  }),

  // Firebase configuration
  firebase: z.object({
    // Path to Firebase credentials file
    credentialsPath: z.string().optional(),
    // Firebase credentials as JSON string
    credentialsJson: z.string().optional(),
    // Google application credentials path
    googleApplicationCredentials: z.string().optional(),
  }),

  // Feature flags
  features: z.object({
    // Enable Swagger UI documentation
    swaggerUi: z.boolean(),
  }),

  // Environment detection
  environment: z.object({
    // Explicit environment flag (development, staging, production)
    explicit: z.string().optional(),
    // Staging flag
    isStaging: z.boolean(),
    // Hostname (for environment detection)
    hostname: z.string().optional(),
  }),

  // Application URLs configuration
  urls: z.object({
    // Production API URL
    productionApi: z.string().default('https://www.crosswithfriends.com/api'),
    // Staging API URL
    stagingApi: z.string().default('https://crosswithfriendsbackend-staging.onrender.com/api'),
    // Production frontend URL
    productionFrontend: z.string().default('https://www.crosswithfriends.com'),
    // Alternative production frontend URL
    productionFrontendAlt: z.string().default('https://crosswithfriends.com'),
    // Staging frontend URL
    stagingFrontend: z.string().default('https://crosswithfriendsbackend-staging.onrender.com'),
    // Link preview API endpoint (for Vercel middleware)
    linkPreviewApi: z.string().default('https://downforacross-com.onrender.com/api/link_preview'),
    // Site name for Open Graph
    siteName: z.string().default('downforacross.com'),
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

  // SSL certificate verification: ALWAYS true in production, regardless of env var
  // SECURITY: In production, we enforce SSL verification to prevent MITM attacks
  // The env var PGSSL_REJECT_UNAUTHORIZED=false is only respected in non-production
  let sslRejectUnauthorized: boolean;
  if (nodeEnv === 'production') {
    // In production, ALWAYS verify SSL certificates
    if (process.env.PGSSL_REJECT_UNAUTHORIZED === 'false') {
      console.warn(
        'PGSSL_REJECT_UNAUTHORIZED=false is ignored in production. SSL certificate verification is enforced.'
      );
    }
    sslRejectUnauthorized = true;
  } else {
    // In development/test, allow disabling for self-signed certs
    sslRejectUnauthorized = process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false';
  }

  // Detect if running in staging environment
  const isStaging =
    process.env.ENVIRONMENT === 'staging' ||
    process.env.STAGING === 'true' ||
    process.env.STAGING === '1' ||
    (typeof process.env.HOSTNAME === 'string' && process.env.HOSTNAME.includes('staging'));

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
      sslRejectUnauthorized,
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
    cors: {
      enabled: process.env.CORS_ENABLED === 'true',
      origins: process.env.CORS_ORIGINS,
    },
    auth: {
      tokenSecret: process.env.AUTH_TOKEN_SECRET,
      // Require auth in production, optional in development/test
      requireAuth: nodeEnv === 'production' || process.env.REQUIRE_AUTH === 'true',
      tokenExpiryMs: process.env.AUTH_TOKEN_EXPIRY_MS,
    },
    firebase: {
      credentialsPath: process.env.FIREBASE_CREDENTIALS_PATH,
      credentialsJson: process.env.FIREBASE_CREDENTIALS_JSON,
      googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    },
    features: {
      swaggerUi: !nodeEnv || nodeEnv !== 'production' || process.env.ENABLE_SWAGGER_UI === 'true',
    },
    environment: {
      explicit: process.env.ENVIRONMENT,
      isStaging,
      hostname: process.env.HOSTNAME,
    },
    urls: {
      productionApi: process.env.PRODUCTION_API_URL,
      stagingApi: process.env.STAGING_API_URL,
      productionFrontend: process.env.PRODUCTION_FRONTEND_URL,
      productionFrontendAlt: process.env.PRODUCTION_FRONTEND_ALT_URL,
      stagingFrontend: process.env.STAGING_FRONTEND_URL,
      linkPreviewApi: process.env.LINK_PREVIEW_API_URL,
      siteName: process.env.SITE_NAME,
    },
  };

  try {
    const validated = configSchema.parse(rawConfig);

    // Validate that either connectionString OR (user and database) are provided
    if (!validated.database.connectionString) {
      if (!validated.database.user || !validated.database.database) {
        throw new Error(
          'Database configuration error: Either DATABASE_URL must be set, or both PGUSER and PGDATABASE must be set'
        );
      }
    }

    console.info(
      {
        nodeEnv: validated.server.nodeEnv,
        port: validated.server.port,
        dbHost: validated.database.host,
        dbName: validated.database.database || 'from DATABASE_URL',
        dbUser: validated.database.user || 'from DATABASE_URL',
        dbUseSSL: validated.database.useSSL,
        dbSslRejectUnauthorized: validated.database.sslRejectUnauthorized,
        poolMax: validated.database.pool.max,
        poolMin: validated.database.pool.min,
        usingConnectionString: !!validated.database.connectionString,
      },
      'Configuration loaded and validated'
    );
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error({errors: error.issues}, 'Configuration validation failed');
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
