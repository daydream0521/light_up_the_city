import './styles.css';
import { CityAudio } from './game/audio';
import { LEVELS, type MirrorOrientation } from './game/levels';
import { traceLight, type TraceResult } from './game/optics';
import { rateLevel } from './game/score';
import { clearProgress, loadSave, writeSave, type SaveData } from './game/storage';
import { CityScene, districtProgress } from './scene/CityScene';
import { GameUI } from './ui/GameUI';

type GameState = 'intro' | 'playing' | 'levelComplete' | 'finale';

let save: SaveData = loadSave();
let state: GameState = 'intro';
let currentLevel = save.currentLevel;
let orientations: MirrorOrientation[] = initialOrientations(currentLevel);
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
  onPanorama: () => scene.resetFinaleView(),
  onToggleSpin: () => scene.toggleFreeSpin(),
});

let scene: CityScene;
try {
  scene = new CityScene(ui.container, rotateMirror);
  scene.setCompletedDistricts(save.completed);
  scene.setLevel(currentLevel, orientations, traceLight(LEVELS[currentLevel], orientations), true);
  scene.showIntro(true);
  ui.ready();
  ui.showIntro(save);
  ui.setMuted(save.muted);
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
  orientations = initialOrientations(index);
  const trace = traceLight(LEVELS[index], orientations);
  ui.hideLevelComplete();
  ui.showLevel(LEVELS[index], orientations, save.completed, save.best);
  ui.updateStatus(trace, moves);
  scene.setLevel(index, orientations, trace, immediate);
  scene.setInteractive(true);
  save.currentLevel = index;
  writeSave(save);
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
  ui.announce('当前关卡已重置为初始镜面方向。');
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