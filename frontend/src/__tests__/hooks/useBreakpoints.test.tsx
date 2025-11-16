import {ThemeProvider, createTheme} from '@mui/material';
import {renderHook} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import useBreakpoints from '../../hooks/useBreakpoints';

// Mock useMediaQuery
const mockUseMediaQuery = vi.fn();

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material');
  return {
    ...actual,
    useMediaQuery: (query: any) => mockUseMediaQuery(query),
  };
});

describe('useBreakpoints', () => {
  const theme = createTheme();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return breakpoint values', () => {
    // Mock all breakpoints to return false initially
    mockUseMediaQuery.mockReturnValue(false);

    const {result} = renderHook(() => useBreakpoints(), {
      wrapper: ({children}) => <ThemeProvider theme={theme}>{children}</ThemeProvider>,
    });

    expect(result.current).toHaveProperty('isXs');
    expect(result.current).toHaveProperty('isSm');
    expect(result.current).toHaveProperty('isMd');
    expect(result.current).toHaveProperty('isLg');
    expect(result.current).toHaveProperty('isXl');
    expect(result.current).toHaveProperty('isMobile');
    expect(result.current).toHaveProperty('isTablet');
    expect(result.current).toHaveProperty('isDesktop');
    expect(result.current).toHaveProperty('isLargeDesktop');
    expect(result.current).toHaveProperty('isSmallScreen');
    expect(result.current).toHaveProperty('isLargeScreen');
  });

  it('should return mobile breakpoint properties', () => {
    // Mock all queries to return false except one that would make isMobile true
    let callIndex = 0;
    mockUseMediaQuery.mockImplementation(() => {
      callIndex++;
      // Return true for the 18th call which corresponds to isMobile (theme.breakpoints.down('sm'))
      return callIndex === 18;
    });

    const {result} = renderHook(() => useBreakpoints(), {
      wrapper: ({children}) => <ThemeProvider theme={theme}>{children}</ThemeProvider>,
    });

    // Verify the structure exists
    expect(result.current).toHaveProperty('isMobile');
    expect(result.current).toHaveProperty('isSmallScreen');
    expect(typeof result.current.isMobile).toBe('boolean');
  });

  it('should return desktop breakpoint properties', () => {
    // Mock all queries to return false except one that would make isDesktop true
    let callIndex = 0;
    mockUseMediaQuery.mockImplementation(() => {
      callIndex++;
      // Return true for the 20th call which corresponds to isDesktop (theme.breakpoints.up('md'))
      return callIndex === 20;
    });

    const {result} = renderHook(() => useBreakpoints(), {
      wrapper: ({children}) => <ThemeProvider theme={theme}>{children}</ThemeProvider>,
    });

    // Verify the structure exists
    expect(result.current).toHaveProperty('isDesktop');
    expect(result.current).toHaveProperty('isLargeScreen');
    expect(typeof result.current.isDesktop).toBe('boolean');
  });

  it('should memoize return value', () => {
    mockUseMediaQuery.mockReturnValue(false);

    const {result, rerender} = renderHook(() => useBreakpoints(), {
      wrapper: ({children}) => <ThemeProvider theme={theme}>{children}</ThemeProvider>,
    });

    const firstResult = result.current;
    rerender();
    const secondResult = result.current;

    // Should return same object reference if values haven't changed
    expect(firstResult).toBe(secondResult);
  });
});
