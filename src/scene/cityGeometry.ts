import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DISTRICT_CENTERS, GRID_SIZE, LEVELS, type GridPoint, type LevelConfig } from '../game/levels';
import {
  buildApartment, buildChimney, buildCivic, buildClockTower, buildCommercial, buildDomeHall, buildFence,
  buildFountain, buildGarden, buildQuaySign, buildSpireTower, buildStorageTanks, buildTree, buildWarehouse,
  buildWaterTower, createGlowTexture, windowGeometry, type BuildContext, type WindowSeed,
} from './cityBuildings';

export interface DistrictVisual {
  group: THREE.Group;
  windowMaterial: THREE.MeshStandardMaterial;
  signMaterial: THREE.MeshStandardMaterial;
  lampMaterial: THREE.MeshStandardMaterial;
  poolMaterial: THREE.MeshBasicMaterial;
  light: THREE.PointLight;
}

export interface DistrictLifeSeed {
  windows: WindowSeed[];
  silhouettes: THREE.Matrix4[];
  center: THREE.Vector3;
}

export interface CityVisual {
  group: THREE.Group;
  districts: DistrictVisual[];
  life: DistrictLifeSeed[];
  beacons: THREE.Mesh[];
  canalLampMaterials: THREE.MeshStandardMaterial[];
}

const bodyColors = ['#243b54', '#294259', '#30485e', '#20364e', '#354b60'];
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const postGeometry = new THREE.BoxGeometry(0.035, 0.34, 0.035);

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function gridToWorld(level: LevelConfig, [x, z]: GridPoint, y = 0): THREE.Vector3 {
  return new THREE.Vector3(
    level.districtCenter[0] + (x - 3) * GRID_SIZE,
    y,
    level.districtCenter[1] + (z - 3) * GRID_SIZE,
  );
}

export function createCity(): CityVisual {
  const group = new THREE.Group();
  group.name = 'Procedural night city';
  const bodyMaterials = bodyColors.map((color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.34,
    metalness: 0.36,
  }));
  const roofMaterial = new THREE.MeshStandardMaterial({ color: '#263e53', roughness: 0.4, metalness: 0.55 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: '#0c1b2a', roughness: 0.3, metalness: 0.72 });
  const pavement = new THREE.MeshStandardMaterial({ color: '#101e2e', roughness: 0.42, metalness: 0.22 });
  const concrete = new THREE.MeshStandardMaterial({ color: '#16283a', roughness: 0.62, metalness: 0.18 });
  const warningMaterial = new THREE.MeshStandardMaterial({ color: '#8f4a2c', emissive: '#c2682f', emissiveIntensity: 0.3, roughness: 0.45 });
  const foliageMaterial = new THREE.MeshStandardMaterial({ color: '#1c3527', roughness: 0.82, metalness: 0.05 });
  const timberMaterial = new THREE.MeshStandardMaterial({ color: '#33291f', roughness: 0.72, metalness: 0.08 });
  const roadMaterial = new THREE.MeshPhysicalMaterial({
    color: '#081521', roughness: 0.2, metalness: 0.46, clearcoat: 0.9, clearcoatRoughness: 0.18,
  });
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: '#0a1e30', roughness: 0.1, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.22,
  });

  const plinth = new THREE.Mesh(new RoundedBoxGeometry(23.2, 0.7, 23.2, 4, 0.35), new THREE.MeshStandardMaterial({
    color: '#081422', roughness: 0.38, metalness: 0.48,
  }));
  plinth.position.y = -0.4;
  plinth.receiveShadow = true;
  group.add(plinth);

  const ground = new THREE.Mesh(new THREE.BoxGeometry(22.6, 0.12, 22.6), roadMaterial);
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(22.5, 0.15, 22.5)),
    new THREE.LineBasicMaterial({ color: '#24435c', transparent: true, opacity: 0.5 }),
  );
  edge.position.y = 0.02;
  group.add(edge);

  const laneMaterial = new THREE.MeshBasicMaterial({ color: '#426079', transparent: true, opacity: 0.26 });
  for (let i = -9; i <= 9; i += 2) {
    if (Math.abs(i) < 2) continue;
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.045), laneMaterial);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(i, 0.056, 0);
    group.add(dash);
  }

  const canalLampMaterial = new THREE.MeshStandardMaterial({
    color: '#425268', emissive: '#ffd18c', emissiveIntensity: 0.03, roughness: 0.25,
  });
  addCanal(group, waterMaterial, concrete, darkMetal, timberMaterial, canalLampMaterial);
  addBridge(group, darkMetal, roofMaterial, canalLampMaterial);
  addSkyline(group);

  const canalLampMaterials: THREE.MeshStandardMaterial[] = [canalLampMaterial];
  const beacons: THREE.Mesh[] = [];
  const life: DistrictLifeSeed[] = [];
  const districts = DISTRICT_CENTERS.map((center, index) => {
    const levelsHere = LEVELS.filter((level) => !level.city && level.district === index);
    const occupied = new Set<string>();
    let size = 7;
    for (const level of levelsHere) {
      size = level.size;
      level.reflection.pieces.forEach((piece) => occupied.add(piece.at.join(',')));
      occupied.add(level.source.join(','));
    }
    const built = createDistrict(center, index, occupied, size, bodyMaterials, roofMaterial, darkMetal, pavement, warningMaterial, foliageMaterial);
    beacons.push(...built.beacons);
    life.push(built.seed);
    return built.visual;
  });
  districts.forEach((district) => group.add(district.group));
  addStreetFurniture(group, darkMetal);
  addPuddles(group);
  return { group, districts, life, beacons, canalLampMaterials };
}

