/**
 * Error Sanitization Utilities
 *
 * Provides error sanitization to prevent information disclosure in production.
 * Ensures that error messages returned to clients don't reveal internal details.
 */

import {config} from '../config/index.js';

import {logger} from './logger.js';

/**
 * Patterns that indicate sensitive information that should be sanitized
 */
const SENSITIVE_PATTERNS = [
  // File paths
  /\/[a-zA-Z0-9_/-]+\.(ts|js|json|mjs|cjs|tsx|jsx)/gi,
  // Stack traces
  /at\s+[\w.<>]+\s+\(.*:\d+:\d+\)/gi,
  /^\s*at\s+/gim,
  // Database connection details
  /postgres(?:ql)?:\/\/[^@\s]+@[^\s]+/gi,
  /(?:host|server|database|password|user)=[^\s&]+/gi,
  // IP addresses (except localhost references)
  /\b(?!127\.0\.0\.1|localhost)(?:\d{1,3}\.){3}\d{1,3}\b/g,
  // Environment variable values (when leaked)
  /process\.env\.[A-Z_]+/gi,
  // Internal class/function names that might reveal architecture
  /(?:Repository|Service|Manager|Controller|Handler)\./gi,
];

/**
 * Known safe error messages that can be returned as-is
 */
const SAFE_ERROR_MESSAGES = new Set([
  'Validation error',
  'Authentication required',
  'Invalid credentials',
  'Not found',
  'Access denied',
  'Rate limit exceeded',
  'Invalid request',
  'Bad request',
  'Unauthorized',
  'Forbidden',
  'Internal server error',
  'Service unavailable',
  'Game not found',
  'Room not found',
  'Puzzle not found',
  'Invalid game ID',
  'Invalid room ID',
  'Invalid puzzle ID',
  'Invalid user ID',
  'Token expired',
  'Invalid token',
]);

/**
 * Generic error messages for different HTTP status codes
 */
const GENERIC_ERROR_MESSAGES: Record<number, string> = {
  400: 'Invalid request',
  401: 'Authentication required',
  403: 'Access denied',
  404: 'Resource not found',
  409: 'Conflict',
  422: 'Unprocessable entity',
  429: 'Rate limit exceeded',
  500: 'Internal server error',
  502: 'Bad gateway',
  503: 'Service unavailable',
  504: 'Gateway timeout',
};

/**
 * Checks if an error message is safe to expose to clients
 * @param message - The error message to check
 * @returns true if the message is safe
 */
export function isSafeErrorMessage(message: string): boolean {
  if (!message) return false;

  const lowerMessage = message.toLowerCase().trim();

  // Check against known safe messages
  for (const safe of SAFE_ERROR_MESSAGES) {
    if (lowerMessage === safe.toLowerCase()) {
      return true;
    }
  }

  // Check for sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(message)) {
      return false;
    }
  }

  // Check message length - very long messages might contain stack traces
  if (message.length > 200) {
    return false;
  }

  // Check for common indicators of internal errors
  const unsafeIndicators = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'socket hang up',
    'Cannot read property',
    'Cannot read properties',
    'undefined is not',
    'null is not',
    'is not a function',
    'is not defined',
    'Unexpected token',
    'SyntaxError',
    'TypeError',
    'ReferenceError',
    'RangeError',
    'column',
    'row',
    'constraint',
    'duplicate key',
    'violates',
    'relation',
    'SQLSTATE',
  ];

  for (const indicator of unsafeIndicators) {
    if (message.toLowerCase().includes(indicator.toLowerCase())) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitizes an error message for client consumption
 * @param message - The original error message
 * @param statusCode - The HTTP status code
 * @returns A safe error message
 */
export function sanitizeErrorMessage(message: string | undefined, statusCode: number): string {
  // In development, allow more detailed messages
  if (config.server.isDevelopment) {
    return message || GENERIC_ERROR_MESSAGES[statusCode] || 'An error occurred';
  }

  // If no message, use generic
  if (!message) {
    return GENERIC_ERROR_MESSAGES[statusCode] || 'An error occurred';
  }

  // If message is safe, return it
  if (isSafeErrorMessage(message)) {
    return message;
  }

  // Log the original message for debugging (only in production)
  logger.debug({originalMessage: message, statusCode}, 'Sanitized error message');

  // Return generic message based on status code
  return GENERIC_ERROR_MESSAGES[statusCode] || 'An error occurred';
}

/**
 * Sanitizes validation errors for client consumption
 * In production, we strip detailed field information that could reveal schema structure
 * @param validation - The validation error details
 * @returns Sanitized validation details or undefined
 */
export function sanitizeValidationErrors(
  validation: Array<{instancePath?: string; message?: string; keyword?: string}> | undefined
): Array<{field?: string; message: string}> | undefined {
  if (!validation || validation.length === 0) {
    return undefined;
  }

  // In development, return more details (but still sanitized)
  if (config.server.isDevelopment) {
    return validation.map((v) => ({
      field: v.instancePath?.replace(/^\//, '').replace(/\//g, '.') || undefined,
      message: v.message || 'Invalid value',
    }));
  }

  // In production, return minimal information
  // Just indicate that there's a validation error without revealing schema details
  return validation.slice(0, 5).map((v) => ({
    field: v.instancePath ? sanitizeFieldPath(v.instancePath) : undefined,
    message: sanitizeValidationMessage(v.message, v.keyword),
  }));
}

/**
 * Sanitizes a field path to prevent schema disclosure
 */
function sanitizeFieldPath(path: string): string {
  // Remove leading slash and convert to dot notation
  const cleanPath = path.replace(/^\//, '').replace(/\//g, '.');

  // Only return top-level field name
  const parts = cleanPath.split('.');
  return parts[0] || 'field';
}

/**
 * Sanitizes a validation message
 */
function sanitizeValidationMessage(message: string | undefined, keyword: string | undefined): string {
  // Map validation keywords to generic messages
  const keywordMessages: Record<string, string> = {
    required: 'This field is required',
    type: 'Invalid type',
    minLength: 'Value is too short',
    maxLength: 'Value is too long',
    minimum: 'Value is too small',
    maximum: 'Value is too large',
    pattern: 'Invalid format',
    format: 'Invalid format',
    enum: 'Invalid value',
    additionalProperties: 'Unknown field',
  };

  if (keyword && keywordMessages[keyword]) {
    return keywordMessages[keyword];
  }

  if (message && message.length < 50 && !SENSITIVE_PATTERNS.some((p) => p.test(message))) {
    return message;
  }

  return 'Invalid value';
}

/**
 * Creates a sanitized error response object
 * @param statusCode - HTTP status code
 * @param error - Error name
 * @param message - Error message (will be sanitized)
 * @param validation - Optional validation errors
 */
export function createSanitizedErrorResponse(
  statusCode: number,
  error: string,
  message?: string,
  validation?: Array<{instancePath?: string; message?: string; keyword?: string}>
): {
  statusCode: number;
  error: string;
  message: string;
  validation?: Array<{field?: string; message: string}>;
} {
  const response: {
    statusCode: number;
    error: string;
    message: string;
    validation?: Array<{field?: string; message: string}>;
  } = {
    statusCode,
    error,
    message: sanitizeErrorMessage(message, statusCode),
  };

  if (validation) {
    const sanitizedValidation = sanitizeValidationErrors(validation);
    if (sanitizedValidation && sanitizedValidation.length > 0) {
      response.validation = sanitizedValidation;
    }
  }

  return response;
}
