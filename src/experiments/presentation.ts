export type CityMode = 'home' | 'view' | 'preview' | 'show' | 'revive' | 'park';

export interface CityRevival {
  progress: readonly number[];
  change?: { district: number; from: number; finale: boolean };
}

let revision = 0;
let reported = false;

export function connectPresentation(applyMode: (mode: CityMode, revival?: CityRevival) => void): void {
  if (Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).some(link => !link.sheet)) {
    throw new Error('City stylesheet was not loaded');
  }
  function apply(mode: CityMode, revival?: CityRevival): void {
    reported = false;
    document.documentElement.dataset.sceneMode = mode;
    applyMode(mode, revival);
  }

  if (window.parent === window) {
    const requested = new URLSearchParams(location.search).get('exhibit');
    apply(requested === 'home' || requested === 'show' || requested === 'preview' ? requested : 'view');
    return;
  }
  document.documentElement.dataset.embedded = '';
  window.addEventListener('message', ({ origin, source, data }) => {
    if (origin !== location.origin || source !== window.parent || data?.type !== 'city-frame-mode') return;
    if (data.revision <= revision) return;
    revision = data.revision;
    apply(data.mode, data.revival);
  });
  window.parent.postMessage({ type: 'city-frame-awaiting' }, location.origin);
}

export function reportCityShow(playing: boolean): void {
  if (window.parent !== window) window.parent.postMessage({ type: 'city-frame-show', playing, revision }, location.origin);
}

export function reportCityControls(hidden: boolean): void {
  if (window.parent !== window) window.parent.postMessage({ type: 'city-frame-controls', hidden, revision }, location.origin);
}

export function firstCityFrame(): void {
  const root = document.documentElement;
  const mode = root.dataset.sceneMode;
  if (root.dataset.sceneState === 'failed' || reported) return;
  reported = true;
  root.dataset.sceneState = 'ready';
  document.getElementById('status')!.hidden = true;
  if (window.parent !== window) window.parent.postMessage({ type: 'city-frame-ready', mode, revision }, location.origin);
}

export function playRevival(revival: CityRevival, pullBack: () => void) {
  const { progress, change } = revival;
  let start: number | undefined;
  let ignited = false;
  let wide = false;
  let finished = false;
  return (now: number, reducedMotion: boolean) => {
    if (!change || finished) return { progress, animating: false };
    if (start === undefined && reported) start = now;
    const seconds = start === undefined ? 0 : (now - start) / 1000;
    const goal = progress[change.district];
    const pullback = change.finale ? 2.85 : goal === 1 ? 2.12 : 1.57;
    const end = change.finale ? 4.85 : goal === 1 ? 3.8 : 2.72;
    const ignition = .5;
    if (!ignited && seconds >= ignition) {
      ignited = true;
      reportCityShow(true);
    }
    if (!wide && seconds >= pullback) {
      wide = true;
      pullBack();
    }
    if (seconds >= end) {
      finished = true;
      reportCityShow(false);
    }
    const elapsed = Math.min(1, Math.max(0, (seconds - ignition) / (pullback - ignition)));
    const blend = reducedMotion ? Number(seconds >= ignition) : elapsed * elapsed * (3 - 2 * elapsed);
    const power = progress.slice();
    power[change.district] = change.from + (goal - change.from) * blend;
    return { progress: power, animating: true };
  };
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
