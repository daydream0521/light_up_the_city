import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function tapCell(page: Page, x: number, z: number): Promise<void> {
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  const point = await page.evaluate(([cx, cz]) => {
    const hook = (window as unknown as { __qoderTest: { projectCell: (x: number, z: number) => { x: number; y: number } | null } }).__qoderTest;
    return hook.projectCell(cx, cz);
  }, [x, z]);
  if (!point) throw new Error(`cell ${x},${z} cannot be projected`);
  await page.touchscreen.tap(point.x, point.y);
}

test('mobile touch plays the first three unified-rule levels', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: '开始点亮' }).tap();
  await expect(page.locator('#level-name')).toHaveText('第一面镜');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await expect(page.locator('#level-brief')).toBeHidden();
  await expect(page.locator('#status-panel')).toBeVisible();
  await expect(page.locator('#cond-lights')).toHaveText('0/1');
  await page.screenshot({ path: 'test-results/11-mobile-level-1.png' });

  // 第 1 关：触屏旋转镜面与背灯镜。
  await tapCell(page, 3, 2);
  await tapCell(page, 3, 4);
  await tapCell(page, 3, 4);
  await expect(page.locator('#level-toast')).toBeVisible({ timeout: 8000 });
  await page.screenshot({ path: 'test-results/12-mobile-level-1-lit.png' });
  await expect(page.locator('#level-name')).toHaveText('行囊初试');

  // 第 2 关：触屏放置（每次放置后需重新选择器件）。
  await expect(page.locator('#tool-dock')).toBeVisible();
  await expect(page.locator('#status-panel')).toBeVisible();
  await page.locator('[data-tool="mirror"]').tap();
  await tapCell(page, 4, 0);
  await tapCell(page, 4, 0);
  await page.locator('[data-tool="single"]').tap();
  await tapCell(page, 4, 3);
  await tapCell(page, 4, 3);
  await tapCell(page, 4, 3);
  await expect(page.locator('#level-toast')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#cond-lights')).toHaveText('1/1');
  await page.screenshot({ path: 'test-results/13-mobile-level-2-lit.png' });
  await expect(page.locator('#level-name')).toHaveText('布光行囊');

  // 第 3 关：保留的 Reflection 第一关官方解（镜面 ×2 + 背灯镜 ×1）。
  await page.locator('[data-tool="mirror"]').tap();
  await tapCell(page, 0, 1);
  await page.locator('[data-tool="mirror"]').tap();
  await tapCell(page, 3, 1);
  await tapCell(page, 3, 1);
  await page.locator('[data-tool="single"]').tap();
  await tapCell(page, 0, 3);
  await tapCell(page, 0, 3);
  await tapCell(page, 0, 3);
  await expect(page.locator('#level-toast')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#cond-lights')).toHaveText('1/1');
  await page.screenshot({ path: 'test-results/14-mobile-level-3-lit.png' });
  expect(errors).toEqual([]);
});
