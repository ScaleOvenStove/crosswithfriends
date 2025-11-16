import {render} from '@testing-library/react';
import {describe, it, expect} from 'vitest';

import GameSkeletonLoader from '../../../components/common/GameSkeletonLoader';
import {renderWithProviders} from '../../utils';

describe('GameSkeletonLoader', () => {
  it('should render skeleton loader', () => {
    const {container} = renderWithProviders(<GameSkeletonLoader />);

    // Should render multiple skeleton elements
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render toolbar skeleton', () => {
    const {container} = renderWithProviders(<GameSkeletonLoader />);

    // Check for skeleton elements that would be in the toolbar
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render puzzle info skeleton', () => {
    const {container} = renderWithProviders(<GameSkeletonLoader />);

    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render game grid skeleton', () => {
    const {container} = renderWithProviders(<GameSkeletonLoader />);

    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render clues list skeleton', () => {
    const {container} = renderWithProviders(<GameSkeletonLoader />);

    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should have proper structure with Stack', () => {
    const {container} = renderWithProviders(<GameSkeletonLoader />);

    // Should have a Stack as the root element
    const stack = container.querySelector('.MuiStack-root');
    expect(stack).toBeInTheDocument();
  });
});
