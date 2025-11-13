/**
 * Test utilities and helpers for component testing
 */
import React from 'react';
import {BrowserRouter} from 'react-router-dom';
import {ThemeProvider, CssBaseline} from '@mui/material';
import {createAppTheme} from '../theme/theme';
import GlobalContext from '@crosswithfriends/shared/lib/GlobalContext';
import ErrorBoundary from '../components/common/ErrorBoundary';

/**
 * Default test wrapper that provides all necessary context providers
 */
export function TestWrapper({children}: {children: React.ReactNode}) {
  const theme = createAppTheme(false);
  const mockToggleDarkMode = () => {};
  const mockDarkModePreference = '0';

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <GlobalContext.Provider
            value={{toggleMolesterMoons: mockToggleDarkMode, darkModePreference: mockDarkModePreference}}
          >
            {children}
          </GlobalContext.Provider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

/**
 * Wrapper with custom router context
 */
export function RouterWrapper({
  children,
  initialEntries = ['/'],
}: {
  children: React.ReactNode;
  initialEntries?: string[];
}) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

/**
 * Wrapper with MUI theme only
 */
export function ThemeWrapper({children}: {children: React.ReactNode}) {
  const theme = createAppTheme(false);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

/**
 * Wrapper with GlobalContext only
 */
export function GlobalContextWrapper({children}: {children: React.ReactNode}) {
  const mockToggleDarkMode = () => {};
  const mockDarkModePreference = '0';
  return (
    <GlobalContext.Provider
      value={{toggleMolesterMoons: mockToggleDarkMode, darkModePreference: mockDarkModePreference}}
    >
      {children}
    </GlobalContext.Provider>
  );
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(condition: () => boolean, timeout = 5000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
