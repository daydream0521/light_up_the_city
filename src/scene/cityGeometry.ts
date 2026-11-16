import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GRID_SIZE, LEVELS, type GridPoint, type LevelConfig } from '../game/levels';

export interface DistrictVisual {
  group: THREE.Group;
  windowMaterial: THREE.MeshStandardMaterial;
  signMaterial: THREE.MeshStandardMaterial;
  lampMaterial: THREE.MeshStandardMaterial;
  poolMaterial: THREE.MeshBasicMaterial;
  light: THREE.PointLight;
}

export interface CityVisual {
  group: THREE.Group;
  districts: DistrictVisual[];
}

const bodyColors = ['#243b54', '#294259', '#30485e', '#20364e', '#354b60'];
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const windowGeometry = new THREE.BoxGeometry(0.18, 0.23, 0.025);
const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3(1, 1, 1);
const yAxis = new THREE.Vector3(0, 1, 0);

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
  const roadMaterial = new THREE.MeshPhysicalMaterial({
    color: '#081521', roughness: 0.2, metalness: 0.46, clearcoat: 0.9, clearcoatRoughness: 0.18,
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
    const dashA = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.7), laneMaterial);
    dashA.rotation.x = -Math.PI / 2;
    dashA.position.set(0, 0.055, i);
    group.add(dashA);
    const dashB = dashA.clone();
    dashB.rotation.z = Math.PI / 2;
    dashB.position.set(i, 0.056, 0);
    group.add(dashB);
  }

  const districts = LEVELS.map((level, index) => createDistrict(level, index, bodyMaterials, roofMaterial, darkMetal, pavement));
  districts.forEach((district) => group.add(district.group));
  addBridge(group, darkMetal, roofMaterial);
  addStreetFurniture(group, darkMetal);
  addPuddles(group);
  return { group, districts };
}

function createDistrict(
  level: LevelConfig,
  index: number,
  bodyMaterials: THREE.MeshStandardMaterial[],
  roofMaterial: THREE.MeshStandardMaterial,
  darkMetal: THREE.MeshStandardMaterial,
  pavement: THREE.MeshStandardMaterial,
): DistrictVisual {
  const random = seededRandom(8731 + index * 971);
  const group = new THREE.Group();
  group.name = `District ${index + 1}`;
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: '#294056', emissive: '#ffbd67', emissiveIntensity: 0.015, roughness: 0.45, metalness: 0.05,
  });
  const signMaterial = new THREE.MeshStandardMaterial({
    color: '#244252', emissive: index % 2 ? '#42c7df' : '#ff9c78', emissiveIntensity: 0.12, roughness: 0.32,
  });
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: '#425268', emissive: '#ffd18c', emissiveIntensity: 0.025, roughness: 0.25,
  });
  const poolMaterial = new THREE.MeshBasicMaterial({
    color: '#ffc679', map: createGlowTexture(), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const center = new THREE.Vector3(level.districtCenter[0], 0, level.districtCenter[1]);
  const light = new THREE.PointLight('#ffbd72', 0.08, 10, 1.8);
  light.position.copy(center).add(new THREE.Vector3(0, 3.5, 0));
  group.add(light);

  const plaza = new THREE.Mesh(new RoundedBoxGeometry(8.35, 0.18, 8.35, 2, 0.14), pavement);
  plaza.position.copy(center).setY(0.08);
  plaza.receiveShadow = true;
  group.add(plaza);

  const occupied = new Set<string>([
    ...level.mirrors.map((mirror) => mirror.at.join(',')),
    ...level.obstacles.map((point) => point.join(',')),
    level.source.join(','), level.target.join(','),
  ]);
  const windows: THREE.Matrix4[] = [];

  for (let x = 0; x < level.size; x += 1) {
    for (let z = 0; z < level.size; z += 1) {
      if (occupied.has(`${x},${z}`) || random() < 0.2) continue;
      const position = gridToWorld(level, [x, z]);
      const width = 0.72 + random() * 0.2;
      const depth = 0.72 + random() * 0.2;
      const height = 0.72 + random() * 1.05;
      addBuilding(group, windows, position, width, depth, height, bodyMaterials[Math.floor(random() * bodyMaterials.length)], roofMaterial, darkMetal, random);
    }
  }

  const outerDirection = index === 0 ? [-1, -1] : index === 1 ? [1, -1] : index === 2 ? [-1, 1] : [1, 1];
  for (let tower = 0; tower < 5; tower += 1) {
    const along = (tower - 2) * 1.5;
    const position = center.clone();
    if (tower % 2 === 0) {
      position.x += along;
      position.z += outerDirection[1] * 4.7;
    } else {
      position.x += outerDirection[0] * 4.7;
      position.z += along;
    }
    const height = 2.3 + random() * 2.7;
    addBuilding(group, windows, position, 1.05 + random() * 0.35, 1.05 + random() * 0.35, height, bodyMaterials[Math.floor(random() * bodyMaterials.length)], roofMaterial, darkMetal, random);
    if (tower % 2 === 0) addRoofAntenna(group, position, height, darkMetal, signMaterial);
  }

  const windowInstances = new THREE.InstancedMesh(windowGeometry, windowMaterial, windows.length);
  windows.forEach((item, instance) => windowInstances.setMatrixAt(instance, item));
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

  for (let sign = 0; sign < 4; sign += 1) {
    const position = center.clone().add(new THREE.Vector3((sign - 1.5) * 1.7, 0.5 + random(), outerDirection[1] * 3.8));
    const panel = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.22, 0.04, 2, 0.03), signMaterial);
    panel.position.copy(position);
    panel.rotation.y = outerDirection[1] > 0 ? 0 : Math.PI;
    group.add(panel);
  }

  return { group, windowMaterial, signMaterial, lampMaterial, poolMaterial, light };
}

