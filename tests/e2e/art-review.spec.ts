import { expect, test, type Page } from '@playwright/test';
import { LEVELS } from '../../src/game/levels';
import { advanceCampaign, solveLevel } from './board';

async function measureFps(page: Page): Promise<number> {
  return page.evaluate(() => new Promise<number>((resolve) => {
    let frames = 0;
    const start = performance.now();
    const tick = () => {
      frames += 1;
      if (performance.now() - start < 2500) requestAnimationFrame(tick);
      else resolve(frames / ((performance.now() - start) / 1000));
    };
    requestAnimationFrame(tick);
  }));
}

test('art review: fixed viewpoints across districts, canal and revival states', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.addInitScript(() => localStorage.removeItem('light-up-the-city-v3'));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.waitForTimeout(3200);
  await page.screenshot({ path: 'test-results/art-01-intro-wide-dark.png' });
  const introFps = await measureFps(page);
  console.log(`[art] intro fps ~${introFps.toFixed(1)}`);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'test-results/art-02-intro-angle2.png' });

  await page.getByRole('button', { name: '开始点亮' }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-moving', 'false', { timeout: 20_000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'test-results/art-03-district0-residential-dark.png' });

  await solveLevel(page, LEVELS[0]);
  await advanceCampaign(page, 0);
  await solveLevel(page, LEVELS[1]);
  await advanceCampaign(page, 1);
  await page.screenshot({ path: 'test-results/art-04-district1-commercial.png' });
  const levelFps = await measureFps(page);
  console.log(`[art] level fps ~${levelFps.toFixed(1)}`);

  await solveLevel(page, LEVELS[2]);
  await advanceCampaign(page, 2);
  await solveLevel(page, LEVELS[3]);
  await advanceCampaign(page, 3);
  await page.screenshot({ path: 'test-results/art-05-district2-industrial.png' });

  await solveLevel(page, LEVELS[4]);
  await advanceCampaign(page, 4);
  await solveLevel(page, LEVELS[5]);
  await advanceCampaign(page, 5);
  await page.screenshot({ path: 'test-results/art-06-district3-civic.png' });

  await solveLevel(page, LEVELS[6]);
  await advanceCampaign(page, 6);
  await solveLevel(page, LEVELS[7]);
  await advanceCampaign(page, 7);
  await solveLevel(page, LEVELS[8]);
  await advanceCampaign(page, 8);
  await page.waitForTimeout(4500);
  await page.screenshot({ path: 'test-results/art-07-finale.png' });
  const finaleFps = await measureFps(page);
  console.log(`[art] finale fps ~${finaleFps.toFixed(1)}`);
  await page.waitForTimeout(7000);
  await page.screenshot({ path: 'test-results/art-08-finale-angle2.png' });

  expect(errors).toEqual([]);
});
