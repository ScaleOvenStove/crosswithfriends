/**
 * Security Validation Utilities
 *
 * Provides startup validation to ensure secure configuration in production.
 * Prevents development mode security bypasses from running in production.
 */

import {config} from '../config/index.js';

import {logger} from './logger.js';

export interface SecurityIssue {
  severity: 'critical' | 'warning';
  message: string;
  recommendation: string;
}

/**
 * Detects if the current environment is staging
 * Staging uses NODE_ENV=production but should have more lenient security requirements
 */
function isStaging(): boolean {
  return config.environment.isStaging;
}

/**
 * Validates security configuration for production deployment
 * @returns Array of security issues found
 */
export function validateSecurityConfig(): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  const isStagingEnv = isStaging();

  if (config.server.isProduction) {
    // In staging, these are warnings; in production, they're critical
    const authSeverity = isStagingEnv ? 'warning' : 'critical';

    // AUTH_TOKEN_SECRET must be set in production (warning in staging)
    if (!config.auth.tokenSecret || config.auth.tokenSecret.length < 32) {
      issues.push({
        severity: authSeverity,
        message: 'AUTH_TOKEN_SECRET is not set or is too short (minimum 32 characters)',
        recommendation: 'Set AUTH_TOKEN_SECRET environment variable with a strong secret',
      });
    }

    // REQUIRE_AUTH validation removed - config module now enforces requireAuth=true in production
    // regardless of REQUIRE_AUTH env var value, making explicit env var check redundant

    // Note: SSL certificate validation is now enforced in production via config
    // This check is kept for documentation purposes but should never trigger
    // since the config module now ignores PGSSL_REJECT_UNAUTHORIZED in production
    if (config.database.useSSL && !config.database.sslRejectUnauthorized) {
      issues.push({
        severity: 'critical',
        message: 'SSL certificate validation is disabled in production (this should not happen)',
        recommendation: 'Check config/index.ts - SSL verification should be enforced in production',
      });
    }

    // Warning: Firebase Admin should be configured for production
    if (
      !config.firebase.credentialsPath &&
      !config.firebase.credentialsJson &&
      !config.firebase.googleApplicationCredentials
    ) {
      issues.push({
        severity: 'warning',
        message: 'Firebase Admin credentials are not configured',
        recommendation:
          'Set FIREBASE_CREDENTIALS_PATH, FIREBASE_CREDENTIALS_JSON, or GOOGLE_APPLICATION_CREDENTIALS',
      });
    }

    // Warning: CORS origins should be configured for production
    if (config.cors.origins.length === 0) {
      issues.push({
        severity: 'warning',
        message: 'CORS origins are not explicitly configured',
        recommendation: 'Set CORS_ORIGINS environment variable with allowed domains',
      });
    }
  } else {
    // Development mode warnings
    if (!config.auth.requireAuth) {
      issues.push({
        severity: 'warning',
        message: 'Authentication is not required (development mode)',
        recommendation: 'This is acceptable for development but ensure REQUIRE_AUTH=true in production',
      });
    }
  }

  return issues;
}

/**
 * Runs security validation and logs/throws based on severity
 * @throws Error if critical security issues are found in production
 */
export function runSecurityValidation(): void {
  const issues = validateSecurityConfig();

  if (issues.length === 0) {
    logger.info('Security validation passed');
    return;
  }

  const criticalIssues = issues.filter((i) => i.severity === 'critical');
  const warnings = issues.filter((i) => i.severity === 'warning');

  // Log warnings
  for (const warning of warnings) {
    logger.warn({issue: warning.message, recommendation: warning.recommendation}, 'Security warning');
  }

  // Handle critical issues
  if (criticalIssues.length > 0) {
    for (const critical of criticalIssues) {
      logger.error(
        {issue: critical.message, recommendation: critical.recommendation},
        'CRITICAL SECURITY ISSUE'
      );
    }

    const isStagingEnv = isStaging();

    // In staging, allow startup with warnings; in production, block startup
    if (config.server.isProduction && !isStagingEnv) {
      throw new Error(
        `Critical security issues found in production configuration: ${criticalIssues.map((i) => i.message).join('; ')}`
      );
    } else {
      logger.warn(
        `Critical security issues found but allowing startup${isStagingEnv ? ' in staging mode' : ' in non-production mode'}. ` +
          'These MUST be resolved before deploying to production.'
      );
    }
  }
}

/**
 * Checks if the current environment is safe for insecure operations
 * Use this instead of direct NODE_ENV checks for security-sensitive code
 * @returns true only if in development or test AND not in production
 */
export function isInsecureModeAllowed(): boolean {
  // Explicitly check server config and auth requirements
  return !config.server.isProduction && !config.auth.requireAuth;
}
