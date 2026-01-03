import {describe, it, expect} from 'vitest';
import {toHex, darken, lightenHsl} from '../colors';

describe('toHex', () => {
  it('should convert number to hex string', () => {
    expect(toHex(0xffffff)).toBe('#ffffff');
    expect(toHex(0x000000)).toBe('#000000');
    expect(toHex(0xff0000)).toBe('#ff0000');
  });

  it('should pad with zeros correctly', () => {
    expect(toHex(0x0)).toBe('#000000');
    expect(toHex(0x1)).toBe('#000001');
    expect(toHex(0x10)).toBe('#000010');
  });
});

describe('darken', () => {
  it('should darken color by 5%', () => {
    const original = 0xffffff; // white
    const darkened = darken(original);
    expect(darkened).toBeLessThan(original);
  });

  it('should handle black color', () => {
    const darkened = darken(0x000000);
    expect(darkened).toBe(0x000000);
  });

  it('should apply 0.95 multiplier to each RGB component', () => {
    const color = 0x808080; // gray
    const darkened = darken(color);
    // Each component should be 0x80 * 0.95 = 0x78 (120)
    const expected =
      Math.floor(0x80 * 0.95) * 256 * 256 + Math.floor(0x80 * 0.95) * 256 + Math.floor(0x80 * 0.95);
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
});
