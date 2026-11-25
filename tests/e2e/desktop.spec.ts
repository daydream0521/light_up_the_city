import { expect, test, type Page } from '@playwright/test';
import { LEVELS, type LevelConfig } from '../../src/game/levels';

async function solveClassic(page: Page, level: LevelConfig): Promise<void> {
  const initial = level.mirrors.map((mirror) => mirror.initial);
  const solution = level.solution ?? [];
  for (let index = 0; index < solution.length; index += 1) {
    if (solution[index] !== initial[index]) await page.locator(`[data-mirror="${index}"]`).click();
  }
  await expect(page.locator('#level-toast')).toBeVisible();
}

async function clickCell(page: Page, x: number, z: number): Promise<void> {
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  const point = await page.evaluate(([cx, cz]) => {
    const hook = (window as unknown as { __qoderTest: { projectCell: (x: number, z: number) => { x: number; y: number } | null } }).__qoderTest;
    return hook.projectCell(cx, cz);
  }, [x, z]);
  if (!point) throw new Error(`cell ${x},${z} cannot be projected`);
  await page.mouse.click(point.x, point.y);
}

async function pickTool(page: Page, tool: string): Promise<void> {
  await page.locator(`[data-tool="${tool}"]`).click();
  await expect(page.locator(`[data-tool="${tool}"]`)).toHaveAttribute('aria-pressed', 'true');
}

interface ReflectionPlan {
  sourceClicks?: number;
  sourceAt?: [number, number];
  pieceClicks?: { at: [number, number]; times: number }[];
  placements: { tool: string; at: [number, number]; clicks: number }[];
}

async function solveReflection(page: Page, plan: ReflectionPlan): Promise<void> {
  if (plan.sourceClicks && plan.sourceAt) {
    for (let index = 0; index < plan.sourceClicks; index += 1) await clickCell(page, plan.sourceAt[0], plan.sourceAt[1]);
  }
  for (const piece of plan.pieceClicks ?? []) {
    for (let index = 0; index < piece.times; index += 1) await clickCell(page, piece.at[0], piece.at[1]);
  }
  let currentTool: string | null = null;
  for (const placement of plan.placements) {
    if (currentTool !== placement.tool) {
      await pickTool(page, placement.tool);
      currentTool = placement.tool;
    }
    await clickCell(page, placement.at[0], placement.at[1]);
    // 库存耗尽后游戏会自动取消选择
    const pressed = await page.locator(`[data-tool="${placement.tool}"]`).getAttribute('aria-pressed');
    if (pressed === 'false') currentTool = null;
    for (let index = 0; index < placement.clicks; index += 1) await clickCell(page, placement.at[0], placement.at[1]);
  }
  await expect(page.locator('#level-toast')).toBeVisible({ timeout: 8000 });
}

async function advance(page: Page, expectedName?: string): Promise<void> {
  const next = page.locator('[data-action="next"]');
  if (await next.isVisible()) await next.click({ force: true }).catch(() => undefined);
  if (expectedName) await expect(page.locator('#level-name')).toHaveText(expectedName);
}

async function dismissBrief(page: Page): Promise<void> {
  const brief = page.locator('[data-action="brief-ok"]');
  if (await brief.isVisible()) await brief.click();
}

