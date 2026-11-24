import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { DISTRICT_CENTERS, GRID_SIZE, LEVELS, OPTICS_HEIGHT, type GridPoint, type LevelConfig, type MirrorOrientation, type PieceKind, type TargetConfig } from '../game/levels';
import type { TraceResult } from '../game/optics';
import type { ReflectionGameState, ReflectionTrace } from '../game/reflection';
import { createCity, gridToWorld, type CityVisual } from './cityGeometry';

interface MirrorVisual {
  rotor: THREE.Group;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>;
  targetRotation: number;
}

interface TargetVisual {
  material: THREE.MeshStandardMaterial;
  ringMaterial: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
}

interface BeamSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  length: number;
}

interface BeamRun {
  segments: BeamSegment[];
  totalLength: number;
  branch: number;
}

interface CameraTween {
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromSize: number;
  toSize: number;
  elapsed: number;
  duration: number;
}

const CYAN = '#69e6f2';
const GOLD = '#ffcf82';
const MINT = '#8affc1';
const BRANCH_COLORS = [CYAN, MINT, '#b39dff', '#ffd18a'];
const Y_AXIS = new THREE.Vector3(0, 1, 0);
// 引擎方向 0=E 1=S 2=W 3=N；喷口默认朝 +Z（南）。
const SOURCE_ROT_Y = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];
const KIND_LABELS: Record<PieceKind, string> = { mirror: '镜面', splitter: '分光镜', single: '背灯镜', checkpoint: '闸门' };
// 拾取/投影共用的平面高度：介于屋脊(≈1.74)与镜面面板(2.25)之间，斜视角下点选偏差最小。
const PICK_HEIGHT = 1.95;

