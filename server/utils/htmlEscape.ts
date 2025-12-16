/**
 * HTML Escaping Utility
 * Escapes user-controlled data to prevent XSS attacks
 * Uses the 'escape-html' library for reliable, battle-tested escaping
 */

import escapeHtmlLib from 'escape-html';

/**
 * Escapes HTML special characters to prevent XSS
 * @param text - The text to escape
 * @returns Escaped text safe for use in HTML content and attributes
 */
export function escapeHtml(text: string): string {
  return escapeHtmlLib(text);
}

/**
 * Escapes text for use in HTML attribute values
 * This is the same as escapeHtml but provided for semantic clarity
 * @param text - The text to escape
 * @returns Escaped text safe for use in HTML attributes
 */
export function escapeHtmlAttribute(text: string): string {
  return escapeHtml(text);
}