type Theme = 'residential' | 'commercial' | 'industrial' | 'civic';
const THEMES: readonly Theme[] = ['residential', 'commercial', 'industrial', 'civic'];
const SIGN_COLORS = ['#ff9c78', '#42c7df', '#7fa6c4', '#ffbd67'];
const SIGN_COUNTS = [3, 6, 2, 4];

function createDistrict(
  centerPoint: GridPoint,
  index: number,
  occupied: Set<string>,
  size: number,
  bodies: THREE.MeshStandardMaterial[],
  roofMaterial: THREE.MeshStandardMaterial,
  darkMetal: THREE.MeshStandardMaterial,
  pavement: THREE.MeshStandardMaterial,
  warning: THREE.MeshStandardMaterial,
  foliage: THREE.MeshStandardMaterial,
): { visual: DistrictVisual; seed: DistrictLifeSeed; beacons: THREE.Mesh[] } {
  const random = seededRandom(8731 + index * 971);
  const theme = THEMES[index];
  const group = new THREE.Group();
  group.name = `District ${index + 1} · ${theme}`;
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: '#294056', emissive: '#ffbd67', emissiveIntensity: 0.015, roughness: 0.45, metalness: 0.05,
  });
  const signMaterial = new THREE.MeshStandardMaterial({
    color: '#244252', emissive: SIGN_COLORS[index], emissiveIntensity: 0.12, roughness: 0.32,
  });
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: '#425268', emissive: '#ffd18c', emissiveIntensity: 0.025, roughness: 0.25,
  });
  const poolMaterial = new THREE.MeshBasicMaterial({
    color: '#ffc679', map: createGlowTexture(), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const center = new THREE.Vector3(centerPoint[0], 0, centerPoint[1]);
  const light = new THREE.PointLight('#ffbd72', 0.08, 10, 1.8);
  light.position.copy(center).add(new THREE.Vector3(0, 3.5, 0));
  group.add(light);

  const plaza = new THREE.Mesh(new RoundedBoxGeometry(8.35, 0.18, 8.35, 2, 0.14), pavement);
  plaza.position.copy(center).setY(0.08);
  plaza.receiveShadow = true;
  group.add(plaza);

  const windows: WindowSeed[] = [];
  const silhouettes: THREE.Matrix4[] = [];
  const beacons: THREE.Mesh[] = [];
  const ctx: BuildContext = { group, windows, silhouettes, beacons, random, bodies, roof: roofMaterial, metal: darkMetal, sign: signMaterial, warning, foliage };
  const toWorld = ([x, z]: GridPoint) => new THREE.Vector3(centerPoint[0] + (x - 3) * GRID_SIZE, 0, centerPoint[1] + (z - 3) * GRID_SIZE);
  const outerDirection = index === 0 ? [-1, -1] : index === 1 ? [1, -1] : index === 2 ? [-1, 1] : [1, 1];
  const quayFacing = (index === 1 || index === 3) ? -Math.PI / 2 : Math.PI / 2;
  let fountainPlaced = false;
  let domePlaced = false;

  for (let x = 0; x < size; x += 1) {
    for (let z = 0; z < size; z += 1) {
      if (occupied.has(`${x},${z}`)) continue;
      const position = toWorld([x, z]);
      const riverside = (index === 0 || index === 2) ? x === size - 1 : x === 0;
      const roll = random();
      if (riverside) {
        placeRiverside(ctx, theme, position, roll, quayFacing, random);
        continue;
      }
      switch (theme) {
        case 'residential':
          if (roll < 0.1) buildGarden(ctx, position);
          else if (roll < 0.15) buildFence(ctx, position, random() < 0.5 ? 'x' : 'z');
          else if (roll < 0.21) buildTree(ctx, position);
          else if (roll < 0.26) continue;
          else buildApartment(ctx, position, 0.66 + random() * 0.24, 0.66 + random() * 0.2, 0.65 + random() * 0.9);
          break;
        case 'commercial':
          if (roll < 0.2) continue;
          else if (roll < 0.25) buildTree(ctx, position);
          else buildCommercial(ctx, position, 0.68 + random() * 0.26, 0.68 + random() * 0.22, 0.85 + random() * 1.1);
          break;
        case 'industrial':
          if (roll < 0.14) continue;
          else if (roll < 0.24) buildFence(ctx, position, random() < 0.5 ? 'x' : 'z');
          else if (roll < 0.33) buildStorageTanks(ctx, position);
          else buildWarehouse(ctx, position, 0.8 + random() * 0.16, 0.74 + random() * 0.2, 0.45 + random() * 0.4);
          break;
        case 'civic':
          if (!domePlaced && roll < 0.06) { domePlaced = true; buildDomeHall(ctx, position); }
          else if (roll < 0.12) continue;
          else if (roll < 0.24) buildTree(ctx, position);
          else if (roll < 0.3) buildGarden(ctx, position);
          else if (!fountainPlaced && roll < 0.35) { fountainPlaced = true; buildFountain(ctx, position); }
          else if (roll < 0.6) buildCivic(ctx, position, 0.84 + random() * 0.2, 0.8 + random() * 0.16, 0.5 + random() * 0.35);
          else buildApartment(ctx, position, 0.66 + random() * 0.2, 0.66 + random() * 0.18, 0.6 + random() * 0.6);
          break;
      }
    }
  }

  for (let slot = 0; slot < 5; slot += 1) {
    const along = (slot - 2) * 1.6;
    const position = center.clone();
    if (slot % 2 === 0) {
      position.x += along;
      position.z += outerDirection[1] * 4.7;
    } else {
      position.x += outerDirection[0] * 4.7;
      position.z += along;
    }
    switch (theme) {
      case 'residential': {
        const height = 2.2 + random() * 1.1;
        buildApartment(ctx, position, 1.05 + random() * 0.3, 1.05 + random() * 0.28, height);
        if (random() < 0.55) addAntenna(ctx, position, height + 0.5);
        break;
      }
      case 'commercial':
        if (slot === 2) buildSpireTower(ctx, position, 4.9 + random() * 0.9);
        else buildCommercial(ctx, position, 1.0 + random() * 0.35, 1.0 + random() * 0.3, 2.5 + random() * 2.0);
        break;
      case 'industrial':
        if (slot % 2 === 0) buildWaterTower(ctx, position);
        else buildChimney(ctx, position, 2.5 + random() * 1.7);
        break;
      case 'civic':
        if (slot === 1) buildClockTower(ctx, position, 3.7 + random() * 0.7);
        else if (slot % 2 === 0) buildCivic(ctx, position, 1.5 + random() * 0.4, 1.1 + random() * 0.3, 0.7 + random() * 0.4);
        else if (slot === 3) buildTree(ctx, position);
        else buildWarehouse(ctx, position, 1.2, 1.0, 0.6 + random() * 0.25);
        break;
    }
  }

  const windowInstances = new THREE.InstancedMesh(windowGeometry, windowMaterial, Math.max(1, windows.length));
  windows.forEach((item, instance) => windowInstances.setMatrixAt(instance, item.matrix));
  if (!windows.length) windowInstances.setMatrixAt(0, new THREE.Matrix4().makeScale(0, 0, 0));
  windowInstances.instanceMatrix.needsUpdate = true;
  windowInstances.frustumCulled = false;
  group.add(windowInstances);

  for (let lamp = 0; lamp < 4; lamp += 1) {
    const angle = lamp * Math.PI / 2 + Math.PI / 4;
    const position = center.clone().add(new THREE.Vector3(Math.cos(angle) * 4.05, 0, Math.sin(angle) * 4.05));
    addLamp(group, position, darkMetal, lampMaterial);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), poolMaterial);
    pool.rotation.x = -Math.PI / 2;
    pool.position.copy(position).setY(0.13);
    group.add(pool);
  }

  const signCount = SIGN_COUNTS[index];
  for (let sign = 0; sign < signCount; sign += 1) {
    const spread = theme === 'commercial' ? 1.25 : 1.7;
    const heightScale = theme === 'commercial' ? 1.5 : 1;
    const position = center.clone().add(new THREE.Vector3((sign - (signCount - 1) / 2) * spread, 0.5 + random(), outerDirection[1] * 3.8));
    const panel = new THREE.Mesh(new RoundedBoxGeometry(0.7 * heightScale, 0.22 * heightScale, 0.04, 2, 0.03), signMaterial);
    panel.position.copy(position);
    panel.rotation.y = outerDirection[1] > 0 ? 0 : Math.PI;
    group.add(panel);
  }

  return {
    visual: { group, windowMaterial, signMaterial, lampMaterial, poolMaterial, light },
    seed: { windows, silhouettes, center: center.clone() },
    beacons,
  };
}

