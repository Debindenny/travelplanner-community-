import { test, expect, Page } from '@playwright/test';

/**
 * Critical path: login (OTP) -> wizard -> generated itinerary.
 *
 * Requires the full stack running locally (docker compose up -d, then
 * `npm start`), with identity's OTP provider in dev/mock mode so the login
 * page surfaces `devOtp` (see services/identity/app/routers/auth.py
 * `otp_request` — dev_otp is only returned when MockProvider is active).
 *
 * Style/budget/food-preference choices in the wizard render via inline
 * arrays in wizard-page.component.ts whose translation keys
 * (WIZARD.STYLES.*, WIZARD.BUDGETS.*, WIZARD.FOOD.*) are not present in the
 * i18n JSON files, so those buttons currently render literal missing-key
 * text instead of a label. This spec deliberately selects them by their
 * `assets/icons/<id>.svg` icon instead of visible text, which is stable
 * either way — but the missing translations are a real gap worth fixing
 * separately.
 */

const TEST_EMAIL = `e2e-${Date.now()}@example.com`;

async function loginViaOtp(page: Page, returnUrl: string): Promise<void> {
  await page.goto(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);

  await page.getByLabel('Email').fill(TEST_EMAIL);
  await page.getByRole('button', { name: 'Send Code' }).click();

  // Dev-only: the OTP is echoed back in the response and rendered on-screen
  // (see login-page.component.ts `devOtp`) so no mailbox access is needed.
  const devOtpLocator = page.locator('text=/^\\d{6}$/').first();
  await expect(devOtpLocator).toBeVisible({ timeout: 15_000 });
  const code = (await devOtpLocator.textContent())?.trim() ?? '';
  expect(code).toMatch(/^\d{6}$/);

  for (let i = 0; i < 6; i++) {
    await page.getByLabel(`Digit ${i + 1} of 6`).fill(code[i]);
  }
  await page.getByRole('button', { name: /Verify/ }).click();
}

async function clickIconChoice(page: Page, iconId: string): Promise<void> {
  await page.locator(`button:has(img[src="assets/icons/${iconId}.svg"])`).click();
}

test('login, complete the wizard, and land on a generated itinerary', async ({ page }) => {
  await loginViaOtp(page, '/wizard');
  await expect(page).toHaveURL(/\/wizard/, { timeout: 15_000 });

  // Step 1 — destination + departure city
  await page.locator('#destination-0').fill('Lisbon');
  await page.locator('#departureLocation').fill('New York');
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 2 — dates: let the AI pick them to skip manual date-range validation
  await page.locator('input[formcontrolname="aiDates"]').check();
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 3 — travel group (solo) + method (rental car)
  await clickIconChoice(page, 'solo');
  await clickIconChoice(page, 'rental-car');
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 4 — at least one interest (Adventure -> mountain icon)
  await clickIconChoice(page, 'mountain');
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 5 — budget (mid-range)
  await clickIconChoice(page, 'mid');
  await page.getByRole('button', { name: 'Generate Plan' }).click();

  // Generation can take a while (LLM call chain) — give it a generous timeout.
  await expect(page).toHaveURL(/\/itinerary\/[a-f0-9-]+/, { timeout: 120_000 });
});
