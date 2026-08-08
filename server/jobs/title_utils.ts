/**
 * Helpers for repairing puzzle titles that arrived from external upload bots
 * with the publication name stamped on more than once, e.g.
 *
 *   "Universal Universal Universal Crossword - Aug 8 2026"
 *   "The New Yorker The New Yorker Crossword"
 *
 * Kept separate from the job script so it can be unit tested without the
 * script's module-scope pg.Pool.
 */

// Compare tokens loosely so "Yorker" and "Yorker," count as the same word.
// Punctuation-only differences are the common case when a pipeline
// concatenates a publication name that already ends in a comma or dash.
const normalizeToken = (token: string): string => token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Collapse a phrase that is repeated back-to-back at the start of a title down
 * to a single occurrence. Returns the title unchanged (modulo trimming and
 * whitespace collapsing) when there is no leading repeat.
 *
 * The shortest repeating phrase wins, which is what distinguishes
 * "Universal Universal Universal Crossword" (one-word phrase, 3 copies) from
 * "The New Yorker The New Yorker Crossword" (three-word phrase, 2 copies).
 * The *last* copy is the one kept, so any punctuation that separated the
 * repeats from the rest of the title survives.
 */
export function collapseRepeatedTitlePrefix(title: string): string {
  const tokens = title.trim().split(/\s+/).filter(Boolean);
  const n = tokens.length;
  if (n < 2) return tokens.join(' ');

  for (let phraseLen = 1; phraseLen * 2 <= n; phraseLen += 1) {
    let copies = 1;
    while ((copies + 1) * phraseLen <= n) {
      let matches = true;
      for (let i = 0; i < phraseLen; i += 1) {
        if (normalizeToken(tokens[copies * phraseLen + i]) !== normalizeToken(tokens[i])) {
          matches = false;
          break;
        }
      }
      if (!matches) break;
      copies += 1;
    }
    if (copies >= 2) {
      return tokens.slice((copies - 1) * phraseLen).join(' ');
    }
  }

  return tokens.join(' ');
}
