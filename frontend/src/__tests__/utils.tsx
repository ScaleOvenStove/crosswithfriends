/**
 * Test utilities and helpers for Vitest unit tests
 */
import GlobalContext from '@crosswithfriends/shared/lib/GlobalContext';
import {ThemeProvider, CssBaseline} from '@mui/material';
import {render, type RenderOptions} from '@testing-library/react';
import React from 'react';
import {BrowserRouter} from 'react-router-dom';

import ErrorBoundary from '../components/common/ErrorBoundary';
import {createAppTheme} from '../theme/theme';

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
 * Custom render function that includes all providers
 */
export function renderWithProviders(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, {
    wrapper: TestWrapper,
    ...options,
  });
}

/**
 * Re-export everything from @testing-library/react
 */
export * from '@testing-library/react';
