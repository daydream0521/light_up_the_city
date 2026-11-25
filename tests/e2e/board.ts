import { expect, type Page } from '@playwright/test';
import type { LevelConfig } from '../../src/game/levels';
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
  await expect(page.locator('#level-toast')).toBeVisible();
}
