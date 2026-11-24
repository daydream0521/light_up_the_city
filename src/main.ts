import './styles.css';
import { CityAudio } from './game/audio';
import { LEVELS, type Direction, type GridPoint, type MirrorOrientation } from './game/levels';
import { traceLight, type TraceResult } from './game/optics';
import {
  canPlaceAt, initialReflectionState, inventoryLeft, placementZones, traceReflection,
  type ReflectionGameState,
} from './game/reflection';
import { rateLevel } from './game/score';
import { clearProgress, loadSave, writeSave, type SaveData } from './game/storage';
import { CityScene, districtProgress } from './scene/CityScene';
import { GameUI, type ToolSelection } from './ui/GameUI';

type GameState = 'intro' | 'playing' | 'levelComplete' | 'finale';

let save: SaveData = loadSave();
let state: GameState = 'intro';
let currentLevel = save.currentLevel;
let orientations: MirrorOrientation[] = initialOrientations(currentLevel);
let reflectionState: ReflectionGameState | null = LEVELS[currentLevel].reflection ? initialReflectionState(LEVELS[currentLevel]) : null;
let tool: ToolSelection = null;
let moves = 0;
let toastTimer = 0;
let nextTimer = 0;
const audio = new CityAudio();

const ui = new GameUI(document.querySelector<HTMLElement>('#app')!, {
  onStart: startGame,
  onMirror: rotateMirror,
  onReset: resetLevel,
  onToggleMute: toggleMute,
  onNext: nextLevel,
  onReplay: replay,
  onSelectLevel: selectLevel,
  onSelectTool: selectTool,
});