function placeRiverside(
  ctx: BuildContext,
  theme: Theme,
  position: THREE.Vector3,
  roll: number,
  quayFacing: number,
  random: () => number,
): void {
  switch (theme) {
    case 'residential':
      if (roll < 0.4) return;
      if (roll < 0.68) buildTree(ctx, position);
      else buildApartment(ctx, position, 0.64 + random() * 0.18, 0.64 + random() * 0.16, 0.6 + random() * 0.4);
      break;
    case 'commercial':
      if (roll < 0.32) return;
      if (roll < 0.66) buildQuaySign(ctx, position, quayFacing);
      else buildCommercial(ctx, position, 0.66 + random() * 0.2, 0.66 + random() * 0.18, 0.75 + random() * 0.35);
      break;
    case 'industrial':
      if (roll < 0.36) return;
      if (roll < 0.6) buildFence(ctx, position, 'z');
      else buildWarehouse(ctx, position, 0.8 + random() * 0.14, 0.72 + random() * 0.16, 0.42 + random() * 0.34);
      break;
    case 'civic':
      if (roll < 0.42) return;
      if (roll < 0.8) buildTree(ctx, position);
      else buildCivic(ctx, position, 0.8, 0.75, 0.5 + random() * 0.2);
      break;
  }
}

function addAntenna(ctx: BuildContext, position: THREE.Vector3, topY: number): void {
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.032, 0.7, 8), ctx.metal);
  mast.position.copy(position).setY(topY + 0.35);
  ctx.group.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff8c5c', toneMapped: false }));
  beacon.position.copy(position).setY(topY + 0.74);
  ctx.group.add(beacon);
  ctx.beacons.push(beacon);
}

