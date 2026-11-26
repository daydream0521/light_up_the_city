import { CITIES } from '../game/journey';
import type { CityMode } from '../experiments/presentation';

export class CitySurface {
  private readonly root = document.createElement('div');
  private readonly feedback: HTMLElement;
  private readonly message: HTMLElement;
  private readonly retry: HTMLButtonElement;
  private frame?: HTMLIFrameElement;
  private city?: (typeof CITIES)[1 | 2];
  private mode: CityMode = 'home';
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
      if (this.city) this.show(this.city, this.mode);
    });

    window.addEventListener('message', ({ origin, source, data }) => {
      if (origin !== location.origin || !this.frame || source !== this.frame.contentWindow) return;
      if (data?.type === 'city-frame-failed') {
        this.failed();
        if (this.mode !== 'home') onShow(false);
      }
      if (this.mode !== 'home' && data?.type === 'city-frame-show' && typeof data.playing === 'boolean') onShow(data.playing);
      if (this.mode !== 'home' && data?.type === 'city-frame-controls' && typeof data.hidden === 'boolean') {
        shell.classList.toggle('exhibit-controls-hidden', data.hidden);
      }
      if (data?.type !== 'city-frame-ready') return;
      if (data.mode !== this.mode) { this.sendMode(); return; }
      window.clearTimeout(this.timeout);
      this.root.dataset.status = 'ready';
      this.feedback.hidden = true;
      this.sendMode();
    });
  }

  show(city: (typeof CITIES)[1 | 2], mode: CityMode): void {
    const previousMode = this.mode;
    this.mode = mode;
    this.root.dataset.mode = mode;
    this.root.hidden = false;
    if (this.city === city && this.frame) {
      this.frame.tabIndex = mode === 'home' ? -1 : 0;
      if (previousMode === mode || this.root.dataset.status === 'loading') return;
      if (mode === 'home') {
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
    frame.tabIndex = mode === 'home' ? -1 : 0;
    frame.src = `./experiments/${city.key}-city/index.html?exhibit=${mode}`;
    this.frame = frame;
    this.root.append(frame);
    this.timeout = window.setTimeout(() => this.failed(), 32_000);
  }

  close(): void {
    window.clearTimeout(this.timeout);
    this.frame?.remove();
    this.frame = undefined;
    this.city = undefined;
    this.root.hidden = true;
    delete this.root.dataset.city;
    delete this.root.dataset.status;
  }

  private sendMode(): void {
    this.frame?.contentWindow?.postMessage({ type: 'city-frame-mode', mode: this.mode }, location.origin);
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
