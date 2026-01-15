/**
 * Type guard functions for runtime type validation
 * These functions provide type-safe alternatives to type assertions (as keyword)
 */

import type {JwtPayload} from './auth.js';

// ============================================================================
// Primitive Type Guards
// ============================================================================

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// ============================================================================
// Auth Type Guards
// ============================================================================

export function isJwtPayload(obj: unknown): obj is JwtPayload {
  return (
    isObject(obj) &&
    'userId' in obj &&
    isString(obj.userId) &&
    obj.userId.length > 0 &&
    obj.userId.length <= 200
  );
}

// ============================================================================
// Request Body Type Guards
// ============================================================================

export function hasUserId(obj: unknown): obj is {userId: string} {
  return isObject(obj) && 'userId' in obj && isString(obj.userId);
}

export function hasToken(obj: unknown): obj is {token: string} {
  return isObject(obj) && 'token' in obj && isString(obj.token);
}

export function hasFirebaseToken(obj: unknown): obj is {firebaseToken: string} {
  return isObject(obj) && 'firebaseToken' in obj && isString(obj.firebaseToken);
}

export function hasGameIds(obj: unknown): obj is {gid: string; pid: string} {
  return isObject(obj) && 'gid' in obj && isString(obj.gid) && 'pid' in obj && isString(obj.pid);
}

// ============================================================================
// Database Result Type Guards
// ============================================================================

export function isGameRow(obj: unknown): obj is {gid: string; pid: string} {
  return isObject(obj) && 'gid' in obj && isString(obj.gid) && 'pid' in obj && isString(obj.pid);
}

export function isPuzzleRow(obj: unknown): obj is {pid: string; puzzle: unknown} {
  return isObject(obj) && 'pid' in obj && isString(obj.pid) && 'puzzle' in obj;
}

// ============================================================================
// Socket Event Type Guards
// ============================================================================

export interface SocketEventBase {
  type: string;
  timestamp?: number;
}

export function isSocketEvent(obj: unknown): obj is SocketEventBase {
  return isObject(obj) && 'type' in obj && isString(obj.type);
}

export function hasEventData<T extends Record<string, unknown>>(
  obj: unknown,
  requiredKeys: (keyof T)[]
): obj is T {
  if (!isObject(obj)) return false;
  return requiredKeys.every((key) => key in obj);
}

// ============================================================================
// Utility Type Guards
// ============================================================================

/**
 * Type guard for non-null/undefined values
 * Useful for filtering arrays
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for error objects
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard for objects with specific property
 */
export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * Type guard for objects with string property
 */
export function hasStringProperty<K extends string>(obj: unknown, key: K): obj is Record<K, string> {
  return isObject(obj) && key in obj && isString(obj[key]);
}

/**
 * Type guard for objects with number property
 */
export function hasNumberProperty<K extends string>(obj: unknown, key: K): obj is Record<K, number> {
  return isObject(obj) && key in obj && isNumber(obj[key]);
}

// ============================================================================
// URL Validation Type Guards
// ============================================================================

/**
 * Type guard for valid URL strings
 */
export function isValidUrl(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for HTTP(S) URLs
 */
export function isHttpUrl(value: unknown): value is string {
  if (!isValidUrl(value)) return false;
  const url = new URL(value);
  return url.protocol === 'http:' || url.protocol === 'https:';
}
