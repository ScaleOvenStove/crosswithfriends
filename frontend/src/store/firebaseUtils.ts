/**
 * Firebase utility functions following best practices
 * https://firebase.google.com/docs/database/web/read-and-write
 */

/**
 * Validates a Firebase Realtime Database path
 * Firebase paths cannot contain: . $ [ ] # /
 * @param path - The path to validate
 * @returns true if valid, false otherwise
 */
export function isValidFirebasePath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Check for undefined/null in path
  if (path.includes('undefined') || path.includes('null')) {
    return false;
  }

  // Firebase doesn't allow these characters in key names: . $ [ ] # /
  // However, / is allowed as a path separator, so we check individual segments
  const segments = path.split('/').filter(Boolean);
  for (const segment of segments) {
    if (/[.$[\]#]/.test(segment)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates a game ID (gid) extracted from a path
 * @param gid - The game ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidGid(gid: string): boolean {
  if (!gid || typeof gid !== 'string' || gid.trim() === '') {
    return false;
  }

  // Gid cannot contain Firebase invalid characters
  if (/[.$[\]#/]/.test(gid)) {
    return false;
  }

  return true;
}

/**
 * Extracts and validates gid from a game path
 * @param path - The game path (e.g., "/game/123-abc")
 * @returns The validated gid or null if invalid
 */
export function extractAndValidateGid(path: string): string | null {
  if (!isValidFirebasePath(path)) {
    return null;
  }

  const match = path.match(/^\/game\/(.+)$/);
  if (!match) {
    return null;
  }

  const gid = match[1];
  if (!isValidGid(gid)) {
    return null;
  }

  return gid;
}

/**
 * Creates a safe Firebase path with validation
 * @param basePath - Base path (e.g., "/game")
 * @param key - Key to append (e.g., gid)
 * @returns Validated path or throws error
 */
export function createSafePath(basePath: string, key: string): string {
  if (!isValidFirebasePath(basePath)) {
    throw new Error(`Invalid base path: ${basePath}`);
  }

  if (!isValidGid(key)) {
    throw new Error(`Invalid key: ${key}`);
  }

  // Ensure basePath doesn't end with / and key doesn't start with /
  const cleanBase = basePath.replace(/\/$/, '');
  const cleanKey = key.replace(/^\//, '');

  return `${cleanBase}/${cleanKey}`;
}
