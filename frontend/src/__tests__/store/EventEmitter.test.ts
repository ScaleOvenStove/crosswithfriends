import {describe, it, expect, beforeEach, vi} from 'vitest';

import EventEmitter from '../../store/EventEmitter';

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('on', () => {
    it('should add a listener for an event', () => {
      const listener = () => {};
      emitter.on('test', listener);

      expect(emitter.emit('test')).toBe(true);
    });

    it('should add multiple listeners for the same event', () => {
      const listener1 = () => {};
      const listener2 = () => {};
      emitter.on('test', listener1);
      emitter.on('test', listener2);

      expect(emitter.emit('test')).toBe(true);
    });

    it('should return this for chaining', () => {
      const listener = () => {};
      const result = emitter.on('test', listener);

      expect(result).toBe(emitter);
    });
  });

  describe('off', () => {
    it('should remove a listener', () => {
      const listener = () => {};
      emitter.on('test', listener);
      emitter.off('test', listener);

      expect(emitter.emit('test')).toBe(false);
    });

    it('should remove only the specified listener', () => {
      const listener1 = () => {};
      const listener2 = () => {};
      emitter.on('test', listener1);
      emitter.on('test', listener2);
      emitter.off('test', listener1);

      expect(emitter.emit('test')).toBe(true);
    });

    it('should handle removing non-existent listener gracefully', () => {
      const listener = () => {};
      emitter.off('test', listener);

      expect(emitter.emit('test')).toBe(false);
    });

    it('should return this for chaining', () => {
      const listener = () => {};
      const result = emitter.off('test', listener);

      expect(result).toBe(emitter);
    });
  });

  describe('emit', () => {
    it('should call all listeners for an event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      emitter.on('test', listener1);
      emitter.on('test', listener2);

      emitter.emit('test');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to listeners', () => {
      const listener = vi.fn();
      emitter.on('test', listener);

      emitter.emit('test', 'arg1', 'arg2', 123);

      expect(listener).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('should return false if no listeners exist', () => {
      expect(emitter.emit('test')).toBe(false);
    });

    it('should return true if listeners exist', () => {
      const listener = () => {};
      emitter.on('test', listener);

      expect(emitter.emit('test')).toBe(true);
    });

    it('should propagate errors from listeners', () => {
      const errorListener = () => {
        throw new Error('Test error');
      };
      const normalListener = vi.fn();
      emitter.on('test', errorListener);
      emitter.on('test', normalListener);

      // EventEmitter doesn't catch errors - they propagate
      expect(() => emitter.emit('test')).toThrow('Test error');
      // Note: normalListener may or may not be called depending on execution order
    });
  });

  describe('once', () => {
    it('should call listener only once', () => {
      const listener = vi.fn();
      emitter.once('test', listener);

      emitter.emit('test');
      emitter.emit('test');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should automatically remove listener after first call', () => {
      const listener = vi.fn();
      emitter.once('test', listener);

      emitter.emit('test');
      expect(listener).toHaveBeenCalledTimes(1);

      emitter.emit('test');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to listener', () => {
      const listener = vi.fn();
      emitter.once('test', listener);

      emitter.emit('test', 'arg1', 'arg2');

      expect(listener).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('addListener', () => {
    it('should be an alias for on', () => {
      const listener = vi.fn();
      emitter.addListener('test', listener);

      emitter.emit('test');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should return this for chaining', () => {
      const listener = () => {};
      const result = emitter.addListener('test', listener);

      expect(result).toBe(emitter);
    });
  });

  describe('removeListener', () => {
    it('should be an alias for off', () => {
      const listener = vi.fn();
      emitter.on('test', listener);
      emitter.removeListener('test', listener);

      emitter.emit('test');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should return this for chaining', () => {
      const listener = () => {};
      const result = emitter.removeListener('test', listener);

      expect(result).toBe(emitter);
    });
  });

  describe('multiple events', () => {
    it('should handle multiple different events independently', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      emitter.on('event1', listener1);
      emitter.on('event2', listener2);

      emitter.emit('event1');
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();

      emitter.emit('event2');
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should allow same listener for multiple events', () => {
      const listener = vi.fn();
      emitter.on('event1', listener);
      emitter.on('event2', listener);

      emitter.emit('event1');
      emitter.emit('event2');

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });
});
