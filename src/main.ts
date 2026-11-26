import './styles.css';
import './workshop.css';
import './journey.css';
import { CITIES, chapterStatus, cityOf, isLevelUnlocked, phaseProgress, type CityIndex } from './game/journey';
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
import { CitySurface } from './ui/CitySurface';
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
  onVolume: (channel, volume) => audio.setVolume(channel, volume),
  onNext: nextLevel,
  onReplay: replay,
  onSelectLevel: selectLevel,
  onSelectTool: selectTool,
  onPanorama: () => { audio.setScene(0, 'view'); scene.resetFinaleView(); },
  onToggleSpin: () => { audio.setScene(0, 'view'); return scene.toggleFreeSpin(); },
});

const shell = document.querySelector<HTMLElement>('.game-shell')!;
const citySurface = new CitySurface(shell, (playing) => {
  if (state === 'exhibit') audio.setScene(observedCity, playing ? 'show' : 'view');
});
const collection = document.createElement('section');
collection.className = 'journey-collection';
collection.hidden = true;
collection.setAttribute('aria-label', '城市收藏');
shell.append(collection);
const exhibit = document.createElement('section');
exhibit.className = 'journey-exhibit';
exhibit.hidden = true;
shell.append(exhibit);
let observedCity: CityIndex = 0;
let homeCity = cityOf(save.currentLevel);

shell.addEventListener('click', (event) => {
  const control = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-journey]');
  if (!control || control.disabled) return;
  const action = control.dataset.journey;
  if (action === 'home') showHome();
  else if (action === 'collection') showCollection(homeCity);
  else if (action === 'preview' && state === 'intro') showCity(homeCity);
  else if (action?.startsWith('select-city-') && state === 'collection') {
    showCollection(Number(action.slice(12)) as CityIndex);
    collection.querySelector<HTMLButtonElement>(`[data-journey="${action}"]`)?.focus();
  }
  else if (action === 'replay-chapter' && state === 'intro' && chapterStatus(homeCity, save.completed).complete) {
    loadLevel(CITIES[homeCity].first);
  }
  else if (action === 'revival') showCity(observedCity, true);
  else if (action === 'advance') {
    const next = nextChapter();
    if (next !== null) loadLevel(chapterStatus(next, save.completed).next);
  }
  else if (action === 'restart' && save.completed.length === LEVELS.length) replay();
  else if (action?.startsWith('theme-') && state === 'intro') {
    const index = CITIES.findIndex(city => action === `theme-${city.key}`);
    if (index !== -1 && index !== homeCity) renderHome(index as CityIndex, index > homeCity ? 1 : -1);
  }
  else if (action?.startsWith('observe-')) showCity(CITIES.findIndex(city => action === `observe-${city.key}`) as CityIndex);
  else if (action?.startsWith('level-')) {
    const index = Number(action.slice(6));
    if (isLevelUnlocked(index, save.completed)) loadLevel(index);
  }
});

function closeJourney(keepCity = false): void {
  collection.hidden = true;
  shell.classList.remove('exhibit-controls-hidden');
  exhibit.hidden = true;
  exhibit.replaceChildren();
  if (!keepCity) {
    citySurface.close();
    scene.setRendering(true);
  }
}

function showCollection(selected: CityIndex): void {
  clearTimers();
  clearSharedHash();
  closeJourney();
  workshop.hide();
  ui.setObserveHidden(false);
  ui.showWorkshop(false);
  state = 'collection';
  audio.setScene(selected, 'view');
  collection.hidden = false;
  scene.setRendering(false);
  collection.innerHTML = `
    <header><div><p>点亮夜城</p><h2>城市收藏</h2></div><button class="icon-button" data-journey="home">返回首页</button></header>
    <div class="journey-cards">${CITIES.map((city, index) => {
      const total = city.end - city.first;
      const { done, complete } = chapterStatus(index, save.completed);
      return `<article data-selected="${index === selected}">
        <img src="./journey/${city.key}.${city.key === 'rain' ? 'png' : 'jpg'}" alt="">
        <div class="journey-card-copy"><small>${city.region}</small><h3>${city.name}</h3>
        <p>${done} / ${total} 关 · ${complete ? '已复苏' : done ? '点亮中' : '可开始'}</p>
        <button class="icon-button" data-journey="select-city-${index}" aria-pressed="${index === selected}">选关</button>
        <button class="icon-button" data-journey="observe-${city.key}">${complete ? '自由观赏' : '预览城市'}</button>
        </div></article>`;
    }).join('')}</div>
    <section class="journey-chapter" aria-label="${CITIES[selected].name}选关">
      <h3>${CITIES[selected].name} · 章节关卡</h3>
      <div class="journey-levels">${LEVELS.slice(CITIES[selected].first, CITIES[selected].end).map(level =>
        `<button class="icon-button" data-journey="level-${level.id}" ${isLevelUnlocked(level.id, save.completed) ? '' : 'disabled'}
          aria-label="第 ${level.id + 1} 关 ${level.name}，${save.best[level.id]?.stars ?? 0} 星">
          <small>${String(level.id + 1).padStart(2,'0')}</small><span>${level.name}</span><small>${'★'.repeat(save.best[level.id]?.stars ?? 0)}</small>
        </button>`).join('')}</div>
    </section>`;
}

