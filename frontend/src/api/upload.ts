/**
 * File upload utilities for puzzle files
 *
 * This function parses uploaded puzzle files (.puz or .ipuz format) and
 * uploads them using the POST /api/puzzle endpoint.
 */

import PUZtoIPUZ from '@crosswithfriends/shared/lib/converter/PUZtoIPUZ';
import { puzzlesApi } from './apiClient';
import type { AddPuzzleResponse, PuzzleJson } from './types';
import type { CreatePuzzleRequestPuzzle } from './apiClient';

/**
 * Validates that a parsed object is a valid PuzzleJson
 */
function validatePuzzleJson(puzzle: unknown): puzzle is PuzzleJson {
  if (typeof puzzle !== 'object' || puzzle === null) {
    return false;
  }

  const p = puzzle as Record<string, unknown>;

  return (
    typeof p['version'] === 'string' &&
    Array.isArray(p['kind']) &&
    typeof p['dimensions'] === 'object' &&
    p['dimensions'] !== null &&
    typeof (p['dimensions'] as { width?: unknown })['width'] === 'number' &&
    typeof (p['dimensions'] as { height?: unknown })['height'] === 'number' &&
    typeof p['title'] === 'string' &&
    typeof p['author'] === 'string' &&
    Array.isArray(p['solution']) &&
    Array.isArray(p['puzzle']) &&
    typeof p['clues'] === 'object' &&
    p['clues'] !== null &&
    Array.isArray((p['clues'] as { Across?: unknown })['Across']) &&
    Array.isArray((p['clues'] as { Down?: unknown })['Down'])
  );
}

/**
 * Parses an .ipuz file (JSON format)
 */
async function parseIpuzFile(file: File): Promise<PuzzleJson> {
  const text = await file.text();
  try {
    const puzzle = JSON.parse(text);
    if (!validatePuzzleJson(puzzle)) {
      throw new Error('Invalid iPUZ format: missing required fields');
    }
    return puzzle;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in iPUZ file: ${error.message}`);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to parse iPUZ file');
  }
}

/**
 * Parses a .puz file (binary format) and converts it to iPUZ format
 */
async function parsePuzFile(file: File): Promise<PuzzleJson> {
  const arrayBuffer = await file.arrayBuffer();
  try {
    const puzzle = PUZtoIPUZ(arrayBuffer);
    if (!validatePuzzleJson(puzzle)) {
      throw new Error('PUZ converter returned invalid puzzle format');
    }
    return puzzle;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse PUZ file: ${error.message}`);
    }
    throw new Error('Failed to parse PUZ file');
  }
}

/**
 * Upload a puzzle file (.puz or .ipuz)
 *
 * This function:
 * 1. Detects the file type based on extension
 * 2. Parses the file (.ipuz as JSON, .puz using converter)
 * 3. Validates the parsed puzzle
 * 4. Calls the POST /api/puzzle endpoint with the parsed data
 *
 * @param file - The puzzle file to upload (.puz or .ipuz)
 * @param isPublic - Whether the puzzle should be public (default: true)
 * @returns The puzzle ID from the server
 * @throws Error if file parsing fails or API call fails
 */
export async function uploadPuzzleFile(
  file: File,
  isPublic: boolean = true
): Promise<AddPuzzleResponse> {
  // Determine file type from extension
  const fileName = file.name.toLowerCase();
  const isPuz = fileName.endsWith('.puz');
  const isIpuz = fileName.endsWith('.ipuz');

  if (!isPuz && !isIpuz) {
    throw new Error('Unsupported file type. Only .puz and .ipuz files are supported.');
  }

  // Parse the file based on type
  let puzzleJson: PuzzleJson;
  try {
    if (isPuz) {
      puzzleJson = await parsePuzFile(file);
    } else {
      puzzleJson = await parseIpuzFile(file);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to parse puzzle file');
  }

  // Upload using the API client
  // Note: Cast to CreatePuzzleRequestPuzzle because the generated type is stricter
  // than the actual API (which accepts null in solution arrays)
  try {
    // Normalize clues to match the generated API client's expectations
    // 1. The generated client expects lowercase 'across' and 'down' keys
    // 2. The generated client expects clues to be objects { number, clue }, not arrays
    const clues = (puzzleJson as any).clues || {};
    const normalizeClueList = (rawList: any[]) => {
      if (!Array.isArray(rawList)) return [];
      return rawList.map((item) => {
        if (Array.isArray(item)) {
          // Handle [number, clue] format
          return { number: String(item[0]), clue: item[1] };
        } else if (typeof item === 'object' && item !== null) {
          // Handle existing object format, ensuring number is string
          return {
            ...item,
            number: String(item.number || ''),
            clue: item.clue || '',
          };
        }
        return { number: '', clue: '' };
      });
    };

    const normalizedClues = {
      across: normalizeClueList(clues.Across || clues.across),
      down: normalizeClueList(clues.Down || clues.down),
    };

    // Construct the request object cleanly
    const requestPuzzle = {
      ...puzzleJson,
      clues: normalizedClues,
    };

    console.log(
      '[Frontend Upload] Normalized puzzle JSON for upload:',
      JSON.stringify(requestPuzzle.clues, null, 2)
    );

    const response = await puzzlesApi.createPuzzle({
      puzzle: requestPuzzle as unknown as CreatePuzzleRequestPuzzle,
      isPublic,
    });

    return {
      pid: response.pid,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to upload puzzle: ${error.message}`);
    }
    throw new Error('Failed to upload puzzle');
  }
}
