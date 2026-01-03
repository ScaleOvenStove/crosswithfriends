import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import Caret from '../caret';

// Skip tests if document is not available (Node.js environment)
const isBrowser = typeof document !== 'undefined';

const describeIf = (condition) => (condition ? describe : describe.skip);

describeIf(isBrowser)('Caret', () => {
  let mockElement;
  let mockSelection;
  let mockRange;

  beforeEach(() => {
    // Create mock element
    mockElement = document.createElement('div');
    mockElement.textContent = 'Test content';
    document.body.appendChild(mockElement);

    // Mock Selection API
    mockSelection = {
      baseOffset: 0,
      focusOffset: 0,
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
    };

    mockRange = {
      startContainer: mockElement,
      start: 0,
      end: 0,
      collapse: vi.fn(),
      setStart: vi.fn(),
      setEnd: vi.fn(),
      selectNodeContents: vi.fn(),
    };

    window.getSelection = vi.fn(() => mockSelection);
    document.createRange = vi.fn(() => mockRange);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create Caret instance with element', () => {
      const caret = new Caret(mockElement);
      expect(caret.el).toBe(mockElement);
    });
  });

  describe('startPosition getter', () => {
    it('should return start position from selection', () => {
      mockSelection.baseOffset = 5;
      mockSelection.focusOffset = 10;
      const caret = new Caret(mockElement);
      expect(caret.startPosition).toBe(5);
    });

    it('should return minimum of baseOffset and focusOffset', () => {
      mockSelection.baseOffset = 10;
      mockSelection.focusOffset = 5;
      const caret = new Caret(mockElement);
      expect(caret.startPosition).toBe(5);
    });

    it('should return undefined if selection is not available', () => {
      // When getSelection returns null/undefined, the code will throw when trying to destructure
      // So we need to make getSelection return an object but with null/undefined values
      // Actually, the code checks typeof window.getSelection !== 'undefined', so if it's a function
      // that returns null, it will try to destructure null which throws
      // Let's test the case where getSelection doesn't exist at all
      const originalGetSelection = window.getSelection;
      delete window.getSelection;
      const caret = new Caret(mockElement);
      // Without getSelection, _getRange returns {start: undefined, end: undefined}
      const result = caret.startPosition;
      expect(result).toBeUndefined();
      window.getSelection = originalGetSelection;
    });

    it('should return undefined if element is null', () => {
      const caret = new Caret(null);
      expect(caret.startPosition).toBeUndefined();
    });
  });

  describe('endPosition getter', () => {
    it('should return end position from selection', () => {
      mockSelection.baseOffset = 5;
      mockSelection.focusOffset = 10;
      const caret = new Caret(mockElement);
      expect(caret.endPosition).toBe(10);
    });

    it('should return maximum of baseOffset and focusOffset', () => {
      mockSelection.baseOffset = 5;
      mockSelection.focusOffset = 10;
      const caret = new Caret(mockElement);
      expect(caret.endPosition).toBe(10);
    });

    it('should return undefined if selection is not available', () => {
      // When getSelection doesn't exist, _getRange returns {start: undefined, end: undefined}
      const originalGetSelection = window.getSelection;
      delete window.getSelection;
      const caret = new Caret(mockElement);
      // Without getSelection, _getRange returns {start: undefined, end: undefined}
      const result = caret.endPosition;
      expect(result).toBeUndefined();
      window.getSelection = originalGetSelection;
    });
  });

  describe('startPosition setter', () => {
    it('should set caret position', () => {
      const caret = new Caret(mockElement);
      caret.startPosition = 5;

      expect(mockRange.selectNodeContents).toHaveBeenCalledWith(mockElement);
      expect(mockRange.collapse).toHaveBeenCalledWith(false);
      // setStart/setEnd are called with range.startContainer (set by selectNodeContents), not mockElement directly
      expect(mockRange.setStart).toHaveBeenCalled();
      expect(mockRange.setEnd).toHaveBeenCalled();
      expect(mockSelection.removeAllRanges).toHaveBeenCalled();
      expect(mockSelection.addRange).toHaveBeenCalledWith(mockRange);
    });

    it('should clamp position to element length', () => {
      mockElement.textContent = 'Test';
      // Mock the length property (DOM elements don't have .length, but the code checks el.length)
      Object.defineProperty(mockElement, 'length', {
        value: 4,
        writable: true,
        configurable: true,
      });
      const caret = new Caret(mockElement);
      caret.startPosition = 100;
      // Position should be clamped to element.length (4)
      expect(mockRange.setStart).toHaveBeenCalled();
      expect(mockRange.setEnd).toHaveBeenCalled();
      // Verify the position was clamped by checking the last call
      const lastSetStartCall = mockRange.setStart.mock.calls[mockRange.setStart.mock.calls.length - 1];
      expect(lastSetStartCall[1]).toBe(4);
    });

    it('should not set position if element is null', () => {
      const caret = new Caret(null);
      caret.startPosition = 5;
      expect(mockRange.setStart).not.toHaveBeenCalled();
    });

    it('should handle position at element length', () => {
      mockElement.textContent = 'Test';
      Object.defineProperty(mockElement, 'length', {
        value: 4,
        writable: true,
        configurable: true,
      });
      const caret = new Caret(mockElement);
      caret.startPosition = 4;
      expect(mockRange.setStart).toHaveBeenCalled();
      const lastCall = mockRange.setStart.mock.calls[mockRange.setStart.mock.calls.length - 1];
      expect(lastCall[1]).toBe(4);
    });

    it('should handle position 0', () => {
      const caret = new Caret(mockElement);
      caret.startPosition = 0;
      expect(mockRange.setStart).toHaveBeenCalled();
      const lastCall = mockRange.setStart.mock.calls[mockRange.setStart.mock.calls.length - 1];
      expect(lastCall[1]).toBe(0);
    });

    // Note: IE fallback test removed - Internet Explorer is no longer supported
    // The createTextRange fallback code remains in the implementation for backwards
    // compatibility but is unlikely to be executed in modern browsers
  });

  describe('_getRange', () => {
    it('should return range with start and end positions', () => {
      mockSelection.baseOffset = 3;
      mockSelection.focusOffset = 7;
      const caret = new Caret(mockElement);
      // Access private method through public getter
      expect(caret.startPosition).toBe(3);
      expect(caret.endPosition).toBe(7);
    });

    it('should handle reversed selection', () => {
      mockSelection.baseOffset = 7;
      mockSelection.focusOffset = 3;
      const caret = new Caret(mockElement);
      expect(caret.startPosition).toBe(3);
      expect(caret.endPosition).toBe(7);
    });
  });
});
