/**
 * Input Validation Utilities
 *
 * Provides validation for common input types like IDs.
 * Ensures inputs match expected formats before database queries.
 */

import {z} from 'zod';

/**
 * Validates a game ID format
 * Game IDs should be alphanumeric with optional hyphens, 1-100 characters
 */
export const gameIdSchema = z
  .string()
  .min(1, 'Game ID cannot be empty')
  .max(100, 'Game ID is too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Game ID contains invalid characters');

/**
 * Validates a puzzle ID format
 * Puzzle IDs should be alphanumeric with optional hyphens/underscores, 1-100 characters
 */
export const puzzleIdSchema = z
  .string()
  .min(1, 'Puzzle ID cannot be empty')
  .max(100, 'Puzzle ID is too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Puzzle ID contains invalid characters');

/**
 * Validates a room ID format
 * Room IDs should be alphanumeric with optional hyphens/underscores, 1-100 characters
 */
export const roomIdSchema = z
  .string()
  .min(1, 'Room ID cannot be empty')
  .max(100, 'Room ID is too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Room ID contains invalid characters');

/**
 * Validates a user ID format
 * User IDs are UUIDs or alphanumeric strings, 1-200 characters
 */
export const userIdSchema = z
  .string()
  .min(1, 'User ID cannot be empty')
  .max(200, 'User ID is too long')
  .regex(/^[\w-]+$/, 'User ID contains invalid characters');

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  error?: string;
}

/**
 * Validates a game ID
 * @param gid - Game ID to validate
 * @returns Validation result
 */
export function validateGameId(gid: unknown): ValidationResult<string> {
  const result = gameIdSchema.safeParse(gid);
  if (result.success) {
    return {valid: true, value: result.data};
  }
  return {valid: false, error: result.error.errors[0]?.message || 'Invalid game ID'};
}

/**
 * Validates a puzzle ID
 * @param pid - Puzzle ID to validate
 * @returns Validation result
 */
export function validatePuzzleId(pid: unknown): ValidationResult<string> {
  const result = puzzleIdSchema.safeParse(pid);
  if (result.success) {
    return {valid: true, value: result.data};
  }
  return {valid: false, error: result.error.errors[0]?.message || 'Invalid puzzle ID'};
}

/**
 * Validates a room ID
 * @param rid - Room ID to validate
 * @returns Validation result
 */
export function validateRoomId(rid: unknown): ValidationResult<string> {
  const result = roomIdSchema.safeParse(rid);
  if (result.success) {
    return {valid: true, value: result.data};
  }
  return {valid: false, error: result.error.errors[0]?.message || 'Invalid room ID'};
}

/**
 * Validates a user ID
 * @param userId - User ID to validate
 * @returns Validation result
 */
export function validateUserId(userId: unknown): ValidationResult<string> {
  const result = userIdSchema.safeParse(userId);
  if (result.success) {
    return {valid: true, value: result.data};
  }
  return {valid: false, error: result.error.errors[0]?.message || 'Invalid user ID'};
}

/**
 * Validates pagination parameters
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * Validates pagination parameters
 * @param params - Pagination parameters to validate
 * @returns Validation result
 */
export function validatePagination(params: {limit?: unknown; offset?: unknown}): ValidationResult<{
  limit: number;
  offset: number;
}> {
  const result = paginationSchema.safeParse(params);
  if (result.success) {
    return {valid: true, value: result.data};
  }
  return {valid: false, error: result.error.errors[0]?.message || 'Invalid pagination parameters'};
}

/**
 * Sanitizes a string for safe database usage (removes null bytes, trims)
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  // Remove null bytes and other problematic characters
  return input.replace(/\0/g, '').trim();
}

/**
 * Validates and sanitizes a search query
 * @param query - Search query to validate
 * @returns Validation result
 */
export function validateSearchQuery(query: unknown): ValidationResult<string> {
  if (typeof query !== 'string') {
    return {valid: false, error: 'Search query must be a string'};
  }

  const sanitized = sanitizeString(query);

  if (sanitized.length === 0) {
    return {valid: false, error: 'Search query cannot be empty'};
  }

  if (sanitized.length > 500) {
    return {valid: false, error: 'Search query is too long'};
  }

  return {valid: true, value: sanitized};
}
