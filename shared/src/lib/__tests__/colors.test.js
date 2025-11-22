import {describe, it, expect} from 'vitest';
import {toHex, darken, lightenHsl, MAIN_BLUE_3, GREENISH, PINKISH, THEME_COLORS} from '../colors';

describe('toHex', () => {
  it('should convert number to hex string', () => {
    expect(toHex(0xffffff)).toBe('#ffffff');
    expect(toHex(0x000000)).toBe('#000000');
    expect(toHex(0xff0000)).toBe('#ff0000');
  });

  it('should handle MAIN_BLUE_3', () => {
    expect(toHex(MAIN_BLUE_3)).toBe('#dcefff');
  });

  it('should handle GREENISH', () => {
    expect(toHex(GREENISH)).toBe('#1fff3d');
  });

  it('should handle PINKISH', () => {
    expect(toHex(PINKISH)).toBe('#f0dbff');
  });

  it('should pad with zeros correctly', () => {
    expect(toHex(0x0)).toBe('#000000');
    expect(toHex(0x1)).toBe('#000001');
    expect(toHex(0x10)).toBe('#000010');
  });

  it('should handle uppercase conversion', () => {
    const result = toHex(0xabcdef);
    expect(result).toBe('#abcdef');
  });
});

describe('darken', () => {
  it('should darken color by 5%', () => {
    const original = 0xffffff; // white
    const darkened = darken(original);
    expect(darkened).toBeLessThan(original);
  });

  it('should darken MAIN_BLUE_3', () => {
    const darkened = darken(MAIN_BLUE_3);
    expect(darkened).toBeLessThan(MAIN_BLUE_3);
  });

  it('should darken GREENISH', () => {
    const darkened = darken(GREENISH);
    expect(darkened).toBeLessThan(GREENISH);
  });

  it('should handle black color', () => {
    const darkened = darken(0x000000);
    expect(darkened).toBe(0x000000);
  });

  it('should apply 0.95 multiplier to each RGB component', () => {
    const color = 0x808080; // gray
    const darkened = darken(color);
    // Each component should be 0x80 * 0.95 = 0x78 (120)
    const expected = Math.floor(0x80 * 0.95) * 256 * 256 + Math.floor(0x80 * 0.95) * 256 + Math.floor(0x80 * 0.95);
    expect(darkened).toBe(expected);
  });

  it('should floor the result', () => {
    const color = 0x010101;
    const darkened = darken(color);
    // Very small values should still be floored correctly
    expect(darkened).toBeGreaterThanOrEqual(0);
  });
});

describe('lightenHsl', () => {
  it('should lighten HSL color string', () => {
    const hsl = 'hsl(180,50%,50%)';
    const result = lightenHsl(hsl);
    expect(result).toBe('hsla(180,50%,50%,40%)');
  });

  it('should handle different HSL values', () => {
    const hsl = 'hsl(120,75%,25%)';
    const result = lightenHsl(hsl);
    expect(result).toBe('hsla(120,75%,25%,40%)');
  });

  it('should return empty string for non-HSL strings', () => {
    expect(lightenHsl('rgb(255,0,0)')).toBe('');
    expect(lightenHsl('#ff0000')).toBe('');
    expect(lightenHsl('red')).toBe('');
    expect(lightenHsl('')).toBe('');
  });

  it('should handle HSL with spaces', () => {
    const hsl = 'hsl(180, 50%, 50%)';
    const result = lightenHsl(hsl);
    expect(result).toBe('hsla(180, 50%, 50%,40%)');
  });

  it('should preserve HSL parameters', () => {
    const hsl = 'hsl(200,60%,30%)';
    const result = lightenHsl(hsl);
    expect(result).toContain('200');
    expect(result).toContain('60%');
    expect(result).toContain('30%');
    expect(result).toContain('40%');
  });
});

describe('constants', () => {
  it('should export MAIN_BLUE_3', () => {
    expect(typeof MAIN_BLUE_3).toBe('number');
    expect(MAIN_BLUE_3).toBe(0xdcefff);
  });

  it('should export GREENISH', () => {
    expect(typeof GREENISH).toBe('number');
    expect(GREENISH).toBe(0x1fff3d);
  });

  it('should export PINKISH', () => {
    expect(typeof PINKISH).toBe('number');
    expect(PINKISH).toBe(0xf0dbff);
  });

  it('should export THEME_COLORS array', () => {
    expect(Array.isArray(THEME_COLORS)).toBe(true);
    expect(THEME_COLORS).toContain(MAIN_BLUE_3);
    expect(THEME_COLORS).toContain(GREENISH);
    expect(THEME_COLORS.length).toBe(2);
  });
});

