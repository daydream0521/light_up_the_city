import { CITIES, chapterStatus, cityOf, isLevelUnlocked, type CityIndex } from '../game/journey';
import { LEVELS, type LevelConfig, type PieceKind } from '../game/levels';
import type { ReflectionTrace } from '../game/reflection';
import type { LevelRating } from '../game/score';
import type { BestScore, SaveData } from '../game/storage';

import type { ToolSelection } from '../game/reflectionPlay';

interface UICallbacks {
  onStart: () => void;
  onReset: () => void;
  onToggleMute: () => void;
  onVolume: (channel: 'music' | 'ambience' | 'effects', volume: number) => void;
  onNext: () => void;
  onReplay: () => void;
  onSelectLevel: (index: number) => void;
  onSelectTool: (tool: ToolSelection) => void;
  onPanorama: () => void;
  onToggleSpin: () => boolean;
}

const icons = {
  sliders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16M9 3v6m6 0v6m-5 0v6"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6M5.5 15a7 7 0 1 0 .5-7l-2 2"/></svg>',
  muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>',
  help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.3 2.4c-.6.3-.9.8-.9 1.5v.4"/><path d="M12 16.6h.01"/></svg>',
  panorama: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V5h3m12 0h3v3m0 8v3h-3M6 19H3v-3m2-6h4l2-2 2 4 2-2h4"/></svg>',
  spin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10 5.3A9.7 9.7 0 0 1 12 5c5 0 9 4.5 10 7-.3.8-1 1.9-2 3M6.6 6.6C4.4 8.1 2.7 10.4 2 12c1 2.5 5 7 10 7 1.5 0 2.9-.4 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
};

export const TOOL_LABELS: Record<PieceKind, string> = { mirror: '镜面', splitter: '分光镜', single: '背灯镜', checkpoint: '闸门' };
const devicePaths = {
  source: 'M6 21h12M9 21l2-11m4 11-2-11M9 7l3-4 3 4-3 4-3-4Zm8 0h4M3 7h4',
  mirror: 'M5 19 19 5m-15 6h6m4 7v-6m2-9 5 5',
  splitter: 'm12 3 8 9-8 9-8-9 8-9ZM2 12h20m-10 0V5m-3 3 3-3 3 3',
  single: 'M5 18 19 4M7 8 4 5m.5 8H1m15 7 3 3m-5-6 5-5 3 3-5 5',
  checkpoint: 'M4 20V6h16v14M8 20v-9h8v9M12 18v-4m-2 2 2-2 2 2',
  erase: 'M5 10a7 7 0 1 1 2 8m-2-8V4m0 6h6M12 9l3 3-3 3',
  select: 'M6 3v15l4-4 4 7 3-2-4-7h6L6 3Z',
};

export function deviceIcon(kind: keyof typeof devicePaths): string {
  return `<svg class="device-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${devicePaths[kind]}"/></svg>`;
}

export class GameUI {
  private readonly shell: HTMLElement;
  private readonly sceneContainer: HTMLElement;
  private readonly intro: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly finale: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly live: HTMLElement;
  private currentLevel: LevelConfig = LEVELS[0];

