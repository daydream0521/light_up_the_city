import * as THREE from 'three';

export interface WindowSeed {
  matrix: THREE.Matrix4;
  threshold: number;
}

export interface BuildContext {
  group: THREE.Group;
  windows: WindowSeed[];
  silhouettes: THREE.Matrix4[];
  beacons: THREE.Mesh[];
  random: () => number;
  bodies: THREE.MeshStandardMaterial[];
  roof: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  sign: THREE.MeshStandardMaterial;
  warning: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
}

export const windowGeometry = new THREE.BoxGeometry(0.18, 0.23, 0.025);

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const prismGeometry = new THREE.CylinderGeometry(0.577, 0.577, 1, 3, 1);
const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const taperGeometry = new THREE.CylinderGeometry(0.34, 0.5, 1, 10);
const coneGeometry = new THREE.ConeGeometry(0.5, 1, 10);
const sphereGeometry = new THREE.SphereGeometry(0.5, 12, 10);
const circleGeometry = new THREE.CircleGeometry(0.5, 20);
const planeGeometry = new THREE.PlaneGeometry(1, 1);

const quaternion = new THREE.Quaternion();
const yAxis = new THREE.Vector3(0, 1, 0);
const unitScale = new THREE.Vector3(1, 1, 1);

export function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,.85)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,.24)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function part(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rotY = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  if (rotY !== 0) mesh.rotation.y = rotY;
  mesh.castShadow = sy > 1.4;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function pickBody(ctx: BuildContext): THREE.MeshStandardMaterial {
  return ctx.bodies[Math.floor(ctx.random() * ctx.bodies.length)];
}

function pushWindow(ctx: BuildContext, x: number, y: number, z: number, rotY: number, collectSilhouette: boolean): void {
  quaternion.setFromAxisAngle(yAxis, rotY);
  const position = new THREE.Vector3(x, y, z);
  ctx.windows.push({
    matrix: new THREE.Matrix4().compose(position, quaternion.clone(), unitScale.clone()),
    threshold: 0.05 + ctx.random() ** 1.5 * 0.9,
  });
  if (collectSilhouette && ctx.random() < 0.075) {
    const outward = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY)).multiplyScalar(0.02);
    ctx.silhouettes.push(new THREE.Matrix4().compose(position.clone().add(outward), quaternion.clone(), unitScale.clone()));
  }
}

export function addWindowGrid(
  ctx: BuildContext,
  position: THREE.Vector3,
  width: number,
  depth: number,
  height: number,
  baseY = 0.15,
  options: { sparse?: boolean; silhouettes?: boolean } = {},
): void {
  const floors = Math.max(1, Math.floor(height / 0.38));
  const columns = width > 1.05 ? 3 : 2;
  for (let floor = 0; floor < floors; floor += 1) {
    const y = baseY + 0.23 + floor * 0.37;
    for (let column = 0; column < columns; column += 1) {
      if (ctx.random() < (options.sparse ? 0.55 : 0.18)) continue;
      const offset = (column - (columns - 1) / 2) * width * (columns > 2 ? 0.3 : 0.42);
      for (const side of [-1, 1]) {
        pushWindow(ctx, position.x + offset, y, position.z + side * (depth / 2 + 0.014), side > 0 ? 0 : Math.PI, Boolean(options.silhouettes));
        pushWindow(ctx, position.x + side * (width / 2 + 0.014), y, position.z + offset * depth / width, side > 0 ? Math.PI / 2 : -Math.PI / 2, Boolean(options.silhouettes));
      }
    }
  }
}

export function addGableRoof(
  group: THREE.Group,
  position: THREE.Vector3,
  topY: number,
  length: number,
  width: number,
  rise: number,
  material: THREE.Material,
  ridgeAlongX = true,
): void {
  const scaleY = rise / 0.866;
  const mesh = new THREE.Mesh(prismGeometry, material);
  mesh.scale.set(ridgeAlongX ? length : width, scaleY, ridgeAlongX ? width : length);
  mesh.rotation.z = Math.PI / 2;
  if (!ridgeAlongX) mesh.rotation.y = Math.PI / 2;
  mesh.position.set(position.x, topY + 0.2887 * scaleY, position.z);
  mesh.castShadow = true;
  group.add(mesh);
}

