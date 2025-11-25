import {act} from '@testing-library/react';
import React from 'react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import RerenderBoundary from '../../components/RerenderBoundary';
import {logger} from '../../utils/logger';
import {renderWithProviders} from '../utils';

// Mock logger.debug
const loggerDebugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => {});

describe('RerenderBoundary', () => {
  beforeEach(() => {
    loggerDebugSpy.mockClear();
  });

  it('should render children', () => {
    const {getByText} = renderWithProviders(
      <RerenderBoundary name="test" hash="hash1">
        <div>Test Content</div>
      </RerenderBoundary>
    );

    expect(getByText('Test Content')).toBeInTheDocument();
  });

  it('should update children when hash changes', () => {
    const {rerender, getByText} = renderWithProviders(
      <RerenderBoundary name="test" hash="hash1">
        <div>Content 1</div>
      </RerenderBoundary>
    );

    expect(getByText('Content 1')).toBeInTheDocument();

    act(() => {
      rerender(
        <RerenderBoundary name="test" hash="hash2">
          <div>Content 2</div>
        </RerenderBoundary>
      );
    });

    expect(getByText('Content 2')).toBeInTheDocument();
    expect(loggerDebugSpy).toHaveBeenCalledWith(
      'Rerendering boundary',
      expect.objectContaining({name: 'test'})
    );
  });

  it('should not update children when hash does not change', () => {
    loggerDebugSpy.mockClear();

    const {rerender, getByText} = renderWithProviders(
      <RerenderBoundary name="test" hash="hash1">
        <div>Content 1</div>
      </RerenderBoundary>
    );

    expect(getByText('Content 1')).toBeInTheDocument();
    loggerDebugSpy.mockClear(); // Clear initial render log if any

    act(() => {
      rerender(
        <RerenderBoundary name="test" hash="hash1">
          <div>Content 2</div>
        </RerenderBoundary>
      );
    });

    // Should still show Content 1 because hash didn't change
    expect(getByText('Content 1')).toBeInTheDocument();
    // The component only logs when hash changes, so after clearing, it shouldn't log
    expect(loggerDebugSpy).not.toHaveBeenCalled();
  });

  it('should log debug message when rerendering', () => {
    const {rerender} = renderWithProviders(
      <RerenderBoundary name="test-component" hash="hash1">
        <div>Content</div>
      </RerenderBoundary>
    );

    act(() => {
      rerender(
        <RerenderBoundary name="test-component" hash="hash2">
          <div>Content</div>
        </RerenderBoundary>
      );
    });

    expect(loggerDebugSpy).toHaveBeenCalledWith(
      'Rerendering boundary',
      expect.objectContaining({name: 'test-component'})
    );
  });

  it('should handle multiple children', () => {
    const {getByText} = renderWithProviders(
      <RerenderBoundary name="test" hash="hash1">
        <div>Child 1</div>
        <div>Child 2</div>
      </RerenderBoundary>
    );

    expect(getByText('Child 1')).toBeInTheDocument();
    expect(getByText('Child 2')).toBeInTheDocument();
  });
});
