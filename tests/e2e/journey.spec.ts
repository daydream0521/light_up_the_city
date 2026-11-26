import { expect, test, type ElementHandle } from '@playwright/test';
import { CITIES } from '../../src/game/journey';
import { LEVELS } from '../../src/game/levels';
import { clickCell, pickTool, solveLevel } from './board';

test('city collection previews all three maps and preserves progress', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.screenshot({ path: 'test-results/v3-home.png', scale: 'css' });
  await page.getByRole('button', { name: '城市收藏', exact: true }).click();
  await expect(page.locator('.journey-cards article')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/v3-collection.png', scale: 'css' });
  for (const [city, first] of [[1, 9], [2, 17]]) {
    await page.locator(`[data-journey="select-city-${city}"]`).click();
    await expect(page.locator(`[data-journey="level-${first}"]`)).toBeEnabled();
    await expect(page.locator(`[data-journey="level-${first + 1}"]`)).toBeDisabled();
  }
  for (const city of CITIES) {
    await page.locator(`.journey-collection [data-journey="observe-${city.key}"]`).click();
    if (city.key === 'rain') {
      await expect(page.locator('#finale-title')).toHaveText(city.name);
      await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
    } else {
      const frame = page.frameLocator('.city-surface iframe');
      await expect(frame.locator('#status')).toBeHidden();
      await expect(frame.locator('#time')).toBeVisible();
    }
    if (city.key === 'rain') await page.screenshot({ path: 'test-results/v3-observe-rain.png', scale: 'css' });
    await page.locator(city.key === 'rain' ? '#finale [data-journey="collection"]' : '.journey-exhibit [data-journey="collection"]').click();
    await expect(page.locator('.journey-cards article')).toHaveCount(3);
  }
  expect(await page.evaluate(() => localStorage.getItem('light-up-the-city-v3'))).toBeNull();
  expect(failures).toEqual([]);
});

for (const chapter of CITIES.slice(1)) {
  test(`solve ${chapter.name}, show revival and continue`, async ({ page }) => {
    test.setTimeout(420_000);
    await page.addInitScript(({ first }) => {
      if (localStorage.getItem('light-up-the-city-v3')) return;
      localStorage.setItem('light-up-the-city-v3', JSON.stringify({
        currentLevel: first, completed: Array.from({ length: first }, (_, i) => i), best: {}, muted: true,
      }));
    }, chapter);
    await page.goto('/');
    await page.getByRole('button', { name: '开始点亮' }).click();
    await expect(page.locator('#level-name')).toHaveText(LEVELS[chapter.first].name);
    const stocked = LEVELS[chapter.first].reflection.inventory[0].kind;
    const level = LEVELS[chapter.first];
    const empty = [0, 1, 2, 3, 4].flatMap(z => [0, 1, 2, 3, 4].map(x => [x, z] as const))
      .find(at => ![level.source, ...level.reflection.pieces.map(piece => piece.at)].some(p => p.join() === at.join()))!;
    await pickTool(page, stocked);
    await clickCell(page, ...empty);
    await clickCell(page, ...empty);
    await pickTool(page, 'erase');
    await clickCell(page, ...empty);
    await expect(page.locator('#move-count')).toHaveText('3');
    await page.getByRole('button', { name: '重置当前关卡' }).click();
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
    await page.screenshot({ path: `test-results/v3-puzzle-${chapter.key}.png`, scale: 'css' });

    const surface = page.locator('.city-surface');
    const observation = page.frameLocator('.city-surface iframe');
    let loadedCity: ElementHandle | null = null;
    for (const puzzle of LEVELS.slice(chapter.first, chapter.end)) {
      await solveLevel(page, puzzle);
      await expect(page.locator('.revival-panel')).toBeVisible();
      await expect(surface).toHaveAttribute('data-status', 'ready', { timeout: 32_000 });
      await expect(observation.locator('html')).toHaveAttribute('data-scene-mode', 'revive');
      await expect(observation.locator('#time')).toBeHidden();
      const recovered = (puzzle.id - chapter.first) % 2 + 1;
      await expect(page.locator('.revival-regions [aria-current="true"]')).toHaveAttribute('aria-label', new RegExp(`已恢复 ${recovered} / 2`));
      const iframe = page.locator('.city-surface iframe');
      if (loadedCity) expect(await iframe.evaluate((element, previous) => element === previous, loadedCity)).toBe(true);
      else loadedCity = await iframe.elementHandle();
      await expect(page.getByRole('button', { name: '跳过演出' })).toBeHidden();
      if (puzzle.id + 1 < chapter.end) {
        await page.getByRole('button', { name: '下一关', exact: true }).click();
        await expect(surface).toBeHidden();
        await expect(observation.locator('html')).toHaveAttribute('data-scene-mode', 'park');
      }
    }
    if (chapter.key === 'aegean') {
      await page.getByRole('button', { name: '继续旅程' }).click();
      await expect(page.locator('#level-name')).toHaveText(LEVELS[17].name);
      await page.reload();
      await page.getByRole('button', { name: '开始点亮' }).click();
      await expect(page.locator('#level-name')).toHaveText(LEVELS[17].name);
    } else {
      await expect(page.locator('.journey-exhibit')).toContainText('三座城市，灯火相连');
      await page.locator('.revival-panel [data-journey="observe-shanghai"]').click();
      await observation.locator('#show').click();
      await expect(observation.locator('#show')).toHaveAttribute('aria-pressed', 'true');
      await expect(observation.locator('#show')).toHaveAttribute('aria-pressed', 'false', { timeout: 30_000 });
      await expect(observation.locator('#clock')).toHaveText('21:03');
      await page.locator('.journey-exhibit [data-journey="revival"]').click();
      await page.getByRole('button', { name: '再玩一次' }).click();
      await expect(page.locator('#level-name')).toHaveText(LEVELS[0].name);
    }
  });
}


