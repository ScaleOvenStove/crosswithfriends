import {render, screen} from '@testing-library/react';
import {describe, it, expect, vi, afterEach} from 'vitest';

import MaintenanceBanner from '../../../components/common/MaintenanceBanner';

describe('MaintenanceBanner', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should not render when VITE_MAINTENANCE_BANNER_ACTIVE is not "true"', () => {
    vi.stubEnv('VITE_MAINTENANCE_BANNER_ACTIVE', 'false');
    const {container} = render(<MaintenanceBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render when VITE_MAINTENANCE_BANNER_ACTIVE is "true"', () => {
    vi.stubEnv('VITE_MAINTENANCE_BANNER_ACTIVE', 'true');
    render(<MaintenanceBanner />);
    expect(screen.getByText(/Site is under maintenance/i)).toBeInTheDocument();
  });

  it('should render custom message', () => {
    vi.stubEnv('VITE_MAINTENANCE_BANNER_ACTIVE', 'true');
    vi.stubEnv('VITE_MAINTENANCE_BANNER_MESSAGE', 'Custom Maintenance Message');
    render(<MaintenanceBanner />);
    expect(screen.getByText('Custom Maintenance Message')).toBeInTheDocument();
  });
});