function addBeacon(ctx: BuildContext, x: number, y: number, z: number, material: THREE.MeshBasicMaterial): void {
  const beacon = new THREE.Mesh(sphereGeometry, material);
  beacon.position.set(x, y, z);
  beacon.scale.setScalar(0.11);
  ctx.group.add(beacon);
  ctx.beacons.push(beacon);
}

export function buildApartment(ctx: BuildContext, position: THREE.Vector3, width: number, depth: number, height: number): void {
  const body = pickBody(ctx);
  part(ctx.group, unitBox, body, position.x, height / 2 + 0.15, position.z, width, height, depth);
  part(ctx.group, unitBox, ctx.roof, position.x, height + 0.19, position.z, width + 0.08, 0.07, depth + 0.08);
  if (height > 1.1 && ctx.random() < 0.55) {
    addGableRoof(ctx.group, position, height + 0.22, width + 0.1, depth + 0.1, 0.24 + ctx.random() * 0.14, ctx.roof, width >= depth);
  } else if (ctx.random() < 0.5) {
    const tankX = position.x + (ctx.random() - 0.5) * width * 0.4;
    const tankZ = position.z + (ctx.random() - 0.5) * depth * 0.4;
    part(ctx.group, cylinderGeometry, ctx.metal, tankX - 0.09, height + 0.3, tankZ, 0.035, 0.14, 0.035);
    part(ctx.group, cylinderGeometry, ctx.metal, tankX + 0.09, height + 0.3, tankZ, 0.035, 0.14, 0.035);
    part(ctx.group, cylinderGeometry, ctx.roof, tankX, height + 0.5, tankZ, 0.3, 0.26, 0.3);
    part(ctx.group, coneGeometry, ctx.roof, tankX, height + 0.7, tankZ, 0.34, 0.16, 0.34);
  } else {
    part(ctx.group, unitBox, ctx.metal, position.x + width * 0.2, height + 0.3, position.z - depth * 0.15, 0.26, 0.14, 0.24);
  }
  addWindowGrid(ctx, position, width, depth, height, 0.15, { silhouettes: true });
}

export function buildCommercial(ctx: BuildContext, position: THREE.Vector3, width: number, depth: number, height: number): void {
  const body = pickBody(ctx);
  const tiers = height > 1.5 ? 2 + Math.floor(ctx.random() * 2) : 1;
  let tierHeight = height / tiers;
  let tierWidth = width;
  let tierDepth = depth;
  let baseY = 0.15;
  for (let tier = 0; tier < tiers; tier += 1) {
    part(ctx.group, unitBox, body, position.x, baseY + tierHeight / 2, position.z, tierWidth, tierHeight, tierDepth);
    addWindowGrid(ctx, position, tierWidth, tierDepth, tierHeight, baseY, { sparse: tier > 0 });
    part(ctx.group, unitBox, ctx.roof, position.x, baseY + tierHeight + 0.03, position.z, tierWidth + 0.07, 0.06, tierDepth + 0.07);
    baseY += tierHeight;
    tierWidth *= 0.74;
    tierDepth *= 0.74;
    tierHeight = (height - baseY + 0.15) / Math.max(1, tiers - tier - 1);
  }
  const topY = baseY + 0.06;
  if (ctx.random() < 0.7) {
    const faceZ = position.z + (ctx.random() < 0.5 ? depth / 2 + 0.03 : -depth / 2 - 0.03);
    const stripHeight = Math.min(height * 0.72, 1.5);
    part(ctx.group, unitBox, ctx.sign, position.x + (ctx.random() - 0.5) * width * 0.4, 0.5 + stripHeight / 2, faceZ, 0.09, stripHeight, 0.045);
  }
  if (height > 2.0 && ctx.random() < 0.5) {
    const panelY = topY + 0.34;
    part(ctx.group, cylinderGeometry, ctx.metal, position.x - 0.28, topY + 0.16, position.z, 0.05, 0.32, 0.05);
    part(ctx.group, cylinderGeometry, ctx.metal, position.x + 0.28, topY + 0.16, position.z, 0.05, 0.32, 0.05);
    const panel = part(ctx.group, unitBox, ctx.sign, position.x, panelY, position.z, 0.82, 0.36, 0.05);
    panel.rotation.x = -0.12;
  }
}

