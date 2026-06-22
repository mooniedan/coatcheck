import { test, expect } from '@playwright/test';

test.describe('admin', () => {
  test('blocks non-admins (signed out)', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText(/don.t have access/i)).toBeVisible();
  });

  test('admin API is gated', async ({ request }) => {
    const res = await request.get('/api/admin/overview');
    expect(res.status()).toBe(401);
  });
});
