import {screen, act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {RoomError} from '../../../components/common/RoomError';
import {renderWithProviders} from '../../utils';

describe('RoomError', () => {
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
    renderWithProviders(<RoomError />);

    expect(screen.getByText('Room Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong while loading the room.')).toBeInTheDocument();
  });

  it('should render reload button', () => {
    renderWithProviders(<RoomError />);

    const reloadButton = screen.getByRole('button', {name: /reload page/i});
    expect(reloadButton).toBeInTheDocument();
  });

  it('should reload page when reload button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RoomError />);

    const reloadButton = screen.getByRole('button', {name: /reload page/i});
    await act(async () => {
      await user.click(reloadButton);
    });

    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});
