import {render, screen} from '@testing-library/react';
import {describe, it, expect} from 'vitest';

import MaintenanceSplash from '../../../components/common/MaintenanceSplash';

describe('MaintenanceSplash', () => {
  it('should render correctly', () => {
    render(<MaintenanceSplash />);
    expect(screen.getByText('Maintenance in Progress')).toBeInTheDocument();
    expect(screen.getByText(/We are currently performing scheduled maintenance/i)).toBeInTheDocument();
  });
});
