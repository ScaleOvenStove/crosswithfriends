/**
 * Zod schemas for puzzle data validation
 * Replaces unsafe `as any` casts with runtime validation
 */

import { z } from 'zod';

// IPuz cell can be a number, string, object, or null
const ipuzCellSchema = z.union([
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

// Clue format can be [number, clue] tuple or object
const clueFormatSchema = z.union([
  z.tuple([z.string(), z.string()]),
  z.object({
    number: z.string(),
    clue: z.string(),
  }),
]);

// Puzzle dimensions
const dimensionsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

// Main puzzle JSON schema (ipuz format)
export const puzzleJsonSchema = z
  .object({
    version: z.string(),
    kind: z.array(z.string()),
    dimensions: dimensionsSchema,
    title: z.string(),
    author: z.string(),
    copyright: z.string().optional(),
    notes: z.string().optional(),
    solution: z.array(z.array(z.union([z.string(), z.null()]))),
    puzzle: z.array(z.array(ipuzCellSchema)),
    clues: z.object({
      Across: z.array(clueFormatSchema),
      Down: z.array(clueFormatSchema),
    }),
    // Allow additional properties for backward compatibility
  })
  .passthrough();

// Type inference from schema
export type PuzzleJson = z.infer<typeof puzzleJsonSchema>;

// Validation helper
export function validatePuzzleData(data: unknown): PuzzleJson {
  return puzzleJsonSchema.parse(data);
}

// Safe validation that returns result instead of throwing
export function safeValidatePuzzleData(data: unknown): {
  success: boolean;
  data?: PuzzleJson;
  error?: z.ZodError;
} {
  const result = puzzleJsonSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