let scene: CityScene;
try {
  scene = new CityScene(ui.container, handleCell);
  scene.setCompletedDistricts(save.completed);
  if (reflectionState) {
    scene.setLevel(currentLevel, [], traceReflection(LEVELS[currentLevel], reflectionState), true, reflectionState);
  } else {
    scene.setLevel(currentLevel, orientations, traceLight(LEVELS[currentLevel], orientations), true);
  }
  scene.showIntro(true);
  ui.ready();
  ui.showIntro(save);
  ui.setMuted(save.muted);
  (window as unknown as Record<string, unknown>).__qoderTest = {
    projectCell: (x: number, z: number) => scene.projectCellToScreen([x, z]),
    pickCellAt: (clientX: number, clientY: number) => scene.pickCellAt(clientX, clientY),
    getTool: () => tool,
    summary: () => {
      const level = LEVELS[currentLevel];
      if (!level.reflection || !reflectionState) return { level: currentLevel, classic: true };
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

function initialOrientations(level: number): MirrorOrientation[] {
  return LEVELS[level].mirrors.map((mirror) => mirror.initial);
}

function startGame(): void {
  if (!scene) return;
  if (save.completed.length === LEVELS.length) {
    state = 'finale';
    ui.showFinale(save);
    scene.showFinale();
    return;
  }
  currentLevel = Math.min(save.currentLevel, save.completed.length);
  loadLevel(currentLevel);
}

function loadLevel(index: number, immediate = false): void {
  clearTimers();
  currentLevel = index;
  state = 'playing';
  moves = 0;
  tool = null;
  const level = LEVELS[index];
  ui.hideLevelComplete();
  if (level.reflection) {
    reflectionState = initialReflectionState(level);
    orientations = [];
    const trace = traceReflection(level, reflectionState);
    ui.showLevel(level, orientations, save.completed, save.best);
    ui.updateReflection(trace, inventoryLeft(level, reflectionState), 0, null, 0);
    scene.setLevel(index, [], trace, immediate, reflectionState);
  } else {
    reflectionState = null;
    orientations = initialOrientations(index);
    const trace = traceLight(level, orientations);
    ui.showLevel(level, orientations, save.completed, save.best);
    ui.updateStatus(trace, moves);
    scene.setLevel(index, orientations, trace, immediate);
  }
  scene.setInteractive(true);
  save.currentLevel = index;
  writeSave(save);
}

function handleCell(at: GridPoint): void {
  if (state !== 'playing' || !scene) return;
  const level = LEVELS[currentLevel];
  const sameCell = (point: GridPoint): boolean => point[0] === at[0] && point[1] === at[1];
  if (!level.reflection || !reflectionState) {
    const index = level.mirrors.findIndex((mirror) => sameCell(mirror.at));
    if (index >= 0) rotateMirror(index);
    return;
  }
  const rs = reflectionState;
  const placementIndex = rs.placements.findIndex((placement) => sameCell(placement.at));

  if (tool === 'erase') {
    if (placementIndex >= 0) {
      rs.placements.splice(placementIndex, 1);
      moves += 1;
      audio.rotate();
      if (rs.placements.length === 0) setTool(null); else refreshReflection();
    } else {
      ui.announce('这个屋顶上没有你放置的器件。');
    }
    return;
  }
  if (tool) {
    const left = inventoryLeft(level, rs);
    if (left[tool] <= 0) { ui.announce('这种器件已经用完了。'); return; }
    if (!canPlaceAt(level, rs, at)) { ui.announce('这个屋顶不能放置器件。'); return; }
    rs.placements.push({ at: [at[0], at[1]], kind: tool, state: 0 });
    moves += 1;
    audio.rotate();
    // 与原作一致：每次放置后取消选中，避免误把旋转点击当作放置。
    setTool(null);
    return;
  }
  if (placementIndex >= 0) {
    const placement = rs.placements[placementIndex];
    placement.state = (placement.state + 1) % (placement.kind === 'single' ? 4 : 2);
    moves += 1;
    audio.rotate();
    refreshReflection();
    return;
  }
  const pieceIndex = level.reflection.pieces.findIndex((piece) => sameCell(piece.at));
  if (pieceIndex >= 0) {
    const piece = level.reflection.pieces[pieceIndex];
    if (piece.locked) { ui.announce(`${piece.id} 是固定器件，不能调整。`); return; }
    rs.pieceStates[pieceIndex] = (rs.pieceStates[pieceIndex] + 1) % (piece.kind === 'single' ? 4 : 2);
    moves += 1;
    audio.rotate();
    refreshReflection();
    return;
  }
  if (sameCell(level.source)) {
    if (!level.reflection.sourceRotatable) { ui.announce('这座光塔的方向是固定的。'); return; }
    rs.sourceDirection = ((rs.sourceDirection + 1) % 4) as Direction;
    moves += 1;
    audio.rotate();
    refreshReflection();
  }
}

function selectTool(next: ToolSelection): void {
  if (state !== 'playing' || !LEVELS[currentLevel].reflection) return;
  setTool(tool === next ? null : next);
}

function setTool(next: ToolSelection): void {
  tool = next;
  const level = LEVELS[currentLevel];
  const zones = level.reflection && reflectionState && next && next !== 'erase'
    ? placementZones(level, reflectionState)
    : [];
  scene?.setToolZones(zones);
  refreshReflection();
}

function refreshReflection(): void {
  const level = LEVELS[currentLevel];
  if (!level.reflection || !reflectionState || !scene) return;
  const trace = traceReflection(level, reflectionState);
  scene.setReflection(reflectionState, trace);
  ui.updateReflection(trace, inventoryLeft(level, reflectionState), reflectionState.placements.length, tool, moves);
  if (trace.won && state === 'playing') completeLevel(trace);
}

function rotateMirror(index: number): void {
  if (state !== 'playing' || !orientations[index]) return;
  orientations[index] = orientations[index] === '/' ? '\\' : '/';
  moves += 1;
  scene.updateMirror(index, orientations[index]);
  ui.updateMirrors(orientations);
  audio.rotate();
  const trace = traceLight(LEVELS[currentLevel], orientations);
  scene.setBeam(trace);
  ui.updateStatus(trace, moves);
  if (trace.allPowered) completeLevel(trace);
}

function completeLevel(trace: TraceResult): void {
  state = 'levelComplete';
  scene.setInteractive(false);
  const rating = rateLevel(LEVELS[currentLevel], moves, trace);
  const previous = save.best[currentLevel];
  if (!previous || rating.moves < previous.moves) {
    save.best[currentLevel] = { moves: rating.moves, stars: rating.stars };
  }
  if (!save.completed.includes(currentLevel)) save.completed.push(currentLevel);
  save.completed.sort((a, b) => a - b);
  save.currentLevel = Math.min(currentLevel + 1, LEVELS.length - 1);
  writeSave(save);
  scene.setDistrictProgress(districtProgress(save.completed));
  scene.celebrate();
  audio.success(currentLevel === LEVELS.length - 1);
  const best = save.best[currentLevel];
  toastTimer = window.setTimeout(() => {
    ui.showLevelComplete(LEVELS[currentLevel], currentLevel === LEVELS.length - 1, rating, best);
  }, 750);
  nextTimer = window.setTimeout(nextLevel, 3600);
}

function nextLevel(): void {
  if (state !== 'levelComplete') return;
  clearTimers();
  if (currentLevel === LEVELS.length - 1) {
    state = 'finale';
    ui.showFinale(save);
    scene.showFinale();
    return;
  }
  loadLevel(currentLevel + 1);
}

function resetLevel(): void {
  if (state !== 'playing' && state !== 'levelComplete') return;
  loadLevel(currentLevel);
  ui.announce('当前关卡已重置。');
  audio.rotate();
}

function selectLevel(index: number): void {
  if (index < 0 || index > Math.min(save.completed.length, LEVELS.length - 1)) return;
  if (state === 'intro') return;
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
