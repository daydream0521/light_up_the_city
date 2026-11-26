import { expect, test, type Page } from '@playwright/test';

const surface = (page: Page) => page.locator('.city-surface');
const frame = (page: Page) => page.frameLocator('.city-surface iframe');
const title = (page: Page) => page.locator('#intro .intro-copy:not(.intro-copy-out) h1');
const select = (page: Page, key: string) => page.locator(`#intro [data-journey="theme-${key}"]`);
const action = (page: Page) => page.locator('#intro [data-action="start"]');

test('the three themes orbit live, preserve progress and reuse the selected map for viewing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(title(page)).toHaveText('点亮夜城');
  await expect(select(page, 'rain')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#scene-container canvas')).toBeVisible();
  if (process.env.V31_SHOTS) await page.screenshot({ path: 'test-results/v31-home-rain.png', scale: 'css' });

  for (const [key, name] of [['aegean', '爱琴余晖'], ['shanghai', '两岸灯火']]) {
    await select(page, key).click();
    await expect(title(page)).toHaveText(name);
    await expect(select(page, key)).toHaveAttribute('aria-pressed', 'true');
    await expect(surface(page)).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(frame(page).locator('html')).toHaveAttribute('data-scene-mode', 'home');
    await expect(frame(page).locator('#time')).toBeHidden();
    await expect(frame(page).locator('#orbit')).toHaveAttribute('aria-pressed', 'true');
    await expect(action(page)).toHaveText('预览城市');
    if (process.env.V31_SHOTS) {
      await expect(surface(page).locator('iframe')).toHaveCSS('opacity', '1');
      await page.screenshot({ path: `test-results/v31-home-${key}.png`, scale: 'css', timeout: 30_000 });
    }

    const liveFrame = await surface(page).locator('iframe').elementHandle();
    await action(page).click();
    await expect(page.locator('#intro')).toBeHidden();
    await expect(frame(page).locator('#time')).toBeVisible();
    await expect(frame(page).locator('#orbit')).toHaveAttribute('aria-pressed', 'false');
    await frame(page).locator('#time').fill('20');
    await expect(frame(page).locator('#clock')).toHaveText('20:00');
    expect(await surface(page).locator('iframe').evaluate((element, previous) => element === previous, liveFrame)).toBe(true);
    await page.locator('.journey-exhibit [data-journey="home"]').click();
    await expect(title(page)).toHaveText(name);
    await expect(frame(page).locator('#time')).toBeHidden();
    await expect(surface(page)).toHaveAttribute('data-status', 'ready');
    expect(await surface(page).locator('iframe').evaluate((element, previous) => element === previous, liveFrame)).toBe(true);
  }

  await page.locator('#intro [data-journey="collection"]').click();
  await expect(page.locator('.journey-cards article')).toHaveCount(3);
  await expect(surface(page).locator('iframe')).toHaveCount(0);
  await page.locator('.journey-collection [data-journey="home"]').click();
  await expect(title(page)).toHaveText('两岸灯火');
  await select(page, 'rain').click();
  await expect(title(page)).toHaveText('点亮夜城');
  await expect(surface(page).locator('iframe')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('light-up-the-city-v3'))).toBeNull();
  expect(errors).toEqual([]);
});

test('cold slow frames keep their poster until WebGL and ignore obsolete replies', async ({ page, context }) => {
  await page.goto('/');
  const net = await context.newCDPSession(page);
  await net.send('Network.enable');
  await net.send('Network.setCacheDisabled', { cacheDisabled: true });
  await net.send('Network.emulateNetworkConditions', {
    offline: false, latency: 170, downloadThroughput: 150 * 1024, uploadThroughput: 72 * 1024,
  });

  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let entryBlocked = false;
  await page.route(url => /\/(?:src\/experiments\/aegean-city\/main\.ts|assets\/aegean-[^/]+\.js)$/.test(url.pathname),
    async route => { entryBlocked = true; await gate; await route.continue().catch(() => {}); });

  try {
    await select(page, 'aegean').click();
    await expect.poll(() => entryBlocked).toBe(true);
    await expect(surface(page)).toHaveAttribute('data-status', 'loading');
    await expect(surface(page).locator('iframe')).toHaveCSS('opacity', '0');
    await expect(frame(page).locator('#time')).toBeHidden();
    const color = await frame(page).locator('html').evaluate(root => getComputedStyle(root).backgroundColor);
    expect(color).toBe('rgb(17, 39, 44)');
    if (process.env.V31_SHOTS) await page.screenshot({ path: 'test-results/v31-transition-poster.png', scale: 'css' });

    const obsolete = await surface(page).locator('iframe').elementHandle();
    const staleWindow = await obsolete!.evaluateHandle(element => (element as HTMLIFrameElement).contentWindow);
    await page.evaluate(() => {
      for (const key of ['rain', 'aegean', 'rain', 'shanghai']) {
        document.querySelector<HTMLButtonElement>(`[data-journey="theme-${key}"]`)!.click();
      }
    });
    await expect(title(page)).toHaveText('两岸灯火');
    await expect(surface(page)).toHaveAttribute('data-city', 'shanghai');
    await page.evaluate(previous => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: location.origin, source: previous as Window, data: { type: 'city-frame-ready', mode: 'home' },
      }));
      const current = document.querySelector('iframe')!.contentWindow;
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://example.invalid', source: current, data: { type: 'city-frame-ready', mode: 'home' },
      }));
    }, staleWindow);
    await expect(surface(page)).toHaveAttribute('data-status', 'loading');
    await expect(surface(page).locator('iframe')).toHaveCount(1);
    release();
    await expect(surface(page)).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(title(page)).toHaveText('两岸灯火');
    await expect(frame(page).locator('#time')).toBeHidden();
  } finally {
    release();
  }
});