test('complete the six-level campaign: classic tutorials then Reflection ports', async ({ page }) => {
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

  await solveClassic(page, LEVELS[0]);
  await expect(page.locator('#toast-stars .star-on')).toHaveCount(3);
  await expect(page.locator('#toast-score')).toContainText('操作 1 次');
  await advance(page, '街角');

  await solveClassic(page, LEVELS[1]);
  await advance(page, '布光行囊');

  // 第 3 关：Reflection 移植（放置教学）。开场简报介绍通关条件与器件。
  await expect(page.locator('#level-brief')).toBeVisible();
  await expect(page.locator('#brief-title')).toContainText('怎样才算通关');
  await expect(page.locator('#brief-body')).toContainText('背灯镜');
  await page.locator('[data-action="brief-ok"]').click();
  await expect(page.locator('#level-brief')).toBeHidden();
  // 说明按钮可随时重开简报
  await page.locator('[data-action="brief"]').click();
  await expect(page.locator('#level-brief')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#level-brief')).toBeHidden();

  // 持久化检查后再解。
  await page.reload();
  await expect(page.getByRole('button', { name: '继续点亮' })).toBeVisible();
  await page.getByRole('button', { name: '继续点亮' }).click();
  await expect(page.locator('#level-name')).toHaveText('布光行囊');
  await page.locator('[data-action="brief-ok"]').click();
  await expect(page.locator('#tool-dock')).toBeVisible();
  await expect(page.locator('#mirror-dock')).toBeHidden();
  await expect(page.locator('#light-count')).toHaveText('0/1');
  await page.screenshot({ path: 'test-results/03-level-3-place.png' });

  await solveReflection(page, {
    placements: [
      { tool: 'mirror', at: [0, 1], clicks: 0 },
      { tool: 'mirror', at: [3, 1], clicks: 1 },
      { tool: 'single', at: [0, 3], clicks: 2 },
    ],
  });
  await expect(page.locator('#toast-stars .star-on')).toHaveCount(3);
  await expect(page.locator('#toast-score')).toContainText('操作 6 次');
  await advance(page, '闸口分光');
  await dismissBrief(page);

  // 第 4 关：先验证放置/取回交互，再按官方解通关。
  await expect(page.locator('#cp-count')).toHaveText('0/1');
  await pickTool(page, 'single');
  await clickCell(page, 0, 0);
  await expect(page.locator('[data-tool="single"] .mirror-glyph')).toHaveText('×2');
  await pickTool(page, 'erase');
  await clickCell(page, 0, 0);
  await expect(page.locator('[data-tool="single"] .mirror-glyph')).toHaveText('×3');
  await expect(page.locator('[data-tool="erase"]')).toBeDisabled();
  await page.screenshot({ path: 'test-results/04-level-4-gate.png' });

  await solveReflection(page, {
    sourceClicks: 1, sourceAt: [1, 2],
    pieceClicks: [{ at: [2, 0], times: 3 }],
    placements: [
      { tool: 'single', at: [4, 0], clicks: 2 },
      { tool: 'single', at: [0, 1], clicks: 1 },
      { tool: 'single', at: [4, 3], clicks: 1 },
      { tool: 'splitter', at: [4, 1], clicks: 1 },
      { tool: 'splitter', at: [0, 3], clicks: 1 },
    ],
  });
  await expect(page.locator('#cp-count')).toHaveText('1/1');
  await advance(page, '镜街二十');
  await dismissBrief(page);

  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/05-level-5-street.png' });
  await solveReflection(page, {
    sourceClicks: 2, sourceAt: [0, 2],
    pieceClicks: [
      { at: [4, 0], times: 2 },
      { at: [0, 1], times: 1 },
      { at: [1, 1], times: 1 },
      { at: [1, 2], times: 3 },
      { at: [2, 3], times: 2 },
    ],
    placements: [
      { tool: 'single', at: [0, 0], clicks: 3 },
      { tool: 'mirror', at: [4, 1], clicks: 0 },
      { tool: 'splitter', at: [2, 2], clicks: 0 },
    ],
  });
  await advance(page, '万家灯火');
  await dismissBrief(page);

  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/06-level-6-finale-level.png' });
  await solveReflection(page, {
    sourceClicks: 3, sourceAt: [3, 0],
    placements: [
      { tool: 'single', at: [1, 0], clicks: 0 },
      { tool: 'single', at: [0, 1], clicks: 0 },
      { tool: 'single', at: [0, 3], clicks: 0 },
      { tool: 'single', at: [3, 3], clicks: 3 },
      { tool: 'splitter', at: [3, 1], clicks: 0 },
      { tool: 'splitter', at: [3, 2], clicks: 0 },
    ],
  });
  await advance(page);
  await expect(page.locator('#finale')).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/07-finale.png' });

  await page.getByRole('button', { name: '再玩一次' }).click();
  await expect(page.locator('#level-name')).toHaveText('初光');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('light-up-the-city-v2')!));
  expect(saved.completed).toEqual([]);
  expect(saved.currentLevel).toBe(0);
  expect(errors).toEqual([]);
});
