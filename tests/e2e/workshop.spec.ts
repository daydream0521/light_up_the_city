import { expect, test, type Page } from '@playwright/test';
import { clickCell, pickTool } from './board';

const v3Key = 'light-up-the-city-v3';
const editor = (page: Page) => page.locator('#work-editor');
const action = (page: Page, name: string) => editor(page).locator(`[data-work="${name}"]`);

async function create(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '造光工坊', exact: true }).click();
  await page.getByRole('button', { name: '新建关卡' }).click();
}

async function solve(page: Page): Promise<void> {
  await clickCell(page, 3, 2);
  await pickTool(page, 'single');
  await clickCell(page, 3, 4);
  await clickCell(page, 3, 4);
  await clickCell(page, 3, 4);
}

test('draft recovery, trial verification and self-contained sharing', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await create(page);
  await page.getByLabel('关卡名称').fill('运河旁的光');
  await page.getByRole('combobox', { name: '区域', exact: true }).selectOption('1');
  await page.getByLabel('背灯镜', { exact: true }).fill('1');
  await page.getByLabel('背灯目标').fill('1');
  await action(page, 'tool-mirror').click();
  await clickCell(page, 3, 2);
  await expect(page.locator('#work-piece')).toHaveText('镜面 · / · 可调整');
  await action(page, 'move').click();
  await clickCell(page, 0, 2);
  await expect(page.locator('#work-feedback')).toContainText('空屋顶');
  await clickCell(page, 3, 1);
  await action(page, 'undo').click();

  await action(page, 'tool-checkpoint').click();
  await clickCell(page, 3, 3);
  await action(page, 'lock').click();
  await expect(page.locator('#work-piece')).toHaveText('闸门 · 南北 · 已锁定');
  await action(page, 'save').click();
  await expect(page.locator('#work-state')).toHaveText('草稿 · 已保存');
  await expect(action(page, 'share')).toBeDisabled();

  await page.reload();
  await page.getByRole('button', { name: '造光工坊', exact: true }).click();
  await expect(page.getByRole('heading', { name: '运河旁的光' })).toBeVisible();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await expect(page.getByLabel('关卡名称')).toHaveValue('运河旁的光');
  await expect(page.getByRole('combobox', { name: '区域', exact: true })).toHaveValue('1');
  await expect(page.getByLabel('背灯镜', { exact: true })).toHaveValue('1');
  await clickCell(page, 3, 2);
  await expect(page.locator('#work-piece')).toHaveText('镜面 · / · 可调整');
  await page.screenshot({ path: 'test-results/workshop-editor.png', scale: 'css' });

  await action(page, 'trial').click();
  await expect(page.locator('#level-number')).toHaveText('编辑器试玩 · 雨夜之城');
  await clickCell(page, 3, 3);
  await expect(page.locator('#move-count')).toHaveText('0');
  await clickCell(page, 3, 2);
  await page.getByRole('button', { name: '重置当前关卡' }).click();
  await expect(page.locator('#move-count')).toHaveText('0');
  await solve(page);
  await expect(page.getByRole('heading', { name: '试玩通过' })).toBeVisible();
  await expect(page.locator('#cond-cp')).toHaveText('1/1');
  expect(await page.evaluate((key) => localStorage.getItem(key), v3Key)).toBeNull();
  await page.locator('#work-result').getByRole('button', { name: '返回编辑' }).click();
  await expect(page.locator('#work-piece')).toHaveText('镜面 · / · 可调整');
  await action(page, 'save').click();
  await expect(page.locator('#work-state')).toHaveText('已验证 · 已保存');
  const stored = await page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([key]) =>
    key.startsWith('light-up-the-city-work:'))![1]));
  expect(stored.puzzle.pieces[0].state).toBe(0);
  expect(stored.solution.final.pieceStates[0]).toBe(1);
  expect(stored.solution.moves).toHaveLength(4);
  await action(page, 'share').click();
  const url = await page.locator('#work-url').inputValue();
  expect(url).toContain('#level=');

  const guest = await browser.newContext({
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.E2E_RENDER_SCALE ?? 1),
  });
  const challenge = await guest.newPage();
  challenge.on('pageerror', (error) => errors.push(error.message));
  try {
    await challenge.goto(url);
    await expect(challenge.locator('#work-result-title')).toHaveText('运河旁的光');
    await challenge.getByRole('button', { name: '开始挑战' }).click();
    await expect(challenge.locator('#cond-lights')).toHaveText('0/1');
    await solve(challenge);
    await expect(challenge.getByRole('heading', { name: '挑战成功' })).toBeVisible();
    await challenge.screenshot({ path: 'test-results/workshop-challenge.png', scale: 'css' });
    await challenge.getByRole('button', { name: '再玩一次' }).click();
    await expect(challenge.locator('#cond-inv')).toHaveText('剩 1');
    await solve(challenge);
    await challenge.getByRole('button', { name: '复制到我的关卡' }).click();
    await expect(challenge.locator('#work-state')).toHaveText('草稿 · 已保存');
    await expect(challenge.getByLabel('关卡名称')).toHaveValue('运河旁的光 副本');
    await challenge.getByLabel('背灯目标').fill('2');
    await action(challenge, 'save').click();
    await expect(challenge.locator('#work-state')).toHaveText('草稿 · 已保存');
    expect(await challenge.evaluate((key) => localStorage.getItem(key), v3Key)).toBeNull();
  } finally {
    await guest.close();
  }

  await action(page, 'rotate').click();
  await expect(page.locator('#work-state')).toHaveText('草稿 · 未保存');
  await expect(action(page, 'share')).toBeDisabled();
  await action(page, 'save').click();
  const edited = await page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([key]) =>
    key.startsWith('light-up-the-city-work:'))![1]));
  expect(edited.solution).toBeUndefined();
  await action(page, 'library').click();
  const work = page.locator('.work-entry').filter({ hasText: '运河旁的光' });
  await work.getByRole('button', { name: '复制', exact: true }).click();
  await expect(page.getByLabel('关卡名称')).toHaveValue('运河旁的光 副本');
  await action(page, 'library').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.work-entry').filter({ hasText: '副本' }).getByRole('button', { name: '删除' }).click();
  await expect(page.locator('.work-entry')).toHaveCount(1);
  await page.getByRole('button', { name: '游戏首页' }).click();

  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({
    currentLevel: 24, completed: Array.from({ length: 25 }, (_, i) => i), best: {}, muted: true,
  })), v3Key);
  await page.reload();
  await page.getByRole('button', { name: '自由观赏' }).click();
  await page.getByRole('button', { name: '重播复苏' }).click();
  await page.getByRole('button', { name: '再玩一次' }).click();
  const completed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).completed, v3Key);
  expect(completed).toEqual([]);
  await page.reload();
  await page.getByRole('button', { name: '造光工坊', exact: true }).click();
  await expect(page.getByRole('heading', { name: '运河旁的光' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('malformed link recovers and denied writes leave the draft unsaved', async ({ page }) => {
  await page.goto('/#level=broken!');
  await expect(page.locator('#work-link-error')).toContainText('无法打开分享关卡');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: '造光工坊', exact: true }).click();
  await page.getByRole('button', { name: '新建关卡' }).click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Test blocked storage', 'QuotaExceededError'); };
  });
  await action(page, 'save').click();
  await expect(page.locator('#work-feedback')).toContainText('保存失败');
  await expect(page.locator('#work-state')).toHaveText('草稿 · 未保存');
});

