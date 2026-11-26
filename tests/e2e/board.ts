import { CITIES, cityOf } from '../../src/game/journey';
import { expect, type Page } from '@playwright/test';
import { LEVELS, type LevelConfig } from '../../src/game/levels';
import { SOLUTIONS } from '../campaign-solutions';

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
  const solution = SOLUTIONS[level.id];
  async function rotate(at: readonly [number, number], from: number, to: number, directions: number) {
    const clicks = (to - from + directions) % directions;
    for (let i = 0; i < clicks; i += 1) await clickCell(page, ...at);
  }
  await rotate(level.source, level.sourceDirection, solution.sourceDirection, 4);
  for (const [index, piece] of level.reflection.pieces.entries()) {
    await rotate(piece.at, piece.state, solution.pieceStates[index], piece.kind === 'single' ? 4 : 2);
  }
  for (const piece of solution.placements) {
    await pickTool(page, piece.kind);
    await clickCell(page, piece.x, piece.z);
    await rotate([piece.x, piece.z], 0, piece.state, piece.kind === 'single' ? 4 : 2);
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
      await expect(page.locator('.journey-exhibit iframe')).toBeVisible();
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
