import { expect, test, type Page } from '@playwright/test';
import { LEVELS, type LevelConfig } from '../../src/game/levels';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function solve(page: Page, level: LevelConfig): Promise<void> {
  const initial = level.mirrors.map((mirror) => mirror.initial);
  for (let index = 0; index < level.solution.length; index += 1) {
    if (level.solution[index] !== initial[index]) await page.locator(`[data-mirror="${index}"]`).tap();
  }
  await expect(page.locator('#level-toast')).toBeVisible();
}

async function advance(page: Page, expectedName: string): Promise<void> {
  const next = page.locator('[data-action="next"]');
  if (await next.isVisible()) await next.tap().catch(() => undefined);
  await expect(page.locator('#level-name')).toHaveText(expectedName);
}

test('mobile touch plays reflection and split levels with live target status', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: '开始点亮' }).tap();
  await expect(page.locator('#level-name')).toHaveText('初光');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/07-mobile-level-1.png' });

  await page.locator('[data-mirror="0"]').tap();
  await expect(page.locator('#level-toast')).toBeVisible();
  await page.screenshot({ path: 'test-results/08-mobile-level-1-lit.png' });
  await advance(page, '街角');

  await solve(page, LEVELS[1]);
  await advance(page, '一分为二');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await expect(page.locator('#status-panel')).toBeVisible();
  await page.screenshot({ path: 'test-results/09-mobile-split.png' });
  await solve(page, LEVELS[2]);
  await expect(page.locator('[data-target="T1"]')).toHaveClass(/is-powered/);
  await expect(page.locator('[data-target="T2"]')).toHaveClass(/is-powered/);
  await page.screenshot({ path: 'test-results/10-mobile-split-lit.png' });
  await advance(page, '双街灯火');

  await page.locator('[data-mirror="0"]').tap();
  await page.getByRole('button', { name: '重置当前关卡' }).tap();
  await expect(page.locator('[data-mirror="0"]')).toHaveAttribute('aria-label', /当前方向 \\/);
  expect(errors).toEqual([]);
});