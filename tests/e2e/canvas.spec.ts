import { expect, test } from '@playwright/test';

test('raycast hover and direct 3D piece clicks solve level one', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '开始点亮' }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-camera-moving', 'false');

  const point = await page.evaluate(() => {
    const hook = (window as unknown as { __qoderTest: { projectCell: (x: number, z: number) => { x: number; y: number } | null } }).__qoderTest;
    return hook.projectCell(3, 2);
  });
  if (!point) throw new Error('mirror cell cannot be projected');

  await page.mouse.move(point.x, point.y);
  await expect(canvas).toHaveClass(/is-hovering/);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#move-count')).toHaveText('1');

  const back = await page.evaluate(() => {
    const hook = (window as unknown as { __qoderTest: { projectCell: (x: number, z: number) => { x: number; y: number } | null } }).__qoderTest;
    return hook.projectCell(3, 4);
  });
  if (!back) throw new Error('back-light cell cannot be projected');
  await page.mouse.click(back.x, back.y);
  await page.mouse.click(back.x, back.y);
  await expect(page.locator('#level-toast')).toBeVisible();
});
