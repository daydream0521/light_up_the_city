import './styles.css';
import './workshop.css';
import './journey.css';
import { CITIES, cityOf, phaseProgress } from './game/journey';
import { CityAudio } from './game/audio';
import { LEVELS, type GridPoint, type LevelConfig } from './game/levels';
import {
  initialReflectionState, inventoryLeft, placementZones, traceReflection,
  type ReflectionGameState,
} from './game/reflection';
import { puzzleLevel, readSharedPuzzle, type Puzzle } from './game/workshop';
import { Workshop } from './ui/Workshop';
import { rateLevel } from './game/score';
import { clearProgress, loadSave, writeSave, type SaveData } from './game/storage';
import { CityScene, districtProgress } from './scene/CityScene';
import { GameUI } from './ui/GameUI';
import { playCell, type CellMove, type ToolSelection } from './game/reflectionPlay';

type GameState = 'intro' | 'workshop' | 'editor' | 'challengeReady' | 'playing' | 'levelComplete' | 'finale' | 'collection' | 'exhibit';

/** 教学提示：短文案 + 玩家做出对应操作后自动消失（不强制阅读）。 */
const LEVEL_HINTS: Record<number, { text: string; dismiss: 'piece' | 'place' | 'source' }> = {
  0: { text: '点击镜面翻转朝向，把光折进背灯镜的金色一面', dismiss: 'piece' },
  1: { text: '先在下方选中器件，再点击发亮的屋顶放下；点击已放置的器件可以旋转', dismiss: 'place' },
  2: { text: '先在下方选中器件，再点击发亮的屋顶放下；点「取回」可收回放错的器件', dismiss: 'place' },
  3: { text: '旋转分光镜试试：它既反射光，也让光直行穿过', dismiss: 'piece' },
  4: { text: '点击闸门切换南北/东西向；带锁环的器件不能调整', dismiss: 'piece' },
  5: { text: '点击光塔可以转向——它也有四个朝向', dismiss: 'source' },
};

let save: SaveData = loadSave();
let state: GameState = 'intro';
let currentLevel = save.currentLevel;
let activeLevel: LevelConfig = LEVELS[currentLevel];
let customMode: 'trial' | 'challenge' | undefined;
let reflectionState: ReflectionGameState = initialReflectionState(activeLevel);
let tool: ToolSelection = null;
let moves = 0;
let trialMoves: CellMove[] = [];
let hintDismiss: 'piece' | 'place' | 'source' | null = null;
let toastTimer = 0;
let nextTimer = 0;
const audio = new CityAudio();

const ui = new GameUI(document.querySelector<HTMLElement>('#app')!, {
  onStart: startGame,
  onReset: resetLevel,
  onToggleMute: toggleMute,
  onNext: nextLevel,
  onReplay: replay,
  onSelectLevel: selectLevel,
  onSelectTool: selectTool,
  onPanorama: () => scene.resetFinaleView(),
  onToggleSpin: () => scene.toggleFreeSpin(),
});

const shell = document.querySelector<HTMLElement>('.game-shell')!;
const collection = document.createElement('section');
collection.className = 'journey-collection';
collection.hidden = true;
collection.setAttribute('aria-label', '城市收藏');
shell.append(collection);
const exhibit = document.createElement('section');
exhibit.className = 'journey-exhibit';
exhibit.hidden = true;
shell.append(exhibit);
let observedCity = 0;

shell.addEventListener('click', (event) => {
  const control = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-journey]');
  if (!control || control.disabled) return;
  const action = control.dataset.journey;
  if (action === 'home') showHome();
  else if (action === 'collection') showCollection();
  else if (action === 'revival') showCity(observedCity, true);
  else if (action === 'advance') observedCity < CITIES.length - 1 ? loadLevel(CITIES[observedCity + 1].first) : showCollection();
  else if (action === 'restart' && save.completed.length === LEVELS.length) replay();
  else if (action?.startsWith('observe-')) showCity(CITIES.findIndex(city => action === `observe-${city.key}`));
  else if (action?.startsWith('level-')) {
    const index = Number(action.slice(6));
    if (index >= 0 && index < LEVELS.length && index <= save.completed.length) loadLevel(index);
  }
});

