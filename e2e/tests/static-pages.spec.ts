import {test, expect, assertNoFatalErrors, assertPageRendered} from '../fixtures/base';

const staticPages = [
  {path: '/privacy', title: 'Privacy Policy - Cross with Friends', heading: 'Privacy Policy'},
  {path: '/terms', title: 'Terms of Service - Cross with Friends', heading: 'Terms of Service'},
  {path: '/help', title: 'Help & FAQ - Cross with Friends', heading: 'Help & FAQ'},
];

for (const {path, title, heading} of staticPages) {
  test.describe(`${heading} page`, () => {
    test(`renders at ${path}`, async ({smoke}) => {
      const {page, consoleErrors} = smoke;

      await page.goto(path);
      await assertPageRendered(page);

      // Page title via react-helmet
      await expect(page).toHaveTitle(title);

      // Nav bar
      await expect(page.locator('.nav')).toBeVisible();

      // Main heading
      await expect(page.locator('h1')).toContainText(heading);

      // Content section has text
      await expect(page.locator('.legal--content')).not.toBeEmpty();

      // Footer with links
      await expect(page.locator('.footer')).toBeVisible();
      await expect(page.locator('.footer--links')).toBeVisible();

      assertNoFatalErrors(consoleErrors);
    });
  });
}
