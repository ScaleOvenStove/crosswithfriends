import {AUTO_ASSIGN_COLORS, PALETTE_COLORS, pickDistinctColor} from '../colorAssignment';

describe('PALETTE_COLORS', () => {
  it('contains the 18 auto-assign colors plus a pale grey', () => {
    expect(AUTO_ASSIGN_COLORS).toHaveLength(18);
    expect(PALETTE_COLORS).toHaveLength(19);
    expect(PALETTE_COLORS).toEqual(expect.arrayContaining([...AUTO_ASSIGN_COLORS]));
    expect(PALETTE_COLORS).toContain('hsl(200,10%,72%)');
  });

  it('has no duplicate colors', () => {
    expect(new Set(PALETTE_COLORS).size).toBe(PALETTE_COLORS.length);
  });

  it('all colors are valid hsl strings', () => {
    for (const color of PALETTE_COLORS) {
      expect(color).toMatch(/^hsl\(\d+,\d+%,\d+%\)$/);
    }
  });
});

describe('pickDistinctColor', () => {
  it('returns a palette color when no existing colors', () => {
    const color = pickDistinctColor([]);
    expect(PALETTE_COLORS).toContain(color);
  });

  it('returns a palette color when one color exists', () => {
    const color = pickDistinctColor(['hsl(4,90%,58%)']);
    expect(PALETTE_COLORS).toContain(color);
  });

  it('avoids colors near existing hue', () => {
    // Red is hue 4 — should pick something far away
    const color = pickDistinctColor(['hsl(4,90%,58%)']);
    const hue = parseInt(color.match(/^hsl\((\d+)/)?.[1] || '0', 10);
    const dist = Math.abs(hue - 4) % 360;
    const angularDist = dist > 180 ? 360 - dist : dist;
    expect(angularDist).toBeGreaterThan(60);
  });

  it('picks maximally distinct from multiple existing colors', () => {
    const color = pickDistinctColor(['hsl(4,90%,58%)', 'hsl(207,90%,54%)']);
    expect(PALETTE_COLORS).toContain(color);
    expect(color).not.toBe('hsl(4,90%,58%)');
    expect(color).not.toBe('hsl(207,90%,54%)');
  });

  it('handles non-hsl strings gracefully', () => {
    const color = pickDistinctColor(['#ff0000', 'rgb(0,0,255)']);
    expect(PALETTE_COLORS).toContain(color);
  });

  it('handles all palette colors being taken', () => {
    const color = pickDistinctColor([...PALETTE_COLORS]);
    expect(PALETTE_COLORS).toContain(color);
  });

  it('never auto-assigns a manual-only color', () => {
    const manualOnly = PALETTE_COLORS.filter((c) => !AUTO_ASSIGN_COLORS.includes(c));
    expect(manualOnly.length).toBeGreaterThan(0);
    for (let i = 0; i < 50; i++) {
      expect(manualOnly).not.toContain(pickDistinctColor([]));
    }
    expect(manualOnly).not.toContain(pickDistinctColor([...AUTO_ASSIGN_COLORS]));
  });

  it('handles legacy rand_color format', () => {
    // Old rand_color() produced hsl(h,40%,60-80%)
    const color = pickDistinctColor(['hsl(147,40%,73%)']);
    expect(PALETTE_COLORS).toContain(color);
    const hue = parseInt(color.match(/^hsl\((\d+)/)?.[1] || '0', 10);
    const dist = Math.abs(hue - 147) % 360;
    const angularDist = dist > 180 ? 360 - dist : dist;
    expect(angularDist).toBeGreaterThan(30);
  });
});