function addLamp(group: THREE.Group, position: THREE.Vector3, metal: THREE.Material, glow: THREE.Material): void {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 1.05, 8), metal);
  pole.position.copy(position).setY(0.65);
  group.add(pole);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.15, 8), glow);
  cap.position.copy(position).setY(1.22);
  group.add(cap);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.12, 8), metal);
  roof.position.copy(position).setY(1.35);
  group.add(roof);
}

function addCanal(
  group: THREE.Group,
  waterMaterial: THREE.Material,
  concrete: THREE.Material,
  metal: THREE.Material,
  timber: THREE.Material,
  lampMaterial: THREE.Material,
): void {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 21.4), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.05;
  water.receiveShadow = true;
  group.add(water);

  for (const side of [-1, 1]) {
    const quay = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 21.4), concrete);
    quay.position.set(side * 0.82, 0.08, 0);
    quay.receiveShadow = true;
    group.add(quay);
  }

  const railSegments: [number, number, number][] = [
    [-10.6, -2.3, -1], [-10.6, -2.3, 1], [2.3, 10.6, -1], [2.3, 5.25, 1], [6.55, 10.6, 1],
  ];
  for (const [from, to, side] of railSegments) {
    const length = to - from;
    const midZ = (from + to) / 2;
    for (const y of [0.3, 0.42]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, length), metal);
      rail.position.set(side * 0.9, y, midZ);
      group.add(rail);
    }
    const posts = Math.max(2, Math.round(length / 0.85));
    const instanced = new THREE.InstancedMesh(postGeometry, metal, posts);
    const matrix = new THREE.Matrix4();
    for (let post = 0; post < posts; post += 1) {
      matrix.setPosition(side * 0.9, 0.33, from + (length * post) / (posts - 1));
      instanced.setMatrixAt(post, matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    group.add(instanced);
  }

  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.72), timber);
  pierDeck.position.set(0.25, 0.21, 5.9);
  pierDeck.castShadow = true;
  pierDeck.receiveShadow = true;
  group.add(pierDeck);
  for (const [dx, dz] of [[-0.72, -0.28], [-0.72, 0.28], [0.72, -0.28], [0.72, 0.28]]) {
    const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.4, 8), timber);
    pile.position.set(0.25 + dx, 0.05, 5.9 + dz);
    group.add(pile);
  }
  const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.24, 8), metal);
  bollard.position.set(-0.42, 0.36, 5.62);
  group.add(bollard);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.26), timber);
  crate.position.set(0.5, 0.35, 6.08);
  crate.rotation.y = 0.4;
  crate.castShadow = true;
  group.add(crate);

  for (const [x, z] of [[-0.98, -3.4], [0.98, -3.4], [-0.98, 3.4], [0.98, 8.4], [-0.5, 5.62]] as const) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.032, 0.62, 8), metal);
    pole.position.set(x, 0.47, z);
    group.add(pole);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), lampMaterial);
    cap.position.set(x, 0.82, z);
    group.add(cap);
  }
}

