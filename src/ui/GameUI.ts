import { LEVELS, type LevelConfig, type MirrorOrientation, type PieceKind } from '../game/levels';
import type { TraceResult } from '../game/optics';
import type { ReflectionTrace } from '../game/reflection';
import type { LevelRating } from '../game/score';
import type { BestScore, SaveData } from '../game/storage';

export type ToolSelection = PieceKind | 'erase' | null;

interface UICallbacks {
  onStart: () => void;
  onMirror: (index: number) => void;
  onReset: () => void;
  onToggleMute: () => void;
  onNext: () => void;
  onReplay: () => void;
  onSelectLevel: (index: number) => void;
  onSelectTool: (tool: ToolSelection) => void;
}

const icons = {
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6M5.5 15a7 7 0 1 0 .5-7l-2 2"/></svg>',
  muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>',
  help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.3 2.4c-.6.3-.9.8-.9 1.5v.4"/><path d="M12 16.6h.01"/></svg>',
};

const RULES_HINT = '反射 −1 能量 · 分光器平分能量 · 达到所需能量即点亮';
const REFLECTION_HINT = '库存全部放上屋顶 · 每件器件都被光碰到 · 背灯亮够数 · 闸门恰好穿过一次';
const TOOL_LABELS: Record<PieceKind, string> = { mirror: '镜面', splitter: '分光镜', single: '背灯镜', checkpoint: '闸门' };
const TOOL_GLYPHS: Record<PieceKind, string> = { mirror: '镜', splitter: '分', single: '灯', checkpoint: '闸' };

export class GameUI {
  private readonly shell: HTMLElement;
  private readonly sceneContainer: HTMLElement;
  private readonly intro: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly finale: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly mirrorButtons: HTMLElement;
  private readonly live: HTMLElement;
  private currentLevel = 0;

