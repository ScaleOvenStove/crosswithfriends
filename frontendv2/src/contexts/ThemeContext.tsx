/**
 * Theme Context - Provides dynamic theme switching with MUI integration
 * Supports light, dark, and system preference modes
 */

import { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { useUserStore } from '@stores/userStore';
import { lightTheme, darkTheme } from '@theme/index';
import type { Theme } from '@mui/material/styles';

interface ThemeContextType {
  mode: 'light' | 'dark';
  effectiveMode: 'light' | 'dark' | 'system';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * ThemeProvider component that manages MUI theme based on user preference
 * Supports light, dark, and system preference modes
 */
export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const { darkMode } = useUserStore();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  
  // Determine effective theme mode
  const effectiveMode = useMemo(() => {
    if (darkMode === 'system') {
      return prefersDarkMode ? 'dark' : 'light';
    }
    return darkMode;
  }, [darkMode, prefersDarkMode]);

  // Get the appropriate MUI theme
  const theme = useMemo<Theme>(() => {
    return effectiveMode === 'dark' ? darkTheme : lightTheme;
  }, [effectiveMode]);

  // Sync with document class for Tailwind CSS dark mode
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveMode]);

  // Note: useMediaQuery automatically handles system preference changes,
  // so no additional listener is needed

  const contextValue = useMemo(
    () => ({
      mode: effectiveMode,
      effectiveMode: darkMode,
    }),
    [effectiveMode, darkMode]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

