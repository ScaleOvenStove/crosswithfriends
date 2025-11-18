# Theme Configuration & Breakpoints

This directory contains the MUI theme configuration with dynamic breakpoints for responsive design.

## Breakpoints

The theme uses the following breakpoint values:

- **xs**: 0px - Extra small devices (phones)
- **sm**: 600px - Small devices (tablets in portrait)
- **md**: 900px - Medium devices (tablets in landscape, small laptops)
- **lg**: 1200px - Large devices (desktops)
- **xl**: 1536px - Extra large devices (large desktops)

## Usage

### Using the Theme

The theme is automatically applied in `index.tsx` and supports dark mode:

```tsx
import {createAppTheme} from './theme/theme';

const theme = createAppTheme(darkMode);
```

### Using Breakpoints Hook

Use the `useBreakpoints` hook for responsive design:

```tsx
import {useBreakpoints} from '../hooks/useBreakpoints';

const MyComponent = () => {
  const {isMobile, isTablet, isDesktop, isAtLeastMd} = useBreakpoints();

  return (
    <Box
      sx={{
        padding: isMobile ? 2 : 4,
        display: isDesktop ? 'flex' : 'block',
      }}
    >
      {isAtLeastMd && <Sidebar />}
      <MainContent />
    </Box>
  );
};
```

### Using MUI Breakpoint Helpers

You can also use MUI's built-in breakpoint helpers in the `sx` prop:

```tsx
<Box
  sx={{
    width: {xs: '100%', sm: '50%', md: '33%', lg: '25%'},
    padding: {xs: 1, sm: 2, md: 3},
  }}
>
  Responsive content
</Box>
```

### Breakpoint Queries Available

The `useBreakpoints` hook provides:

- **Exact breakpoints**: `isXs`, `isSm`, `isMd`, `isLg`, `isXl`
- **Range queries**: `isMobile` (< 600px), `isTablet` (600-900px), `isDesktop` (>= 900px)
- **At least queries**: `isAtLeastSm`, `isAtLeastMd`, `isAtLeastLg`
- **At most queries**: `isAtMostSm`, `isAtMostMd`, `isAtMostLg`
- **Helpers**: `isSmallScreen`, `isLargeScreen`

## Migration from `isMobile()`

The old `isMobile()` function uses user agent detection. For better responsive design, consider migrating to the breakpoint hook:

**Before:**

```tsx
import {isMobile} from '@crosswithfriends/shared/lib/jsUtils';
const mobile = isMobile();
```

**After:**

```tsx
import {useBreakpoints} from '../hooks/useBreakpoints';
const {isMobile} = useBreakpoints();
```

## Dark Mode

The theme automatically adapts to dark mode when enabled. The theme is recreated when dark mode changes to ensure proper color schemes.
