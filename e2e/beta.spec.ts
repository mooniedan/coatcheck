import { test, expect } from '@playwright/test';

test.describe('beta waitlist', () => {
  test('page loads with an email form', async ({ page }) => {
    await page.goto('/beta');
    await expect(page.getByRole('textbox')).toBeVisible();
    // A submit control is present.
    await expect(page.getByRole('button')).toBeVisible();
  });

  test('rejects an invalid email client-or-server side', async ({ page }) => {
    await page.goto('/beta');
    const email = page.getByRole('textbox');
    await email.fill('not-an-email');
    await page.getByRole('button').first().click();
    // Either native validation blocks submit, or the server returns the validation message.
    const invalid = await email.evaluate(
      (el) => el instanceof HTMLInputElement && !el.validity.valid
    );
    if (!invalid) {
      await expect(page.getByText(/valid email/i)).toBeVisible();
    }
  });
});
