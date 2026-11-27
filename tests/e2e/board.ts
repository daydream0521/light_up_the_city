import { CITIES, cityOf } from '../../src/game/journey';
import { expect, type Page } from '@playwright/test';
import { LEVELS, type LevelConfig } from '../../src/game/levels';
import { referenceMoves } from '../../src/game/campaignGuide';
import { initialReflectionState } from '../../src/game/reflection';

export async function clickCell(page: Page, x: number, z: number): Promise<void> {
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
  const point = await page.evaluate(([cx, cz]) => {
    const hook = (window as unknown as { __qoderTest: { projectCell: (x: number, z: number) => { x: number; y: number } | null } }).__qoderTest;
    return hook.projectCell(cx, cz);
  }, [x, z]);
  if (!point) throw new Error(`cell ${x},${z} cannot be projected`);
  await page.mouse.click(point.x, point.y);
}

export async function pickTool(page: Page, tool: string): Promise<void> {
  await page.locator(`[data-tool="${tool}"]`).click();
  await expect(page.locator(`[data-tool="${tool}"]`)).toHaveAttribute('aria-pressed', 'true');
}

export async function solveLevel(page: Page, level: LevelConfig): Promise<void> {
  await expect(page.locator('#level-name')).toHaveText(level.name);
  for (const move of referenceMoves(level, initialReflectionState(level))) {
    if (move.tool) await pickTool(page, move.tool);
    await clickCell(page, ...move.at);
  }
  // The campaign advances on a timer, so fast and slow renderers may see different toast durations.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('light-up-the-city-v3')!).completed))
    .toContain(level.id);
}

export async function advanceCampaign(page: Page, solved: number): Promise<void> {
  const city = cityOf(solved);
  if (solved + 1 === CITIES[city].end) {
    await page.locator('[data-action="next"]').click();
    if (city === 0) {
      await expect(page.locator('#finale')).toBeVisible();
      await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
    } else {
      await expect(page.locator('.city-surface iframe')).toBeVisible();
    }
    return;
  }
  await page.locator('[data-action="next"]').evaluate((button) => {
    if (!button.closest('[hidden]')) (button as HTMLButtonElement).click();
  });
  if (solved + 1 < LEVELS.length) {
    await expect(page.locator('#level-name')).toHaveText(LEVELS[solved + 1].name);
  } else {
    await expect(page.locator('#finale')).toBeVisible();
  }
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false');
}
