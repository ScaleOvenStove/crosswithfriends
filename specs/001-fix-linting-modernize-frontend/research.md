# Research: Fix Linting Errors and Modernize Frontend

**Feature**: Fix Linting Errors and Modernize Frontend  
**Date**: 2025-11-17  
**Status**: Complete

## Research Findings

### React 19 Hooks Best Practices

**Decision**: Use React 19 hooks patterns with proper dependency arrays and avoid accessing refs during render.

**Rationale**:

- React 19 has stricter rules about hooks dependencies to prevent bugs
- Refs should only be accessed in event handlers or effects, not during render
- Arrow functions in JSX props cause unnecessary re-renders and should use useCallback

**Key Patterns**:

- All hook dependencies must be included in dependency arrays
- Destructure props outside useCallback to avoid including entire props object
- Use useCallback for functions passed as props to prevent re-renders
- Access refs only in event handlers, effects, or other non-render contexts

**Alternatives considered**:

- N/A - React 19 is already in use and these are the recommended patterns

### TypeScript 5.9 Type Safety Patterns

**Decision**: Use strict type checking, avoid `any` types, use proper type guards instead of non-null assertions.

**Rationale**:

- TypeScript 5.9 provides improved type inference
- `any` types defeat the purpose of TypeScript's type safety
- Non-null assertions (`!`) are unsafe and can cause runtime errors
- Type guards provide safer null checking

**Key Patterns**:

- Replace `any` with specific types from `@crosswithfriends/shared` package
- Use type guards (`if (value !== null)`) instead of non-null assertions
- Leverage TypeScript's type narrowing for safer code
- Use `unknown` instead of `any` when type is truly unknown, then narrow it

**Alternatives considered**:

- N/A - TypeScript 5.9 is already in use and strict typing is a constitution requirement

### ESLint 9 Configuration and Rules

**Decision**: Follow existing ESLint 9 flat config format and rule set.

**Rationale**:

- ESLint 9 uses a new flat config format (already configured)
- Existing rules are appropriate for React 19 and TypeScript 5.9
- No configuration changes needed - only fix violations

**Key Rules to Address**:

- `react-hooks/exhaustive-deps`: Fix missing or unnecessary dependencies
- `react/jsx-no-bind`: Replace arrow functions in JSX with useCallback
- `@typescript-eslint/no-explicit-any`: Replace `any` with proper types
- `@typescript-eslint/no-non-null-assertion`: Replace `!` with type guards
- `react/no-array-index-key`: Use stable unique keys
- `react-hooks/refs`: Move ref access out of render
- `no-bitwise`: Replace or justify bitwise operations
- `no-undef`: Fix missing imports

**Alternatives considered**:

- N/A - ESLint 9 is already configured and rules are appropriate

### React Component Modernization Patterns

**Decision**: Use functional components with hooks, proper memoization, and stable keys for lists.

**Rationale**:

- Functional components with hooks are the modern React pattern
- Proper memoization prevents unnecessary re-renders
- Stable keys improve list rendering performance and prevent bugs

**Key Patterns**:

- Use `useCallback` for functions passed as props
- Use `useMemo` for expensive computations
- Extract arrow functions from JSX to named functions with useCallback
- Use stable unique keys (IDs) instead of array indices
- Avoid prop spreading unless justified (e.g., Material-UI components)

**Alternatives considered**:

- N/A - Functional components are already in use, just need to follow best practices

### Bitwise Operations Handling

**Decision**: Replace bitwise operations with appropriate alternatives or document justification if bitwise is necessary.

**Rationale**:

- Bitwise operations are often unclear and can be replaced with more readable alternatives
- Some use cases (e.g., bit flags) may legitimately require bitwise operations
- Document when bitwise is necessary for performance or correctness

**Key Patterns**:

- Replace bitwise shifts (`<<`, `>>`) with multiplication/division when possible
- Replace bitwise AND (`&`) with logical operations when possible
- Document when bitwise operations are necessary (e.g., performance-critical code)

**Alternatives considered**:

- Allow bitwise with eslint-disable comments: Chosen approach - document justification

## Summary

All research is complete. The codebase uses React 19, TypeScript 5.9, and ESLint 9, which are modern and appropriate. The fixes needed are:

1. Follow React 19 hooks best practices
2. Improve TypeScript type safety
3. Fix ESLint rule violations
4. Modernize component patterns

No additional research is needed - proceed with implementation.
