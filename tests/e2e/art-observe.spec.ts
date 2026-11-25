import { expect, test, type Page } from '@playwright/test';
import { LEVELS } from '../../src/game/levels';
import { advanceCampaign, clickCell, solveLevel } from './board';

async function reachFinale(page: Page): Promise<void> {
  for (const level of LEVELS) {
    await solveLevel(page, level);
    await advanceCampaign(page, level.id);
  }
  await page.waitForTimeout(2200);
}

async function drag(page: Page, dx: number, dy: number, button: 'left' | 'right' = 'left'): Promise<void> {
  const box = await page.locator('canvas').boundingBox();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button });
  await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
  await page.mouse.up({ button });
  await page.waitForTimeout(400);
}

async function zoom(page: Page, ticks: number): Promise<void> {
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  for (let i = 0; i < ticks; i += 1) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(400);
}

test('finale clears devices and free city observation works on desktop', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: '开始点亮' }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false', { timeout: 25_000 });
  await reachFinale(page);

  await expect(page.locator('.finale-copy h2')).toHaveText('这座城市，因你而亮。');
  await page.screenshot({ path: 'test-results/obs-01-panorama.png' });

  await drag(page, 260, 0);
  await drag(page, 0, 320);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/obs-02-topdown.png' });

  await drag(page, 0, -260);
  await zoom(page, 5);
  await drag(page, 300, 120, 'right');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/obs-03-closeup.png' });

  await page.locator('[data-action="panorama"]').click();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false', { timeout: 25_000 });

  await page.locator('[data-action="spin"]').click();
  await expect(page.locator('[data-action="spin"]')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(1200);
  await page.locator('[data-action="spin"]').click();
  await expect(page.locator('[data-action="spin"]')).toHaveAttribute('aria-pressed', 'false');

  await page.locator('[data-action="hide-ui"]').click();
  await expect(page.locator('#show-ui')).toBeVisible();
  await expect(page.locator('.finale-copy')).toHaveCSS('opacity', '0');
  await page.screenshot({ path: 'test-results/obs-04-ui-hidden.png' });
  await page.locator('[data-action="show-ui"]').click();
  await expect(page.locator('.finale-copy')).toHaveCSS('opacity', '1');

  await page.locator('[data-level="4"]').click();
  await expect(page.locator('#level-name')).toHaveText('闸门之规');
  await clickCell(page, 2, 3);
  await expect(page.locator('#move-count')).toHaveText('1');

  await page.reload();
  await expect(page.getByRole('button', { name: '俯瞰夜城' })).toBeVisible();
  await page.getByRole('button', { name: '俯瞰夜城' }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false', { timeout: 25_000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'test-results/obs-05-reload-finale.png' });
  await drag(page, 200, 0);
  await zoom(page, 4);
  await page.screenshot({ path: 'test-results/obs-06-reload-closeup.png' });

  expect(errors).toEqual([]);
});

test('finale observation basics on mobile', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 840 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('light-up-the-city-v3', JSON.stringify({
      currentLevel: 8,
      completed: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      best: {},
      muted: true,
    }));
  });
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: '俯瞰夜城' }).tap();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false', { timeout: 25_000 });
  await page.waitForTimeout(2200);

  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.synthesizeScrollGesture', {
    x: 195, y: 420, xDistance: 130, yDistance: 50, gestureSourceType: 'touch', speed: 700,
  });
  await page.waitForTimeout(500);
  await cdp.send('Input.synthesizePinchGesture', {
    x: 195, y: 420, scaleFactor: 2.4, gestureSourceType: 'touch', relativeSpeed: 300,
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/obs-07-mobile.png' });

  await page.locator('[data-action="hide-ui"]').tap();
  await expect(page.locator('#show-ui')).toBeVisible();
  await page.locator('[data-action="show-ui"]').tap();
  await expect(page.locator('.observe-bar')).toBeVisible();
  await context.close();
});