test.describe('touch editor', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('place, rotate, trial and save on a phone viewport', async ({ page }) => {
    await create(page);
    await action(page, 'tool-single').tap();
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
    const point = await page.evaluate(() => (window as unknown as {
      __qoderTest: { projectCell: (x: number, z: number) => { x: number; y: number } };
    }).__qoderTest.projectCell(2, 2));
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.locator('#work-piece')).toHaveText('背灯镜 · 北 · 可调整');
    await action(page, 'rotate').tap();
    await page.screenshot({ path: 'test-results/workshop-mobile.png', scale: 'css' });
    await action(page, 'trial').tap();
    await expect(page.locator('#work-feedback')).toContainText('初始布局已经满足通关条件');
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
    await page.screenshot({ path: 'test-results/phase-b2-initial-win.png', scale: 'css' });
    await expect(action(page, 'share')).toBeDisabled();
    await action(page, 'save').tap();
    await expect(page.locator('#work-state')).toHaveText('草稿 · 已保存');

    // Turn the lamp out of its solved orientation before validating by playing.
    await action(page, 'rotate').tap();
    await action(page, 'trial').tap();
    const trialPoint = await page.evaluate(() => (window as unknown as {
      __qoderTest: { projectCell: (x: number, z: number) => { x: number; y: number } };
    }).__qoderTest.projectCell(2, 2));
    for (let i = 0; i < 3; i++) await page.touchscreen.tap(trialPoint.x, trialPoint.y);
    await expect(page.getByRole('heading', { name: '试玩通过' })).toBeVisible();
    await page.locator('#work-result').getByRole('button', { name: '返回编辑' }).tap();
    await action(page, 'save').tap();
    await expect(page.locator('#work-state')).toHaveText('已验证 · 已保存');
  });
});

