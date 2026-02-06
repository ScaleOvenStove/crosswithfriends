import {TextEncoder, TextDecoder} from 'util';

// Polyfill for jsdom environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import fileTypeGuesser from '../fileTypeGuesser';

// Helper: encode a string as an ArrayBuffer
function stringToBuffer(str) {
  return new TextEncoder().encode(str).buffer;
}

// Helper: create an ArrayBuffer from an array of byte values
function bytesToBuffer(bytes) {
  return new Uint8Array(bytes).buffer;
}

describe('fileTypeGuesser', () => {
  describe('iPUZ detection', () => {
    it('detects valid iPUZ JSON', () => {
      const ipuz = JSON.stringify({version: 'http://ipuz.org/v2', puzzle: {}});
      expect(fileTypeGuesser(stringToBuffer(ipuz))).toBe('ipuz');
    });

    it('does not detect JSON without ipuz version', () => {
      const json = JSON.stringify({version: '1.0', data: 'test'});
      expect(fileTypeGuesser(stringToBuffer(json))).toBeUndefined();
    });
  });

  describe('PUZ detection', () => {
    it('detects .puz file by magic header at offset 2', () => {
      // PUZ magic: "ACROSS&DOWN\0" at bytes 2-13
      // Hex: 41 43 52 4f 53 53 26 44 4f 57 4e 00
      const header = [
        0x00,
        0x00, // bytes 0-1 (checksum placeholder)
        0x41,
        0x43,
        0x52,
        0x4f,
        0x53,
        0x53,
        0x26,
        0x44,
        0x4f,
        0x57,
        0x4e,
        0x00, // ACROSS&DOWN\0
      ];
      expect(fileTypeGuesser(bytesToBuffer(header))).toBe('puz');
    });
  });

  describe('JPZ detection', () => {
    it('detects ZIP file (JPZ container)', () => {
      // ZIP magic: 50 4b 03 04
      const header = [0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
      expect(fileTypeGuesser(bytesToBuffer(header))).toBe('jpz');
    });

    it('detects XML file (JPZ format)', () => {
      // XML magic: "<?xm" = 3c 3f 78 6d
      const header = [0x3c, 0x3f, 0x78, 0x6d, 0x6c, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
      expect(fileTypeGuesser(bytesToBuffer(header))).toBe('jpz');
    });
  });

  describe('unknown formats', () => {
    it('returns undefined for unrecognized binary', () => {
      const header = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
      expect(fileTypeGuesser(bytesToBuffer(header))).toBeUndefined();
    });

    it('returns undefined for plain text', () => {
      expect(fileTypeGuesser(stringToBuffer('just some plain text'))).toBeUndefined();
    });
  });
});
