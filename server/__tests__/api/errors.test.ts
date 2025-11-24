import {describe, it, expect} from 'vitest';
import {createHttpError} from '../../api/errors.js';

describe('HTTP Error Utilities', () => {
  describe('createHttpError', () => {
    it('should create an error with correct statusCode', () => {
      const error = createHttpError('Not found', 404);
      expect(error.statusCode).toBe(404);
    });

    it('should preserve error message', () => {
      const message = 'Custom error message';
      const error = createHttpError(message, 400);
      expect(error.message).toBe(message);
    });

    it('should be an instance of Error', () => {
      const error = createHttpError('Test error', 500);
      expect(error).toBeInstanceOf(Error);
    });

    it('should work with different status codes', () => {
      const statusCodes = [200, 301, 400, 401, 403, 404, 500, 502, 503];
      statusCodes.forEach((code) => {
        const error = createHttpError(`Error ${code}`, code);
        expect(error.statusCode).toBe(code);
        expect(error.message).toBe(`Error ${code}`);
      });
    });

    it('should allow statusCode to be accessed as property', () => {
      const error = createHttpError('Test', 404);
      expect('statusCode' in error).toBe(true);
      expect(error.statusCode).toBe(404);
    });

    it('should create error with empty message', () => {
      const error = createHttpError('', 500);
      expect(error.message).toBe('');
      expect(error.statusCode).toBe(500);
    });

    it('should handle special characters in message', () => {
      const message = 'Error: "Invalid input" <script>alert("xss")</script>';
      const error = createHttpError(message, 400);
      expect(error.message).toBe(message);
    });
  });
});
