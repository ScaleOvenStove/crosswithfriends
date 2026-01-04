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
 * Validates security configuration for production deployment
 * @returns Array of security issues found
 */
export function validateSecurityConfig(): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  if (config.server.isProduction) {
    // Critical: AUTH_TOKEN_SECRET must be set in production
    if (!process.env.AUTH_TOKEN_SECRET || process.env.AUTH_TOKEN_SECRET.length < 32) {
      issues.push({
        severity: 'critical',
        message: 'AUTH_TOKEN_SECRET is not set or is too short (minimum 32 characters)',
        recommendation: 'Set AUTH_TOKEN_SECRET environment variable with a strong secret',
      });
    }

    // Critical: REQUIRE_AUTH must not be explicitly set to false in production
    if (process.env.REQUIRE_AUTH === 'false') {
      issues.push({
        severity: 'critical',
        message: 'REQUIRE_AUTH is explicitly set to false in production',
        recommendation: 'Remove REQUIRE_AUTH=false or set it to true for production',
      });
    }

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
      !process.env.FIREBASE_CREDENTIALS_PATH &&
      !process.env.FIREBASE_CREDENTIALS_JSON &&
      !process.env.GOOGLE_APPLICATION_CREDENTIALS
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

    if (config.server.isProduction) {
      throw new Error(
        `Critical security issues found in production configuration: ${criticalIssues.map((i) => i.message).join('; ')}`
      );
    } else {
      logger.warn(
        'Critical security issues found but allowing startup in non-production mode. ' +
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
  // Explicitly check NODE_ENV is not production AND server config agrees
  return (
    process.env.NODE_ENV !== 'production' &&
    !config.server.isProduction &&
    process.env.REQUIRE_AUTH !== 'true'
  );
}
