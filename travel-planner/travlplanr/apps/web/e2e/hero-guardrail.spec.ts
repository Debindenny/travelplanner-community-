import { test, expect, Page } from '@playwright/test';

/**
 * Protected-surface guardrail for the landing hero (see PROTECTED.md next to
 * hero-section.component.ts). Locks down: the background video, mute toggle,
 * chat/search composer, send/stop button, and destination suggestion chips.
 *
 * Requires the full stack running locally (docker compose up -d, then
 * `npm start`), same prerequisite as login-wizard-itinerary.spec.ts.
 *
 * The pixel snapshot is captured in the IDLE (unfocused) hero state only —
 * focusing the search input triggers an async destination-suggestion fetch
 * (DestinationSearchService) whose chip content is not deterministic, so it
 * is verified functionally below but deliberately excluded from the
 * pixel-diffed baseline to avoid flaky diffs on live/changing destination data.
 *
 * To (re)generate the baseline after an intentional, approved hero change:
 *   npx playwright test hero-guardrail.spec.ts --update-snapshots
 */

async function gotoHero(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.hero-viewport')).toBeVisible({ timeout: 15_000 });
}

test.describe('hero protected surface', () => {
  test('critical hero elements are present and visible', async ({ page }) => {
    await gotoHero(page);

    const hero = page.locator('.hero-viewport');
    await expect(hero.locator('video')).toBeVisible();
    await expect(hero.locator('.hero-mute-btn')).toBeVisible();
    await expect(hero.locator('.hero-search input[type="text"]')).toBeVisible();
    await expect(hero.locator('.hero-search .search-btn')).toBeVisible();
    // The typeahead only renders internal content once a search is open
    // (query >= minChars or prior search history) — idle it's a legitimate
    // zero-size host, so assert it's wired into the DOM, not "visible".
    await expect(hero.locator('app-destination-typeahead')).toBeAttached();
  });

  test('typing a query surfaces destination suggestions', async ({ page }) => {
    await gotoHero(page);

    // minChars is 2 (destination-typeahead.component.ts) — a fresh Playwright
    // context has no recent-search history, so nothing renders below that.
    await page.locator('.hero-search input[type="text"]').fill('pa');
    // Either a populated chip list or the "no suggestions" empty state is
    // acceptable — this asserts the typeahead responded, not its content.
    await expect(
      page.locator('.typeahead-chips, .typeahead-empty').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('hero idle-state visual snapshot', async ({ page }) => {
    await gotoHero(page);
    // Let entrance/scroll-cue transitions settle before snapshotting.
    await page.waitForTimeout(500);

    await expect(page.locator('.hero-viewport')).toHaveScreenshot('hero-idle.png');
  });
});
