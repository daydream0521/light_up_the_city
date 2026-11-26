export type CityMode = 'home' | 'view' | 'show';

let reportedMode: string | undefined;

export function connectPresentation(applyMode: (mode: CityMode) => void): void {
  if (Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).some(link => !link.sheet)) {
    throw new Error('City stylesheet was not loaded');
  }
  let current: CityMode | undefined;
  const requested = new URLSearchParams(location.search).get('exhibit');
  apply(requested === 'home' || requested === 'show' ? requested : 'view');
  if (window.parent === window) return;
  document.documentElement.dataset.embedded = '';
  window.addEventListener('message', ({ origin, source, data }) => {
    if (origin !== location.origin || source !== window.parent || data?.type !== 'city-frame-mode') return;
    const mode = data.mode;
    if (mode === 'home' || mode === 'view' || mode === 'show') apply(mode);
  });

  function apply(mode: CityMode): void {
    if (mode === current) return;
    current = mode;
    reportedMode = undefined;
    document.documentElement.dataset.sceneMode = mode;
    applyMode(mode);
  }
}

export function reportCityShow(playing: boolean): void {
  if (window.parent !== window) window.parent.postMessage({ type: 'city-frame-show', playing }, location.origin);
}

export function reportCityControls(hidden: boolean): void {
  if (window.parent !== window) window.parent.postMessage({ type: 'city-frame-controls', hidden }, location.origin);
}

export function firstCityFrame(): void {
  const root = document.documentElement;
  const mode = root.dataset.sceneMode;
  if (root.dataset.sceneState === 'failed' || mode === reportedMode) return;
  reportedMode = mode;
  root.dataset.sceneState = 'ready';
  document.getElementById('status')!.hidden = true;
  if (window.parent !== window) window.parent.postMessage({ type: 'city-frame-ready', mode }, location.origin);
}

export function cityFrameFailed(error: unknown): void {
  document.documentElement.dataset.sceneState = 'failed';
  const status = document.getElementById('status')!;
  status.hidden = false;
  status.textContent = '三维场景载入失败。';
  document.getElementById('scene-retry')!.hidden = false;
  if (window.parent !== window) window.parent.postMessage({ type: 'city-frame-failed' }, location.origin);
  console.error(error);
}
