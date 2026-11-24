import { expect, test, type Page } from '@playwright/test';
import { LEVELS, type LevelConfig } from '../../src/game/levels';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function solve(page: Page, level: LevelConfig): Promise<void> {
  const initial = level.mirrors.map((mirror) => mirror.initial);
  const solution = level.solution ?? [];
  for (let index = 0; index < solution.length; index += 1) {
    if (solution[index] !== initial[index]) await page.locator(`[data-mirror="${index}"]`).tap();
  }
  await expect(page.locator('#level-toast')).toBeVisible();
}

async function tapCell(page: Page, x: number, z: number): Promise<void> {
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  const point = await page.evaluate(([cx, cz]) => {
    const hook = (window as unknown as { __qoderTest: { projectCell: (x: number, z: number) => { x: number; y: number } | null } }).__qoderTest;
    return hook.projectCell(cx, cz);
  }, [x, z]);
  if (!point) throw new Error(`cell ${x},${z} cannot be projected`);
  await page.touchscreen.tap(point.x, point.y);
}

async function advance(page: Page, expectedName: string): Promise<void> {
  const next = page.locator('[data-action="next"]');
  if (await next.isVisible()) await next.tap().catch(() => undefined);
  await expect(page.locator('#level-name')).toHaveText(expectedName);
}

test('mobile touch plays classic and Reflection placement levels', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: '开始点亮' }).tap();
  await expect(page.locator('#level-name')).toHaveText('初光');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/08-mobile-level-1.png' });

  await page.locator('[data-mirror="0"]').tap();
  await expect(page.locator('#level-toast')).toBeVisible();
  await page.screenshot({ path: 'test-results/09-mobile-level-1-lit.png' });
  await advance(page, '街角');

  await solve(page, LEVELS[1]);
  await advance(page, '布光行囊');
  await expect(page.locator('#tool-dock')).toBeVisible();
  await expect(page.locator('#status-panel')).toBeVisible();
  await page.screenshot({ path: 'test-results/10-mobile-place.png' });

  // 触屏放置：镜面 ×2 + 背灯镜 ×1（Reflection 第一关官方解）；每次放置后需重新选择器件
  await page.locator('[data-tool="mirror"]').tap();
  await tapCell(page, 0, 1);
  await page.locator('[data-tool="mirror"]').tap();
  await tapCell(page, 3, 1);
  await tapCell(page, 3, 1);
  await page.locator('[data-tool="single"]').tap();
  await tapCell(page, 0, 3);
  await tapCell(page, 0, 3);
  await tapCell(page, 0, 3);
  await page.screenshot({ path: 'test-results/11-mobile-place-lit.png' });
  await expect(page.locator('#level-toast')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#light-count')).toHaveText('1/1');
  expect(errors).toEqual([]);
});