export function buildWarehouse(ctx: BuildContext, position: THREE.Vector3, width: number, depth: number, height: number): void {
  const body = pickBody(ctx);
  part(ctx.group, unitBox, body, position.x, height / 2 + 0.15, position.z, width, height, depth);
  addGableRoof(ctx.group, position, height + 0.15, width + 0.08, depth + 0.08, 0.2 + ctx.random() * 0.1, ctx.roof, width >= depth);
  const doorZ = position.z + depth / 2 + 0.012;
  part(ctx.group, planeGeometry, ctx.metal, position.x, 0.15 + Math.min(0.42, height * 0.6) / 2, doorZ, Math.min(0.5, width * 0.55), Math.min(0.42, height * 0.6), 1);
  part(ctx.group, unitBox, ctx.sign, position.x, 0.15 + Math.min(0.42, height * 0.6) + 0.05, doorZ, Math.min(0.56, width * 0.6), 0.045, 0.03);
  if (ctx.random() < 0.6) {
    part(ctx.group, cylinderGeometry, ctx.metal, position.x + width * 0.25, height + 0.32, position.z - depth * 0.2, 0.1, 0.2, 0.1);
  }
  if (ctx.random() < 0.4) {
    part(ctx.group, cylinderGeometry, ctx.roof, position.x - width * 0.3, height + 0.42, position.z, 0.5, 0.12, 0.5).rotation.z = Math.PI / 2;
  }
  addWindowGrid(ctx, position, width, depth, Math.min(height, 0.8), 0.15);
}

export function buildCivic(ctx: BuildContext, position: THREE.Vector3, width: number, depth: number, height: number): void {
  const body = pickBody(ctx);
  part(ctx.group, unitBox, body, position.x, height / 2 + 0.15, position.z, width, height, depth);
  part(ctx.group, unitBox, ctx.roof, position.x, height + 0.19, position.z, width + 0.12, 0.08, depth + 0.12);
  const frontZ = position.z + depth / 2;
  part(ctx.group, unitBox, ctx.roof, position.x, 0.19, frontZ + 0.16, width + 0.3, 0.08, 0.34);
  const columns = Math.max(3, Math.round(width / 0.28));
  for (let column = 0; column < columns; column += 1) {
    const x = position.x + (column - (columns - 1) / 2) * (width * 0.86 / (columns - 1));
    part(ctx.group, cylinderGeometry, ctx.roof, x, 0.58, frontZ + 0.14, 0.075, 0.7, 0.075);
  }
  addGableRoof(ctx.group, new THREE.Vector3(position.x, 0, frontZ + 0.14), 0.93, width * 0.94, 0.3, 0.16, ctx.roof);
  addWindowGrid(ctx, position, width, depth, height, 0.15);
}

export function buildDomeHall(ctx: BuildContext, position: THREE.Vector3): void {
  const body = pickBody(ctx);
  part(ctx.group, unitBox, body, position.x, 0.35, position.z, 1.0, 0.4, 1.0);
  part(ctx.group, cylinderGeometry, body, position.x, 0.83, position.z, 0.72, 0.56, 0.72);
  part(ctx.group, unitBox, ctx.sign, position.x, 1.13, position.z, 0.78, 0.05, 0.78);
  part(ctx.group, sphereGeometry, ctx.roof, position.x, 1.36, position.z, 0.84, 0.72, 0.84);
  part(ctx.group, sphereGeometry, ctx.sign, position.x, 1.82, position.z, 0.12, 0.16, 0.12);
  for (let column = 0; column < 6; column += 1) {
    const angle = column * Math.PI / 3;
    part(ctx.group, cylinderGeometry, ctx.roof, position.x + Math.cos(angle) * 0.46, 0.75, position.z + Math.sin(angle) * 0.46, 0.06, 0.5, 0.06);
  }
  addWindowGrid(ctx, position, 0.95, 0.95, 0.5, 0.15, { sparse: true });
}