  constructor(root: HTMLElement, private readonly callbacks: UICallbacks) {
    root.innerHTML = `
      <main class="game-shell" data-screen="intro">
        <div id="scene-container" class="scene-container" role="img" aria-label="可交互的雨夜微缩城市。点击屋顶器件改变光路。"></div>
        <div class="scene-vignette" aria-hidden="true"></div>
        <div class="rain-glass" aria-hidden="true"></div>

        <header class="game-header">
          <div class="brand" aria-label="点亮夜城">
            <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 32h24M12 32V19h6v13m4 0V10h8v22"/><path class="brand-beam" d="m5 17 27-11"/><circle cx="33" cy="5" r="2.5"/></svg>
            <span><strong>点亮夜城</strong><small>Light Up the City</small></span>
          </div>
          <nav class="level-progress" aria-label="街区进度"><ol id="level-list"></ol></nav>
          <div class="header-actions">
            <button class="icon-button journey-home" data-journey="home" aria-label="返回首页">首页</button>
            <button class="icon-button" data-action="brief" aria-label="本关玩法说明" title="本关玩法说明">${icons.help}<span>说明</span></button>
            <button class="icon-button" data-action="reset" aria-label="重置当前关卡" title="重置当前关卡（R）">${icons.reset}<span>重置</span></button>
            <button class="icon-button" data-action="mute" aria-label="开启声音" aria-pressed="true" title="切换声音（M）">${icons.muted}<span>声音</span></button>
            <details class="sound-settings">
              <summary class="icon-button" aria-label="声音设置" title="声音设置">${icons.sliders}</summary>
              <div class="sound-panel">
                <label>音乐<input id="mix-music" data-volume="music" type="range" min="0" max="100"></label>
                <label>环境音<input id="mix-ambience" data-volume="ambience" type="range" min="0" max="100"></label>
                <label>操作音<input id="mix-effects" data-volume="effects" type="range" min="0" max="100"></label>
              </div>
            </details>
          </div>
        </header>

        <section id="intro" class="intro-screen screen-layer" data-theme="rain">
          <div class="intro-copy">
            <p class="intro-overline">Light Up the City</p>
            <h1><span>点亮</span><span>夜城</span></h1>
            <p class="intro-description">翻转屋顶的镜面，安放器件、转动光塔，<br>让光束穿过街角，抵达每一盏等待亮起的背灯。</p>
            <div class="intro-actions">
              <button class="primary-button" data-action="start"><span id="start-label">开始点亮</span>${icons.arrow}</button>
              <button class="icon-button" data-journey="collection">城市收藏</button>
              <button class="icon-button" id="open-workshop">造光工坊</button>
              <button class="icon-button" data-journey="replay-chapter" hidden>重玩章节</button>
            </div>
            <p class="city-note"><span id="save-note" class="save-note"></span><button class="home-preview" data-journey="preview" hidden>预览城市</button></p>
          </div>
          <div class="intro-cities" aria-label="城市之旅"><i class="intro-city-marker" aria-hidden="true"></i>${CITIES.map(city => `<button data-journey="theme-${city.key}" aria-pressed="${city.key === 'rain'}"><img src="./journey/${city.key}.${city.key === 'rain' ? 'png' : 'jpg'}" alt=""><span>${city.name}</span></button>`).join('')}</div>
          <a class="homepage-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" hidden>© OpenStreetMap contributors</a>
        </section>

        <section id="hud" class="game-hud" hidden>
          <div class="play-overview"><div class="level-copy">
            <p id="level-number" class="level-number"></p>
            <h2 id="level-name"></h2>
            <p id="level-subtitle"></p>
          </div>
          <div id="status-panel" class="status-panel" aria-label="通关条件">
            <div class="status-head">
              <span class="panel-title">通关条件</span>
              <div class="status-actions">
                <button id="guide-toggle" type="button" data-guide="toggle" aria-controls="guide-panel" aria-expanded="false" hidden>寻光指引</button>
                <span class="move-chip">操作 <b id="move-count">0</b></span>
              </div>
            </div>
            <ul id="win-conditions" class="win-conditions"></ul>
          </div>
          <div id="play-hint" class="play-hint" hidden><span id="play-hint-text"></span></div></div>
          <div id="tool-dock" class="mirror-dock tool-dock" aria-label="库存器件" hidden>
            <span class="dock-label">库存器件</span>
            <div id="tool-buttons" class="mirror-buttons"></div>
          </div>
          <aside id="guide-panel" class="guide-panel" aria-labelledby="guide-title" hidden>
            <div class="guide-heading"><h3 id="guide-title">寻光指引</h3><button class="icon-button" data-guide="close" aria-label="收起指引">×</button></div>
            <p id="guide-copy"></p>
            <div class="guide-actions">
              <button class="icon-button" data-guide="idea">查看思路</button>
              <button class="icon-button" data-guide="key">查看关键引导 · 最高 2 星</button>
              <button class="icon-button" data-guide="warning">完整解法</button>
              <button class="primary-button" data-guide="start">开始演示</button>
              <button class="icon-button" data-guide="play">自动播放</button>
              <button class="icon-button" data-guide="step">下一步</button>
              <button class="icon-button" data-guide="layout">查看完整布局</button>
              <button class="icon-button" data-guide="cancel">返回自己的尝试</button>
              <button class="primary-button" data-guide="finish">确认引导通关</button>
            </div>
          </aside>
          <div class="camera-hint">拖动环视 <span>·</span> 滚轮缩放</div>
        </section>

        <div id="level-toast" class="level-toast" role="status" hidden>
          <span class="success-orbit" aria-hidden="true"></span>
          <p class="toast-kicker">街区重新亮起</p>
          <h2 id="toast-title"></h2>
          <div id="toast-stars" class="toast-stars" aria-hidden="true"></div>
          <p id="toast-copy"></p>
          <p id="toast-score" class="toast-score"></p>
          <button class="primary-button" data-action="next"><span id="next-label">前往下一街区</span>${icons.arrow}</button>
        </div>

        <div id="level-brief" class="level-brief" hidden>
          <div class="brief-card" role="dialog" aria-label="本关玩法说明">
            <p class="brief-kicker" id="brief-kicker"></p>
            <h2 id="brief-title"></h2>
            <div id="brief-body" class="brief-body"></div>
            <button class="primary-button" data-action="brief-ok"><span>开始布光</span>${icons.arrow}</button>
          </div>
        </div>

        <section id="finale" class="finale-screen screen-layer" hidden>
          <div class="finale-copy">
            <p class="finale-count" id="finale-count">${LEVELS.length} / ${LEVELS.length} 关已点亮</p>
            <h2 id="finale-title">这座城市，因你而亮。</h2>
            <p id="finale-stars"></p>
            <button class="primary-button" data-journey="advance" hidden>继续旅程</button>
            <button class="icon-button" data-journey="collection">城市收藏</button>
            <button class="primary-button" data-action="replay"><span>再玩一次</span>${icons.reset}</button>
          </div>
          <div class="observe-bar" role="group" aria-label="城市观赏控制">
            <button class="icon-button" data-action="panorama" aria-label="回到全景" title="回到全景">${icons.panorama}</button>
            <button class="icon-button" data-action="spin" aria-label="自动环视" aria-pressed="false" title="自动环视">${icons.spin}</button>
            <button class="icon-button" data-action="hide-ui" aria-label="隐藏界面" title="隐藏界面">${icons.eyeOff}</button>
          </div>
        </section>
        <button id="show-ui" class="icon-button show-ui-button" data-action="show-ui" aria-label="恢复界面" title="恢复界面" hidden>${icons.eye}</button>

        <div id="loading" class="loading-screen"><span class="loading-beam"></span><p>正在唤醒夜城…</p></div>
        <div id="fatal" class="fatal-screen" hidden><h1>夜城暂时无法苏醒</h1><p id="fatal-message"></p><button class="primary-button" onclick="location.reload()">重新加载</button></div>
        <div id="live-region" class="sr-only" aria-live="polite"></div>
      </main>`;

    this.shell = root.querySelector('.game-shell')!;
    this.sceneContainer = root.querySelector('#scene-container')!;
    this.intro = root.querySelector('#intro')!;
    this.hud = root.querySelector('#hud')!;
    this.finale = root.querySelector('#finale')!;
    this.toast = root.querySelector('#level-toast')!;
    this.live = root.querySelector('#live-region')!;

    root.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action], button[data-level], button[data-tool]');
      if (!button || button.disabled) return;
      if (button.dataset.tool !== undefined) {
        this.callbacks.onSelectTool(button.dataset.tool === 'erase' ? 'erase' : button.dataset.tool as PieceKind);
        return;
      }
      if (button.dataset.level !== undefined) this.callbacks.onSelectLevel(Number(button.dataset.level));
      switch (button.dataset.action) {
        case 'start': this.callbacks.onStart(); break;
        case 'reset': this.callbacks.onReset(); break;
        case 'mute': this.callbacks.onToggleMute(); break;
        case 'next': this.callbacks.onNext(); break;
        case 'replay': this.callbacks.onReplay(); break;
        case 'brief': this.openBrief(); break;
        case 'brief-ok': this.closeBrief(); break;
        case 'panorama': this.callbacks.onPanorama(); break;
        case 'spin': button.setAttribute('aria-pressed', String(this.callbacks.onToggleSpin())); break;
        case 'hide-ui': this.setObserveHidden(true); break;
        case 'show-ui': this.setObserveHidden(false); break;
      }
    });

    const sound = this.shell.querySelector<HTMLDetailsElement>('.sound-settings')!;
    sound.addEventListener('input', (event) => {
      const slider = event.target as HTMLInputElement;
      const channel = slider.dataset.volume as 'music' | 'ambience' | 'effects';
      this.callbacks.onVolume(channel, slider.valueAsNumber / 100);
    });
    document.addEventListener('pointerdown', (event) => {
      if (sound.open && !sound.contains(event.target as Node)) sound.open = false;
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { this.closeBrief(); sound.open = false; return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.matches('input, select, textarea')) return;
      if (event.key.toLowerCase() === 'r') this.callbacks.onReset();
      if (event.key.toLowerCase() === 'm') this.callbacks.onToggleMute();
    });
  }

  get container(): HTMLElement {
    return this.sceneContainer;
  }

  ready(): void {
    rootQuery('#loading').hidden = true;
  }

  showIntro(save: SaveData, index = 0, direction = 0): void {
    const city = CITIES[index];
    this.intro.querySelector('.intro-copy-out')?.remove();
    const copy = this.intro.querySelector<HTMLElement>('.intro-copy')!;
    copy.getAnimations().forEach(animation => animation.cancel());
    if (direction && !this.intro.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const outgoing = copy.cloneNode(true) as HTMLElement;
      outgoing.querySelectorAll('[id], [data-action], [data-journey]').forEach(element => {
        element.removeAttribute('id');
        element.removeAttribute('data-action');
        element.removeAttribute('data-journey');
      });
      outgoing.classList.add('intro-copy-out');
      outgoing.setAttribute('aria-hidden', 'true');
      outgoing.inert = true;
      outgoing.style.left = `${copy.offsetLeft}px`;
      outgoing.style.top = `${copy.offsetTop}px`;
      outgoing.style.width = `${copy.offsetWidth}px`;
      this.intro.prepend(outgoing);
      const exit = outgoing.animate([{ opacity: 1 }, { opacity: 0, transform: `translateX(${-direction * 26}px)` }],
        { duration: 240, easing: 'ease-in', fill: 'forwards' });
      exit.onfinish = () => outgoing.remove();
      copy.animate([{ opacity: 0, transform: `translateX(${direction * 30}px)` }, { opacity: 1 }],
        { delay: 130, duration: 420, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'backwards' });
    }
    this.shell.dataset.screen = 'intro';
    this.shell.dataset.city = city.key;
    this.intro.hidden = false;
    this.hud.hidden = true;
    this.finale.hidden = true;
    this.toast.hidden = true;
    rootQuery('#level-brief').hidden = true;
    rootQuery<HTMLButtonElement>('[data-action="brief"]').hidden = true;
    this.intro.dataset.theme = city.key;
    rootQuery('.intro-cities').style.setProperty('--active-city', String(index));
    const [leading, trailing] = copy.querySelectorAll('h1 span');
    leading.textContent = city.title[0];
    trailing.textContent = city.title[1];
    copy.querySelector('.intro-overline')!.textContent = city.english;
    copy.querySelector('.intro-description')!.textContent = city.description;
    const { complete, done, next } = chapterStatus(index, save.completed);
    rootQuery('#start-label').textContent = complete ? '自由观赏' : done > 0 ? '继续点亮' : '开始点亮';
    rootQuery('[data-journey="replay-chapter"]').hidden = !complete;
    rootQuery('#save-note').textContent = done ? `已点亮 ${done} / ${city.end - city.first} 关` : '';
    rootQuery('[data-journey="preview"]').hidden = complete;
    this.intro.querySelectorAll<HTMLButtonElement>('[data-journey^="theme-"]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.journey === `theme-${city.key}`));
    });
    rootQuery('.homepage-attribution').hidden = city.key !== 'shanghai';
    this.renderProgress(next, save.completed, true, save.best);
  }

  showWorkshop(editing: boolean, city: CityIndex = 0): void {
    this.shell.dataset.screen = editing ? 'editor' : 'workshop';
    this.shell.dataset.city = CITIES[city].key;
    this.intro.hidden = true;
    this.hud.hidden = true;
    this.finale.hidden = true;
    this.toast.hidden = true;
    this.closeBrief();
    rootQuery<HTMLButtonElement>('[data-action="brief"]').hidden = true;
  }

  showLevel(level: LevelConfig, completed: readonly number[], best: Record<number, BestScore>, hintText: string | null, mode?: 'trial' | 'challenge'): void {
    this.currentLevel = level;
    rootQuery('#guide-toggle').hidden = !!mode;
    this.shell.dataset.screen = mode ?? 'playing';
    this.shell.dataset.city = CITIES[level.city ?? 0].key;
    this.intro.hidden = true;
    this.finale.hidden = true;
    this.toast.hidden = true;
    this.hud.hidden = false;
    rootQuery('#level-brief').hidden = true;
    rootQuery<HTMLButtonElement>('[data-action="brief"]').hidden = false;
    rootQuery('#level-number').textContent = mode === 'trial' ? `编辑器试玩 · ${CITIES[level.city ?? 0].name}` : mode === 'challenge' ? `玩家关卡挑战 · ${CITIES[level.city ?? 0].name}` : `${CITIES[cityOf(level.id)].name} · 第 ${level.id + 1} 关 · ${level.chapter}`;
    rootQuery('#level-name').textContent = level.name;
    rootQuery('#level-subtitle').textContent = level.subtitle;

    const reflection = level.reflection;
    const inventoryTotal = reflection.inventory.reduce((sum, item) => sum + item.count, 0);
    const checkpointTotal = reflection.pieces.filter((piece) => piece.kind === 'checkpoint').length
      + (reflection.inventory.find((item) => item.kind === 'checkpoint')?.count ?? 0);
    const rows: string[] = [
      this.conditionRow('lights', '背灯点亮', `0/${reflection.lightTargets}`),
    ];
    if (inventoryTotal > 0) rows.push(this.conditionRow('inv', '用尽库存', `剩 ${inventoryTotal}`));
    rows.push(this.conditionRow('hit', '光照全部器件', '未照 0'));
    if (checkpointTotal > 0) rows.push(this.conditionRow('cp', '闸门恰好通过', `0/${checkpointTotal}`));
    rootQuery('#win-conditions').innerHTML = rows.join('');

    const hint = rootQuery('#play-hint');
    hint.classList.remove('dismissed');
    if (hintText) {
      rootQuery('#play-hint-text').textContent = hintText;
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }

    const dock = rootQuery('#tool-dock');
    dock.hidden = inventoryTotal === 0;
    if (inventoryTotal > 0) {
      rootQuery('#tool-buttons').innerHTML = reflection.inventory.map((item) => `
        <button class="mirror-button tool-button" data-tool="${item.kind}" title="${TOOL_LABELS[item.kind]}" aria-label="${TOOL_LABELS[item.kind]}，剩余 ${item.count}" aria-pressed="false">
          ${deviceIcon(item.kind)}<span class="tool-name">${TOOL_LABELS[item.kind]}</span><span class="mirror-glyph">×${item.count}</span>
        </button>`).join('') + `
        <button class="mirror-button tool-button" data-tool="erase" title="取回你放置的器件" aria-label="取回你放置的器件" aria-pressed="false" disabled>
          ${deviceIcon('erase')}<span class="tool-name">取回</span>
        </button>`;
    }
    if (!mode) this.renderProgress(level.id, completed, false, best);
    this.announce(`${level.name}。${level.subtitle}`);
  }

  private conditionRow(id: string, label: string, value: string): string {
    return `<li class="cond" id="cond-${id}-row" data-cond="${id}"><i class="cond-dot" aria-hidden="true"></i><span class="cond-label">${label}</span><b id="cond-${id}">${value}</b></li>`;
  }

  private setCondition(id: string, value: string, ok: boolean, aria: string): void {
    const row = rootQuery(`#cond-${id}-row`);
    rootQuery(`#cond-${id}`).textContent = value;
    row.classList.toggle('is-ok', ok);
    row.classList.toggle('is-bad', !ok);
    row.setAttribute('aria-label', aria);
  }

  clearHint(): void {
    rootQuery('#play-hint').classList.add('dismissed');
  }

  updateReflection(trace: ReflectionTrace, left: Record<PieceKind, number>, placements: number, tool: ToolSelection, moves: number): void {
    rootQuery('#move-count').textContent = String(moves);
    const lightsOk = trace.litLights >= trace.lightTargets;
    this.setCondition('lights', `${trace.litLights}/${trace.lightTargets}`, lightsOk,
      `背灯点亮 ${trace.litLights} / ${trace.lightTargets}，${lightsOk ? '已达标' : '未达标'}`);
    const invRow = this.shell.querySelector('#cond-inv-row');
    if (invRow) {
      const invOk = trace.inventoryLeft === 0;
      this.setCondition('inv', invOk ? '已用尽' : `剩 ${trace.inventoryLeft}`, invOk,
        `库存${invOk ? '已全部放上屋顶' : `还剩 ${trace.inventoryLeft} 件`}`);
    }
    const hitOk = trace.unhitPieces.length === 0;
    this.setCondition('hit', hitOk ? '全部照到' : `未照 ${trace.unhitPieces.length}`, hitOk,
      hitOk ? '场上器件全部被光照到' : `还有 ${trace.unhitPieces.length} 件器件未被光照到`);
    const cpRow = this.shell.querySelector('#cond-cp-row');
    if (cpRow) {
      const over = trace.checkpointsPassed > trace.checkpointsTotal;
      const cpOk = trace.checkpointsPassed === trace.checkpointsTotal;
      cpRow.classList.toggle('is-over', over);
      this.setCondition('cp', over ? `${trace.checkpointsPassed}/${trace.checkpointsTotal} · 超额` : `${trace.checkpointsPassed}/${trace.checkpointsTotal}`, cpOk,
        over ? `闸门穿过 ${trace.checkpointsPassed} 次，超过目标 ${trace.checkpointsTotal} 次，未满足` :
          cpOk ? `闸门恰好穿过 ${trace.checkpointsTotal} 次，已满足` : `闸门穿过 ${trace.checkpointsPassed} / ${trace.checkpointsTotal} 次`);
    }
    this.shell.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
      const kind = button.dataset.tool as PieceKind | 'erase';
      if (kind === 'erase') {
        button.disabled = placements === 0;
      } else {
        button.querySelector('.mirror-glyph')!.textContent = `×${left[kind]}`;
        button.setAttribute('aria-label', `${TOOL_LABELS[kind]}，剩余 ${left[kind]}`);
        button.disabled = left[kind] <= 0 && tool !== kind;
      }
      button.setAttribute('aria-pressed', String(tool === kind));
    });
  }

  showLevelComplete(level: LevelConfig, isFinal: boolean, rating: LevelRating, best: BestScore | undefined, revival = false, guided = false): void {
    this.shell.dataset.screen = 'complete';
    rootQuery('#toast-title').textContent = `${level.name}，亮了`;
    rootQuery('#toast-stars').innerHTML = guided ? '' : [1, 2, 3].map((n) => `<span class="${n <= rating.stars ? 'star-on' : 'star-off'}">★</span>`).join('');
    rootQuery('#toast-copy').textContent = revival ? '这束光将点亮城市的一角。' : isFinal ? '最后一片夜色退去，看看这座城市吧。' : '窗灯与街灯，会记住这束光。';
    rootQuery('#toast-score').textContent = guided ? '引导完成 · 本次不计星级'
      : `操作 ${rating.moves} 次 · 个人最佳 ${best!.moves} 次`;
    rootQuery('#next-label').textContent = revival ? '查看复苏' : isFinal ? '俯瞰全城' : '前往下一街区';
    this.toast.hidden = false;
    rootQuery<HTMLButtonElement>('[data-action="next"]').focus({ preventScroll: true });
  }

  hideLevelComplete(): void {
    this.toast.hidden = true;
  }

  showFinale(save: SaveData, preview = false, journeyComplete = false, fullPreview = false): void {
    this.shell.dataset.screen = 'finale';
    this.shell.dataset.city = 'rain';
    this.hud.hidden = true;
    this.toast.hidden = true;
    this.intro.hidden = true;
    this.finale.hidden = false;
    this.finale.dataset.view = fullPreview ? 'preview' : 'progress';
    rootQuery('#level-brief').hidden = true;
    rootQuery<HTMLButtonElement>('[data-action="brief"]').hidden = true;
    const rain = CITIES[0];
    const completed = save.completed.filter(id => id < rain.end);
    const totalStars = completed.reduce((sum, id) => sum + (save.best[id]?.stars ?? 0), 0);
    rootQuery('#finale-count').textContent = fullPreview ? '城市预览 · 全城亮灯' : `${completed.length} / ${rain.end} 关已点亮`;
    rootQuery('#finale-title').textContent = preview ? rain.name : journeyComplete ? '三座城市，灯火相连' : '这座城市，因你而亮。';
    rootQuery('#finale-stars').hidden = fullPreview;
    rootQuery('#finale-stars').textContent = `收集 ${totalStars} / ${rain.end * 3} ★`;
    rootQuery('[data-action="replay"]').hidden = preview || !journeyComplete;
    rootQuery('[data-journey="advance"]').hidden = preview || journeyComplete;
    this.renderProgress(rain.end - 1, save.completed, false, save.best);
    this.announce(preview ? rain.name : '雨夜之城完成复苏。');
  }

  setObserveHidden(hidden: boolean): void {
    this.shell.classList.toggle('observe-hidden', hidden);
    rootQuery<HTMLButtonElement>('#show-ui').hidden = !hidden;
    this.announce(hidden ? '界面已隐藏，可自由观赏城市。' : '界面已恢复。');
  }

  setMix(mix: Record<'music' | 'ambience' | 'effects', number>): void {
    for (const [channel, value] of Object.entries(mix)) {
      rootQuery<HTMLInputElement>(`#mix-${channel}`).value = String(Math.round(value * 100));
    }
  }

  setMuted(muted: boolean): void {
    const button = rootQuery<HTMLButtonElement>('[data-action="mute"]');
    button.innerHTML = `${muted ? icons.muted : icons.sound}<span>${muted ? '声音' : '有声'}</span>`;
    button.setAttribute('aria-label', muted ? '开启声音' : '关闭声音');
    button.setAttribute('aria-pressed', String(muted));
  }

  announce(message: string): void {
    this.live.textContent = message;
  }

  private static readonly DEVICE_TEXT: Record<PieceKind, string> = {
    single: '<b>背灯镜</b>：单面镜。光击中金色背灯一面会被吸收并<b>点亮</b>；从镜面两侧入射会被反射；从剩下一个方向入射被吸收但不点亮。点击可四向旋转。',
    splitter: '<b>分光镜</b>：一束变两束——既像镜面一样把光反射 90°，又让原方向的光直行穿过。点击翻转朝向。',
    mirror: '<b>镜面</b>：把光整体折转 90°，点击在 “/” 与 “\\” 两个朝向间翻转。',
    checkpoint: '<b>闸门</b>：不挡光，但光只有沿它的朝向穿过才计一次；整张光网的穿过总次数必须<b>恰好</b>等于目标次数——多穿一次同样失败。',
  };

  private openBrief(): void {
    const level = this.currentLevel;
    const reflection = level.reflection;
    const inventory = new Map(reflection.inventory.map((item) => [item.kind, item.count]));
    const inventoryTotal = reflection.inventory.reduce((sum, item) => sum + item.count, 0);
    const singleTotal = reflection.pieces.filter((piece) => piece.kind === 'single').length + (inventory.get('single') ?? 0);
    const deviceTotal = reflection.pieces.length + inventoryTotal;
    const checkpoints = reflection.pieces.filter((piece) => piece.kind === 'checkpoint');
    const checkpointTotal = checkpoints.length + (inventory.get('checkpoint') ?? 0);
    const axisName = (state: number): string => (state === 0 ? '南北' : '东西');

    const conditions: string[] = [];
    if (inventoryTotal > 0) conditions.push(`把库存里的 <b>${inventoryTotal}</b> 件器件全部放上屋顶，一件不剩；`);
    conditions.push(`场上 <b>${deviceTotal}</b> 件器件（含你放置的）全部被光经过——任务面板「器件全部被光照到」必须达成；`);
    conditions.push(`<b>${singleTotal}</b> 盏背灯中至少点亮 <b>${reflection.lightTargets}</b> 盏；`);
    if (checkpointTotal > 0) {
      const locked = checkpoints.filter((piece) => piece.locked);
      const free = checkpoints.filter((piece) => !piece.locked);
      const parts: string[] = [];
      if (locked.length) parts.push(locked.map((piece) => `已锁定为${axisName(piece.state)}向`).join('、'));
      if (free.length) parts.push('可点击切换南北/东西向');
      if (inventory.get('checkpoint')) parts.push('库存中的闸门也必须放上并被穿过');
      conditions.push(`闸门被光<b>恰好穿过 ${checkpointTotal} 次</b>（${parts.join('；')}）。`);
    }
    if (reflection.sourceRotatable) conditions.push('光塔可以点击转向，别忘记它的四个朝向。');

    const kinds: PieceKind[] = (['single', 'splitter', 'mirror', 'checkpoint'] as PieceKind[])
      .filter((kind) => reflection.pieces.some((piece) => piece.kind === kind) || (inventory.get(kind) ?? 0) > 0);

    rootQuery('#brief-kicker').textContent = level.id < 0 ? level.chapter : `第 ${level.id + 1} 关 · ${level.chapter}`;
    rootQuery('#brief-title').textContent = `${level.name}：怎样才算通关`;
    rootQuery('#brief-body').innerHTML = `
      <ul class="brief-list">${conditions.map((condition) => `<li>${condition}</li>`).join('')}</ul>
      <div class="brief-devices">${kinds.map((kind) => `<p>${GameUI.DEVICE_TEXT[kind]}</p>`).join('')}</div>
      <p class="brief-controls">操作：点击底部「库存器件」选中一种 → 点击发亮的屋顶放下；点击已放置或预置的器件 = 旋转/翻转（带灰色锁环的器件不可调整）；点「取回」再点你放置的器件可收回库存。</p>`;
    rootQuery('#level-brief').hidden = false;
    rootQuery<HTMLButtonElement>('[data-action="brief-ok"]').focus({ preventScroll: true });
  }

  private closeBrief(): void {
    rootQuery('#level-brief').hidden = true;
  }

  fatal(message: string): void {
    rootQuery('#loading').hidden = true;
    rootQuery('#fatal').hidden = false;
    rootQuery('#fatal-message').textContent = message;
  }

  private renderProgress(current: number, completed: readonly number[], intro: boolean, best: Record<number, BestScore>): void {
    rootQuery('#level-list').innerHTML = LEVELS.filter(level => cityOf(level.id) === cityOf(current)).map((level) => {
      const index = level.id;
      const isComplete = completed.includes(index);
      const isCurrent = index === current && !intro;
      const unlocked = isLevelUnlocked(index, completed);
      const stars = best[index]?.stars ?? 0;
      const starText = isComplete && stars ? `，${stars} 星` : '';
      return `<li><button data-level="${index}" class="progress-step${isComplete ? ' is-complete' : ''}${isCurrent ? ' is-current' : ''}" ${unlocked ? '' : 'disabled'} aria-label="第 ${index + 1} 关 ${level.name}${isComplete ? '，已点亮' : ''}${starText}" ${isCurrent ? 'aria-current="step"' : ''}><span>${index + 1}</span><i></i></button></li>`;
    }).join('');
  }
}

function rootQuery<T extends HTMLElement = HTMLElement>(selector: string): T {
  return document.querySelector<T>(selector)!;
}
