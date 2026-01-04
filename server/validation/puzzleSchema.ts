/**
 * Puzzle Validation Schema
 * Validates ipuz format puzzles using Zod
 * Replaces Joi validation for consistency
 */

import {z} from 'zod';

// Helper for string that allows empty string
const stringSchema = (): z.ZodString => z.string();

// Schema for clue entry (supports both v1 and v2 formats)
const clueEntrySchema = z.union([
  // v1 format: ["1", "clue text"]
  z.array(z.string()),
  // v2 format: {number: "1", clue: "clue text", cells?: [[column, row], ...]}
  z.object({
    number: z.string(),
    clue: z.string(),
    cells: z.array(z.array(z.number())).optional(), // Array of [column, row] pairs
  }),
]);

// Schema for puzzle cell (can be number, string, object with cell/style, or null)
const puzzleCellSchema = z.union([
  z.number(),
  z.string(),
  z.object({
    cell: z.union([z.number(), z.string()]),
    style: z
      .object({
        shapebg: z.string().optional(),
        fillbg: z.string().optional(),
      })
      .optional(),
  }),
  z.null(),
]);

// Main puzzle validator schema for ipuz format per https://www.puzzazz.com/ipuz/v1 and v2
export const puzzleSchema = z
  .object({
    version: stringSchema().min(1), // Supports both v1 and v2
    kind: z.array(stringSchema()).min(1),
    dimensions: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    title: stringSchema().min(1),
    author: stringSchema().min(1),
    copyright: stringSchema().optional(),
    notes: stringSchema().optional(),
    // Additional ipuz fields that may be present
    origin: stringSchema().optional(),
    publisher: stringSchema().optional(),
    intro: stringSchema().optional(),
    difficulty: stringSchema().optional(),
    empty: stringSchema().optional(),
    solution: z.array(z.array(z.union([stringSchema(), z.literal(null), z.literal('#')])).min(1)).min(1),
    puzzle: z.array(z.array(puzzleCellSchema)).min(1),
    clues: z
      .object({
        Across: z.array(clueEntrySchema).optional(),
        Down: z.array(clueEntrySchema).optional(),
        across: z.array(clueEntrySchema).optional(),
        down: z.array(clueEntrySchema).optional(),
      })
      .passthrough(), // Allow additional properties (e.g., other clue directions)
  })
  .passthrough(); // Allow additional top-level properties

/**
 * Validates a puzzle using Zod schema
 * @param puzzle - Puzzle object to validate
 * @throws Error if validation fails
 */
export function validatePuzzle(puzzle: unknown): void {
  const result = puzzleSchema.safeParse(puzzle);
  if (!result.success) {
    const errors = result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
    throw new Error(`Puzzle validation failed: ${errors}`);
  }
}
