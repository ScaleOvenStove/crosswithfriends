/**
 * Shared color palette and distinct color selection for player cursors.
 *
 * AUTO_ASSIGN_COLORS is a curated set of 18 visually distinct HSL colors that
 * auto-assignment (when joining a game) chooses from. PALETTE_COLORS is what the
 * manual ColorPicker shows: the same 18 plus manual-only extras.
 */

export const AUTO_ASSIGN_COLORS: readonly string[] = [
  'hsl(4,90%,58%)',
  'hsl(340,82%,52%)',
  'hsl(291,47%,51%)',
  'hsl(262,52%,47%)',
  'hsl(231,48%,48%)',
  'hsl(207,90%,54%)',
  'hsl(199,98%,48%)',
  'hsl(187,100%,42%)',
  'hsl(174,100%,29%)',
  'hsl(122,39%,49%)',
  'hsl(88,50%,53%)',
  'hsl(66,70%,54%)',
  'hsl(54,100%,62%)',
  'hsl(45,100%,51%)',
  'hsl(36,100%,50%)',
  'hsl(14,100%,57%)',
  'hsl(16,25%,38%)',
  'hsl(200,18%,46%)',
];

/**
 * Manual-only swatches. A pale grey for players who want their cursor and
 * attribution fill to sit quietly on the grid. It is never auto-assigned: a
 * low-contrast cursor is a choice a player should make, not one made for them.
 */
const MANUAL_ONLY_COLORS: readonly string[] = ['hsl(200,10%,72%)'];

export const PALETTE_COLORS: readonly string[] = [...AUTO_ASSIGN_COLORS, ...MANUAL_ONLY_COLORS];

function parseHue(hslString: string): number | null {
  const match = hslString.match(/^hsla?\((\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function hueDistance(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Pick the palette color most visually distinct from all existing colors.
 *
 * For each palette color, computes its minimum angular hue distance to any
 * existing color, then returns the one with the largest minimum distance.
 * Falls back to a random auto-assign color if no existing colors are parseable.
 */
export function pickDistinctColor(existingColors: string[]): string {
  const existingHues = existingColors.map(parseHue).filter((h): h is number => h !== null);

  if (existingHues.length === 0) {
    return AUTO_ASSIGN_COLORS[Math.floor(Math.random() * AUTO_ASSIGN_COLORS.length)];
  }

  let bestColor = AUTO_ASSIGN_COLORS[0];
  let bestMinDistance = -1;

  for (const candidate of AUTO_ASSIGN_COLORS) {
    const candidateHue = parseHue(candidate);
    if (candidateHue === null) continue;

    const minDist = Math.min(...existingHues.map((h) => hueDistance(candidateHue, h)));

    if (minDist > bestMinDistance) {
      bestMinDistance = minDist;
      bestColor = candidate;
    }
  }

  return bestColor;
}
