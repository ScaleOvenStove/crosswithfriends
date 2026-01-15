/**
 * Environment variable types for 12-factor app configuration
 * All configuration should flow through the config module using these types
 */

/**
 * Environment variable interface
 * Represents all environment variables used by the application
 */
export interface EnvironmentVariables {
  // Node environment
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: string;

  // Database configuration
  DATABASE_URL?: string;
  PGHOST?: string;
  PGPORT?: string;
  PGUSER?: string;
  PGPASSWORD?: string;
  PGDATABASE?: string;
  PGSSLMODE?: 'disable' | 'require';
  PGSSL_REJECT_UNAUTHORIZED?: string;
  PGPOOL_MAX?: string;
  PGPOOL_MIN?: string;

  // Authentication
  AUTH_TOKEN_SECRET?: string;
  AUTH_TOKEN_EXPIRY_MS?: string;
  REQUIRE_AUTH?: string;

  // Firebase
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  FIREBASE_SERVICE_ACCOUNT?: string;

  // Rate limiting
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW_MS?: string;

  // CORS
  CORS_ORIGINS?: string;
  DISABLE_CORS?: string;

  // URLs
  PRODUCTION_API_URL?: string;
  STAGING_API_URL?: string;
  PRODUCTION_FRONTEND_URL?: string;
  PRODUCTION_FRONTEND_ALT_URL?: string;
  STAGING_FRONTEND_URL?: string;
  LINK_PREVIEW_API_URL?: string;
  SITE_NAME?: string;

  // Feature flags
  ENABLE_SWAGGER_UI?: string;
}

/**
 * Helper type for required environment variables
 */
export type RequiredEnvVars = Pick<EnvironmentVariables, 'NODE_ENV' | 'PORT'>;

/**
 * Validates and parses an environment variable as a number
 */
export function parseEnvNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return parsed;
}

/**
 * Validates and parses an environment variable as a boolean
 */
export function parseEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Throws an error if a required environment variable is missing
 */
export function requireEnv(key: keyof EnvironmentVariables, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Please set ${key} in your environment or .env file.`
    );
  }
  return value;
}
