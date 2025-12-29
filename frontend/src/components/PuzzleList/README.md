# Puzzle List Components

## Overview

This directory contains components for displaying and filtering the puzzle list on the Welcome page.

## Components

### `PuzzleListComponent.tsx`

Main component that orchestrates puzzle listing with filtering, search, and infinite scroll.

**Features**:

- Infinite scroll pagination
- Real-time search
- Comprehensive filtering via sidebar
- URL state persistence
- Loading and error states
- Responsive grid layout

**Usage**:

```tsx
import PuzzleListComponent from '@components/PuzzleList/PuzzleListComponent';

function Welcome() {
  return <PuzzleListComponent />;
}
```

### `FilterSidebar.tsx`

Collapsible sidebar with all filter controls.

**Props**:

```typescript
interface FilterSidebarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  isOpen: boolean;
  onToggle: () => void;
}
```

**FilterState Interface**:

```typescript
interface FilterState {
  size: { Mini: boolean; Standard: boolean };
  status: { New: boolean; InProgress: boolean; Complete: boolean };
  difficulty: { Easy: boolean; Medium: boolean; Hard: boolean };
  author: string;
  dateFrom: string; // ISO date format
  dateTo: string; // ISO date format
}
```

### `PuzzleListItem.tsx`

Individual puzzle card component (existing).

## Filter Behavior

### Default State

By default, all filters are **enabled** (showing all puzzles):

- ✅ All sizes
- ✅ All statuses
- ✅ All difficulties
- ✅ No author filter
- ✅ No date range

### URL Parameters

Filter state is persisted in URL query parameters:

| Filter        | URL Parameter       | Values                 |
| ------------- | ------------------- | ---------------------- |
| Mini size     | `size_mini`         | `0` = off, absent = on |
| Standard size | `size_standard`     | `0` = off, absent = on |
| New status    | `status_new`        | `0` = off, absent = on |
| In Progress   | `status_inprogress` | `0` = off, absent = on |
| Complete      | `status_complete`   | `0` = off, absent = on |
| Easy          | `difficulty_easy`   | `0` = off, absent = on |
| Medium        | `difficulty_medium` | `0` = off, absent = on |
| Hard          | `difficulty_hard`   | `0` = off, absent = on |
| Author        | `author`            | string value           |
| Date From     | `date_from`         | YYYY-MM-DD             |
| Date To       | `date_to`           | YYYY-MM-DD             |

**Example URLs**:

```
# Show only mini puzzles
?size_standard=0

# Show only new and in-progress puzzles by specific author
?status_complete=0&author=Jane+Doe

# Show hard puzzles added in December 2024
?difficulty_easy=0&difficulty_medium=0&date_from=2024-12-01&date_to=2024-12-31
```

## Responsive Behavior

### Desktop (≥1024px)

- Sidebar always visible on the left
- Fixed width of 320px (80 Tailwind units)
- Main content takes remaining space
- Smooth hover effects

### Mobile (<1024px)

- Sidebar hidden by default
- Floating action button (FAB) in bottom-right corner
- Sidebar slides in from left when opened
- Dark overlay behind sidebar
- Touch-optimized controls

## Accessibility

### Keyboard Navigation

- All checkboxes accessible via Tab
- Enter/Space to toggle checkboxes
- Escape to close mobile sidebar
- Focus management on open/close

### Screen Readers

- Proper ARIA labels on all interactive elements
- Semantic HTML structure
- Hidden decorative elements
- Clear filter descriptions

### Color Contrast

- WCAG AA compliant text contrast
- Focus indicators on all interactive elements
- Clear hover states

## Performance

### Optimizations

- `useMemo` for filter computation
- `useCallback` for event handlers
- Debounced search input (250ms)
- Infinite scroll with page-based loading
- React Query caching (5 min stale time)

### Bundle Impact

- FilterSidebar: ~3KB gzipped
- useFilterState hook: ~1KB gzipped
- No additional dependencies required
- Uses existing MUI icons

## Styling

### Tailwind Classes

The components use Tailwind CSS for styling with these key patterns:

**Colors**:

- Primary: `bg-primary`, `text-primary`, `border-primary`
- Gray scale: `gray-50` through `gray-900`
- White backgrounds with subtle borders

**Spacing**:

- Consistent padding with Tailwind spacing scale
- Gap utilities for flex/grid layouts
- Responsive spacing adjustments

**Transitions**:

- `transition-all duration-200` for smooth effects
- `transition-colors` for color changes
- `transition-transform` for mobile sidebar

## Testing

### Unit Tests

Test the `useFilterState` hook:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useFilterState } from '@hooks/useFilterState';

test('initializes with default filters', () => {
  const { result } = renderHook(() => useFilterState());
  expect(result.current.filterState.size.Mini).toBe(true);
});
```

### Component Tests

Test FilterSidebar interactions:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import FilterSidebar from './FilterSidebar';

test('toggles filter on checkbox click', () => {
  const handleChange = jest.fn();
  render(<FilterSidebar filters={...} onFilterChange={handleChange} />);

  const miniCheckbox = screen.getByLabelText('Mini');
  fireEvent.click(miniCheckbox);

  expect(handleChange).toHaveBeenCalledWith(
    expect.objectContaining({ size: { Mini: false, Standard: true } })
  );
});
```

### E2E Tests

Test complete user flows:

```typescript
test('user can filter puzzles by size', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Standard');

  // URL should update
  expect(page.url()).toContain('size_standard=0');

  // Results should update
  const puzzles = await page.locator('[data-testid="puzzle-item"]').count();
  expect(puzzles).toBeGreaterThan(0);
});
```

## Maintenance

### Adding New Filters

To add a new filter category:

1. Update `FilterState` interface in `FilterSidebar.tsx`
2. Add filter UI section in `FilterSidebar` component
3. Update `useFilterState` hook to handle URL params
4. Extend `PuzzleListFilters` in `api/types.ts`
5. Update API client serialization in `api/client.ts`
6. Update backend filter logic (if needed)

### Common Issues

**Filters not working?**

- Check browser console for API errors
- Verify URL parameters are being set
- Ensure backend supports the filter parameters

**Mobile sidebar won't open?**

- Check z-index conflicts
- Verify event handlers are attached
- Test on different screen sizes

**URL not updating?**

- Ensure react-router-dom is configured
- Check useSearchParams is available
- Verify replace: true option is set

## Future Improvements

1. **Filter Presets**: Save/load common filter combinations
2. **Smart Suggestions**: Show popular filter combinations
3. **Filter History**: Quick access to recently used filters
4. **Advanced Search**: Boolean operators (AND/OR/NOT)
5. **Filter Analytics**: Track most used filters
6. **Bulk Actions**: Select multiple puzzles from filtered results

---

**Last Updated**: December 3, 2025
