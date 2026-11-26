import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { height, seeded } from './terrain';

export const random = seeded(38021);
export const between = (lo: number, hi: number) => lo + (hi - lo) * random();
export const pick = <V>(values: readonly V[]) => values[Math.floor(random() * values.length)];
export const limestone = ['#e8d3aa', '#d6bd94', '#f3dfbb', '#c8ac86'];
export const plaster = ['#e5d4b9', '#e4c2a0', '#eeddbd', '#cbb79a', '#e4cdae', '#d3ac8d'];
export const clay = ['#a35840', '#bc6a4d', '#af543f', '#ca8157', '#925444'];
export const wood = '#614637';
export const dark = '#362b24';
const boxGeometry = new T.BoxGeometry();
const sphere = new T.IcosahedronGeometry(1, 1);
const surfaces = new Map<string, T.MeshStandardMaterial>();

function material(color: string) {
  let found = surfaces.get(color);
  if (!found) {
    found = new T.MeshStandardMaterial({ color, roughness: .94 });
    surfaces.set(color, found);
  }
  return found;
}

export function piece(parent: T.Object3D, geometry: T.BufferGeometry, color: string, x: number, y: number, z: number) {
  const mesh = new T.Mesh(geometry, material(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function block(parent: T.Object3D, color: string, x: number, y: number, z: number, w: number, h: number, d: number) {
  const mesh = piece(parent, boxGeometry, color, x, y, z);
  mesh.scale.set(w, h, d);
  return mesh;
}

export function rock(parent: T.Object3D, color: string, x: number, y: number, z: number, w: number, h: number, d: number) {
  const mesh = piece(parent, sphere, color, x, y, z);
  mesh.scale.set(w, h, d);
  mesh.rotation.set(between(-.3, .3), between(0, 6.3), between(-.4, .4));
  return mesh;
}

export function group(parent: T.Object3D, x: number, y: number, z: number, rotation = 0) {
  const node = new T.Group();
  node.position.set(x, y, z);
  node.rotation.y = rotation;
  parent.add(node);
  return node;
}

export function prism(w: number, d: number, rise: number) {
  const shape = new T.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  return new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
}

export function roof(parent: T.Object3D, y: number, w: number, d: number, rise: number, tiled = true) {
  piece(parent, prism(w, d, rise), pick(clay), 0, y, 0);
  const angle = Math.atan2(rise, w / 2);
  const length = Math.hypot(w / 2, rise);
  for (const side of [-1, 1]) {
    block(parent, pick(clay), w / 4 * side, y + rise / 2, 0, length, .15, d + .12).rotation.z = -side * angle;
    if (!tiled) continue;
    for (let z = -d / 2; z <= d / 2; z += .39) {
      block(parent, pick(clay), w / 4 * side, y + rise / 2 + .065, z, length, .12, .082).rotation.z = -side * angle;
    }
    for (let x = .6; x < w / 2; x += .6) {
      block(parent, '#a35e45', x * side, y + rise * (1 - 2 * x / w) + .045, 0, .065, .037, d);
    }
  }
  block(parent, '#cc8960', 0, y + rise + .08, 0, .25, .22, d + .23);
}

function columnShape() {
  const positions: number[] = [];
  const triangles: number[] = [];
  const sides = 80;
  const rings = [[0, 1], [.25, 1.015], [.62, .94], [1, .81]];
  for (const [y, radius] of rings) {
    for (let i = 0; i < sides; i++) {
      const angle = i / sides * Math.PI * 2;
      const r = radius - .085 * (1 - Math.cos(angle * 20)) / 2;
      positions.push(Math.cos(angle) * r, y, Math.sin(angle) * r);
    }
  }
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < sides; i++) {
      const a = j * sides + i;
      const b = j * sides + (i + 1) % sides;
      triangles.push(a, a + sides, b, b, a + sides, b + sides);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setIndex(triangles);
  geo.computeVertexNormals();
  return geo;
}

const fluted = columnShape();
const capital = new T.CylinderGeometry(1.2, .83, 1, 20);
export function column(parent: T.Object3D, x: number, y: number, z: number, h: number, r: number) {
  const color = pick(limestone.slice(0, 3));
  piece(parent, fluted, color, x, y, z).scale.set(r, h * .9, r);
  piece(parent, capital, color, x, y + h * .925, z).scale.set(r, h * .07, r);
  block(parent, color, x, y + h * .98, z, r * 2.45, h * .06, r * 2.45);
}

const jarGeometry = new T.LatheGeometry([
  [.05, 0], [.20, .035], [.18, .14], [.37, .39], [.4, .59], [.32, .77],
  [.16, .9], [.14, .98], [.22, 1], [.22, 1.06], [.14, 1.06], [.13, .95],
].map(([x, y]) => new T.Vector2(x, y)), 14);
const handle = new T.TorusGeometry(.15, .024, 5, 12);
export function jar(parent: T.Object3D, x: number, y: number, z: number, size: number) {
  const vessel = group(parent, x, y, z, between(0, 6.28));
  const color = pick(clay);
  piece(vessel, jarGeometry, color, 0, 0, 0).scale.setScalar(size);
  for (const side of [-1, 1]) {
    piece(vessel, handle, color, side * size * .24, size * .79, 0).scale.set(size * .77, size, size);
  }
}

export function masonry(parent: T.Object3D, x: number, bottom: number, z: number, w: number, h: number, d: number, face: 'x' | 'z' = 'z') {
  const wall = group(parent, x, bottom, z, face === 'x' ? Math.PI / 2 : 0);
  block(wall, '#9a8066', 0, h / 2, 0, w, h, d);
  const courses = Math.max(1, Math.ceil(h / .52));
  const dy = h / courses;
  for (let row = 0; row < courses; row++) {
    for (let start = -w / 2; start < w / 2 - .06;) {
      const end = Math.min(w / 2, start + between(.65, 1.65));
      block(wall, pick(limestone), (start + end) / 2, dy * (row + .5), d / 2, end - start - .035, dy - .035, .12);
      start = end;
    }
  }
  block(wall, '#c9ae8b', 0, h + .10, 0, w + .12, .2, d + .21);
}

export function bake(root: T.Group, destination: T.Object3D, shadow = true) {
  root.updateWorldMatrix(true, true);
  const chunks = new Map<string, T.BufferGeometry[]>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const source: T.BufferGeometry = object.geometry;
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    geometry.deleteAttribute('uv');
    geometry.applyMatrix4(object.matrixWorld);
    const a = geometry.attributes.position;
    const colors = new Float32Array(a.count * 3);
    const normal = geometry.attributes.normal;
    const color = (object.material as T.MeshStandardMaterial).color;
    for (let i = 0; i < a.count; i++) {
      const grain = Math.sin(a.getX(i) * 3.5 + a.getZ(i)) * .022 + .955 + .04 * normal.getY(i);
      colors[i * 3] = color.r * grain;
      colors[i * 3 + 1] = color.g * grain;
      colors[i * 3 + 2] = color.b * grain;
    }
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
    const center = object.getWorldPosition(new T.Vector3());
    const key = Math.floor(center.x / 25) + '/' + Math.floor(center.z / 25);
    const list = chunks.get(key) ?? [];
    list.push(geometry);
    chunks.set(key, list);
  });
  const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .93 });
  for (const list of chunks.values()) {
    const geometry = mergeGeometries(list);
    const mesh = new T.Mesh(geometry, mat);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    destination.add(mesh);
    list.forEach((item) => item.dispose());
  }
}

export function path(parent: T.Object3D, knots: [number, number][], width: number) {
  const curve = new T.CatmullRomCurve3(knots.map(([x, z]) => new T.Vector3(x, 0, z)));
  const vertices: number[] = [];
  const indices: number[] = [];
  const count = Math.ceil(curve.getLength() * 5);
  const strips = 5;
  for (let i = 0; i <= count; i++) {
    const p = curve.getPointAt(i / count);
    const t = curve.getTangentAt(i / count);
    for (let j = 0; j < strips; j++) {
      const edge = (j / (strips - 1) - .5) * width * (1 + .04 * Math.sin(i * .31));
      const x = p.x - t.z * edge;
      const z = p.z + t.x * edge;
      vertices.push(x, height(x, z) + .12, z);
    }
    if (!i) continue;
    for (let j = 0; j < strips - 1; j++) {
      const k = i * strips + j;
      indices.push(k - strips, k - strips + 1, k, k, k - strips + 1, k + 1);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  piece(parent, geo, '#c8ad85', 0, 0, 0);
  return curve;
}