  constructor(root: HTMLElement, private readonly callbacks: UICallbacks) {
    root.innerHTML = `
      <main class="game-shell" data-screen="intro">
        <div id="scene-container" class="scene-container" role="img" aria-label="可交互的雨夜微缩城市。点击屋顶镜面改变光路。"></div>
        <div class="scene-vignette" aria-hidden="true"></div>
        <div class="rain-glass" aria-hidden="true"></div>

        <header class="game-header">
          <div class="brand" aria-label="点亮夜城">
            <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 32h24M12 32V19h6v13m4 0V10h8v22"/><path class="brand-beam" d="m5 17 27-11"/><circle cx="33" cy="5" r="2.5"/></svg>
            <span><strong>点亮夜城</strong><small>Light Up the City</small></span>
          </div>
          <nav class="level-progress" aria-label="街区进度"><ol id="level-list"></ol></nav>
          <div class="header-actions">
            <button class="icon-button" data-action="brief" aria-label="本关玩法说明" title="本关玩法说明" hidden>${icons.help}<span>说明</span></button>
            <button class="icon-button" data-action="reset" aria-label="重置当前关卡" title="重置当前关卡（R）">${icons.reset}<span>重置</span></button>
            <button class="icon-button" data-action="mute" aria-label="开启声音" aria-pressed="true" title="切换声音（M）">${icons.muted}<span>声音</span></button>
          </div>
        </header>

        <section id="intro" class="intro-screen screen-layer">
          <div class="intro-copy">
            <p class="intro-overline">雨还没有停，城市仍在等待。</p>
            <h1><span>点亮</span><span>夜城</span></h1>
            <p class="intro-description">旋转屋顶的镜面，引导有限的光，<br>穿过分光器，抵达每一扇等待亮起的窗。</p>
            <button class="primary-button" data-action="start"><span id="start-label">开始点亮</span>${icons.arrow}</button>
            <p id="save-note" class="save-note"></p>
          </div>
          <div class="intro-footnote"><span class="tiny-light"></span>一束光，八段街角，一座城。</div>
        </section>

        <section id="hud" class="game-hud" hidden>
          <div class="level-copy">
            <p id="level-number" class="level-number"></p>
            <h2 id="level-name"></h2>
            <p id="level-subtitle"></p>
          </div>
          <div id="status-panel" class="status-panel" aria-label="能量与目标状态">
            <div class="status-head">
              <span class="energy-chip" id="energy-chip">${icons.bolt}<span>光塔能量 <b id="source-energy">0</b></span></span>
              <span class="energy-chip" id="light-chip" hidden>✦<span>背灯 <b id="light-count">0/0</b></span></span>
              <span class="energy-chip" id="cp-chip" hidden>▤<span>闸门 <b id="cp-count">0/0</b></span></span>
              <span class="energy-chip" id="unhit-chip" hidden>◈<span>未照到 <b id="unhit-count">0</b></span></span>
              <span class="move-chip">操作 <b id="move-count">0</b></span>
            </div>
            <div id="target-chips" class="target-chips"></div>
            <p class="rules-hint">${RULES_HINT}</p>
          </div>
          <div id="play-hint" class="play-hint"><span class="mouse-symbol" aria-hidden="true"></span><span id="play-hint-text">点击镜面，让光转弯</span></div>
          <div id="mirror-dock" class="mirror-dock" aria-label="镜面控制">
            <span class="dock-label">屋顶镜面</span>
            <div id="mirror-buttons" class="mirror-buttons"></div>
          </div>
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
        </section>

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
    this.mirrorButtons = root.querySelector('#mirror-buttons')!;
    this.live = root.querySelector('#live-region')!;

    root.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action], button[data-mirror], button[data-level], button[data-tool]');
      if (!button || button.disabled) return;
      if (button.dataset.tool !== undefined) {
        this.callbacks.onSelectTool(button.dataset.tool === 'erase' ? 'erase' : button.dataset.tool as PieceKind);
        return;
      }
      if (button.dataset.mirror !== undefined) this.callbacks.onMirror(Number(button.dataset.mirror));
      if (button.dataset.level !== undefined) this.callbacks.onSelectLevel(Number(button.dataset.level));
      switch (button.dataset.action) {
        case 'start': this.callbacks.onStart(); break;
        case 'reset': this.callbacks.onReset(); break;
        case 'mute': this.callbacks.onToggleMute(); break;
        case 'next': this.callbacks.onNext(); break;
        case 'replay': this.callbacks.onReplay(); break;
        case 'brief': this.openBrief(); break;
        case 'brief-ok': this.closeBrief(); break;
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

  showLevel(level: LevelConfig, orientations: readonly MirrorOrientation[], completed: readonly number[], best: Record<number, BestScore>): void {
    this.currentLevel = level.id;
    this.shell.dataset.screen = 'playing';
    this.intro.hidden = true;
    this.finale.hidden = true;
    this.toast.hidden = true;
    this.hud.hidden = false;
    rootQuery('#level-number').textContent = `第 ${level.id + 1} 关 / 共 ${LEVELS.length} 关 · ${level.chapter}`;
    rootQuery('#level-name').textContent = level.name;
    rootQuery('#level-subtitle').textContent = level.subtitle;
    rootQuery('#source-energy').textContent = String(level.sourceEnergy);
    rootQuery('#target-chips').innerHTML = level.targets.map((target) => `
      <span class="target-chip" data-target="${target.id}">
        <i class="target-dot"></i><b>${target.id}</b><span class="target-need">需 ${target.required}</span><span class="target-received">0</span>
      </span>`).join('');
    const isReflection = !!level.reflection;
    rootQuery('#energy-chip').hidden = isReflection;
    rootQuery('#light-chip').hidden = !isReflection;
    rootQuery('#unhit-chip').hidden = !isReflection;
    rootQuery('#cp-chip').hidden = true;
    rootQuery('#target-chips').hidden = isReflection;
    rootQuery('.rules-hint').textContent = isReflection ? REFLECTION_HINT : RULES_HINT;
    rootQuery('#mirror-dock').hidden = isReflection;
    rootQuery('#tool-dock').hidden = !isReflection;
    const hint = rootQuery('#play-hint');
    const hintText = rootQuery('#play-hint-text');
    if (level.id === 0) { hint.hidden = false; hintText.textContent = '点击镜面，让光转弯'; }
    else if (level.id === 2) { hint.hidden = false; hintText.textContent = '先在下方选中器件，再点击屋顶放置；点击已放置的器件可以旋转'; }
    else if (level.id === 3) { hint.hidden = false; hintText.textContent = '分光镜既反射也放行；闸门只认一个方向，且只能恰好穿过一次'; }
    else if (level.id === 4) { hint.hidden = false; hintText.textContent = '点亮背灯还不够：每件器件都要被光碰到，库存必须全部用完'; }
    else if (level.id === 5) { hint.hidden = false; hintText.textContent = '先在心里铺完整张光网，再落下第一件器件'; }
    else hint.hidden = true;
    if (isReflection) {
      rootQuery('#tool-buttons').innerHTML = level.reflection!.inventory.map((item) => `
        <button class="mirror-button tool-button" data-tool="${item.kind}" title="${TOOL_LABELS[item.kind]}" aria-label="${TOOL_LABELS[item.kind]}，剩余 ${item.count}" aria-pressed="false">
          <span class="mirror-id">${TOOL_GLYPHS[item.kind]}</span><span class="mirror-glyph">×${item.count}</span>
        </button>`).join('') + `
        <button class="mirror-button tool-button" data-tool="erase" title="取回你放置的器件" aria-label="取回你放置的器件" aria-pressed="false" disabled>
          <span class="mirror-id">取</span><span class="mirror-glyph">回</span>
        </button>`;
    } else {
      this.mirrorButtons.innerHTML = level.mirrors.map((mirror, index) => `
        <button class="mirror-button" data-mirror="${index}" aria-label="镜面 ${mirror.id}，当前方向 ${orientations[index]}，点击切换" aria-pressed="${orientations[index] === '/'}">
          <span class="mirror-id">${mirror.id}</span><span class="mirror-glyph" aria-hidden="true">${orientations[index]}</span>
        </button>`).join('');
    }
    this.renderProgress(level.id, completed, false, best);
    this.announce(`第 ${level.id + 1} 关，${level.name}。${level.subtitle}`);
    rootQuery<HTMLButtonElement>('[data-action="brief"]').hidden = !isReflection;
    if (isReflection) this.openBrief(); else rootQuery('#level-brief').hidden = true;
  }

  updateMirrors(orientations: readonly MirrorOrientation[]): void {
    rootQuery('#play-hint').hidden = true;
    const level = LEVELS[this.currentLevel];
    this.mirrorButtons.querySelectorAll<HTMLButtonElement>('[data-mirror]').forEach((button, index) => {
      const orientation = orientations[index];
      button.setAttribute('aria-label', `镜面 ${level.mirrors[index].id}，当前方向 ${orientation}，点击切换`);
      button.setAttribute('aria-pressed', String(orientation === '/'));
      button.querySelector('.mirror-glyph')!.textContent = orientation;
      button.classList.remove('just-turned');
      requestAnimationFrame(() => button.classList.add('just-turned'));
    });
  }

  updateStatus(trace: TraceResult, moves: number): void {
    rootQuery('#move-count').textContent = String(moves);
    for (const target of trace.targets) {
      const chip = this.shell.querySelector<HTMLElement>(`[data-target="${target.id}"]`);
      if (!chip) continue;
      chip.classList.toggle('is-powered', target.powered);
      chip.querySelector('.target-received')!.textContent = String(target.received);
      chip.setAttribute('aria-label', `目标 ${target.id}，需要 ${target.required} 能量，当前 ${target.received}，${target.powered ? '已点亮' : '未点亮'}`);
    }
  }

  updateReflection(trace: ReflectionTrace, left: Record<PieceKind, number>, placements: number, tool: ToolSelection, moves: number): void {
    rootQuery('#move-count').textContent = String(moves);
    rootQuery('#light-count').textContent = `${trace.litLights}/${trace.lightTargets}`;
    rootQuery('#cp-chip').hidden = trace.checkpointsTotal === 0;
    rootQuery('#cp-count').textContent = `${trace.checkpointsPassed}/${trace.checkpointsTotal}`;
    rootQuery('#unhit-count').textContent = String(trace.unhitPieces.length);
    // 教学关（第 3–4 关）保留操作提示，挑战关首次操作后收起。
    if (this.currentLevel >= 4) rootQuery('#play-hint').hidden = true;
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
    const efficiency = rating.showEfficiency ? ` · 能量利用 ${Math.round(rating.efficiency * 100)}%` : '';
    rootQuery('#toast-score').textContent = `操作 ${rating.moves} 次${efficiency} · 个人最佳 ${best.moves} 次`;
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
    this.announce('八个街区全部点亮。这座城市，因你而亮。');
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
    if (!level?.reflection) return;
    const reflection = level.reflection;
    const inventory = new Map(reflection.inventory.map((item) => [item.kind, item.count]));
    const inventoryTotal = reflection.inventory.reduce((sum, item) => sum + item.count, 0);
    const singleTotal = reflection.pieces.filter((piece) => piece.kind === 'single').length + (inventory.get('single') ?? 0);
    const deviceTotal = reflection.pieces.length + inventoryTotal;
    const checkpoints = reflection.pieces.filter((piece) => piece.kind === 'checkpoint');
    const checkpointTotal = checkpoints.length + (inventory.get('checkpoint') ?? 0);
    const axisName = (state: number): string => (state === 0 ? '南北' : '东西');

    const conditions: string[] = [
      `把库存里的 <b>${inventoryTotal}</b> 件器件全部放上屋顶，一件不剩；`,
      `场上 <b>${deviceTotal}</b> 件器件（含你放置的）全部被光经过——右上角「未照到」必须为 <b>0</b>；`,
      `<b>${singleTotal}</b> 盏背灯中至少点亮 <b>${reflection.lightTargets}</b> 盏；`,
    ];
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