test.describe('mobile city board', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('place and take back a piece in the harbour', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('light-up-the-city-v3', JSON.stringify({
      currentLevel: 9, completed: [0, 1, 2, 3, 4, 5, 6, 7, 8], best: {}, muted: true,
    })));
    await page.goto('/');
    await page.getByRole('button', { name: '开始点亮' }).tap();
    await expect(page.locator('#level-name')).toHaveText('港口双灯');
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
    await page.locator('[data-tool="splitter"]').tap();
    const level = LEVELS[9];
    const occupied = [level.source, ...level.reflection.pieces.map(piece => piece.at)].map(at => at.join());
    const candidates = [[2, 2], [1, 2], [2, 1], [2, 3], [3, 2]];
    const [x, z] = candidates.find(at => !occupied.includes(at.join()))!;
    const point = await page.evaluate(([x, z]) => (window as unknown as {
      __qoderTest: { projectCell: (x: number, z: number) => { x: number; y: number } };
    }).__qoderTest.projectCell(x, z), [x, z]);
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.locator('#move-count')).toHaveText('1');
    await page.screenshot({ path: 'test-results/v3-mobile-harbour.png', scale: 'css' });
    await page.locator('[data-tool="erase"]').tap();
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.locator('#move-count')).toHaveText('2');
  });
});


test('a cold revival can be skipped while loading and replay uses existing progress', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('/');
  const entry = (url: URL) => /\/(?:src\/experiments\/shanghai-city\/main\.ts|assets\/shanghai-[^/]+\.js)$/.test(url.pathname);
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  await page.route(entry, async route => { await blocked; await route.continue().catch(() => {}); });
  try {
    await page.locator('#intro [data-journey="collection"]').click();
    await page.locator('[data-journey="select-city-2"]').click();
    await page.locator('[data-journey="level-17"]').click();
    await solveLevel(page, LEVELS[17]);
    const surface = page.locator('.city-surface');
    await expect(surface).toHaveAttribute('data-status', 'loading');
    await expect(surface.locator('iframe')).toHaveCSS('opacity', '0');
    await page.getByRole('button', { name: '跳过演出' }).click();
    await expect(page.getByRole('button', { name: '跳过演出' })).toBeHidden();
    await page.getByRole('button', { name: '下一关', exact: true }).click();
    await expect(page.locator('#level-name')).toHaveText(LEVELS[18].name);
    release();
    await page.unroute(entry);
    await expect(surface.locator('iframe')).toHaveCount(0);

    await page.locator('[data-level="17"]').click();
    await solveLevel(page, LEVELS[17]);
    await expect(page.locator('#level-name')).toHaveText(LEVELS[18].name);
    await expect(page.locator('.revival-panel')).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('light-up-the-city-v3')!).completed)).toEqual([17]);
    await page.reload();
    await page.locator('#intro [data-journey="collection"]').click();
    await page.getByRole('button', { name: '查看复苏' }).click();
    await expect(surface).toHaveAttribute('data-status', 'ready', { timeout: 32_000 });
    await expect(page.locator('.revival-regions li').first()).toHaveAttribute('aria-label', /已恢复 1 \/ 2/);
    expect(failures).toEqual([]);
  } finally { release(); }
});
