import { expect, test, type Page } from '@playwright/test';
import { LEVELS } from '../../src/game/levels';
import { clickCell, pickTool, solveLevel } from './board';

const saveKey = 'light-up-the-city-v3';
const guide = (page: Page, action: string) => page.locator(`button[data-guide="${action}"]`);
const readSave = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
const theme = (page: Page, city: string) => page.locator(`[data-journey="theme-${city}"]`);

async function revealKey(page: Page) {
  await guide(page, 'toggle').click();
  await expect(guide(page, 'key')).toBeHidden();
  await guide(page, 'idea').click();
  await guide(page, 'key').click();
}

test('the three previews are available with incomplete saves and restore the home theme', async ({ page }) => {
  const save = { currentLevel: 1, completed: [0, 9, 17], best: { 0: { moves: 3, stars: 3 } }, muted: true };
  await page.addInitScript(save => localStorage.setItem('light-up-the-city-v3', JSON.stringify(save)), save);
  await page.goto('/');
  for (const city of ['rain', 'aegean', 'shanghai']) {
    await theme(page, city).click();
    await page.locator('#intro [data-journey="preview"]').click();
    if (city === 'rain') {
      await expect(page.locator('#finale-count')).toHaveText('城市预览 · 全城亮灯');
      await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
      await page.getByRole('button', { name: '隐藏界面', exact: true }).click();
      await page.getByRole('button', { name: '恢复界面', exact: true }).click();
      await page.locator('.game-header [data-journey="home"]').click();
    } else {
      const frame = page.frameLocator('.city-surface iframe');
      await expect(frame.locator('html')).toHaveAttribute('data-scene-mode', 'preview');
      await expect(frame.locator('#time')).toBeVisible();
      await frame.getByRole('button', { name: '隐藏界面', exact: true }).click();
      await frame.getByRole('button', { name: '显示界面', exact: true }).click();
      await page.locator('.journey-exhibit [data-journey="home"]').click();
    }
    await expect(page.locator('#intro')).toHaveAttribute('data-theme', city);
    expect(await readSave(page)).toEqual(save);
  }
  await theme(page, 'rain').click();
  await page.locator('#intro [data-journey="collection"]').click();
  await page.locator('[data-journey="progress-rain"]').click();
  await expect(page.locator('#finale-count')).toHaveText('1 / 9 关已点亮');
  expect(await readSave(page)).toEqual(save);
});

for (const [city, levelId] of [['rain', 0], ['aegean', 9], ['shanghai', 17]] as const) {
  test(`${city} can demonstrate a real win, cancel safely and resume the player board`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await theme(page, city).click();
    await page.locator('#intro [data-action="start"]').click();
    await expect(page.locator('#level-name')).toHaveText(LEVELS[levelId].name);
    if (city === 'rain') await clickCell(page, 3, 2);
    const playerMoves = city === 'rain' ? '1' : '0';
    await revealKey(page);
    await expect(page.locator('#move-count')).toHaveText(playerMoves);
    await guide(page, 'warning').click();
    await expect(page.locator('#guide-copy')).toContainText('不授予星级');
    await guide(page, 'start').click();
    await expect(page.locator('#move-count')).toHaveText('0');
    await expect(guide(page, 'finish')).toBeDisabled();
    await guide(page, 'step').click();
    await expect(page.locator('#move-count')).toHaveText('1');
    await guide(page, 'cancel').click();
    await expect(page.locator('#move-count')).toHaveText(playerMoves);
    expect((await readSave(page)).completed).toEqual([]);

    await revealKey(page);
    await guide(page, 'warning').click();
    await guide(page, 'start').click();
    if (city === 'rain') {
      await guide(page, 'play').click();
      await expect(guide(page, 'play')).toHaveText('暂停');
      await guide(page, 'play').click();
      await expect(guide(page, 'play')).toHaveText('自动播放');
    }
    await guide(page, 'layout').click();
    await expect(page.locator('#guide-copy')).toContainText('所有通关条件已满足');
    expect((await readSave(page)).completed).toEqual([]);
    await guide(page, 'finish').click();
    await expect.poll(() => readSave(page)).toMatchObject({ completed: [levelId], currentLevel: levelId + 1, best: {} });
    if (city !== 'rain') {
      await expect(page.locator('.revival-panel')).toBeVisible();
      await page.getByRole('button', { name: '下一关', exact: true }).click();
    }
    await expect(page.locator('#level-name')).toHaveText(LEVELS[levelId + 1].name);
    if (city === 'rain') {
      await page.locator('[data-level="0"]').click();
      await solveLevel(page, LEVELS[0]);
      await expect.poll(async () => (await readSave(page)).best[0]).toEqual({ stars: 3, moves: 3 });
      await expect(page.locator('#level-name')).toHaveText(LEVELS[1].name);
      await page.locator('[data-level="0"]').click();
      await revealKey(page);
      await guide(page, 'warning').click();
      await guide(page, 'start').click();
      await guide(page, 'layout').click();
      await guide(page, 'finish').click();
      await expect(page.locator('#level-name')).toHaveText(LEVELS[1].name);
      expect(await readSave(page)).toMatchObject({ completed: [0], best: { 0: { stars: 3, moves: 3 } } });
    }
    expect(errors).toEqual([]);
  });
}

test('thoughts preserve a 3-star clear and key help stays capped after closing', async ({ page }) => {
  await page.goto('/');
  await page.locator('#intro [data-action="start"]').click();
  await guide(page, 'toggle').click();
  await guide(page, 'idea').click();
  await expect(page.locator('#guide-copy')).toContainText('镜面');
  await guide(page, 'close').click();
  await solveLevel(page, LEVELS[0]);
  await expect.poll(async () => (await readSave(page)).best[0].stars).toBe(3);
  await expect(page.locator('#level-name')).toHaveText(LEVELS[1].name);

  await pickTool(page, 'single');
  await clickCell(page, 2, 1);
  await revealKey(page);
  await expect(page.locator('#guide-copy')).toContainText('取回');
  await guide(page, 'close').click();
  await pickTool(page, 'erase');
  await clickCell(page, 2, 1);
  // Obtain the cap even with an otherwise 3-star route from the initial board.
  await page.getByRole('button', { name: '重置当前关卡' }).click();
  await revealKey(page);
  await guide(page, 'close').click();
  await solveLevel(page, LEVELS[1]);
  await expect.poll(async () => (await readSave(page)).best[1].stars).toBe(2);
  await expect(page.locator('#level-name')).toHaveText(LEVELS[2].name);
  await page.locator('[data-level="1"]').click();
  await solveLevel(page, LEVELS[1]);
  await expect.poll(async () => (await readSave(page)).best[1].stars).toBe(3);
});
