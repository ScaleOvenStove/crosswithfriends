/**
 * File upload utilities for puzzle files
 */

import { config } from '@config/index';
import type { AddPuzzleResponse } from './types';

const API_BASE = `${config.apiUrl}/api`;

/**
 * Upload a puzzle file (.puz or .ipuz)
 */
export async function uploadPuzzleFile(
  file: File,
  isPublic: boolean = true
): Promise<AddPuzzleResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('isPublic', isPublic.toString());

  const response = await fetch(`${API_BASE}/puzzle/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload puzzle');
  }

  return response.json();
}