test('theme and region are restored and shared with an independently verified design', async ({ page, browser }) => {
  for (const [theme, city, region] of [['aegean', '1', '剧场'], ['shanghai', '2', '东方明珠']]) {
    await page.goto('/');
    await page.locator(`#intro [data-journey="theme-${theme}"]`).click();
    await page.locator('#open-workshop').click();
    await page.getByRole('button', { name: '新建关卡' }).click();
    await expect(page.locator('#work-city')).toHaveValue(city);
    await page.locator('#work-district').selectOption({ label: region });
    await page.locator('#work-name').fill(`试灯 · ${region}`);
    await action(page, 'tool-single').click();
    await clickCell(page, 2, 2);
    await action(page, 'trial').click();
    await expect(page.locator('.game-shell')).toHaveAttribute('data-city', theme);
    await clickCell(page, 2, 2);
    await expect(page.getByRole('heading', { name: '试玩通过' })).toBeVisible();
    await page.locator('#work-result [data-work="editor"]').click();
    await page.locator('#work-city').selectOption('0');
    await expect(action(page, 'share')).toBeEnabled();
    await page.locator('#work-city').selectOption(city);
    await expect(action(page, 'share')).toBeEnabled();
    await action(page, 'save').click();
    await page.reload();
    await page.locator('#open-workshop').click();
    await page.locator('.work-entry').filter({ hasText: `试灯 · ${region}` }).getByRole('button', { name: '编辑', exact: true }).click();
    await expect(page.locator('#work-city')).toHaveValue(city);
    await expect(page.locator('#work-district')).toHaveValue('2');
    await action(page, 'share').click();
    const guest = await browser.newContext({ deviceScaleFactor: Number(process.env.E2E_RENDER_SCALE ?? 1) });
    try {
      const challenge = await guest.newPage();
      await challenge.goto(await page.locator('#work-url').inputValue());
      await challenge.locator('#work-result [data-work="begin"]').click();
      await expect(challenge.locator('.game-shell')).toHaveAttribute('data-city', theme);
      await expect(challenge.locator('#level-subtitle')).toHaveText(region);
      await clickCell(challenge, 2, 2);
      await expect(challenge.getByRole('heading', { name: '挑战成功' })).toBeVisible();
      await challenge.getByRole('button', { name: '复制到我的关卡' }).click();
      await expect(challenge.locator('#work-city')).toHaveValue(city);
      await expect(challenge.locator('#work-state')).toHaveText('草稿 · 已保存');
    } finally { await guest.close(); }
  }
});
