import { expect, test, type Page } from '@playwright/test';

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
  placements?: { tool: string; at: [number, number]; clicks: number }[];
}

async function solveReflection(page: Page, plan: ReflectionPlan): Promise<void> {
  if (plan.sourceClicks && plan.sourceAt) {
    for (let index = 0; index < plan.sourceClicks; index += 1) await clickCell(page, plan.sourceAt[0], plan.sourceAt[1]);
  }
  for (const piece of plan.pieceClicks ?? []) {
    for (let index = 0; index < piece.times; index += 1) await clickCell(page, piece.at[0], piece.at[1]);
  }
  for (const placement of plan.placements ?? []) {
    // 与原作一致：每次放置后自动取消选中，下一次放置需重新选择器件。
    await pickTool(page, placement.tool);
    await clickCell(page, placement.at[0], placement.at[1]);
    for (let index = 0; index < placement.clicks; index += 1) await clickCell(page, placement.at[0], placement.at[1]);
  }
  await expect(page.locator('#level-toast')).toBeVisible({ timeout: 8000 });
}

async function advance(page: Page, expectedName: string): Promise<void> {
  await page.locator('[data-action="next"]').click({ force: true });
  await expect(page.locator('#level-name')).toHaveText(expectedName);
}

test('complete the nine-level campaign with unified Reflection rules', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.getByRole('button', { name: '开始点亮' })).toBeVisible();
  await expect(page.locator('.intro-description')).not.toContainText('能量');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/01-intro.png' });

  await page.getByRole('button', { name: '开启声音' }).click();
  await expect(page.getByRole('button', { name: '关闭声音' })).toBeVisible();
  await page.getByRole('button', { name: '关闭声音' }).click();
  await page.getByRole('button', { name: '开始点亮' }).click();
  await expect(page.locator('#level-name')).toHaveText('第一面镜');
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');

  // 不再自动弹出规则简报；说明按钮可主动查询。
  await expect(page.locator('#level-brief')).toBeHidden();
  await expect(page.locator('#play-hint')).toBeVisible();
  await page.locator('[data-action="brief"]').click();
  await expect(page.locator('#brief-title')).toContainText('怎样才算通关');
  await page.keyboard.press('Escape');
  await expect(page.locator('#level-brief')).toBeHidden();
  await page.screenshot({ path: 'test-results/02-level-1.png' });

  // 第 1 关：镜面翻转 + 背灯方向。先验证重置。
  await clickCell(page, 3, 2);
  await expect(page.locator('#play-hint')).toBeHidden();
  await page.getByRole('button', { name: '重置当前关卡' }).click();
  await expect(page.locator('#move-count')).toHaveText('0');
  await solveReflection(page, { pieceClicks: [{ at: [3, 2], times: 1 }, { at: [3, 4], times: 2 }] });
  await expect(page.locator('#toast-stars .star-on')).toHaveCount(3);
  await expect(page.locator('#toast-score')).toContainText('操作 3 次');
  await advance(page, '行囊初试');

  // 第 2 关：放置 / 取回 / 旋转。先放错再取回（多 2 次操作 → 2 星）。
  await expect(page.locator('#tool-dock')).toBeVisible();
  await expect(page.locator('#cond-inv')).toHaveText('剩 2');
  await pickTool(page, 'mirror');
  await clickCell(page, 0, 4);
  await expect(page.locator('[data-tool="mirror"] .mirror-glyph')).toHaveText('×0');
  await pickTool(page, 'erase');
  await clickCell(page, 0, 4);
  await expect(page.locator('[data-tool="mirror"] .mirror-glyph')).toHaveText('×1');
  await expect(page.locator('[data-tool="erase"]')).toBeDisabled();
  await page.screenshot({ path: 'test-results/03-level-2-place.png' });
  await solveReflection(page, {
    placements: [
      { tool: 'mirror', at: [4, 0], clicks: 1 },
      { tool: 'single', at: [4, 3], clicks: 2 },
    ],
  });
  await expect(page.locator('#toast-score')).toContainText('操作 7 次');
  await advance(page, '布光行囊');

  // 第 3 关：保留的 Reflection 第一关。持久化检查后再解。
  await page.reload();
  await expect(page.getByRole('button', { name: '继续点亮' })).toBeVisible();
  await page.getByRole('button', { name: '继续点亮' }).click();
  await expect(page.locator('#level-name')).toHaveText('布光行囊');
  await expect(page.locator('#level-brief')).toBeHidden();
  await expect(page.locator('#cond-lights')).toHaveText('0/1');
  await page.screenshot({ path: 'test-results/04-level-3-kit.png' });
  await solveReflection(page, {
    placements: [
      { tool: 'mirror', at: [0, 1], clicks: 0 },
      { tool: 'mirror', at: [3, 1], clicks: 1 },
      { tool: 'single', at: [0, 3], clicks: 2 },
    ],
  });
  await expect(page.locator('#toast-stars .star-on')).toHaveCount(3);
  await expect(page.locator('#toast-score')).toContainText('操作 6 次');
  await advance(page, '一分为二');

  // 第 4 关：分光镜教学——旋转一次即可看到直行 + 反射两束光。
  await expect(page.locator('#cond-lights')).toHaveText('0/2');
  await clickCell(page, 3, 2);
  await expect(page.locator('#cond-lights')).toHaveText('1/2');
  await page.screenshot({ path: 'test-results/05-level-4-split.png' });
  await solveReflection(page, { pieceClicks: [{ at: [4, 2], times: 2 }] });
  await expect(page.locator('#toast-score')).toContainText('操作 3 次');
  await advance(page, '闸门之规');

  // 第 5 关：背灯先达标但闸门未过 → 面板明确显示剩余条件；锁定镜面不可点。
  await clickCell(page, 2, 2);
  await expect(page.locator('#move-count')).toHaveText('0');
  await clickCell(page, 2, 4);
  await clickCell(page, 2, 4);
  await expect(page.locator('#cond-lights')).toHaveText('1/1');
  await expect(page.locator('#cond-lights-row')).toHaveClass(/is-ok/);
  await expect(page.locator('#cond-cp')).toHaveText('0/1');
  await expect(page.locator('#cond-cp-row')).toHaveClass(/is-bad/);
  await expect(page.locator('#level-toast')).toBeHidden();
  await page.screenshot({ path: 'test-results/06-level-5-gate.png' });
  await solveReflection(page, { pieceClicks: [{ at: [2, 3], times: 1 }] });
  await expect(page.locator('#cond-cp-row')).toHaveClass(/is-ok/);
  await expect(page.locator('#toast-score')).toContainText('操作 3 次');
  await advance(page, '转塔之光');

  // 第 6 关：光塔转向 + 综合运用。
  await solveReflection(page, {
    sourceClicks: 1, sourceAt: [2, 2],
    pieceClicks: [
      { at: [3, 0], times: 1 },
      { at: [4, 2], times: 2 },
      { at: [0, 0], times: 1 },
    ],
  });
  await expect(page.locator('#toast-score')).toContainText('操作 5 次');
  await advance(page, '闸口分光');

  // 第 7 关：保留的 Reflection LEVEL 2（官方解）。
  await expect(page.locator('#cond-cp')).toHaveText('0/1');
  await page.screenshot({ path: 'test-results/07-level-7-gate-split.png' });
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
  await expect(page.locator('#cond-cp')).toHaveText('1/1');
  await advance(page, '镜街二十');

  // 第 8 关：保留的 Reflection LEVEL 20（官方解）。
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/08-level-8-street.png' });
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

  // 第 9 关：保留的 Reflection LEVEL 99（官方解）。
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/09-level-9-finale-level.png' });
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
  await page.locator('[data-action="next"]').click({ force: true });
  await expect(page.locator('#finale')).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  await page.screenshot({ path: 'test-results/10-finale.png' });

  await page.getByRole('button', { name: '再玩一次' }).click();
  await expect(page.locator('#level-name')).toHaveText('第一面镜');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('light-up-the-city-v3')!));
  expect(saved.completed).toEqual([]);
  expect(saved.currentLevel).toBe(0);
  expect(errors).toEqual([]);
});
