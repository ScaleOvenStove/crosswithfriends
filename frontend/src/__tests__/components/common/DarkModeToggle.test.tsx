import GlobalContext from '@crosswithfriends/shared/lib/GlobalContext';
import {ThemeProvider, CssBaseline} from '@mui/material';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {BrowserRouter} from 'react-router-dom';
import {describe, it, expect, vi} from 'vitest';

import {DarkModeToggle} from '../../../components/common/DarkModeToggle';
import ErrorBoundary from '../../../components/common/ErrorBoundary';
import {createAppTheme} from '../../../theme/theme';

const TestWrapper = ({
  darkModePreference,
  toggleMolesterMoons,
  children,
}: {
  darkModePreference: string;
  toggleMolesterMoons: () => void;
  children: React.ReactNode;
}) => {
  const theme = createAppTheme(false);

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <GlobalContext.Provider value={{darkModePreference, toggleMolesterMoons}}>
            {children}
          </GlobalContext.Provider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

describe('DarkModeToggle', () => {
  it('should render with light mode icon when preference is "0"', () => {
    const toggleFn = vi.fn();

    render(
      <TestWrapper darkModePreference="0" toggleMolesterMoons={toggleFn}>
        <DarkModeToggle />
      </TestWrapper>
    );

    const button = screen.getByLabelText('Toggle dark mode');
    expect(button).toBeInTheDocument();
  });

  it('should render with dark mode icon when preference is "1"', () => {
    const toggleFn = vi.fn();

    render(
      <TestWrapper darkModePreference="1" toggleMolesterMoons={toggleFn}>
        <DarkModeToggle />
      </TestWrapper>
    );

    const button = screen.getByLabelText('Toggle dark mode');
    expect(button).toBeInTheDocument();
  });

  it('should render with system icon when preference is "2"', () => {
    const toggleFn = vi.fn();

    render(
      <TestWrapper darkModePreference="2" toggleMolesterMoons={toggleFn}>
        <DarkModeToggle />
      </TestWrapper>
    );

    const button = screen.getByLabelText('Toggle dark mode');
    expect(button).toBeInTheDocument();
  });

  it('should call toggleMolesterMoons when clicked', async () => {
    const toggleFn = vi.fn();
    const user = userEvent.setup();

    render(
      <TestWrapper darkModePreference="0" toggleMolesterMoons={toggleFn}>
        <DarkModeToggle />
      </TestWrapper>
    );

    const button = screen.getByLabelText('Toggle dark mode');
    await user.click(button);

    expect(toggleFn).toHaveBeenCalledTimes(1);
  });

  it('should show correct tooltip for light mode', async () => {
    const toggleFn = vi.fn();
    const user = userEvent.setup();

    render(
      <TestWrapper darkModePreference="0" toggleMolesterMoons={toggleFn}>
        <DarkModeToggle />
      </TestWrapper>
    );

    const button = screen.getByLabelText('Toggle dark mode');
    await user.hover(button);

    const tooltip = await screen.findByText(/Dark mode: Off/i);
    expect(tooltip).toBeInTheDocument();
  });

  it('should show correct tooltip for dark mode', async () => {
    const toggleFn = vi.fn();
    const user = userEvent.setup();

    render(
      <TestWrapper darkModePreference="1" toggleMolesterMoons={toggleFn}>
        <DarkModeToggle />
      </TestWrapper>
    );

    const button = screen.getByLabelText('Toggle dark mode');
    await user.hover(button);

    const tooltip = await screen.findByText(/Dark mode: On/i);
    expect(tooltip).toBeInTheDocument();
  });

  it('should show correct tooltip for system default', async () => {
    const toggleFn = vi.fn();
    const user = userEvent.setup();

    render(
      <TestWrapper darkModePreference="2" toggleMolesterMoons={toggleFn}>
        <DarkModeToggle />
      </TestWrapper>
    );

    const button = screen.getByLabelText('Toggle dark mode');
    await user.hover(button);

    const tooltip = await screen.findByText(/System default/i);
    expect(tooltip).toBeInTheDocument();
  });
});