function closeJourney(): void {
  collection.hidden = true;
  if (!exhibit.hidden) {
    exhibit.hidden = true;
    exhibit.replaceChildren();
    scene.setRendering(true);
  }
}

function showCollection(): void {
  clearTimers();
  clearSharedHash();
  closeJourney();
  workshop.hide();
  ui.setObserveHidden(false);
  ui.showWorkshop(false);
  state = 'collection';
  collection.hidden = false;
  scene.showIntro();
  collection.innerHTML = `
    <header><div><p>点亮夜城</p><h2>城市收藏</h2></div><button class="icon-button" data-journey="home">返回首页</button></header>
    <div class="journey-cards">${CITIES.map(city => {
      const levels = LEVELS.slice(city.first, city.end);
      const done = levels.filter(level => save.completed.includes(level.id)).length;
      const unlocked = city.first <= save.completed.length;
      const complete = done === levels.length;
      return `<article>
        <img src="./journey/${city.key}.${city.key === 'rain' ? 'png' : 'jpg'}" alt="">
        <div class="journey-card-copy"><small>${city.region}</small><h3>${city.name}</h3>
        <p>${done} / ${levels.length} 关 · ${complete ? '已复苏' : unlocked ? '已解锁' : '旅程待解锁'}</p>
        <button class="icon-button" data-journey="observe-${city.key}">${complete ? '自由观赏' : '预览城市'}</button>
        <div class="journey-levels" aria-label="${city.name}选关">${levels.map(level =>
          `<button class="icon-button" data-journey="level-${level.id}" ${level.id > save.completed.length ? 'disabled' : ''}
            aria-label="第 ${level.id + 1} 关 ${level.name}，${save.best[level.id]?.stars ?? 0} 星">
            ${String(level.id + 1).padStart(2,'0')}<small>${'★'.repeat(save.best[level.id]?.stars ?? 0)}</small>
           </button>`).join('')}</div></div></article>`;
    }).join('')}</div>`;
}

function showCity(index: number, ceremony = false): void {
  const city = CITIES[index];
  if (!city) return;
  clearTimers();
  closeJourney();
  observedCity = index;
  workshop.hide();
  ui.setObserveHidden(false);
  const completed = LEVELS.slice(city.first, city.end).every(level => save.completed.includes(level.id));
  if (index === 0) {
    state = 'finale';
    ui.showFinale(save, !ceremony);
    scene.showFinale(completed);
    return;
  }
  state = 'exhibit';
  ui.showWorkshop(false);
  scene.setRendering(false);
  exhibit.hidden = false;
  const next = index < CITIES.length - 1;
  exhibit.innerHTML = `<iframe title="${city.name}" src="./experiments/${city.key}-city/index.html?exhibit=${ceremony ? 'show' : 'view'}"></iframe>
    <div class="journey-exhibit-actions">
      <span>${ceremony && !next ? '三座城市，灯火相连' : completed ? '章节已复苏' : '城市预览'}</span>
      <button class="icon-button" data-journey="collection">城市收藏</button>
      ${completed && !ceremony ? '<button class="icon-button" data-journey="revival">重播复苏</button>' : ''}
      ${ceremony && next ? '<button class="icon-button" data-journey="advance">继续旅程</button>' : ''}
      ${ceremony && !next ? '<button class="icon-button" data-journey="restart">再玩一次</button>' : ''}
      <button class="icon-button" data-journey="home">首页</button>
    </div>`;
}