function addBuilding(
  group: THREE.Group,
  windows: THREE.Matrix4[],
  position: THREE.Vector3,
  width: number,
  depth: number,
  height: number,
  bodyMaterial: THREE.MeshStandardMaterial,
  roofMaterial: THREE.MeshStandardMaterial,
  darkMetal: THREE.MeshStandardMaterial,
  random: () => number,
): void {
  const body = new THREE.Mesh(unitBox, bodyMaterial);
  body.scale.set(width, height, depth);
  body.position.copy(position).setY(height / 2 + 0.15);
  body.castShadow = height > 1.5;
  body.receiveShadow = true;
  group.add(body);

  const rim = new THREE.Mesh(unitBox, roofMaterial);
  rim.scale.set(width + 0.09, 0.08, depth + 0.09);
  rim.position.copy(position).setY(height + 0.18);
  group.add(rim);

  if (height > 1.45 && random() > 0.42) {
    const upper = new THREE.Mesh(unitBox, bodyMaterial);
    upper.scale.set(width * 0.62, 0.22, depth * 0.62);
    upper.position.copy(position).setY(height + 0.32);
    group.add(upper);
  } else if (random() > 0.5) {
    const unit = new THREE.Mesh(unitBox, darkMetal);
    unit.scale.set(0.28, 0.15, 0.25);
    unit.position.copy(position).add(new THREE.Vector3(0.12, height + 0.3, -0.08));
    group.add(unit);
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 12), roofMaterial);
    vent.position.copy(unit.position).setY(unit.position.y + 0.09);
    group.add(vent);
  }

  const floors = Math.max(1, Math.floor(height / 0.38));
  for (let floor = 0; floor < floors; floor += 1) {
    const y = 0.38 + floor * 0.37;
    for (let column = 0; column < 2; column += 1) {
      if (random() < 0.18) continue;
      const offset = (column - 0.5) * width * 0.42;
      for (const side of [-1, 1]) {
        quaternion.setFromAxisAngle(yAxis, side > 0 ? 0 : Math.PI);
        matrix.compose(new THREE.Vector3(position.x + offset, y, position.z + side * (depth / 2 + 0.014)), quaternion, scale);
        windows.push(matrix.clone());
        quaternion.setFromAxisAngle(yAxis, side > 0 ? Math.PI / 2 : -Math.PI / 2);
        matrix.compose(new THREE.Vector3(position.x + side * (width / 2 + 0.014), y, position.z + offset * depth / width), quaternion, scale);
        windows.push(matrix.clone());
      }
    }
  }
}

function addRoofAntenna(group: THREE.Group, position: THREE.Vector3, height: number, metal: THREE.Material, glow: THREE.Material): void {
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.8, 8), metal);
  mast.position.copy(position).setY(height + 0.62);
  group.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), glow);
  beacon.position.copy(position).setY(height + 1.04);
  group.add(beacon);
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

function addBridge(group: THREE.Group, metal: THREE.Material, pavement: THREE.Material): void {
  const deck = new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.18, 1.25, 2, 0.08), pavement);
  deck.position.set(0, 0.42, 0);
  deck.castShadow = true;
  group.add(deck);
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

function addStreetFurniture(group: THREE.Group, metal: THREE.Material): void {
  const crosswalkMaterial = new THREE.MeshBasicMaterial({ color: '#7890a3', transparent: true, opacity: 0.18 });
  for (const crossing of [[0, -2.1], [0, 2.1], [-2.1, 0], [2.1, 0]] as const) {
    for (let stripe = -2; stripe <= 2; stripe += 1) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.72), crosswalkMaterial);
      mesh.rotation.x = -Math.PI / 2;
      const horizontal = crossing[0] !== 0;
      mesh.rotation.z = horizontal ? Math.PI / 2 : 0;
      mesh.position.set(crossing[0] + (horizontal ? 0 : stripe * 0.3), 0.06, crossing[1] + (horizontal ? stripe * 0.3 : 0));
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
  for (let i = 0; i < 28; i += 1) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.25 + random() * 0.55, 18), material);
    puddle.scale.x = 0.4 + random() * 1.3;
    puddle.rotation.x = -Math.PI / 2;
    puddle.rotation.z = random() * Math.PI;
    const onVerticalRoad = random() > 0.5;
    puddle.position.set(onVerticalRoad ? (random() - 0.5) * 1.7 : (random() - 0.5) * 20, 0.065, onVerticalRoad ? (random() - 0.5) * 20 : (random() - 0.5) * 1.7);
    group.add(puddle);
  }
}

function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,.8)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,.25)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
