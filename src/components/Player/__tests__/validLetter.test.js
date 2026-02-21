import {validLetter} from '../GridControls';

describe('validLetter', () => {
  it('is exported as a standalone function', () => {
    // Regression gate: if someone moves validLetter back to a class method
    // or removes the export, this test fails immediately.
    expect(typeof validLetter).toBe('function');
  });

  it('accepts uppercase A-Z', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      expect(validLetter(ch)).toBeTruthy();
    }
  });

  it('accepts digits 0-9', () => {
    for (const ch of '0123456789') {
      expect(validLetter(ch)).toBeTruthy();
    }
  });

  it('accepts special symbols used in theme puzzles', () => {
    const symbols = '!@#$%^&*()-+=`~/?\\';
    for (const ch of symbols) {
      expect(validLetter(ch)).toBeTruthy();
    }
  });

  it('rejects lowercase letters (input is uppercased before calling validLetter)', () => {
    expect(validLetter('a')).toBeFalsy();
    expect(validLetter('z')).toBeFalsy();
  });

  it('rejects whitespace', () => {
    expect(validLetter(' ')).toBeFalsy();
    expect(validLetter('\t')).toBeFalsy();
  });
});
