import { expect, test, type Page } from '@playwright/test';

async function clickMirrors(page: Page, indices: number[]): Promise<void> {
  for (const index of indices) await page.locator(`[data-mirror="${index}"]`).click();
}

async function nextLevel(page: Page, expectedName?: string): Promise<void> {
  const next = page.locator('[data-action="next"]');
  if (await next.isVisible()) await next.click({ force: true }).catch(() => undefined);
  if (expectedName) await expect(page.locator('#level-name')).toHaveText(expectedName);
}

test('complete four-level game, reset, persistence, sound and replay', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.getByRole('button', { name: '开始点亮' })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/01-intro.png' });

  await page.getByRole('button', { name: '开启声音' }).click();
  await expect(page.getByRole('button', { name: '关闭声音' })).toBeVisible();
  await page.getByRole('button', { name: '关闭声音' }).click();
  await page.getByRole('button', { name: '开始点亮' }).click();
  await expect(page.locator('#level-name')).toHaveText('初光');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/02-level-1.png' });

  await clickMirrors(page, [0]);
  await expect(page.locator('[data-mirror="0"]')).toHaveAttribute('aria-label', /当前方向 \//);
  await page.getByRole('button', { name: '重置当前关卡' }).click();
  await expect(page.locator('[data-mirror="0"]')).toHaveAttribute('aria-label', /当前方向 \\/);
  await clickMirrors(page, [0]);
  await expect(page.locator('#level-toast')).toBeVisible();
  await page.screenshot({ path: 'test-results/03-level-1-lit.png' });
  await nextLevel(page, '街角');

  await expect(page.locator('#level-name')).toHaveText('街角');
  await clickMirrors(page, [0, 1]);
  await expect(page.locator('#level-toast')).toBeVisible();
  await nextLevel(page, '雨巷');

  await expect(page.locator('#level-name')).toHaveText('雨巷');
  await page.reload();
  await expect(page.getByRole('button', { name: '继续点亮' })).toBeVisible();
  await page.getByRole('button', { name: '继续点亮' }).click();
  await expect(page.locator('#level-name')).toHaveText('雨巷');
  await clickMirrors(page, [0, 2]);
  await expect(page.locator('#level-toast')).toBeVisible();
  await nextLevel(page, '万家灯火');

  await expect(page.locator('#level-name')).toHaveText('万家灯火');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/04-level-4.png' });
  await clickMirrors(page, [0, 1, 2, 3]);
  await expect(page.locator('#level-toast')).toBeVisible();
  await nextLevel(page);
  await expect(page.locator('#finale')).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/05-finale.png' });

  await page.getByRole('button', { name: '再玩一次' }).click();
  await expect(page.locator('#level-name')).toHaveText('初光');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('light-up-the-city-v1')!));
  expect(saved.completed).toEqual([]);
  expect(saved.currentLevel).toBe(0);
  expect(errors).toEqual([]);
});
