import './styles.css';
import { CityAudio } from './game/audio';
import { LEVELS, type Direction, type GridPoint } from './game/levels';
import {
  canPlaceAt, initialReflectionState, inventoryLeft, placementZones, traceReflection,
  type ReflectionGameState, type ReflectionTrace,
} from './game/reflection';
import { rateLevel } from './game/score';
import { clearProgress, loadSave, writeSave, type SaveData } from './game/storage';
import { CityScene, districtProgress } from './scene/CityScene';
import { GameUI, type ToolSelection } from './ui/GameUI';

type GameState = 'intro' | 'playing' | 'levelComplete' | 'finale';

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
let reflectionState: ReflectionGameState = initialReflectionState(LEVELS[currentLevel]);
let tool: ToolSelection = null;
let moves = 0;
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

let scene: CityScene;
try {
  scene = new CityScene(ui.container, handleCell);
  scene.setCompletedDistricts(save.completed);
  scene.setLevel(currentLevel, traceReflection(LEVELS[currentLevel], reflectionState), true, reflectionState);
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
  const hint = LEVEL_HINTS[index];
  hintDismiss = hint?.dismiss ?? null;
  ui.hideLevelComplete();
  reflectionState = initialReflectionState(level);
  const trace = traceReflection(level, reflectionState);
  ui.showLevel(level, save.completed, save.best, hint?.text ?? null);
  ui.updateReflection(trace, inventoryLeft(level, reflectionState), 0, null, 0);
  scene.setLevel(index, trace, immediate, reflectionState);
  scene.setInteractive(true);
  save.currentLevel = index;
  writeSave(save);
}

function dismissHint(action: 'piece' | 'place' | 'source'): void {
  if (hintDismiss === null) return;
  if (hintDismiss === action) {
    hintDismiss = null;
    ui.clearHint();
  }
}

function handleCell(at: GridPoint): void {
  if (state !== 'playing' || !scene) return;
  const level = LEVELS[currentLevel];
  const rs = reflectionState;
  const sameCell = (point: GridPoint): boolean => point[0] === at[0] && point[1] === at[1];
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
    dismissHint('place');
    // 与原作一致：每次放置后取消选中，避免误把旋转点击当作放置。
    setTool(null);
    return;
  }
  if (placementIndex >= 0) {
    const placement = rs.placements[placementIndex];
    placement.state = (placement.state + 1) % (placement.kind === 'single' ? 4 : 2);
    moves += 1;
    audio.rotate();
    dismissHint('piece');
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
    dismissHint('piece');
    refreshReflection();
    return;
  }
  if (sameCell(level.source)) {
    if (!level.reflection.sourceRotatable) { ui.announce('这座光塔的方向是固定的。'); return; }
    rs.sourceDirection = ((rs.sourceDirection + 1) % 4) as Direction;
    moves += 1;
    audio.rotate();
    dismissHint('source');
    refreshReflection();
  }
}

function selectTool(next: ToolSelection): void {
  if (state !== 'playing') return;
  setTool(tool === next ? null : next);
}

function setTool(next: ToolSelection): void {
  tool = next;
  const level = LEVELS[currentLevel];
  const zones = next && next !== 'erase' ? placementZones(level, reflectionState) : [];
  scene?.setToolZones(zones);
  refreshReflection();
}

function refreshReflection(): void {
  const level = LEVELS[currentLevel];
  if (!scene) return;
  const trace = traceReflection(level, reflectionState);
  scene.setReflection(reflectionState, trace);
  ui.updateReflection(trace, inventoryLeft(level, reflectionState), reflectionState.placements.length, tool, moves);
  if (trace.won && state === 'playing') completeLevel(trace);
}

function completeLevel(trace: ReflectionTrace): void {
  void trace;
  state = 'levelComplete';
  hintDismiss = null;
  ui.clearHint();
  scene.setInteractive(false);
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
