import {screen} from '@testing-library/react';
import {describe, it, expect} from 'vitest';

import LoadingSpinner from '../../../components/common/LoadingSpinner';
import {renderWithProviders} from '../../utils';

describe('LoadingSpinner', () => {
  it('should render with default message', () => {
    renderWithProviders(<LoadingSpinner />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    renderWithProviders(<LoadingSpinner message="Please wait..." />);

    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('should render with custom size', () => {
    const {container} = renderWithProviders(<LoadingSpinner size={60} />);

    const progress = container.querySelector('.MuiCircularProgress-root');
    expect(progress).toBeInTheDocument();
  });

  it('should render full screen when fullScreen is true', () => {
    const {container} = renderWithProviders(<LoadingSpinner fullScreen />);

    const box = container.firstChild as HTMLElement;
    expect(box).toHaveStyle({height: '100vh', width: '100vw'});
  });

  it('should not render full screen when fullScreen is false', () => {
    const {container} = renderWithProviders(<LoadingSpinner fullScreen={false} />);

    const box = container.firstChild as HTMLElement;
    expect(box).not.toHaveStyle({height: '100vh', width: '100vw'});
  });

  it('should render circular progress', () => {
    const {container} = renderWithProviders(<LoadingSpinner />);

    const progress = container.querySelector('.MuiCircularProgress-root');
    expect(progress).toBeInTheDocument();
  });
});
