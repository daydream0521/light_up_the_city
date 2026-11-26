import { CITIES } from '../game/journey';
import type { CityMode, CityRevival } from '../experiments/presentation';

export class CitySurface {
  private readonly root = document.createElement('div');
  private readonly feedback: HTMLElement;
  private readonly message: HTMLElement;
  private readonly retry: HTMLButtonElement;
  private frame?: HTMLIFrameElement;
  private city?: (typeof CITIES)[1 | 2];
  private mode: CityMode = 'home';
  private revival?: CityRevival;
  private revision = 0;
  private timeout = 0;

  constructor(shell: HTMLElement, onShow: (playing: boolean) => void) {
    this.root.className = 'city-surface';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="city-posters" aria-hidden="true">
        ${CITIES.slice(1).map(city => `<img class="city-poster" data-poster="${city.key}" src="./journey/${city.key}.jpg" alt="">`).join('')}
      </div>
      <div class="city-frame-feedback" hidden>
        <span role="status"></span>
        <button class="icon-button" type="button" hidden>重新加载</button>
      </div>`;
    shell.append(this.root);
    this.feedback = this.root.querySelector('.city-frame-feedback')!;
    this.message = this.feedback.querySelector('span')!;
    this.retry = this.feedback.querySelector('button')!;
    this.retry.addEventListener('click', () => {
      if (this.city && this.mode !== 'park') this.show(this.city, this.mode, this.revival);
    });

    window.addEventListener('message', ({ origin, source, data }) => {
      if (origin !== location.origin || !this.frame || source !== this.frame.contentWindow) return;
      if (data?.type === 'city-frame-failed') {
        this.failed();
        if (this.mode !== 'home') onShow(false);
      }
      if (data?.type === 'city-frame-awaiting') {
        this.sendMode();
        return;
      }
      if (data?.revision !== this.revision || this.mode === 'park') return;
      if (this.mode !== 'home' && data?.type === 'city-frame-show' && typeof data.playing === 'boolean') onShow(data.playing);
      if (this.mode !== 'home' && data?.type === 'city-frame-controls' && typeof data.hidden === 'boolean') {
        shell.classList.toggle('exhibit-controls-hidden', data.hidden);
      }
      if (data?.type !== 'city-frame-ready') return;
      if (data.mode !== this.mode) return;
      window.clearTimeout(this.timeout);
      this.root.dataset.status = 'ready';
      this.feedback.hidden = true;
    });
  }

  show(city: (typeof CITIES)[1 | 2], mode: Exclude<CityMode, 'park'>, revival?: CityRevival): void {
    const previousMode = this.mode;
    if (this.city === city && this.frame && previousMode === mode && this.revival === revival) return;
    this.mode = mode;
    this.revival = revival;
    this.revision += 1;
    this.root.dataset.mode = mode;
    this.root.hidden = false;
    if (this.city === city && this.frame) {
      this.frame.tabIndex = mode === 'home' || mode === 'revive' ? -1 : 0;
      if (this.root.dataset.status === 'loading') { this.sendMode(); return; }
      if (previousMode === 'park' || mode === 'home' || (mode === 'revive' && previousMode !== 'revive')) {
        window.clearTimeout(this.timeout);
        this.root.dataset.status = 'switching';
        this.timeout = window.setTimeout(() => this.failed(), 32_000);
      }
      this.sendMode();
      return;
    }

    window.clearTimeout(this.timeout);
    this.frame?.remove();
    this.city = city;
    this.root.dataset.city = city.key;
    this.root.dataset.status = 'loading';
    this.feedback.hidden = false;
    this.message.textContent = `正在载入${city.name}…`;
    this.retry.hidden = true;

    const frame = document.createElement('iframe');
    frame.title = city.name;
    frame.tabIndex = mode === 'home' || mode === 'revive' ? -1 : 0;
    frame.src = `./experiments/${city.key}-city/index.html?exhibit=${mode}`;
    this.frame = frame;
    this.root.append(frame);
    this.timeout = window.setTimeout(() => this.failed(), 32_000);
  }

  park(city: (typeof CITIES)[1 | 2]): void {
    if (this.city !== city || !['ready', 'switching'].includes(this.root.dataset.status ?? '')) {
      this.close();
      return;
    }
    if (this.mode === 'park') return;
    window.clearTimeout(this.timeout);
    this.root.hidden = true;
    this.root.dataset.status = 'ready';
    this.mode = 'park';
    this.revival = undefined;
    this.revision += 1;
    this.sendMode();
  }

  close(): void {
    window.clearTimeout(this.timeout);
    this.frame?.remove();
    this.frame = undefined;
    this.city = undefined;
    this.revival = undefined;
    this.root.hidden = true;
    delete this.root.dataset.city;
    delete this.root.dataset.status;
  }

  private sendMode(): void {
    this.frame?.contentWindow?.postMessage({ type: 'city-frame-mode', mode: this.mode, revision: this.revision, revival: this.revival }, location.origin);
  }

  private failed(): void {
    window.clearTimeout(this.timeout);
    this.frame?.remove();
    this.frame = undefined;
    this.root.dataset.status = 'failed';
    this.message.textContent = `${this.city?.name ?? '城市'}载入失败`;
    this.feedback.hidden = false;
    this.retry.hidden = false;
  }
}