let scene: CityScene;
let workshop: Workshop;
try {
  scene = new CityScene(ui.container, handleCell);
  scene.setCompletedDistricts(save.completed);
  workshop = new Workshop(document.querySelector<HTMLElement>('.game-shell')!, scene, {
    showWorkshop: (editing) => {
      clearTimers();
      clearSharedHash();
      customMode = undefined;
      state = editing ? 'editor' : 'workshop';
      ui.showWorkshop(editing);
      if (!editing) scene.showIntro();
    },
    play: playCustom,
    home: showHome,
    reset: resetLevel,
    begin: () => { if (state === 'challengeReady') startCustom(); },
  });
  ui.ready();
  ui.showIntro(save);
  ui.setMuted(save.muted);
  if (location.hash.startsWith('#level=')) {
    const puzzle = readSharedPuzzle(location.hash.slice(7));
    if (puzzle) workshop.setShared(puzzle);
    else workshop.badLink();
  }
  (window as unknown as Record<string, unknown>).__qoderTest = {
    projectCell: (x: number, z: number) => scene.projectCellToScreen([x, z]),
    pickCellAt: (clientX: number, clientY: number) => scene.pickCellAt(clientX, clientY),
    getTool: () => tool,
    summary: () => {
      const level = activeLevel;
      const trace = traceReflection(level, reflectionState);
      return {
        level: currentLevel, won: trace.won, lit: trace.litLights, unhit: trace.unhitPieces.length, cp: trace.checkpointsPassed, moves,
        dir: reflectionState.sourceDirection, states: reflectionState.pieceStates,
        placed: reflectionState.placements.map((p) => `${p.kind}@${p.at.join(',')}:${p.state}`),
      };
    },
  };
} catch (error) {
  console.error('Unable to initialize the city', error);
  ui.fatal('当前浏览器未能启动 WebGL。请使用最新版 Chrome 或 Edge，并确认已开启硬件加速。');
}

function startGame(): void {
  if (!scene) return;
  if (save.completed.length === LEVELS.length) {
    showCity(2, true);
    return;
  }
  currentLevel = Math.min(save.currentLevel, save.completed.length);
  loadLevel(currentLevel);
}

function loadLevel(index: number, immediate = false): void {
  closeJourney();
  ui.setObserveHidden(false);
  clearTimers();
  currentLevel = index;
  state = 'playing';
  moves = 0;
  tool = null;
  const level = activeLevel = LEVELS[index];
  const hint = LEVEL_HINTS[index];
  hintDismiss = hint?.dismiss ?? null;
  ui.hideLevelComplete();
  reflectionState = initialReflectionState(level);
  const trace = traceReflection(level, reflectionState);
  ui.showLevel(level, save.completed, save.best, hint?.text ?? null);
  ui.updateReflection(trace, inventoryLeft(level, reflectionState), 0, null, 0);
  scene.setChapterProgress(phaseProgress(cityOf(index), save.completed));
  scene.setLevel(level, trace, immediate, reflectionState);
  scene.setInteractive(true);
  save.currentLevel = index;
  writeSave(save);
}

function clearSharedHash(): void {
  if (location.hash.startsWith('#level=')) history.replaceState(null, '', location.pathname + location.search);
}

function showHome(): void {
  closeJourney();
  ui.setObserveHidden(false);
  clearTimers();
  clearSharedHash();
  customMode = undefined;
  state = 'intro';
  workshop.hide();
  scene.showIntro();
  ui.showIntro(save);
}

function playCustom(puzzle: Puzzle, mode: 'trial' | 'challenge'): void {
  clearTimers();
  customMode = mode;
  activeLevel = puzzleLevel(structuredClone(puzzle));
  if (mode === 'trial') {
    startCustom();
    return;
  }
  resetCustomBoard();
  state = 'challengeReady';
  scene.setInteractive(false);
  workshop.showPlay(mode, 'ready');
}

function resetCustomBoard(): boolean {
  moves = 0;
  trialMoves = [];
  tool = null;
  hintDismiss = null;
  reflectionState = initialReflectionState(activeLevel);
  const trace = traceReflection(activeLevel, reflectionState);
  ui.showLevel(activeLevel, [], {}, null, customMode);
  ui.updateReflection(trace, inventoryLeft(activeLevel, reflectionState), 0, null, 0);
  scene.setLevel(activeLevel, trace, true, reflectionState);
  return trace.won;
}

function startCustom(): void {
  if (!customMode) return;
  const won = resetCustomBoard();
  if (won && customMode === 'trial') { workshop.rejectInitialWin(); return; }
  state = 'playing';
  workshop.showPlay(customMode, 'playing');
  if (won) completeLevel();
}

function dismissHint(action: 'piece' | 'place' | 'source'): void {
  if (hintDismiss === null) return;
  if (hintDismiss === action) {
    hintDismiss = null;
    ui.clearHint();
  }
}

