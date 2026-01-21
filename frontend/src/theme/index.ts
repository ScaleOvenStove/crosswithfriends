/**
 * MUI Theme Configuration
 * Distinctive design system with bold aesthetic choices
 */

import { createTheme } from '@mui/material/styles';
import type { Shadows, ThemeOptions } from '@mui/material/styles';

/**
 * Shared theme options with distinctive typography
 */
const baseTheme: ThemeOptions = {
  typography: {
    fontFamily: ['"Space Grotesk"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'].join(','),
    h1: {
      fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
    },
    h2: {
      fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      lineHeight: 1.2,
    },
    h3: {
      fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      lineHeight: 1.3,
    },
    h4: {
      fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    button: {
      fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: 600,
      letterSpacing: '0.01em',
    },
    body1: {
      fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
    },
    body2: {
      fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
        },
      },
    },
  },
};

const lightShadows: Shadows = [
  'none',
  '0 2px 8px rgba(44, 62, 80, 0.08)',
  '0 4px 16px rgba(44, 62, 80, 0.12)',
  '0 8px 24px rgba(44, 62, 80, 0.16)',
  '0 12px 32px rgba(44, 62, 80, 0.2)',
  '0 16px 40px rgba(44, 62, 80, 0.24)',
  '0 20px 48px rgba(44, 62, 80, 0.28)',
  '0 24px 56px rgba(44, 62, 80, 0.32)',
  '0 28px 64px rgba(44, 62, 80, 0.36)',
  '0 32px 72px rgba(44, 62, 80, 0.4)',
  '0 36px 80px rgba(44, 62, 80, 0.42)',
  '0 40px 88px rgba(44, 62, 80, 0.44)',
  '0 44px 96px rgba(44, 62, 80, 0.46)',
  '0 48px 104px rgba(44, 62, 80, 0.48)',
  '0 52px 112px rgba(44, 62, 80, 0.5)',
  '0 56px 120px rgba(44, 62, 80, 0.5)',
  '0 60px 128px rgba(44, 62, 80, 0.5)',
  '0 64px 136px rgba(44, 62, 80, 0.5)',
  '0 68px 144px rgba(44, 62, 80, 0.5)',
  '0 72px 152px rgba(44, 62, 80, 0.5)',
  '0 76px 160px rgba(44, 62, 80, 0.5)',
  '0 80px 168px rgba(44, 62, 80, 0.5)',
  '0 84px 176px rgba(44, 62, 80, 0.5)',
  '0 88px 184px rgba(44, 62, 80, 0.5)',
  '0 92px 192px rgba(44, 62, 80, 0.5)',
];

const darkShadows: Shadows = [
  'none',
  '0 2px 8px rgba(0, 0, 0, 0.3)',
  '0 4px 16px rgba(0, 0, 0, 0.34)',
  '0 8px 24px rgba(0, 0, 0, 0.38)',
  '0 12px 32px rgba(0, 0, 0, 0.42)',
  '0 16px 40px rgba(0, 0, 0, 0.46)',
  '0 20px 48px rgba(0, 0, 0, 0.5)',
  '0 24px 56px rgba(0, 0, 0, 0.5)',
  '0 28px 64px rgba(0, 0, 0, 0.5)',
  '0 32px 72px rgba(0, 0, 0, 0.5)',
  '0 36px 80px rgba(0, 0, 0, 0.5)',
  '0 40px 88px rgba(0, 0, 0, 0.5)',
  '0 44px 96px rgba(0, 0, 0, 0.5)',
  '0 48px 104px rgba(0, 0, 0, 0.5)',
  '0 52px 112px rgba(0, 0, 0, 0.5)',
  '0 56px 120px rgba(0, 0, 0, 0.5)',
  '0 60px 128px rgba(0, 0, 0, 0.5)',
  '0 64px 136px rgba(0, 0, 0, 0.5)',
  '0 68px 144px rgba(0, 0, 0, 0.5)',
  '0 72px 152px rgba(0, 0, 0, 0.5)',
  '0 76px 160px rgba(0, 0, 0, 0.5)',
  '0 80px 168px rgba(0, 0, 0, 0.5)',
  '0 84px 176px rgba(0, 0, 0, 0.5)',
  '0 88px 184px rgba(0, 0, 0, 0.5)',
  '0 92px 192px rgba(0, 0, 0, 0.5)',
];

/**
 * Light theme - Editorial ink palette: deep slate with warm amber accents
 */
export const lightTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'light',
    primary: {
      main: '#2c3e50',
      light: '#34495e',
      dark: '#1a252f',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ff6b35',
      light: '#ff8c5a',
      dark: '#e55a2b',
      contrastText: '#ffffff',
    },
    success: {
      main: '#27ae60',
      light: '#2ecc71',
      dark: '#1e8449',
    },
    warning: {
      main: '#f39c12',
      light: '#f1c40f',
      dark: '#d68910',
    },
    error: {
      main: '#c0392b',
      light: '#e74c3c',
      dark: '#922b21',
    },
    background: {
      default: '#fefcf8',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a1a1a',
      secondary: '#4a4a4a',
    },
    divider: 'rgba(44, 62, 80, 0.12)',
  },
  shadows: lightShadows,
});

/**
 * Dark theme - Rich charcoal with warm undertones
 */
export const darkTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#5d7a9a',
      light: '#7a9bc4',
      dark: '#4a6380',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ff8c5a',
      light: '#ffa87d',
      dark: '#ff6b35',
      contrastText: '#ffffff',
    },
    success: {
      main: '#2ecc71',
      light: '#52de88',
      dark: '#27ae60',
    },
    warning: {
      main: '#f1c40f',
      light: '#f7dc6f',
      dark: '#f39c12',
    },
    error: {
      main: '#e74c3c',
      light: '#ec7063',
      dark: '#c0392b',
    },
    background: {
      default: '#1a1a1a',
      paper: '#252525',
    },
    text: {
      primary: '#f5f5f5',
      secondary: '#b0b0b0',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
  },
  shadows: darkShadows,
});

/**
 * Get theme based on mode
 */
export const getTheme = (mode: 'light' | 'dark' = 'light') => {
  return mode === 'dark' ? darkTheme : lightTheme;
};

export default lightTheme;
