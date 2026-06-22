import { test, expect, type Page } from '@playwright/test';

// Search a city and wait for the recommendation to load (the week strip renders as soon as the
// fetch resolves, before the ~6s intro tour finishes).
async function search(page: Page, city: string) {
  await page.goto('/');
  await page.getByPlaceholder('City or address…').fill(city);
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByRole('group', { name: '7-day forecast' })).toBeVisible();
}

test.describe('home', () => {
  test('search renders a recommendation and a 7-day strip', async ({ page }) => {
    await search(page, 'Oslo');

    // The strip has exactly 7 day cells, the first labelled "Today".
    const days = page.getByRole('group', { name: '7-day forecast' }).getByRole('button');
    await expect(days).toHaveCount(7);
    await expect(days.first()).toContainText('Today');

    // The animated card settles and shows the feels-like badge + the resolved location.
    await expect(page.getByText('FEELS LIKE')).toBeVisible();
    await expect(page.getByText(/Oslo/)).toBeVisible();
  });

  test('selecting a future day moves the selection', async ({ page }) => {
    await search(page, 'Oslo');
    const days = page.getByRole('group', { name: '7-day forecast' }).getByRole('button');

    // Today starts selected.
    await expect(days.nth(0)).toHaveAttribute('aria-pressed', 'true');

    // Tapping a future day moves the pressed state to it.
    await days.nth(3).click();
    await expect(days.nth(3)).toHaveAttribute('aria-pressed', 'true');
    await expect(days.nth(0)).toHaveAttribute('aria-pressed', 'false');
  });

  test('signed-out: beta banner shown and feedback disabled', async ({ page }) => {
    await page.goto('/');
    // Closed-testing banner links to the waitlist.
    await expect(page.getByRole('link', { name: /Join the beta/ })).toBeVisible();

    await search(page, 'Oslo');
    // Feedback is gated behind sign-in.
    await expect(page.getByText('Sign in to add feedback.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Too cold' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Perfect' })).toBeDisabled();
  });

  test('invalid city surfaces an error', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('City or address…').fill('zzzzzzznotacity');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText(/not found/i)).toBeVisible();
  });
});
