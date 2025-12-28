/**
 * Unit tests for OptimisticUpdateQueue
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OptimisticUpdateQueue,
  optimisticUpdateQueue as _optimisticUpdateQueue,
} from '../optimisticUpdateQueue';

describe('OptimisticUpdateQueue', () => {
  let queue: OptimisticUpdateQueue;

  beforeEach(() => {
    queue = new OptimisticUpdateQueue();
  });

  it('should add and confirm updates', () => {
    const apply = vi.fn();
    const rollback = vi.fn();
    const onSuccess = vi.fn();

    const update: OptimisticUpdate = {
      id: 'test-1',
      type: 'cell',
      timestamp: Date.now(),
      originalState: { value: 'A' },
      apply,
      rollback,
      onSuccess,
    };

    queue.add(update);
    expect(apply).toHaveBeenCalled();
    expect(queue.hasPending()).toBe(true);

    queue.confirm('test-1');
    expect(onSuccess).toHaveBeenCalled();
    expect(queue.hasPending()).toBe(false);
  });

  it('should rollback failed updates', () => {
    const apply = vi.fn();
    const rollback = vi.fn();
    const onError = vi.fn();

    const update: OptimisticUpdate = {
      id: 'test-2',
      type: 'cell',
      timestamp: Date.now(),
      originalState: { value: 'A' },
      apply,
      rollback,
      onError,
    };

    queue.add(update);
    queue.rollback('test-2', new Error('Failed'));

    expect(rollback).toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });

  it('should rollback all pending updates', () => {
    const rollback1 = vi.fn();
    const rollback2 = vi.fn();

    queue.add({
      id: 'test-3',
      type: 'cell',
      timestamp: Date.now(),
      originalState: {},
      apply: vi.fn(),
      rollback: rollback1,
    });

    queue.add({
      id: 'test-4',
      type: 'cell',
      timestamp: Date.now(),
      originalState: {},
      apply: vi.fn(),
      rollback: rollback2,
    });

    queue.rollbackAll();

    expect(rollback1).toHaveBeenCalled();
    expect(rollback2).toHaveBeenCalled();
    expect(queue.hasPending()).toBe(false);
  });
});