function addBridge(group: THREE.Group, metal: THREE.Material, pavement: THREE.Material, lampMaterial: THREE.Material): void {
  const deck = new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.18, 1.25, 2, 0.08), pavement);
  deck.position.set(0, 0.42, 0);
  deck.castShadow = true;
  group.add(deck);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.055, 8, 20, Math.PI), metal);
  arch.position.set(0, 0.05, 0);
  arch.scale.set(1, 0.38, 0.9);
  group.add(arch);
  for (const x of [-1.42, 1.42]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.42, 8), metal);
    pole.position.set(x, 0.72, 0);
    group.add(pole);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), lampMaterial);
    cap.position.set(x, 0.97, 0);
    group.add(cap);
  }
  for (const z of [-0.58, 0.58]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.045, 0.045), metal);
    rail.position.set(0, 0.9, z);
    group.add(rail);
    for (let x = -1.45; x <= 1.45; x += 0.48) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.48, 0.035), metal);
      post.position.set(x, 0.67, z);
      group.add(post);
    }
  }
}

function addSkyline(group: THREE.Group): void {
  const random = seededRandom(7717);
  const material = new THREE.MeshStandardMaterial({ color: '#0d1e30', roughness: 0.5, metalness: 0.35 });
  const antennaMaterial = new THREE.MeshStandardMaterial({ color: '#0a1624', roughness: 0.4, metalness: 0.6 });
  for (const edge of [0, 1, 2, 3]) {
    let t = -10.3;
    while (t <= 10.3) {
      const width = 0.7 + random() * 0.65;
      const step = width + 0.25 + random() * 0.6;
      if (Math.abs(t) > 1.5) {
        const height = 0.6 + random() * 2.1;
        const block = new THREE.Mesh(unitBox, material);
        block.scale.set(width, height, 0.7 + random() * 0.5);
        if (edge === 0) block.position.set(t, height / 2, -10.55);
        else if (edge === 1) block.position.set(t, height / 2, 10.55);
        else if (edge === 2) block.position.set(-10.55, height / 2, t);
        else block.position.set(10.55, height / 2, t);
        if (edge >= 2) block.rotation.y = Math.PI / 2;
        group.add(block);
        if (height > 2.0 && random() < 0.5) {
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.5, 6), antennaMaterial);
          mast.position.copy(block.position).setY(height + 0.25);
          group.add(mast);
        }
      }
      t += step;
    }
  }
}

