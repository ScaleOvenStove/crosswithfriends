import {useTheme, useMediaQuery} from '@mui/material';
import {useMemo} from 'react';

/**
 * Custom hook to get responsive breakpoint information
 * Returns boolean values for each breakpoint and a helper to check if mobile
 */
export const useBreakpoints = () => {
  const theme = useTheme();

  const isXs = useMediaQuery(theme.breakpoints.only('xs'));
  const isSm = useMediaQuery(theme.breakpoints.only('sm'));
  const isMd = useMediaQuery(theme.breakpoints.only('md'));
  const isLg = useMediaQuery(theme.breakpoints.only('lg'));
  const isXl = useMediaQuery(theme.breakpoints.only('xl'));

  // Range queries
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // < 600px
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600px - 900px
  const isDesktop = useMediaQuery(theme.breakpoints.up('md')); // >= 900px
  const isLargeDesktop = useMediaQuery(theme.breakpoints.up('lg')); // >= 1200px

  // Specific breakpoint checks
  const isAtLeastSm = useMediaQuery(theme.breakpoints.up('sm')); // >= 600px
  const isAtLeastMd = useMediaQuery(theme.breakpoints.up('md')); // >= 900px
  const isAtLeastLg = useMediaQuery(theme.breakpoints.up('lg')); // >= 1200px

  const isAtMostSm = useMediaQuery(theme.breakpoints.down('sm')); // <= 600px
  const isAtMostMd = useMediaQuery(theme.breakpoints.down('md')); // <= 900px
  const isAtMostLg = useMediaQuery(theme.breakpoints.down('lg')); // <= 1200px

  return useMemo(
    () => ({
      // Exact breakpoints
      isXs,
      isSm,
      isMd,
      isLg,
      isXl,
      // Range queries
      isMobile,
      isTablet,
      isDesktop,
      isLargeDesktop,
      // At least queries
      isAtLeastSm,
      isAtLeastMd,
      isAtLeastLg,
      // At most queries
      isAtMostSm,
      isAtMostMd,
      isAtMostLg,
      // Helper for common use case
      isSmallScreen: isMobile || isTablet,
      isLargeScreen: isDesktop || isLargeDesktop,
    }),
    [
      isXs,
      isSm,
      isMd,
      isLg,
      isXl,
      isMobile,
      isTablet,
      isDesktop,
      isLargeDesktop,
      isAtLeastSm,
      isAtLeastMd,
      isAtLeastLg,
      isAtMostSm,
      isAtMostMd,
      isAtMostLg,
    ]
  );
};

export default useBreakpoints;