function handleCell(at: GridPoint): void {
  if (state === 'editor') { workshop.handleCell(at); return; }
  if (state !== 'playing' || !scene) return;
  const move = { at, tool };
  const result = playCell(activeLevel, reflectionState, move);
  switch (result) {
    case null: return;
    case 'noPlacement': ui.announce('这个屋顶上没有你放置的器件。'); return;
    case 'noStock': ui.announce('这种器件已经用完了。'); return;
    case 'occupied': ui.announce('这个屋顶不能放置器件。'); return;
    case 'locked': ui.announce('这是固定器件，不能调整。'); return;
    case 'fixed': ui.announce('这座光塔的方向是固定的。'); return;
  }
  moves += 1;
  if (customMode === 'trial') trialMoves.push(move);
  audio.rotate();
  if (result !== 'erase') dismissHint(result);
  if (result === 'place' || (result === 'erase' && reflectionState.placements.length === 0)) setTool(null);
  else refreshReflection();
}

function selectTool(next: ToolSelection): void {
  if (state !== 'playing') return;
  setTool(tool === next ? null : next);
}

function setTool(next: ToolSelection): void {
  tool = next;
  const level = activeLevel;
  const zones = next && next !== 'erase' ? placementZones(level, reflectionState) : [];
  scene?.setToolZones(zones);
  refreshReflection();
}

function refreshReflection(): void {
  const level = activeLevel;
  if (!scene) return;
  const trace = traceReflection(level, reflectionState);
  scene.setReflection(reflectionState, trace);
  ui.updateReflection(trace, inventoryLeft(level, reflectionState), reflectionState.placements.length, tool, moves);
  if (trace.won && state === 'playing') completeLevel();
}

function completeLevel(): void {
  state = 'levelComplete';
  hintDismiss = null;
  ui.clearHint();
  scene.setInteractive(false);
  if (customMode) {
    if (customMode === 'trial') workshop.markVerified({ final: reflectionState, moves: trialMoves });
    scene.celebrate();
    audio.success(false);
    workshop.showPlay(customMode, 'won');
    return;
  }
  const rating = rateLevel(LEVELS[currentLevel], moves);
  const previous = save.best[currentLevel];
  if (!previous || rating.moves < previous.moves) {
    save.best[currentLevel] = { moves: rating.moves, stars: rating.stars };
  }
  if (!save.completed.includes(currentLevel)) save.completed.push(currentLevel);
  save.completed.sort((a, b) => a - b);
  save.currentLevel = Math.min(currentLevel + 1, LEVELS.length - 1);
  writeSave(save);
  scene.setDistrictProgress(districtProgress(save.completed));
  scene.setChapterProgress(phaseProgress(cityOf(currentLevel), save.completed));
  scene.celebrate();
  const chapterEnd = currentLevel + 1 === CITIES[cityOf(currentLevel)].end;
  audio.success(chapterEnd);
  const best = save.best[currentLevel];
  toastTimer = window.setTimeout(() => {
    ui.showLevelComplete(LEVELS[currentLevel], chapterEnd, rating, best);
  }, 750);
  if (!chapterEnd) nextTimer = window.setTimeout(nextLevel, 3600);
}

function nextLevel(): void {
  if (state !== 'levelComplete' || customMode) return;
  clearTimers();
  if (currentLevel + 1 === CITIES[cityOf(currentLevel)].end) {
    showCity(cityOf(currentLevel), true);
    return;
  }
  loadLevel(currentLevel + 1);
}

function resetLevel(): void {
  if (state !== 'playing' && state !== 'levelComplete') return;
  if (customMode) startCustom();
  else loadLevel(currentLevel);
  ui.announce('当前关卡已重置。');
  audio.rotate();
}

function selectLevel(index: number): void {
  if (index < 0 || index > Math.min(save.completed.length, LEVELS.length - 1)) return;
  if (customMode || (state !== 'playing' && state !== 'levelComplete' && state !== 'finale')) return;
  loadLevel(index);
}

function replay(): void {
  save = clearProgress(save.muted);
  scene.setCompletedDistricts([]);
  loadLevel(0);
}

async function toggleMute(): Promise<void> {
  save.muted = !save.muted;
  ui.setMuted(save.muted);
  writeSave(save);
  try {
    await audio.setEnabled(!save.muted);
  } catch {
    save.muted = true;
    ui.setMuted(true);
    ui.announce('当前浏览器无法播放声音，游戏仍可正常进行。');
  }
}

function clearTimers(): void {
  window.clearTimeout(toastTimer);
  window.clearTimeout(nextTimer);
}
