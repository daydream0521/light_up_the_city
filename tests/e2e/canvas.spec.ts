import { expect, test } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';

test('raycast hover and direct 3D mirror click solve level one', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '开始点亮' }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-camera-moving', 'false');

  const aspect = 1440 / 900;
  const viewSize = 13.6;
  const camera = new OrthographicCamera(-viewSize * aspect / 2, viewSize * aspect / 2, viewSize / 2, -viewSize / 2, 0.1, 140);
  camera.position.set(4.6, 12.95, 8.4);
  camera.lookAt(-5, 0.75, -5);
  camera.updateMatrixWorld();
  const projected = new Vector3(-5, 2.25, -5).project(camera);
  const x = (projected.x + 1) * 720;
  const y = (1 - projected.y) * 450;

  await page.mouse.move(x, y);
  await expect(canvas).toHaveClass(/is-hovering/);
  await page.mouse.click(x, y);
  await expect(page.locator('[data-mirror="0"]')).toHaveAttribute('aria-label', /当前方向 \//);
  await expect(page.locator('#level-toast')).toBeVisible();
});