test('standalone map pages style the first document and withhold controls until a frame', async ({ page }) => {
  for (const [key, background] of [['aegean', 'rgb(17, 39, 44)'], ['shanghai', 'rgb(16, 25, 43)']]) {
    const entry = (url: URL) => url.pathname.endsWith(`/${key}-city/main.ts`) ||
      (url.pathname.includes('/assets/') && url.pathname.split('/').at(-1)?.startsWith(`${key}-`) === true &&
        url.pathname.endsWith('.js'));
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(entry, async route => { await gate; await route.continue().catch(() => {}); });
    try {
      await page.goto(`/experiments/${key}-city/index.html`, { waitUntil: 'commit' });
      await expect(page.locator('html')).toHaveAttribute('data-scene-state', 'loading');
      await expect(page.locator('html')).toHaveCSS('background-color', background);
      await expect(page.locator('#time')).toBeHidden();
      await expect(page.locator('#status')).toBeVisible();
    } finally {
      release();
    }
    await expect(page.locator('html')).toHaveAttribute('data-scene-state', 'ready', { timeout: 30_000 });
    await expect(page.locator('#time')).toBeVisible();
    await page.unroute(entry);
  }
});

test('map initialization failure keeps a usable theme and can be retried', async ({ page }) => {
  await page.addInitScript(() => {
    if (!location.pathname.includes('/experiments/') || sessionStorage.getItem('v31-fail-webgl') !== 'yes') return;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, options?: unknown) {
      return kind.startsWith('webgl') ? null : Reflect.apply(original, this, [kind, options]);
    } as typeof original;
  });
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('v31-fail-webgl', 'yes'));
  await select(page, 'aegean').click();
  await expect(surface(page)).toHaveAttribute('data-status', 'failed');
  await expect(title(page)).toHaveText('爱琴余晖');
  await page.evaluate(() => sessionStorage.removeItem('v31-fail-webgl'));
  await surface(page).getByRole('button', { name: '重新加载' }).click();
  await expect(surface(page)).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
});

test.describe('phone and reduced motion', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });

  test('starts an unlocked chapter and returns to its theme', async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('light-up-the-city-v3')) return;
      localStorage.setItem('light-up-the-city-v3', JSON.stringify({
        currentLevel: 9, completed: [0,1,2,3,4,5,6,7,8], best: {}, muted: true,
      }));
    });
    await page.goto('/');
    await expect(title(page)).toHaveText('爱琴余晖');
    await expect(surface(page)).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(frame(page).locator('#orbit')).toHaveAttribute('aria-pressed', 'false');
    if (process.env.V31_SHOTS) await page.screenshot({ path: 'test-results/v31-mobile.png', scale: 'css' });
    await select(page, 'shanghai').tap();
    await expect(action(page)).toHaveText('预览城市');
    await select(page, 'aegean').tap();
    await expect(action(page)).toHaveText('开始点亮');
    await action(page).tap();
    await expect(page.locator('#level-name')).toHaveText('港口双灯');
    await page.getByRole('button', { name: '返回首页' }).tap();
    await expect(title(page)).toHaveText('爱琴余晖');
    await page.locator('#open-workshop').tap();
    await expect(page.locator('#work-library')).toBeVisible();
    await expect(surface(page).locator('iframe')).toHaveCount(0);
  });
});
