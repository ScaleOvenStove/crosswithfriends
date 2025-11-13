import {createTheme} from '@mui/material/styles';

// Custom breakpoints that match common device sizes
const breakpoints = {
  values: {
    xs: 0,
    sm: 600, // Small tablets (portrait)
    md: 900, // Tablets (landscape) / Small laptops
    lg: 1200, // Desktops
    xl: 1536, // Large desktops
  },
};

// Extended breakpoint values for more granular control
export const customBreakpoints = {
  mobile: 0,
  tablet: 640,
  laptop: 1024,
  desktop: 1200,
  wide: 1536,
};

// Theme configuration
const themeOptions = {
  breakpoints,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
            '&:hover': {
              background: 'rgba(0, 0, 0, 0.3)',
            },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease-in-out',
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
        },
      },
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      [`@media (max-width:${breakpoints.values.md}px)`]: {
        fontSize: '2rem',
      },
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      [`@media (max-width:${breakpoints.values.md}px)`]: {
        fontSize: '1.75rem',
      },
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      [`@media (max-width:${breakpoints.values.md}px)`]: {
        fontSize: '1.5rem',
      },
    },
    body1: {
      fontSize: '1rem',
      [`@media (max-width:${breakpoints.values.sm}px)`]: {
        fontSize: '0.9rem',
      },
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8, // 8px base spacing unit
};

// Create the base theme
export const baseTheme = createTheme(themeOptions);

// Create a function to generate theme with dark mode support
export const createAppTheme = (darkMode: boolean = false) => {
  return createTheme({
    ...themeOptions,
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#6aa9f4',
        light: '#8bb8f6',
        dark: '#4a7bc2',
        contrastText: '#fff',
      },
      secondary: {
        main: '#f50057',
        light: '#ff4081',
        dark: '#c51162',
        contrastText: '#fff',
      },
      background: {
        default: darkMode ? '#121212' : '#ffffff',
        paper: darkMode ? '#1e1e1e' : '#ffffff',
      },
    },
  });
};

export default baseTheme;
