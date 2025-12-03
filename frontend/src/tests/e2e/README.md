# E2E Test Suite - Best Practices Guide

This directory contains end-to-end tests using Playwright, following industry best practices and Playwright's recommended patterns.

## Architecture

### Page Object Models (POM)

We use the Page Object Model pattern to encapsulate page interactions and selectors. This provides:

- **Maintainability**: Selectors are centralized in one place
- **Reusability**: Common interactions can be shared across tests
- **Readability**: Tests read like user stories

Page objects are located in `pages/`:

- `WelcomePage.ts` - Home/welcome page interactions
- `GamePage.ts` - Crossword game interface
- `RoomPage.ts` - Multiplayer room interface
- `ReplayPage.ts` - Game replay interface

### Fixtures

Custom fixtures are defined in `../fixtures.ts` and provide:

- Page object instances (automatically injected)
- Mock socket connections
- Other shared test resources

## Best Practices

### 1. Use Role-Based Locators

**✅ Good:**

```typescript
page.getByRole('button', {name: 'Submit'});
page.getByLabel('Email address');
page.getByPlaceholder('Search...');
```

**❌ Bad:**

```typescript
page.locator('.button.submit-btn');
page.locator('#email-input');
```

### 2. Leverage Auto-Waiting

Playwright automatically waits for elements to be actionable. **Never use `waitForTimeout`**:

**✅ Good:**

```typescript
await expect(button).toBeVisible();
await button.click(); // Playwright waits automatically
```

**❌ Bad:**

```typescript
await page.waitForTimeout(1000); // Anti-pattern!
await button.click();
```

### 3. Use Web-First Assertions

Playwright assertions automatically retry until conditions are met:

**✅ Good:**

```typescript
await expect(element).toBeVisible();
await expect(element).toHaveText('Expected text');
```

**❌ Bad:**

```typescript
const isVisible = await element.isVisible(); // Doesn't wait!
expect(isVisible).toBe(true);
```

### 4. Follow AAA Pattern

Structure tests with Arrange-Act-Assert:

```typescript
test('should do something', async ({page}) => {
  // Arrange - Set up test data and state
  await page.goto('/some-page');

  // Act - Perform the action being tested
  await page.getByRole('button', {name: 'Click me'}).click();

  // Assert - Verify the expected outcome
  await expect(page.getByText('Success')).toBeVisible();
});
```

### 5. Avoid Conditional Test Logic

**❌ Bad:**

```typescript
if (await element.isVisible()) {
  await element.click();
  expect(true).toBeTruthy(); // Always passes!
}
```

**✅ Good:**

```typescript
const isVisible = await element.isVisible({timeout: 2000}).catch(() => false);
if (isVisible) {
  await element.click();
  await expect(someResult).toBeVisible(); // Actual assertion
} else {
  test.skip(); // Explicitly skip if feature not available
}
```

### 6. Use Test IDs When Available

For elements that don't have semantic roles, use `data-testid` attributes:

```typescript
page.locator('[data-testid="crossword-grid"]');
```

### 7. Wait for Load States Appropriately

Use `domcontentloaded` for faster tests, only use `networkidle` when necessary:

**✅ Good:**

```typescript
await page.goto('/page');
await page.waitForLoadState('domcontentloaded');
await expect(element).toBeVisible(); // Auto-waits
```

**❌ Bad:**

```typescript
await page.goto('/page');
await page.waitForLoadState('networkidle'); // Often unnecessary
await page.waitForTimeout(2000); // Never do this
```

## Test Organization

Tests are organized by page/feature:

- `welcome.spec.ts` - Home page tests
- `game.spec.ts` - Game page tests
- `room.spec.ts` - Room/multiplayer tests
- `replay.spec.ts` - Replay functionality tests
- And more...

Each test file uses `test.describe()` blocks to group related tests.

## Running Tests

```bash
# Run all E2E tests
yarn test:e2e

# Run tests in UI mode (interactive)
yarn test:e2e:ui

# Run a specific test file
yarn playwright test welcome.spec.ts
```

## Common Patterns

### Handling Optional Elements

```typescript
const element = page.getByRole('button', {name: 'Optional'});
const isVisible = await element.isVisible({timeout: 2000}).catch(() => false);
if (isVisible) {
  await element.click();
  // Test the behavior
} else {
  test.skip(); // Feature not available
}
```

### Testing Responsive Design

```typescript
test('should work on mobile', async ({page}) => {
  await page.setViewportSize({width: 375, height: 667});
  await page.goto('/page');
  // Test mobile-specific behavior
});
```

### Error Handling Tests

```typescript
test('should handle errors gracefully', async ({page}) => {
  await page.goto('/invalid-page');
  // Should not crash
  await expect(page.locator('body')).toBeVisible();
  // Should show error message or redirect
  const hasError = await page
    .getByText(/error/i)
    .isVisible({timeout: 5000})
    .catch(() => false);
  expect(hasError).toBeTruthy();
});
```

## Improvements Made

The test suite was redesigned to address these issues:

1. ❌ **Removed `waitForTimeout`** - Now uses auto-waiting
2. ❌ **Removed catch blocks that always pass** - Now has meaningful assertions
3. ❌ **Removed generic selectors with fallbacks** - Now uses role-based locators
4. ✅ **Added Page Object Models** - Centralized selectors and interactions
5. ✅ **Added proper fixtures** - Page objects injected automatically
6. ✅ **Improved assertions** - Tests actually verify functionality
7. ✅ **Better test structure** - Clear AAA pattern
8. ✅ **Proper error handling** - Tests skip gracefully when features aren't available

## Next Steps

To further improve the tests:

1. **Add test data setup** - Create fixtures for setting up test games/puzzles
2. **Add API mocking** - Use Playwright's route interception for consistent test data
3. **Add visual regression tests** - Use Playwright's screenshot comparison
4. **Add accessibility tests** - Use Playwright's accessibility tree
5. **Add performance tests** - Measure page load times and interactions