export class CityScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 140);
  private readonly controls: OrbitControls;
  private readonly composer: EffectComposer;
  private readonly city: CityVisual;
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly hitMeshes: THREE.Mesh[] = [];
  private readonly mirrors = new Map<number, MirrorVisual>();
  private readonly targets = new Map<string, TargetVisual>();
  private readonly beamGroup = new THREE.Group();
  private readonly levelGroup = new THREE.Group();
  private readonly pieceGroup = new THREE.Group();
  private readonly zoneGroup = new THREE.Group();
  private readonly beamRuns: BeamRun[] = [];
  private readonly pulses: THREE.Mesh[] = [];
  private readonly lightLevels = [0, 0, 0, 0];
  private readonly lightTargets = [0, 0, 0, 0];
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly darkWindowColor = new THREE.Color('#294056');
  private readonly warmWindowColor = new THREE.Color('#ffd18a');
  private readonly rain: THREE.LineSegments;
  private readonly rainPositions: Float32Array;
  private readonly rainCount: number;
  private readonly glowTexture = createGlowTexture();
  private readonly beamMaterials = BRANCH_COLORS.map((color) => {
    const core = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.55);
    return {
      core: new THREE.MeshBasicMaterial({ color: core, toneMapped: false }),
      glow: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      reflection: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.075, blending: THREE.AdditiveBlending, depthWrite: false }),
      endpoint: color,
    };
  });
  private level: LevelConfig = LEVELS[0];
  private groundPlane?: THREE.Mesh;
  private sourceNozzle?: THREE.Group;
  private lastTrace?: TraceResult;
  private burst?: THREE.Points;
  private burstVelocities: THREE.Vector3[] = [];
  private burstLife = 0;
  private cameraTween?: CameraTween;
  private viewSize = 29;
  private hovered = -1;
  private pointerStart = new THREE.Vector2();
  private pointerDown = false;
  private dragged = false;
  private interactive = false;
  private screen: 'intro' | 'level' | 'finale' = 'intro';

  constructor(private readonly container: HTMLElement, private readonly onCell: (at: GridPoint) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', '点亮夜城 3D 游戏场景');
    this.renderer.domElement.setAttribute('tabindex', '0');

    this.scene.background = new THREE.Color('#050b18');
    this.scene.fog = new THREE.FogExp2('#091426', 0.023);
    this.camera.position.set(18, 21, 25);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.minZoom = 0.72;
    this.controls.maxZoom = 1.8;
    this.controls.minPolarAngle = Math.PI * 0.19;
    this.controls.maxPolarAngle = Math.PI * 0.39;
    this.controls.rotateSpeed = 0.42;
    this.controls.zoomSpeed = 0.65;
    this.controls.autoRotate = !this.reducedMotion;
    this.controls.autoRotateSpeed = 0.16;
    this.controls.target.set(0, 0.6, 0);

    const hemisphere = new THREE.HemisphereLight('#9dc5ed', '#0b1826', 2.15);
    this.scene.add(hemisphere);
    const moon = new THREE.DirectionalLight('#b3d3ff', 2.65);
    moon.position.set(-10, 19, 7);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -15;
    moon.shadow.camera.right = 15;
    moon.shadow.camera.top = 15;
    moon.shadow.camera.bottom = -15;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 50;
    moon.shadow.bias = -0.0004;
    this.scene.add(moon);
    const rim = new THREE.DirectionalLight('#286f9a', 1.1);
    rim.position.set(12, 8, -14);
    this.scene.add(rim);

    this.city = createCity();
    this.scene.add(this.city.group);
    this.scene.add(this.levelGroup, this.beamGroup, this.pieceGroup, this.zoneGroup);

    this.rainCount = window.innerWidth < 800 ? 280 : 560;
    const rain = this.createRain(this.rainCount);
    this.rain = rain.lines;
    this.rainPositions = rain.positions;
    this.scene.add(this.rain);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.72, 0.65, 0.72);
    bloom.threshold = 0.74;
    bloom.strength = window.innerWidth < 800 ? 0.42 : 0.52;
    bloom.radius = 0.42;
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    this.bindPointerEvents();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.showIntro(true);
    this.renderer.setAnimationLoop(() => this.animate());
  }

  showIntro(immediate = false): void {
    this.screen = 'intro';
    this.interactive = false;
    this.controls.autoRotate = !this.reducedMotion;
    this.moveCamera(new THREE.Vector3(18, 21, 25), new THREE.Vector3(0, 0.6, 0), this.cameraViewSize(29, 39), immediate ? 0 : 1.8);
  }

  setLevel(index: number, orientations: readonly MirrorOrientation[], trace: TraceResult, immediate = false, reflectionState: ReflectionGameState | null = null): void {
    this.level = LEVELS[index];
    this.screen = 'level';
    this.interactive = true;
    this.controls.autoRotate = false;
    this.clearLevel();
    this.createLevelObjects(orientations);
    if (this.level.reflection && reflectionState) {
      this.setReflection(reflectionState, trace as ReflectionTrace);
    } else {
      this.setBeam(trace);
    }
    this.setToolZones([]);
    // gridToWorld 以 7 格棋盘为基准居中（x-3）；非 7 格关卡需把镜头对准实际棋盘中心。
    const boardOffset = ((this.level.size - 1) / 2 - 3) * GRID_SIZE;
    const center = new THREE.Vector3(this.level.districtCenter[0] + boardOffset, 0.75, this.level.districtCenter[1] + boardOffset);
    this.moveCamera(center.clone().add(new THREE.Vector3(9.6, 12.2, 13.4)), center, this.cameraViewSize(13.6, 17.2), immediate ? 0 : 1.55);
  }

  updateMirror(index: number, orientation: MirrorOrientation): void {
    const mirror = this.mirrors.get(index);
    if (mirror) mirror.targetRotation = orientation === '/' ? Math.PI / 4 : -Math.PI / 4;
  }

  setReflection(state: ReflectionGameState, trace: ReflectionTrace): void {
    this.lastTrace = trace;
    this.disposeGroup(this.pieceGroup);
    const reflection = this.level.reflection!;
    reflection.pieces.forEach((piece, index) => {
      const lit = piece.kind === 'single' && trace.targets.some((target) => target.id === piece.id && target.powered);
      const active = piece.kind === 'checkpoint' && trace.checkpoints.some((checkpoint) => checkpoint.id === piece.id && checkpoint.activated);
      this.createPieceVisual(piece.kind, state.pieceStates[index], piece.locked, piece.id, piece.at, false, lit, active);
    });
    state.placements.forEach((placement, index) => {
      const id = `放置${index + 1}`;
      const lit = placement.kind === 'single' && trace.targets.some((target) => target.id === id && target.powered);
      this.createPieceVisual(placement.kind, placement.state, false, id, placement.at, true, lit, false);
    });
    if (this.sourceNozzle) this.sourceNozzle.rotation.y = SOURCE_ROT_Y[state.sourceDirection];
    this.setBeam(trace);
  }

  setToolZones(cells: readonly GridPoint[]): void {
    this.disposeGroup(this.zoneGroup);
    if (!cells.length || !this.level.reflection) return;
    const material = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const cell of cells) {
      const marker = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), material);
      marker.rotation.x = -Math.PI / 2;
      marker.position.copy(gridToWorld(this.level, cell, 1.8));
      this.zoneGroup.add(marker);
    }
  }

  projectCellToScreen(at: GridPoint): { x: number; y: number } | null {
    const projected = gridToWorld(this.level, at, PICK_HEIGHT).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + (projected.x + 1) / 2 * rect.width,
      y: rect.top + (-projected.y + 1) / 2 * rect.height,
    };
  }

  private createPieceVisual(kind: PieceKind, pieceState: number, locked: boolean, id: string, at: GridPoint, placed: boolean, lit: boolean, cpActive: boolean): void {
    const root = new THREE.Group();
    root.position.copy(gridToWorld(this.level, at));
    const baseColor = placed ? '#2b4453' : kind === 'single' ? '#4a3a24' : kind === 'checkpoint' ? '#322a4d' : '#173849';
    this.addRoofBase(root, baseColor);
    if (kind === 'checkpoint') {
      const axis = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({ color: '#cdb3ff', emissive: '#8a63ff', emissiveIntensity: cpActive ? 2.4 : locked ? 0.5 : 0.95, roughness: 0.3, metalness: 0.4 });
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.86, 8), material);
        pillar.position.set(side * 0.44, OPTICS_HEIGHT, 0);
        axis.add(pillar);
      }
      const gate = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 26, Math.PI), material);
      gate.position.y = OPTICS_HEIGHT + 0.4;
      axis.add(gate);
      const lane = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: cpActive ? '#e4d6ff' : '#6c5a9e', transparent: true, opacity: 0.9 }));
      lane.position.y = OPTICS_HEIGHT;
      axis.add(lane);
      axis.rotation.y = pieceState === 0 ? 0 : Math.PI / 2;
      root.add(axis);
    } else {
      const rotor = new THREE.Group();
      const panelMaterial = kind === 'single'
        ? new THREE.MeshPhysicalMaterial({ color: '#ffe6b8', metalness: 0.55, roughness: 0.16, clearcoat: 1, emissive: '#9a7435', emissiveIntensity: 0.45 })
        : kind === 'splitter'
          ? new THREE.MeshPhysicalMaterial({ color: '#d6ffe9', metalness: 0.5, roughness: 0.14, clearcoat: 1, emissive: MINT, emissiveIntensity: 0.55, transparent: true, opacity: 0.92 })
          : new THREE.MeshPhysicalMaterial({ color: '#c8f6ff', map: createMirrorTexture(), metalness: 0.68, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, emissive: '#3da6b7', emissiveIntensity: 0.35 });
      const panel = new THREE.Mesh(new RoundedBoxGeometry(0.88, 0.76, 0.04, 3, 0.04), panelMaterial);
      panel.position.y = OPTICS_HEIGHT;
      rotor.add(panel);
      if (kind === 'splitter') {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.82, 0.06), new THREE.MeshBasicMaterial({ color: MINT, transparent: true, opacity: 0.5 }));
        seam.position.y = OPTICS_HEIGHT;
        rotor.add(seam);
      }
      if (kind === 'single') {
        const back = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffd18a', emissive: GOLD, emissiveIntensity: lit ? 3.4 : 0.5, roughness: 0.3 }));
        back.position.set(0, OPTICS_HEIGHT, -0.12);
        rotor.add(back);
        if (lit) {
          const light = new THREE.PointLight(GOLD, 6, 4.5, 1.7);
          light.position.set(0, OPTICS_HEIGHT + 0.2, -0.22);
          rotor.add(light);
        }
        rotor.rotation.y = -pieceState * Math.PI / 2;
      } else {
        rotor.rotation.y = pieceState === 0 ? Math.PI / 4 : -Math.PI / 4;
      }
      root.add(rotor);
    }
    if (locked) {
      const lock = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 20), new THREE.MeshStandardMaterial({ color: '#8b97a6', metalness: 0.8, roughness: 0.35 }));
      lock.position.y = 1.62;
      lock.rotation.x = Math.PI / 2;
      root.add(lock);
    }
    const label = placed ? `${KIND_LABELS[kind]} · 已放置` : `${KIND_LABELS[kind]} ${id}${locked ? ' · 固定' : ''}`;
    root.add(this.createLabel(label, placed ? '#b9fbff' : kind === 'single' ? '#ffdaa0' : '#d4fbff', 3.05));
    this.pieceGroup.add(root);
  }

  private createGroundPickPlane(): void {
    const extent = this.level.size * GRID_SIZE + 2;
    this.groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(extent, extent), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.groundPlane.rotation.x = -Math.PI / 2;
    // 与 projectCellToScreen 的投影高度一致，避免斜视角下的视差错格。
    const half = Math.floor((this.level.size - 1) / 2);
    this.groundPlane.position.copy(gridToWorld(this.level, [half, half], PICK_HEIGHT));
    this.levelGroup.add(this.groundPlane);
  }

  private worldToGrid(point: THREE.Vector3): GridPoint | null {
    const origin = gridToWorld(this.level, [0, 0]);
    const ex = gridToWorld(this.level, [1, 0]).sub(origin);
    const ez = gridToWorld(this.level, [0, 1]).sub(origin);
    origin.y = 0;
    ex.y = 0;
    ez.y = 0;
    const delta = point.clone().sub(origin);
    delta.y = 0;
    const x = Math.round(delta.dot(ex) / ex.lengthSq());
    const z = Math.round(delta.dot(ez) / ez.lengthSq());
    if (x < 0 || z < 0 || x >= this.level.size || z >= this.level.size) return null;
    return [x, z];
  }

  private disposeGroup(group: THREE.Group): void {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          const mapped = material as THREE.Material & { map?: THREE.Texture | null };
          mapped.map?.dispose();
          material.dispose();
        });
      }
    });
    group.clear();
  }

  setBeam(trace: TraceResult): void {
    this.lastTrace = trace;
    this.clearBeam();
    for (const beam of trace.beams) {
      const materials = this.beamMaterials[beam.branch % this.beamMaterials.length];
      const points = beam.points.map((point) => gridToWorld(this.level, point, OPTICS_HEIGHT));
      const segments: BeamSegment[] = [];
      for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        const direction = end.clone().sub(start);
        const length = direction.length();
        if (length < 0.01) continue;
        const midpoint = start.clone().add(end).multiplyScalar(0.5);
        const rotation = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, direction.normalize());
        const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, length, 10, 1, true), materials.glow);
        glow.position.copy(midpoint);
        glow.quaternion.copy(rotation);
        this.beamGroup.add(glow);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, length, 8), materials.core);
        core.position.copy(midpoint);
        core.quaternion.copy(rotation);
        this.beamGroup.add(core);
        const reflection = new THREE.Mesh(new THREE.PlaneGeometry(length, 0.19), materials.reflection);
        reflection.position.copy(midpoint).setY(0.075);
        reflection.rotation.x = -Math.PI / 2;
        reflection.rotation.z = -Math.atan2(end.z - start.z, end.x - start.x);
        this.beamGroup.add(reflection);
        segments.push({ start: start.clone(), end: end.clone(), length });
      }
      const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
      const runIndex = this.beamRuns.length;
      this.beamRuns.push({ segments, totalLength, branch: beam.branch });

      const pulseCount = Math.min(4, Math.max(1, segments.length));
      for (let index = 0; index < pulseCount; index += 1) {
        const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), materials.core);
        pulse.userData.runIndex = runIndex;
        pulse.userData.offset = index / pulseCount;
        this.pulses.push(pulse);
        this.beamGroup.add(pulse);
      }

      if (points.length) {
        const powered = beam.targetId ? trace.targets.find((target) => target.id === beam.targetId)?.powered : false;
        const endpoint = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.glowTexture, color: powered ? GOLD : materials.endpoint, transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        }));
        endpoint.scale.setScalar(powered ? 1.45 : 0.7);
        endpoint.position.copy(points.at(-1)!);
        this.beamGroup.add(endpoint);
      }
    }

    for (const state of trace.targets) {
      const visual = this.targets.get(state.id);
      if (!visual) continue;
      visual.material.emissiveIntensity = state.powered ? 2.2 : 0.6;
      visual.ringMaterial.emissiveIntensity = state.powered ? 2.0 : 0.7;
      visual.light.intensity = state.powered ? 9 : 0.9;
    }
  }

  setDistrictProgress(progress: readonly number[], immediate = false): void {
    for (let index = 0; index < 4; index += 1) {
      this.lightTargets[index] = THREE.MathUtils.clamp(progress[index] ?? 0, 0, 1);
      if (immediate || this.reducedMotion) this.lightLevels[index] = this.lightTargets[index];
    }
  }

  setCompletedDistricts(completed: readonly number[]): void {
    this.setDistrictProgress(districtProgress(completed), true);
  }

  setInteractive(interactive: boolean): void {
    this.interactive = interactive;
    this.hovered = -1;
    this.renderer.domElement.classList.remove('is-hovering');
  }

  celebrate(): void {
    if (this.burst) {
      this.scene.remove(this.burst);
      this.burst.geometry.dispose();
      (this.burst.material as THREE.Material).dispose();
    }
    const count = this.reducedMotion ? 12 : 72;
    const positions = new Float32Array(count * 3);
    const origin = new THREE.Vector3();
    const burstTargets: readonly GridPoint[] = this.level.targets.length
      ? this.level.targets.map((target) => target.at)
      : (this.lastTrace?.targets ?? []).map((target) => target.at);
    for (const at of burstTargets) origin.add(gridToWorld(this.level, at, OPTICS_HEIGHT));
    origin.divideScalar(Math.max(1, burstTargets.length));
    this.burstVelocities = [];
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = origin.x;
      positions[index * 3 + 1] = origin.y;
      positions[index * 3 + 2] = origin.z;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 2;
      this.burstVelocities.push(new THREE.Vector3(Math.cos(angle) * speed, 1.2 + Math.random() * 2.3, Math.sin(angle) * speed));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.burst = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: '#ffe0a4', size: 0.12, map: this.glowTexture, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.burstLife = 2.2;
    this.scene.add(this.burst);
  }

  showFinale(): void {
    this.screen = 'finale';
    this.interactive = false;
    this.controls.autoRotate = !this.reducedMotion;
    this.controls.autoRotateSpeed = 0.1;
    this.setDistrictProgress([1, 1, 1, 1]);
    this.moveCamera(new THREE.Vector3(20, 24, 28), new THREE.Vector3(0, 0.4, 0), this.cameraViewSize(30, 40), this.reducedMotion ? 0 : 3.4);
  }

  private createLevelObjects(orientations: readonly MirrorOrientation[]): void {
    this.createSource();
    if (this.level.reflection) {
      this.level.obstacles.forEach((point) => this.createObstacle(point));
      this.createGroundPickPlane();
      return;
    }
    this.level.targets.forEach((target) => this.createTarget(target));
    this.level.splitters.forEach((splitter) => this.createSplitter(splitter.at, splitter.id));
    this.level.obstacles.forEach((point) => this.createObstacle(point));
    this.level.mirrors.forEach((mirror, index) => this.createMirror(index, mirror.at, orientations[index], mirror.id));
  }

  private createSource(): void {
    const position = gridToWorld(this.level, this.level.source);
    const group = new THREE.Group();
    group.position.copy(position);
    this.addRoofBase(group, '#163a4b');
    const material = new THREE.MeshStandardMaterial({ color: '#b9fbff', emissive: CYAN, emissiveIntensity: 1.7, roughness: 0.16, metalness: 0.2 });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), material);
    crystal.position.y = OPTICS_HEIGHT;
    crystal.rotation.z = Math.PI / 4;
    group.add(crystal);
    const cageMaterial = new THREE.MeshStandardMaterial({ color: '#5cc7d5', emissive: '#1b8b9c', emissiveIntensity: 0.8, metalness: 0.75, roughness: 0.25 });
    for (let ring = 0; ring < 2; ring += 1) {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.38 + ring * 0.12, 0.022, 8, 32), cageMaterial);
      mesh.position.y = OPTICS_HEIGHT;
      mesh.rotation.x = Math.PI / 2;
      mesh.rotation.y = ring * Math.PI / 2;
      group.add(mesh);
    }
    const light = new THREE.PointLight(CYAN, 7, 6, 1.6);
    light.position.y = OPTICS_HEIGHT + 0.25;
    group.add(light);
    if (this.level.reflection) {
      const nozzle = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 10), new THREE.MeshStandardMaterial({ color: '#b9fbff', emissive: CYAN, emissiveIntensity: 1.5, roughness: 0.2 }));
      cone.rotation.x = Math.PI / 2;
      cone.position.z = 0.44;
      nozzle.add(cone);
      nozzle.position.y = OPTICS_HEIGHT;
      nozzle.rotation.y = SOURCE_ROT_Y[this.level.sourceDirection];
      group.add(nozzle);
      this.sourceNozzle = nozzle;
      group.add(this.createLabel(this.level.reflection.sourceRotatable ? '光塔 · 点击转向' : '光塔 · 方向固定', '#b9fbff', 2.95));
    } else {
      group.add(this.createLabel(`光塔 · 能量${this.level.sourceEnergy}`, '#b9fbff', 2.95));
    }
    this.levelGroup.add(group);
  }

  private createTarget(target: TargetConfig): void {
    const position = gridToWorld(this.level, target.at);
    const group = new THREE.Group();
    group.position.copy(position);
    this.addRoofBase(group, '#423a35');
    const material = new THREE.MeshStandardMaterial({ color: '#ffdda1', emissive: '#ffb856', emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.18 });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), material);
    core.position.y = OPTICS_HEIGHT;
    group.add(core);
    const ringMaterial = new THREE.MeshStandardMaterial({ color: '#ffdb9d', emissive: '#ffba55', emissiveIntensity: 0.7, metalness: 0.55, roughness: 0.25 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.027, 8, 40), ringMaterial);
    ring.position.y = OPTICS_HEIGHT;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const lowerRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 32), ringMaterial);
    lowerRing.position.y = 1.92;
    lowerRing.rotation.x = Math.PI / 2;
    group.add(lowerRing);
    const light = new THREE.PointLight(GOLD, 0.9, 5.5, 1.7);
    light.position.y = OPTICS_HEIGHT + 0.25;
    group.add(light);
    group.add(this.createLabel(`${target.id} · 需${target.required}`, '#ffdaa0', 3.02));
    this.levelGroup.add(group);
    this.targets.set(target.id, { material, ringMaterial, light });
  }

  private createSplitter(at: readonly [number, number], id: string): void {
    const root = new THREE.Group();
    root.position.copy(gridToWorld(this.level, at));
    this.addRoofBase(root, '#1c3a30');
    const material = new THREE.MeshStandardMaterial({ color: '#d6ffe9', emissive: MINT, emissiveIntensity: 1.3, roughness: 0.18, metalness: 0.3 });
    const prism = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.46, 3), material);
    prism.position.y = OPTICS_HEIGHT;
    prism.rotation.y = Math.PI / 6;
    root.add(prism);
    const ringMaterial = new THREE.MeshStandardMaterial({ color: '#9ff0c8', emissive: MINT, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.3 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 8, 36), ringMaterial);
    ring.position.y = 1.78;
    ring.rotation.x = Math.PI / 2;
    root.add(ring);
    const light = new THREE.PointLight(MINT, 3.2, 4.5, 1.7);
    light.position.y = OPTICS_HEIGHT + 0.2;
    root.add(light);
    root.add(this.createLabel(`分光器 ${id}`, '#c7ffe2', 3.05));
    this.levelGroup.add(root);
  }

  private createMirror(index: number, at: readonly [number, number], orientation: MirrorOrientation, id: string): void {
    const root = new THREE.Group();
    root.position.copy(gridToWorld(this.level, at));
    this.addRoofBase(root, '#173849');
    const rotor = new THREE.Group();
    rotor.rotation.y = orientation === '/' ? Math.PI / 4 : -Math.PI / 4;
    root.add(rotor);

    const frame = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.9, 0.09, 3, 0.06), new THREE.MeshStandardMaterial({
      color: '#315a6b', metalness: 0.85, roughness: 0.2, emissive: '#176477', emissiveIntensity: 0.35,
    }));
    frame.position.y = OPTICS_HEIGHT;
    rotor.add(frame);
    const panel = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.78, 0.035, 3, 0.04), new THREE.MeshPhysicalMaterial({
      color: '#c8f6ff', map: createMirrorTexture(), metalness: 0.68, roughness: 0.12,
      clearcoat: 1, clearcoatRoughness: 0.08, emissive: '#3da6b7', emissiveIntensity: 0.35,
    }));
    panel.position.set(0, OPTICS_HEIGHT, 0.055);
    rotor.add(panel);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.38, 10), new THREE.MeshStandardMaterial({ color: '#8ab6c2', metalness: 0.9, roughness: 0.2 }));
    stand.position.y = 1.92;
    root.add(stand);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.028, 8, 36), new THREE.MeshStandardMaterial({
      color: '#62c9d8', emissive: CYAN, emissiveIntensity: 0.65, transparent: true, opacity: 0.8,
    }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.78;
    root.add(ring);
    root.add(this.createLabel(`镜面 ${id}`, '#d4fbff', 3.05));

    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.69, 0.69, 1.75, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.position.y = 2.15;
    hit.userData.mirrorIndex = index;
    root.add(hit);
    this.hitMeshes.push(hit);
    this.mirrors.set(index, { rotor, ring, targetRotation: rotor.rotation.y });
    this.levelGroup.add(root);
  }

  private createObstacle(at: readonly [number, number]): void {
    const root = new THREE.Group();
    root.position.copy(gridToWorld(this.level, at));
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.91, 2.65, 0.91, 2, 0.06), new THREE.MeshStandardMaterial({ color: '#28303b', roughness: 0.55, metalness: 0.3 }));
    body.position.y = 1.49;
    body.castShadow = true;
    root.add(body);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.19, 0.94), new THREE.MeshStandardMaterial({ color: '#a06b39', emissive: '#c2682f', emissiveIntensity: 0.3, roughness: 0.4 }));
    band.position.y = OPTICS_HEIGHT;
    root.add(band);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.22, 8), new THREE.MeshStandardMaterial({ color: '#111c28', metalness: 0.7, roughness: 0.3 }));
    cap.position.y = 2.92;
    root.add(cap);
    const warning = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff8c5c' }));
    warning.position.y = 3.07;
    root.add(warning);
    this.levelGroup.add(root);
  }

  private addRoofBase(group: THREE.Group, color: string): void {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.4 });
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.55, 0.9, 2, 0.055), material);
    base.position.y = 0.94;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.01, 0.1, 1.01), new THREE.MeshStandardMaterial({ color: '#335165', metalness: 0.65, roughness: 0.28 }));
    rim.position.y = 1.74;
    group.add(rim);
  }

  private createLabel(text: string, color: string, y: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'rgba(4, 13, 25, .78)';
    context.beginPath();
    context.roundRect(16, 10, 224, 48, 20);
    context.fill();
    context.strokeStyle = color;
    context.globalAlpha = 0.35;
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = color;
    context.font = '24px "Microsoft YaHei", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 35);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false, depthWrite: false }));
    sprite.scale.set(1.5, 0.42, 1);
    sprite.position.y = y;
    sprite.renderOrder = 20;
    return sprite;
  }

  private bindPointerEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      this.pointerDown = true;
      this.dragged = false;
      this.pointerStart.set(event.clientX, event.clientY);
      canvas.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove', (event) => {
      if (this.pointerDown && this.pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 6) this.dragged = true;
      if (!this.pointerDown && this.interactive) this.updateHover(event);
    });
    canvas.addEventListener('pointerup', (event) => {
      canvas.classList.remove('is-dragging');
      if (this.pointerDown && !this.dragged && this.interactive) {
        if (this.level.reflection) {
          const cell = this.pickCell(event);
          if (cell) this.onCell(cell);
        } else {
          const index = this.pickMirror(event);
          if (index >= 0) this.onCell(this.level.mirrors[index].at);
        }
      }
      this.pointerDown = false;
      this.dragged = false;
    });
    canvas.addEventListener('pointercancel', () => {
      this.pointerDown = false;
      this.dragged = false;
      canvas.classList.remove('is-dragging');
    });
    canvas.addEventListener('pointerleave', () => {
      if (!this.pointerDown) this.setHovered(-1);
    });
  }

  private updateHover(event: PointerEvent): void {
    if (this.level.reflection) {
      this.setHovered(this.pickCell(event) ? 0 : -1);
      return;
    }
    this.setHovered(this.pickMirror(event));
  }

  private pickMirror(event: PointerEvent): number {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.hitMeshes, false)[0];
    const value = hit?.object.userData.mirrorIndex;
    return typeof value === 'number' ? value : -1;
  }

  private pickCell(event: PointerEvent): GridPoint | null {
    return this.pickCellAt(event.clientX, event.clientY);
  }

  pickCellAt(clientX: number, clientY: number): GridPoint | null {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((clientX - bounds.left) / bounds.width * 2 - 1, -(clientY - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Reflection 关卡：只用与 projectCellToScreen 同高度的平面拾取，保证“所见格=所点格”。
    // 器件拾取柱在斜视角下会与邻格射线相切，故不使用。
    if (this.level.reflection) {
      if (!this.groundPlane) return null;
      const planeHit = this.raycaster.intersectObject(this.groundPlane, false)[0];
      return planeHit ? this.worldToGrid(planeHit.point) : null;
    }
    const hit = this.raycaster.intersectObjects(this.hitMeshes, false)[0];
    const value = hit?.object.userData.mirrorIndex;
    return typeof value === 'number' ? (this.level.mirrors[value].at as GridPoint) : null;
  }

  private setHovered(index: number): void {
    if (this.hovered === index) return;
    this.hovered = index;
    this.renderer.domElement.classList.toggle('is-hovering', index >= 0);
  }

  private moveCamera(position: THREE.Vector3, target: THREE.Vector3, size: number, duration: number): void {
    this.controls.autoRotate = false;
    this.renderer.domElement.dataset.cameraMoving = String(duration > 0);
    if (duration === 0) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.viewSize = size;
      this.updateProjection();
      this.controls.update();
      this.cameraTween = undefined;
      this.controls.enabled = true;
      this.controls.autoRotate = this.screen !== 'level' && !this.reducedMotion;
      return;
    }
    this.cameraTween = {
      fromPosition: this.camera.position.clone(), toPosition: position,
      fromTarget: this.controls.target.clone(), toTarget: target,
      fromSize: this.viewSize, toSize: size, elapsed: 0, duration,
    };
    this.controls.enabled = false;
  }

  private cameraViewSize(desktop: number, mobile: number): number {
    return this.container.clientWidth / this.container.clientHeight < 0.85 ? mobile : desktop;
  }

  private resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.updateProjection();
  }

  private updateProjection(): void {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.left = -this.viewSize * aspect / 2;
    this.camera.right = this.viewSize * aspect / 2;
    this.camera.top = this.viewSize / 2;
    this.camera.bottom = -this.viewSize / 2;
    this.camera.updateProjectionMatrix();
  }

  private createRain(count: number): { lines: THREE.LineSegments; positions: Float32Array } {
    const positions = new Float32Array(count * 6);
    for (let index = 0; index < count; index += 1) {
      const x = (Math.random() - 0.5) * 36;
      const y = Math.random() * 19;
      const z = (Math.random() - 0.5) * 36;
      positions[index * 6] = x;
      positions[index * 6 + 1] = y;
      positions[index * 6 + 2] = z;
      positions[index * 6 + 3] = x - 0.07;
      positions[index * 6 + 4] = y - 0.34;
      positions[index * 6 + 5] = z + 0.025;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color: '#9ac8e5', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    lines.frustumCulled = false;
    return { lines, positions };
  }

  private animate(): void {
    const frameDelta = this.clock.getDelta();
    const delta = Math.min(frameDelta, 0.05);
    const elapsed = this.clock.elapsedTime;
    if (this.cameraTween) {
      const tween = this.cameraTween;
      tween.elapsed += frameDelta;
      const progress = Math.min(tween.elapsed / tween.duration, 1);
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      this.camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
      this.controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      this.viewSize = THREE.MathUtils.lerp(tween.fromSize, tween.toSize, eased);
      this.updateProjection();
      if (progress >= 1) {
        this.cameraTween = undefined;
        this.controls.enabled = true;
        this.controls.autoRotate = this.screen !== 'level' && !this.reducedMotion;
        this.renderer.domElement.dataset.cameraMoving = 'false';
      }
    }
    this.controls.update();

    this.mirrors.forEach((mirror, index) => {
      mirror.rotor.rotation.y = THREE.MathUtils.damp(mirror.rotor.rotation.y, mirror.targetRotation, 13, delta);
      const hovered = index === this.hovered && this.interactive;
      mirror.ring.material.emissiveIntensity = THREE.MathUtils.damp(mirror.ring.material.emissiveIntensity, hovered ? 3.2 : 0.65, 10, delta);
      mirror.ring.scale.setScalar(THREE.MathUtils.damp(mirror.ring.scale.x, hovered ? 1.16 : 1, 10, delta));
    });

    for (let index = 0; index < 4; index += 1) {
      this.lightLevels[index] = THREE.MathUtils.damp(this.lightLevels[index], this.lightTargets[index], 1.65, delta);
      const level = this.lightLevels[index];
      const district = this.city.districts[index];
      district.windowMaterial.emissiveIntensity = 0.015 + Math.max(0, level - 0.08) * 1.45;
      district.windowMaterial.color.copy(this.darkWindowColor).lerp(this.warmWindowColor, level);
      district.signMaterial.emissiveIntensity = 0.12 + level * 0.85;
      district.lampMaterial.emissiveIntensity = 0.025 + Math.max(0, level - 0.35) * 2.8;
      district.poolMaterial.opacity = Math.max(0, level - 0.25) * 0.4;
      district.light.intensity = 0.08 + level * 7.5;
    }

    if (!this.reducedMotion) this.updateRain(delta);
    this.pulses.forEach((pulse, index) => {
      const run = this.beamRuns[Number(pulse.userData.runIndex)];
      if (!run || !run.totalLength) return;
      let distance = (elapsed * 2.8 + Number(pulse.userData.offset) * run.totalLength) % run.totalLength;
      const segment = run.segments.find((item) => {
        if (distance <= item.length) return true;
        distance -= item.length;
        return false;
      }) ?? run.segments.at(-1)!;
      pulse.position.copy(segment.start).lerp(segment.end, THREE.MathUtils.clamp(distance / segment.length, 0, 1));
      pulse.scale.setScalar(0.85 + Math.sin(elapsed * 8 + index) * 0.18);
    });
    this.updateBurst(delta);
    this.composer.render();
  }

  private updateRain(delta: number): void {
    for (let index = 0; index < this.rainCount; index += 1) {
      const offset = index * 6;
      this.rainPositions[offset + 1] -= delta * 8.5;
      this.rainPositions[offset + 4] -= delta * 8.5;
      this.rainPositions[offset] -= delta * 0.5;
      this.rainPositions[offset + 3] -= delta * 0.5;
      if (this.rainPositions[offset + 1] < 0) {
        const y = 15 + Math.random() * 5;
        this.rainPositions[offset + 1] = y;
        this.rainPositions[offset + 4] = y - 0.34;
        this.rainPositions[offset] = (Math.random() - 0.5) * 36;
        this.rainPositions[offset + 3] = this.rainPositions[offset] - 0.07;
        this.rainPositions[offset + 2] = (Math.random() - 0.5) * 36;
        this.rainPositions[offset + 5] = this.rainPositions[offset + 2] + 0.025;
      }
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }

  private updateBurst(delta: number): void {
    if (!this.burst || this.burstLife <= 0) return;
    this.burstLife -= delta;
    const positions = this.burst.geometry.attributes.position as THREE.BufferAttribute;
    for (let index = 0; index < positions.count; index += 1) {
      const velocity = this.burstVelocities[index];
      velocity.y -= delta * 2.2;
      positions.setXYZ(index, positions.getX(index) + velocity.x * delta, positions.getY(index) + velocity.y * delta, positions.getZ(index) + velocity.z * delta);
    }
    positions.needsUpdate = true;
    (this.burst.material as THREE.PointsMaterial).opacity = Math.min(1, this.burstLife);
    if (this.burstLife <= 0) this.burst.visible = false;
  }

  private clearBeam(): void {
    this.beamGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
      if (object instanceof THREE.Sprite) object.material.dispose();
    });
    this.beamGroup.clear();
    this.beamRuns.length = 0;
    this.pulses.length = 0;
  }

  private clearLevel(): void {
    this.hitMeshes.length = 0;
    this.mirrors.clear();
    this.targets.clear();
    this.disposeGroup(this.pieceGroup);
    this.disposeGroup(this.zoneGroup);
    this.groundPlane = undefined;
    this.sourceNozzle = undefined;
    this.lastTrace = undefined;
    this.levelGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          const mapped = material as THREE.Material & { map?: THREE.Texture | null };
          mapped.map?.dispose();
          material.dispose();
        });
      }
    });
    this.levelGroup.clear();
    this.clearBeam();
  }
}

export function districtProgress(completed: readonly number[]): number[] {
  return DISTRICT_CENTERS.map((_, district) => {
    const ids = LEVELS.filter((level) => level.district === district).map((level) => level.id);
    const done = ids.filter((id) => completed.includes(id)).length;
    return ids.length ? done / ids.length : 0;
  });
}

function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,.8)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,.16)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function createMirrorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 128, 128, 0);
  gradient.addColorStop(0, '#4a879d');
  gradient.addColorStop(0.36, '#d9fbff');
  gradient.addColorStop(0.5, '#82c8d8');
  gradient.addColorStop(0.56, '#f2ffff');
  gradient.addColorStop(1, '#38778f');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  context.strokeStyle = 'rgba(255,255,255,.45)';
  context.lineWidth = 2;
  for (let line = -128; line < 256; line += 25) {
    context.beginPath();
    context.moveTo(line, 128);
    context.lineTo(line + 128, 0);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}