export function buildClockTower(ctx: BuildContext, position: THREE.Vector3, height: number): void {
  const body = pickBody(ctx);
  part(ctx.group, unitBox, body, position.x, height / 2 + 0.15, position.z, 0.62, height, 0.62);
  for (let band = 1; band <= 2; band += 1) {
    part(ctx.group, unitBox, ctx.roof, position.x, 0.15 + (height * band) / 3, position.z, 0.7, 0.07, 0.7);
  }
  const clockY = height + 0.32;
  part(ctx.group, unitBox, ctx.roof, position.x, clockY - 0.14, position.z, 0.78, 0.44, 0.78);
  const faceMaterial = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffe4ad', emissiveIntensity: 0.85, roughness: 0.4 });
  for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const face = part(ctx.group, circleGeometry, faceMaterial, position.x + Math.sin(facing) * 0.4, clockY, position.z + Math.cos(facing) * 0.4, 0.3, 0.3, 1);
    face.rotation.y = facing;
    const hand = part(ctx.group, unitBox, ctx.metal, position.x + Math.sin(facing) * 0.415, clockY + 0.045, position.z + Math.cos(facing) * 0.415, 0.018, 0.11, 0.01);
    hand.rotation.y = facing;
  }
  part(ctx.group, coneGeometry, ctx.roof, position.x, height + 0.86, position.z, 0.86, 0.66, 0.86);
  part(ctx.group, cylinderGeometry, ctx.metal, position.x, height + 1.32, position.z, 0.03, 0.3, 0.03);
  addBeacon(ctx, position.x, height + 1.52, position.z, new THREE.MeshBasicMaterial({ color: '#ff8c5c', toneMapped: false }));
  addWindowGrid(ctx, position, 0.58, 0.58, height * 0.55, 0.15, { sparse: true });
}

export function buildSpireTower(ctx: BuildContext, position: THREE.Vector3, height: number): void {
  const body = pickBody(ctx);
  const stages = [
    { fraction: 0.52, width: 1.15 },
    { fraction: 0.3, width: 0.85 },
    { fraction: 0.18, width: 0.58 },
  ];
  let baseY = 0.15;
  for (const stage of stages) {
    const stageHeight = height * stage.fraction;
    part(ctx.group, unitBox, body, position.x, baseY + stageHeight / 2, position.z, stage.width, stageHeight, stage.width);
    addWindowGrid(ctx, position, stage.width, stage.width, stageHeight, baseY, { sparse: baseY > 1.5 });
    part(ctx.group, unitBox, ctx.roof, position.x, baseY + stageHeight + 0.03, position.z, stage.width + 0.08, 0.06, stage.width + 0.08);
    baseY += stageHeight + 0.06;
  }
  part(ctx.group, coneGeometry, ctx.metal, position.x, baseY + 0.55, position.z, 0.5, 1.1, 0.5);
  addBeacon(ctx, position.x, baseY + 1.2, position.z, new THREE.MeshBasicMaterial({ color: '#ff6f6f', toneMapped: false }));
}

export function buildWaterTower(ctx: BuildContext, position: THREE.Vector3): void {
  for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
    part(ctx.group, cylinderGeometry, ctx.metal, position.x + dx, 0.62, position.z + dz, 0.05, 0.95, 0.05);
  }
  part(ctx.group, unitBox, ctx.metal, position.x, 0.62, position.z, 0.46, 0.04, 0.05);
  part(ctx.group, unitBox, ctx.metal, position.x, 0.62, position.z, 0.05, 0.04, 0.46);
  part(ctx.group, cylinderGeometry, ctx.roof, position.x, 1.32, position.z, 0.62, 0.5, 0.62);
  part(ctx.group, coneGeometry, ctx.roof, position.x, 1.72, position.z, 0.7, 0.32, 0.7);
  part(ctx.group, unitBox, ctx.sign, position.x, 1.32, position.z + 0.315, 0.4, 0.16, 0.015);
}

export function buildChimney(ctx: BuildContext, position: THREE.Vector3, height: number): void {
  part(ctx.group, taperGeometry, pickBody(ctx), position.x, height / 2 + 0.15, position.z, 0.34, height, 0.34);
  part(ctx.group, cylinderGeometry, ctx.warning, position.x, height * 0.72 + 0.15, position.z, 0.27, 0.1, 0.27);
  part(ctx.group, cylinderGeometry, ctx.roof, position.x, height + 0.2, position.z, 0.3, 0.1, 0.3);
  addBeacon(ctx, position.x, height + 0.32, position.z, new THREE.MeshBasicMaterial({ color: '#ff8c5c', toneMapped: false }));
}

