import {screen, act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {AccountError} from '../../../components/common/AccountError';
import {renderWithProviders} from '../../utils';

describe('AccountError', () => {
  beforeEach(() => {
    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: {
        reload: vi.fn(),
      },
      writable: true,
    });
  });

  it('should render error message', () => {
    renderWithProviders(<AccountError />);

    expect(screen.getByText('Account Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong while loading your account.')).toBeInTheDocument();
  });

  it('should render reload button', () => {
    renderWithProviders(<AccountError />);

    const reloadButton = screen.getByRole('button', {name: /reload page/i});
    expect(reloadButton).toBeInTheDocument();
  });

  it('should reload page when reload button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountError />);

    const reloadButton = screen.getByRole('button', {name: /reload page/i});
    await act(async () => {
      await user.click(reloadButton);
    });

    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});