function nextChapter(): CityIndex | null {
  const next = CITIES.findIndex((_, index) => !chapterStatus(index, save.completed).complete);
  return next === -1 ? null : next as CityIndex;
}

function showCity(index: CityIndex, ceremony = false): void {
  const city = CITIES[index];
  if (!city) return;
  clearTimers();
  closeJourney(index !== 0);
  homeCity = index;
  observedCity = index;
  audio.setScene(index, ceremony ? 'show' : 'view');
  workshop.hide();
  ui.setObserveHidden(false);
  const completed = LEVELS.slice(city.first, city.end).every(level => save.completed.includes(level.id));
  if (city.key === 'rain') {
    state = 'finale';
    ui.showFinale(save, !ceremony, nextChapter() === null);
    scene.showFinale(completed);
    return;
  }
  state = 'exhibit';
  ui.showWorkshop(false, index);
  shell.dataset.screen = 'exhibit';
  scene.setRendering(false);
  exhibit.hidden = false;
  const next = nextChapter() !== null;
  citySurface.show(city, ceremony ? 'show' : 'view');
  exhibit.innerHTML = `<div class="journey-exhibit-actions">
      <span><strong>${city.name}</strong>${ceremony && !next ? '三座城市，灯火相连' : completed ? '章节已复苏' : '城市预览'}</span>
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
  scene = new CityScene(ui.container, handleCell, () => audio.setScene(0, 'view'));
  scene.setCompletedDistricts(save.completed);
  workshop = new Workshop(document.querySelector<HTMLElement>('.game-shell')!, scene, {
    entranceCity: () => homeCity,
    showWorkshop: (editing, city) => {
      closeJourney(!editing && city !== 0);
      audio.setScene(city, editing ? 'puzzle' : 'home');
      clearTimers();
      clearSharedHash();
      customMode = undefined;
      state = editing ? 'editor' : 'workshop';
      ui.showWorkshop(editing, city);
      if (editing) scene.setChapterProgress([0, 0, 0, 0]);
      if (!editing && city === 0) scene.showIntro();
      if (!editing && city !== 0) {
        const surface = CITIES[city];
        scene.setRendering(false);
        citySurface.show(surface, 'home');
      }
    },
    play: playCustom,
    home: showHome,
    reset: resetLevel,
    sound: () => audio.rotate(),
    begin: () => { if (state === 'challengeReady') startCustom(); },
  });
  ui.ready();
  ui.showIntro(save);
  ui.setMuted(save.muted);
  ui.setMix(audio.mix);
  if (!save.muted) {
    const resumeSavedAudio = (event: Event) => {
      if ((event.target as HTMLElement).closest('[data-action="mute"]')) return;
      document.removeEventListener('pointerup', resumeSavedAudio);
      document.removeEventListener('keydown', resumeSavedAudio);
      if (!save.muted) void audio.setEnabled(true).catch(() => ui.announce('当前浏览器无法播放声音。'));
    };
    document.addEventListener('pointerup', resumeSavedAudio);
    document.addEventListener('keydown', resumeSavedAudio);
  }
  if (location.hash.startsWith('#level=')) {
    const puzzle = readSharedPuzzle(location.hash.slice(7));
    if (puzzle) workshop.setShared(puzzle);
    else workshop.badLink();
  } else renderHome(homeCity);
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
  if (!scene || state !== 'intro') return;
  const { complete, next } = chapterStatus(homeCity, save.completed);
  if (complete) showCity(homeCity);
  else loadLevel(next);
}

function loadLevel(index: number, immediate = false): void {
  closeJourney();
  ui.setObserveHidden(false);
  clearTimers();
  currentLevel = index;
  homeCity = cityOf(index);
  audio.setScene(homeCity, 'puzzle');
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
  clearSharedHash();
  renderHome(homeCity);
}

function renderHome(index: CityIndex, direction = 0): void {
  closeJourney(index !== 0);
  ui.setObserveHidden(false);
  clearTimers();
  customMode = undefined;
  state = 'intro';
  homeCity = index;
  workshop.hide();
  audio.setScene(index, 'home');
  if (index === 0) scene.showIntro();
  else {
    scene.setRendering(false);
    const city = CITIES[index];
    citySurface.show(city, 'home');
  }
  ui.showIntro(save, index, direction);
}

function playCustom(puzzle: Puzzle, mode: 'trial' | 'challenge'): void {
  closeJourney();
  clearTimers();
  customMode = mode;
  activeLevel = puzzleLevel(structuredClone(puzzle));
  audio.setScene(activeLevel.city ?? 0, 'puzzle');
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
  scene.setChapterProgress([0, 0, 0, 0]);
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
  save.currentLevel = currentLevel + 1 < CITIES[cityOf(currentLevel)].end ? currentLevel + 1 : currentLevel;
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
  if (!isLevelUnlocked(index, save.completed)) return;
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
