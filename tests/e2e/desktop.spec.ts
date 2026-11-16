import { expect, test, type Page } from '@playwright/test';
import { LEVELS, type LevelConfig } from '../../src/game/levels';

async function solveLevel(page: Page, level: LevelConfig): Promise<void> {
  const initial = level.mirrors.map((mirror) => mirror.initial);
  for (let index = 0; index < level.solution.length; index += 1) {
    if (level.solution[index] !== initial[index]) await page.locator(`[data-mirror="${index}"]`).click();
  }
  await expect(page.locator('#level-toast')).toBeVisible();
}

async function advance(page: Page, expectedName?: string): Promise<void> {
  const next = page.locator('[data-action="next"]');
  if (await next.isVisible()) await next.click({ force: true }).catch(() => undefined);
  if (expectedName) await expect(page.locator('#level-name')).toHaveText(expectedName);
}

test('complete eight-level game with split, energy, scoring, persistence and replay', async ({ page }) => {
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

  await page.locator('[data-mirror="0"]').click();
  await expect(page.locator('[data-mirror="0"]')).toHaveAttribute('aria-label', /当前方向 \//);
  await page.getByRole('button', { name: '重置当前关卡' }).click();
  await expect(page.locator('[data-mirror="0"]')).toHaveAttribute('aria-label', /当前方向 \\/);
  await expect(page.locator('#move-count')).toHaveText('0');

  await solveLevel(page, LEVELS[0]);
  await expect(page.locator('#toast-stars .star-on')).toHaveCount(3);
  await expect(page.locator('#toast-score')).toContainText('操作 1 次');
  await expect(page.locator('[data-target="T1"]')).toHaveClass(/is-powered/);
  await advance(page, '街角');

  await solveLevel(page, LEVELS[1]);
  await advance(page, '一分为二');

  await page.reload();
  await expect(page.getByRole('button', { name: '继续点亮' })).toBeVisible();
  await page.getByRole('button', { name: '继续点亮' }).click();
  await expect(page.locator('#level-name')).toHaveText('一分为二');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/03-level-3-split.png' });
  await solveLevel(page, LEVELS[2]);
  await expect(page.locator('[data-target="T1"]')).toHaveClass(/is-powered/);
  await expect(page.locator('[data-target="T2"]')).toHaveClass(/is-powered/);
  await advance(page, '双街灯火');

  await solveLevel(page, LEVELS[3]);
  await advance(page, '精打细算');

  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/04-level-5-energy.png' });
  await solveLevel(page, LEVELS[4]);
  await advance(page, '光的预算');

  await solveLevel(page, LEVELS[5]);
  await advance(page, '雨夜枢纽');

  await solveLevel(page, LEVELS[6]);
  await advance(page, '万家灯火');

  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/05-level-8.png' });
  await solveLevel(page, LEVELS[7]);
  await expect(page.locator('[data-target="T3"]')).toHaveClass(/is-powered/);
  await advance(page);
  await expect(page.locator('#finale')).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/06-finale.png' });

  await page.getByRole('button', { name: '再玩一次' }).click();
  await expect(page.locator('#level-name')).toHaveText('初光');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('light-up-the-city-v2')!));
  expect(saved.completed).toEqual([]);
  expect(saved.currentLevel).toBe(0);
  expect(errors).toEqual([]);
});