function addStreetFurniture(group: THREE.Group, metal: THREE.Material): void {
  const crosswalkMaterial = new THREE.MeshBasicMaterial({ color: '#7890a3', transparent: true, opacity: 0.18 });
  for (const crossing of [[-2.1, 0], [2.1, 0]] as const) {
    for (let stripe = -2; stripe <= 2; stripe += 1) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.72), crosswalkMaterial);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(crossing[0], 0.06, crossing[1] + stripe * 0.3);
      group.add(mesh);
    }
  }
  for (const [x, z] of [[-1.6, -1.5], [1.6, 1.5], [-1.6, 1.5], [1.6, -1.5]]) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.42, 8), metal);
    bollard.position.set(x, 0.25, z);
    group.add(bollard);
  }
}

function addPuddles(group: THREE.Group): void {
  const random = seededRandom(4902);
  const material = new THREE.MeshPhysicalMaterial({
    color: '#17344d', transparent: true, opacity: 0.42, roughness: 0.08, metalness: 0.5,
    clearcoat: 1, depthWrite: false,
  });
  for (let i = 0; i < 26; i += 1) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.25 + random() * 0.55, 18), material);
    puddle.scale.x = 0.4 + random() * 1.3;
    puddle.rotation.x = -Math.PI / 2;
    puddle.rotation.z = random() * Math.PI;
    const alongRoad = random() > 0.35;
    const x = alongRoad ? (random() - 0.5) * 20 : (random() - 0.5) * 18;
    const z = alongRoad ? (random() - 0.5) * 1.5 : (random() - 0.5) * 18;
    if (Math.abs(x) < 1.1) continue;
    puddle.position.set(x, 0.065, z);
    group.add(puddle);
  }
}
