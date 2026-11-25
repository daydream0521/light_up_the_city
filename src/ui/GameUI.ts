import { LEVELS, type LevelConfig, type PieceKind } from '../game/levels';
import type { ReflectionTrace } from '../game/reflection';
import type { LevelRating } from '../game/score';
import type { BestScore, SaveData } from '../game/storage';

export type ToolSelection = PieceKind | 'erase' | null;

interface UICallbacks {
  onStart: () => void;
  onReset: () => void;
  onToggleMute: () => void;
  onNext: () => void;
  onReplay: () => void;
  onSelectLevel: (index: number) => void;
  onSelectTool: (tool: ToolSelection) => void;
  onPanorama: () => void;
  onToggleSpin: () => boolean;
}

const icons = {
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

const TOOL_LABELS: Record<PieceKind, string> = { mirror: '镜面', splitter: '分光镜', single: '背灯镜', checkpoint: '闸门' };
const TOOL_GLYPHS: Record<PieceKind, string> = { mirror: '镜', splitter: '分', single: '灯', checkpoint: '闸' };

export class GameUI {
  private readonly shell: HTMLElement;
  private readonly sceneContainer: HTMLElement;
  private readonly intro: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly finale: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly live: HTMLElement;
  private currentLevel = 0;

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
            <button class="icon-button" data-action="brief" aria-label="本关玩法说明" title="本关玩法说明">${icons.help}<span>说明</span></button>
            <button class="icon-button" data-action="reset" aria-label="重置当前关卡" title="重置当前关卡（R）">${icons.reset}<span>重置</span></button>
            <button class="icon-button" data-action="mute" aria-label="开启声音" aria-pressed="true" title="切换声音（M）">${icons.muted}<span>声音</span></button>
          </div>
        </header>

        <section id="intro" class="intro-screen screen-layer">
          <div class="intro-copy">
            <p class="intro-overline">雨还没有停，城市仍在等待。</p>
            <h1><span>点亮</span><span>夜城</span></h1>
            <p class="intro-description">翻转屋顶的镜面，安放器件、转动光塔，<br>让光束穿过街角，抵达每一盏等待亮起的背灯。</p>
            <button class="primary-button" data-action="start"><span id="start-label">开始点亮</span>${icons.arrow}</button>
            <p id="save-note" class="save-note"></p>
          </div>
          <div class="intro-footnote"><span class="tiny-light"></span>一束光，${LEVELS.length} 段街角，一座城。</div>
        </section>

        <section id="hud" class="game-hud" hidden>
          <div class="level-copy">
            <p id="level-number" class="level-number"></p>
            <h2 id="level-name"></h2>
            <p id="level-subtitle"></p>
          </div>
          <div id="status-panel" class="status-panel" aria-label="通关条件">
            <div class="status-head">
              <span class="panel-title">通关条件</span>
              <span class="move-chip">操作 <b id="move-count">0</b></span>
            </div>
            <ul id="win-conditions" class="win-conditions"></ul>
          </div>
          <div id="play-hint" class="play-hint" hidden><span class="mouse-symbol" aria-hidden="true"></span><span id="play-hint-text"></span></div>
          <div id="tool-dock" class="mirror-dock tool-dock" aria-label="库存器件" hidden>
            <span class="dock-label">库存器件</span>
            <div id="tool-buttons" class="mirror-buttons"></div>
          </div>
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
            <p class="finale-count">${LEVELS.length} / ${LEVELS.length} 街区已点亮</p>
            <h2>这座城市，因你而亮。</h2>
            <p id="finale-stars"></p>
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

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { this.closeBrief(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
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

  showIntro(save: SaveData): void {
    this.shell.dataset.screen = 'intro';
    this.intro.hidden = false;
    this.hud.hidden = true;
    this.finale.hidden = true;
    this.toast.hidden = true;
    rootQuery('#level-brief').hidden = true;
    rootQuery<HTMLButtonElement>('[data-action="brief"]').hidden = true;
    const continuing = save.completed.length > 0 && save.completed.length < LEVELS.length;
    rootQuery('#start-label').textContent = continuing ? '继续点亮' : save.completed.length === LEVELS.length ? '俯瞰夜城' : '开始点亮';
    rootQuery('#save-note').textContent = continuing ? `已为你保留 ${save.completed.length} 段街角的灯光` : '';
    this.renderProgress(save.currentLevel, save.completed, true, save.best);
  }

  showLevel(level: LevelConfig, completed: readonly number[], best: Record<number, BestScore>, hintText: string | null): void {
    this.currentLevel = level.id;
    this.shell.dataset.screen = 'playing';
    this.intro.hidden = true;
    this.finale.hidden = true;
    this.toast.hidden = true;
    this.hud.hidden = false;
    rootQuery('#level-brief').hidden = true;
    rootQuery<HTMLButtonElement>('[data-action="brief"]').hidden = false;
    rootQuery('#level-number').textContent = `第 ${level.id + 1} 关 / 共 ${LEVELS.length} 关 · ${level.chapter}`;
    rootQuery('#level-name').textContent = level.name;
    rootQuery('#level-subtitle').textContent = level.subtitle;

    const reflection = level.reflection;
    const inventoryTotal = reflection.inventory.reduce((sum, item) => sum + item.count, 0);
    const checkpointTotal = reflection.pieces.filter((piece) => piece.kind === 'checkpoint').length
      + (reflection.inventory.find((item) => item.kind === 'checkpoint')?.count ?? 0);
    const rows: string[] = [
      this.conditionRow('lights', '背灯点亮', `0/${reflection.lightTargets}`),
    ];
    if (inventoryTotal > 0) rows.push(this.conditionRow('inv', '库存全部放上屋顶', `剩 ${inventoryTotal}`));
    rows.push(this.conditionRow('hit', '器件全部被光照到', '未照 0'));
    if (checkpointTotal > 0) rows.push(this.conditionRow('cp', '闸门恰好穿过', `0/${checkpointTotal}`));
    rootQuery('#win-conditions').innerHTML = rows.join('');

    const hint = rootQuery('#play-hint');
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
          <span class="mirror-id">${TOOL_GLYPHS[item.kind]}</span><span class="mirror-glyph">×${item.count}</span>
        </button>`).join('') + `
        <button class="mirror-button tool-button" data-tool="erase" title="取回你放置的器件" aria-label="取回你放置的器件" aria-pressed="false" disabled>
          <span class="mirror-id">取</span><span class="mirror-glyph">回</span>
        </button>`;
    }
    this.renderProgress(level.id, completed, false, best);
    this.announce(`第 ${level.id + 1} 关，${level.name}。${level.subtitle}`);
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
    rootQuery('#play-hint').hidden = true;
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
        button.disabled = left[kind] <= 0 && tool !== kind;
      }
      button.setAttribute('aria-pressed', String(tool === kind));
    });
  }

  showLevelComplete(level: LevelConfig, isFinal: boolean, rating: LevelRating, best: BestScore): void {
    this.shell.dataset.screen = 'complete';
    rootQuery('#toast-title').textContent = `${level.name}，亮了`;
    rootQuery('#toast-stars').innerHTML = [1, 2, 3].map((n) => `<span class="${n <= rating.stars ? 'star-on' : 'star-off'}">★</span>`).join('');
    rootQuery('#toast-copy').textContent = isFinal ? '最后一片夜色退去，看看这座城市吧。' : '窗灯与街灯，会记住这束光。';
    rootQuery('#toast-score').textContent = `操作 ${rating.moves} 次 · 个人最佳 ${best.moves} 次`;
    rootQuery('#next-label').textContent = isFinal ? '俯瞰全城' : '前往下一街区';
    this.toast.hidden = false;
    rootQuery<HTMLButtonElement>('[data-action="next"]').focus({ preventScroll: true });
  }

  hideLevelComplete(): void {
    this.toast.hidden = true;
  }

  showFinale(save: SaveData): void {
    this.shell.dataset.screen = 'finale';
    this.hud.hidden = true;
    this.toast.hidden = true;
    this.intro.hidden = true;
    this.finale.hidden = false;
    rootQuery('#level-brief').hidden = true;
    rootQuery<HTMLButtonElement>('[data-action="brief"]').hidden = true;
    const totalStars = Object.values(save.best).reduce((sum, score) => sum + score.stars, 0);
    rootQuery('#finale-stars').textContent = `收集 ${totalStars} / ${LEVELS.length * 3} ★ · 点击顶部街区可重玩任意关卡`;
    this.renderProgress(LEVELS.length - 1, LEVELS.map((level) => level.id), false, save.best);
    this.announce(`${LEVELS.length} 段街角全部点亮。这座城市，因你而亮。`);
  }

  setObserveHidden(hidden: boolean): void {
    this.shell.classList.toggle('observe-hidden', hidden);
    rootQuery<HTMLButtonElement>('#show-ui').hidden = !hidden;
    this.announce(hidden ? '界面已隐藏，可自由观赏城市。' : '界面已恢复。');
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
    const level = LEVELS[this.currentLevel];
    if (!level) return;
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

    rootQuery('#brief-kicker').textContent = `第 ${level.id + 1} 关 · ${level.chapter}`;
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
    rootQuery('#level-list').innerHTML = LEVELS.map((level, index) => {
      const isComplete = completed.includes(index);
      const isCurrent = index === current && !intro;
      const unlocked = index <= Math.min(completed.length, LEVELS.length - 1);
      const stars = best[index]?.stars ?? 0;
      const starText = isComplete && stars ? `，${stars} 星` : '';
      return `<li><button data-level="${index}" class="progress-step${isComplete ? ' is-complete' : ''}${isCurrent ? ' is-current' : ''}" ${unlocked ? '' : 'disabled'} aria-label="第 ${index + 1} 关 ${level.name}${isComplete ? '，已点亮' : ''}${starText}" ${isCurrent ? 'aria-current="step"' : ''}><span>${index + 1}</span><i></i></button></li>`;
    }).join('');
  }
}

function rootQuery<T extends HTMLElement = HTMLElement>(selector: string): T {
  return document.querySelector<T>(selector)!;
}
