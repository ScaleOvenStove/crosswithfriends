import {describe, it, expect} from 'vitest';
import fileTypeGuesser from '../fileTypeGuesser';

describe('fileTypeGuesser', () => {
  describe('PUZ file detection', () => {
    it('should detect PUZ file by magic header', () => {
      // PUZ magic header: '4143524f535326444f574e00'
      // This is "ACROSS&DOWN\0" in hex
      const puzHeader = new Uint8Array([
        0x41, 0x43, 0x52, 0x4f, 0x53, 0x53, 0x26, 0x44, 0x4f, 0x57, 0x4e, 0x00,
      ]);
      const buffer = new Uint8Array(100);
      buffer.set(puzHeader, 2); // Header starts at index 2
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).toBe('puz');
    });

    it('should detect PUZ file with full header', () => {
      const buffer = new Uint8Array(100);
      // Set magic header at correct position (index 2-13)
      buffer[2] = 0x41; // A
      buffer[3] = 0x43; // C
      buffer[4] = 0x52; // R
      buffer[5] = 0x4f; // O
      buffer[6] = 0x53; // S
      buffer[7] = 0x53; // S
      buffer[8] = 0x26; // &
      buffer[9] = 0x44; // D
      buffer[10] = 0x4f; // O
      buffer[11] = 0x57; // W
      buffer[12] = 0x4e; // N
      buffer[13] = 0x00; // \0
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).toBe('puz');
    });
  });

  describe('iPUZ file detection', () => {
    it('should detect iPUZ file by JSON version', () => {
      const ipuzJson = JSON.stringify({
        version: 'http://ipuz.org/v1',
        puzzle: [],
      });
      const encoder = new TextEncoder();
      const buffer = encoder.encode(ipuzJson);
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).toBe('ipuz');
    });

    it('should detect iPUZ with different version formats', () => {
      const ipuzJson = JSON.stringify({
        version: 'http://ipuz.org/v2',
        puzzle: [],
      });
      const encoder = new TextEncoder();
      const buffer = encoder.encode(ipuzJson);
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).toBe('ipuz');
    });

    it('should not detect as iPUZ if version does not start with ipuz.org', () => {
      const json = JSON.stringify({
        version: 'http://example.com/v1',
        puzzle: [],
      });
      const encoder = new TextEncoder();
      const buffer = encoder.encode(json);
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).not.toBe('ipuz');
    });
  });

  describe('JPZ file detection', () => {
    it('should detect JPZ file by ZIP magic header', () => {
      // ZIP magic header: '504b0304' (PK\x03\x04)
      const buffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).toBe('jpz');
    });

    it('should detect JPZ file by XML magic header', () => {
      // XML magic header: '3c3f786d' (<?xm)
      const buffer = new Uint8Array([0x3c, 0x3f, 0x78, 0x6d]);
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).toBe('jpz');
    });
  });

  describe('edge cases', () => {
    it('should handle empty buffer', () => {
      const buffer = new Uint8Array(0);
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).toBeUndefined();
    });

    it('should handle buffer smaller than magic header', () => {
      const buffer = new Uint8Array([0x50, 0x4b]);
      const result = fileTypeGuesser(buffer.buffer);
      // Should not crash, may return undefined or partial match
      expect(typeof result === 'string' || result === undefined).toBe(true);
    });

    it('should handle invalid JSON', () => {
      const invalidJson = 'not valid json {';
      const encoder = new TextEncoder();
      const buffer = encoder.encode(invalidJson);
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).not.toBe('ipuz');
    });

    it('should handle JSON without version field', () => {
      const json = JSON.stringify({puzzle: []});
      const encoder = new TextEncoder();
      const buffer = encoder.encode(json);
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).not.toBe('ipuz');
    });

    it('should handle non-matching magic headers', () => {
      const buffer = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).toBeUndefined();
    });

    it('should prioritize PUZ header over other headers', () => {
      const buffer = new Uint8Array(100);
      // Set both PUZ and ZIP headers
      buffer[0] = 0x50; // ZIP header start
      buffer[1] = 0x4b;
      buffer[2] = 0x41; // PUZ header start
      buffer[3] = 0x43;
      buffer[4] = 0x52;
      buffer[5] = 0x4f;
      buffer[6] = 0x53;
      buffer[7] = 0x53;
      buffer[8] = 0x26;
      buffer[9] = 0x44;
      buffer[10] = 0x4f;
      buffer[11] = 0x57;
      buffer[12] = 0x4e;
      buffer[13] = 0x00;
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).toBe('puz');
    });
  });

  describe('buffer parsing', () => {
    it('should correctly parse first 14 bytes for PUZ header', () => {
      const buffer = new Uint8Array(20);
      // Set PUZ header at correct position
      for (let i = 2; i <= 13; i++) {
        buffer[i] = 0x41 + (i - 2); // Simple pattern
      }
      buffer[2] = 0x41; // A
      buffer[3] = 0x43; // C
      buffer[4] = 0x52; // R
      buffer[5] = 0x4f; // O
      buffer[6] = 0x53; // S
      buffer[7] = 0x53; // S
      buffer[8] = 0x26; // &
      buffer[9] = 0x44; // D
      buffer[10] = 0x4f; // O
      buffer[11] = 0x57; // W
      buffer[12] = 0x4e; // N
      buffer[13] = 0x00; // \0
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).toBe('puz');
    });

    it('should correctly parse first 4 bytes for other magic headers', () => {
      const buffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      const result = fileTypeGuesser(buffer.buffer);
      expect(result).toBe('jpz');
    });
  });
});

