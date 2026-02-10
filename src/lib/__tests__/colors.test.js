import {toHex, darken, lightenHsl, MAIN_BLUE_3, GREENISH, PINKISH} from '../colors';

describe('toHex', () => {
  it('converts numeric color to hex string', () => {
    expect(toHex(0xff0000)).toBe('#ff0000');
    expect(toHex(0x00ff00)).toBe('#00ff00');
    expect(toHex(0x0000ff)).toBe('#0000ff');
  });

  it('pads with leading zeros', () => {
    expect(toHex(0x000000)).toBe('#000000');
    expect(toHex(0x0000ff)).toBe('#0000ff');
  });

  it('converts named constants', () => {
    expect(toHex(MAIN_BLUE_3)).toBe('#dcefff');
    expect(toHex(GREENISH)).toBe('#1fff3d');
    expect(toHex(PINKISH)).toBe('#f0dbff');
  });

  it('handles white and black', () => {
    expect(toHex(0xffffff)).toBe('#ffffff');
    expect(toHex(0x000000)).toBe('#000000');
  });
});

describe('darken', () => {
  it('reduces RGB values by 5%', () => {
    // Pure red: (255, 0, 0) → (242, 0, 0)
    const result = darken(0xff0000);
    expect(toHex(result)).toBe(toHex(0xf20000));
  });

  it('darkens white', () => {
    // (255, 255, 255) * 0.95 → (242, 242, 242)
    const result = darken(0xffffff);
    expect(toHex(result)).toBe(toHex(0xf2f2f2));
  });

  it('keeps black as black', () => {
    expect(darken(0x000000)).toBe(0x000000);
  });

  it('returns a number smaller than input for non-black colors', () => {
    expect(darken(MAIN_BLUE_3)).toBeLessThan(MAIN_BLUE_3);
  });
});

describe('lightenHsl', () => {
  it('converts hsl string to hsla with 40% alpha', () => {
    expect(lightenHsl('hsl(200, 50%, 50%)')).toBe('hsla(200, 50%, 50%,40%)');
  });

  it('returns empty string for non-hsl input', () => {
    expect(lightenHsl('#ff0000')).toBe('');
    expect(lightenHsl('rgb(255, 0, 0)')).toBe('');
    expect(lightenHsl('')).toBe('');
  });
});
