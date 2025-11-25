# Quickstart: Fix Linting Errors and Modernize Frontend

**Feature**: Fix Linting Errors and Modernize Frontend  
**Date**: 2025-11-17

## Overview

This guide provides step-by-step instructions for fixing linting errors and modernizing the frontend codebase.

## Prerequisites

- Node.js v20 or higher
- Yarn 4.11.0
- Access to the frontend workspace

## Implementation Steps

### Step 1: Identify All Linting Errors

```bash
cd frontend
yarn lint > lint-errors.txt 2>&1
```

Review `lint-errors.txt` to understand the scope of issues.

### Step 2: Fix Critical Errors First

Priority order:

1. **Missing imports** (e.g., `useCallback` not defined)
2. **TypeScript compilation errors** (type errors that prevent compilation)
3. **React hooks dependency issues** (missing dependencies in arrays)

### Step 3: Fix React Hooks Issues

For each component with hook dependency issues:

1. **Missing dependencies**: Add missing dependencies to dependency arrays
2. **Unnecessary dependencies**: Remove unnecessary dependencies
3. **Props in dependency arrays**: Destructure props outside useCallback/useMemo

Example fix:

```typescript
// Before
const handleClick = useCallback(() => {
  doSomething(props.value);
}, []); // Missing props.value

// After
const {value} = props;
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);
```

### Step 4: Fix TypeScript Type Issues

1. **Replace `any` types**: Use proper types from `@crosswithfriends/shared`
2. **Remove non-null assertions**: Use type guards instead

Example fix:

```typescript
// Before
function process(data: any) {
  return data.value!.toString();
}

// After
function process(data: {value: string | null}) {
  if (data.value === null) {
    throw new Error('Value is required');
  }
  return data.value.toString();
}
```

### Step 5: Fix React Component Patterns

1. **Arrow functions in JSX**: Extract to useCallback
2. **Ref access during render**: Move to event handlers or effects
3. **Array index keys**: Use stable unique keys

Example fix:

```typescript
// Before
{items.map((item, index) => (
  <div key={index}>{item.name}</div>
))}

// After
{items.map((item) => (
  <div key={item.id}>{item.name}</div>
))}
```

### Step 6: Fix Code Quality Warnings

1. **Bitwise operations**: Replace or document justification
2. **Underscore variables**: Remove or justify
3. **Prop spreading**: Review and justify or replace

### Step 7: Validate Fixes

After each category of fixes:

```bash
# Run linter
yarn lint

# Run TypeScript compiler
cd frontend
npx tsc --noEmit

# Run tests
yarn test

# Build to ensure no compilation errors
yarn build
```

### Step 8: Test Functionality

1. Start development server: `yarn dev`
2. Manually test affected components
3. Verify no console warnings or errors
4. Verify functionality is preserved

## Common Fix Patterns

### Pattern 1: Fix Missing Hook Dependencies

```typescript
// Problem: Missing dependency
const memoized = useMemo(() => compute(value), []);

// Solution: Add dependency
const memoized = useMemo(() => compute(value), [value]);
```

### Pattern 2: Fix Arrow Functions in JSX

```typescript
// Problem: Arrow function in JSX
<Button onClick={() => handleClick(id)} />

// Solution: Use useCallback
const handleClickCallback = useCallback(() => handleClick(id), [id]);
<Button onClick={handleClickCallback} />
```

### Pattern 3: Fix Ref Access During Render

```typescript
// Problem: Accessing ref during render
const MyComponent = () => {
  const ref = useRef(null);
  return <div>{ref.current?.value}</div>; // ❌
};

// Solution: Move to effect or event handler
const MyComponent = () => {
  const ref = useRef(null);
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    setValue(ref.current?.value ?? null);
  }, []);

  return <div>{value}</div>; // ✅
};
```

### Pattern 4: Replace Non-null Assertions

```typescript
// Problem: Non-null assertion
const value = data.value!;

// Solution: Type guard
if (data.value === null || data.value === undefined) {
  throw new Error('Value is required');
}
const value = data.value;
```

## Validation Checklist

After completing fixes, verify:

- [ ] `yarn lint` passes with zero errors
- [ ] `tsc --noEmit` passes with zero errors
- [ ] `yarn test` passes
- [ ] `yarn build` succeeds
- [ ] No console warnings in browser
- [ ] All functionality works as before
- [ ] Code review shows no new linting errors

## Notes

- Fix errors incrementally by category
- Test after each category to catch issues early
- Document any complex fixes with inline comments
- If a fix requires significant refactoring, document it separately