export function buildStorageTanks(ctx: BuildContext, position: THREE.Vector3): void {
  for (const [dx, dz] of [[-0.24, 0], [0.24, 0]]) {
    const tank = part(ctx.group, cylinderGeometry, ctx.roof, position.x + dx, 0.42, position.z + dz, 0.4, 0.78, 0.4);
    tank.rotation.x = Math.PI / 2;
    part(ctx.group, unitBox, ctx.metal, position.x + dx, 0.2, position.z + dz - 0.12, 0.1, 0.16, 0.06);
    part(ctx.group, unitBox, ctx.metal, position.x + dx, 0.2, position.z + dz + 0.12, 0.1, 0.16, 0.06);
  }
  part(ctx.group, cylinderGeometry, ctx.metal, position.x, 0.5, position.z, 0.05, 0.5, 0.05).rotation.z = Math.PI / 2;
}

export function buildFence(ctx: BuildContext, position: THREE.Vector3, along: 'x' | 'z'): void {
  const length = 0.92;
  for (const offset of [-0.4, 0, 0.4]) {
    const x = along === 'x' ? position.x + offset : position.x;
    const z = along === 'z' ? position.z + offset : position.z;
    part(ctx.group, unitBox, ctx.metal, x, 0.36, z, 0.04, 0.34, 0.04);
  }
  for (const y of [0.3, 0.46]) {
    part(ctx.group, unitBox, ctx.metal, position.x, y, position.z, along === 'x' ? length : 0.025, 0.025, along === 'z' ? length : 0.025);
  }
}

export function buildTree(ctx: BuildContext, position: THREE.Vector3): void {
  part(ctx.group, cylinderGeometry, ctx.metal, position.x, 0.28, position.z, 0.05, 0.22, 0.05);
  part(ctx.group, coneGeometry, ctx.foliage, position.x, 0.62, position.z, 0.4 + ctx.random() * 0.14, 0.55 + ctx.random() * 0.25, 0.4);
}

export function buildFountain(ctx: BuildContext, position: THREE.Vector3): void {
  part(ctx.group, cylinderGeometry, ctx.roof, position.x, 0.26, position.z, 0.84, 0.2, 0.84);
  const water = part(ctx.group, circleGeometry, new THREE.MeshStandardMaterial({ color: '#1d4a5e', roughness: 0.1, metalness: 0.5 }), position.x, 0.37, position.z, 0.72, 0.72, 1);
  water.rotation.x = -Math.PI / 2;
  part(ctx.group, cylinderGeometry, ctx.roof, position.x, 0.52, position.z, 0.14, 0.36, 0.14);
  part(ctx.group, cylinderGeometry, ctx.roof, position.x, 0.72, position.z, 0.34, 0.06, 0.34);
  part(ctx.group, sphereGeometry, ctx.sign, position.x, 0.82, position.z, 0.09, 0.12, 0.09);
}

export function buildGarden(ctx: BuildContext, position: THREE.Vector3): void {
  const lawn = part(ctx.group, planeGeometry, ctx.foliage, position.x, 0.185, position.z, 0.86, 0.86, 1);
  lawn.rotation.x = -Math.PI / 2;
  lawn.rotation.z = ctx.random() * Math.PI;
  part(ctx.group, unitBox, ctx.foliage, position.x - 0.24, 0.28, position.z + 0.18, 0.2, 0.14, 0.2);
  part(ctx.group, unitBox, ctx.foliage, position.x + 0.2, 0.26, position.z - 0.22, 0.16, 0.1, 0.16);
}

export function buildQuaySign(ctx: BuildContext, position: THREE.Vector3, facingRotY: number): void {
  part(ctx.group, cylinderGeometry, ctx.metal, position.x - 0.22, 0.5, position.z, 0.05, 0.85, 0.05);
  part(ctx.group, cylinderGeometry, ctx.metal, position.x + 0.22, 0.5, position.z, 0.05, 0.85, 0.05);
  const panel = part(ctx.group, unitBox, ctx.sign, position.x, 0.95, position.z, 0.66, 0.42, 0.05);
  panel.rotation.y = facingRotY;
}
