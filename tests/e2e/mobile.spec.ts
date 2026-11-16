import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('mobile touch can start, reset and complete the first level', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: '开始点亮' }).tap();
  await expect(page.locator('#level-name')).toHaveText('初光');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/06-mobile-level-1.png' });
  await page.locator('[data-mirror="0"]').tap();
  await expect(page.locator('#level-toast')).toBeVisible();
  await page.screenshot({ path: 'test-results/07-mobile-level-1-lit.png' });
  await page.locator('[data-action="next"]').tap();
  await expect(page.locator('#level-name')).toHaveText('街角');
  await page.locator('[data-mirror="0"]').tap();
  await page.getByRole('button', { name: '重置当前关卡' }).tap();
  await expect(page.locator('[data-mirror="0"]')).toHaveAttribute('aria-label', /当前方向 \\/);
  expect(errors).toEqual([]);
});
