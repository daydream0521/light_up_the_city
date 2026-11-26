import * as THREE from 'three';
import { GRID_SIZE } from '../game/levels';
import { clay, column, limestone } from '../experiments/aegean-city/model';

export function createChapterBoard(city: 1 | 2) {
  const aegean = city === 1;
  const root = new THREE.Group();
  root.position.set(-GRID_SIZE, 0, -GRID_SIZE);
  const slab = new THREE.MeshStandardMaterial({ color: aegean ? '#9d7d59' : '#35495a', roughness: .77 });
  const water = new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(aegean ? '#246476' : '#173e5e') } },
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 surface;
      void main() { surface = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 surface;
      uniform vec3 tint;
      void main() {
        vec2 p = surface - vec2(.5);
        float edge = 1. - smoothstep(.16, .47, length(p));
        float swell = sin(p.y * 520. + sin(p.x * 26.) * 1.8) * .037;
        float ripple = pow(max(0., sin(p.y * 880. + 10. * sin(p.x * 34.))), 11.);
        gl_FragColor = vec4(tint * (1. + swell + ripple * .076), edge * .90);
      }`,
  });
  const tile = [0, 1, 2, 3].map((i) => new THREE.MeshStandardMaterial({
    color: aegean ? ['#a9997f', '#bbaa8e', '#c8b89b', '#b5a38a'][i] : ['#4c606f', '#4e6275', '#5a6e7d', '#516270'][i], roughness: .82,
  }));
  const edge = new THREE.MeshStandardMaterial({ color: aegean ? '#f1c891' : '#6cc9e6', roughness: .55 });
  const lights = [0, 1, 2, 3].map((district) => {
    const warm = aegean || district === 0 || district === 3;
    const color = warm ? '#efc998' : '#9ed5ef';
    return new THREE.MeshStandardMaterial({ color, emissive: warm ? '#dfa670' : '#67b8e9', emissiveIntensity: .14 });
  });

  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x, y, z);
    root.add(item);
    return item;
  }
  function box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) {
    return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }
  mesh(new THREE.PlaneGeometry(27, 27), water, 0, -.15, 0).rotation.x = -Math.PI / 2;
  box(8.65, .30, 8.1, slab, 0, .12, 0);
  box(8.20, .28, 7.7, slab, 0, .39, 0);
  box(7.66, .25, 7.27, slab, 0, .64, 0);
  box(7.24, .82, 6.84, slab, 0, 1.05, 0);
  const joint = new THREE.MeshBasicMaterial({ color: '#796d58', opacity: .35, transparent: true });
  for (let z = -2; z <= 2; z += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const surface = box(1.06, .14, 1.06, tile[((x + 2) * 13 + (z + 2) * 7 + x * z + 4) % 4], x * GRID_SIZE, 1.54, z * GRID_SIZE);
      surface.receiveShadow = true;
      if (aegean) {
        box(.013, .008, .98, joint, x * GRID_SIZE + (z % 2 === 0 ? .16 : -.13), 1.612, z * GRID_SIZE);
      }
    }
  }
  for (const [district, [x, z]] of [[-3.38, -3.38], [3.38, -3.38], [-3.38, 3.38], [3.38, 3.38]].entries()) {
    box(.56, .22, .56, edge, x, 1.37, z);
    if (aegean) {
      mesh(new THREE.CylinderGeometry(.15, .20, .85, 12), slab, x, 1.88, z);
      mesh(new THREE.SphereGeometry(.16, 12, 8), lights[district], x, 2.35, z);
    } else {
      box(.35, .82, .35, edge, x, 1.86, z);
      box(.40, .13, .40, lights[district], x, 2.31, z);
    }
  }
  if (aegean) {
    const stone = new THREE.MeshStandardMaterial({ color: limestone[1], roughness: .87 });
    const terracotta = new THREE.MeshStandardMaterial({ color: clay[2], roughness: .84 });
    const trunk = new THREE.MeshStandardMaterial({ color: '#6d5643', roughness: .95 });
    const leaf = new THREE.MeshStandardMaterial({ color: '#6e8358', roughness: .92 });
    const leafLight = new THREE.MeshStandardMaterial({ color: '#929c68', roughness: .84 });
    const pier = new THREE.MeshStandardMaterial({ color: '#9d754e', roughness: .92 });
    box(2.1, .24, 5.4, slab, -4.05, .14, -.25);
    box(1.6, .17, 4.95, stone, -4.56, .34, -.5);
    for (const z of [-2.35, -1.65, -.95, -.25, .45, 1.15]) {
      box(.34, .10, .34, stone, -4.78, .47, z);
      column(root, -4.78, .48, z, 1.27, .13);
    }
    box(1.04, .19, 4.5, stone, -4.72, 1.84, -.6);
    for (const side of [-1, 1]) {
      box(.62, .11, 4.62, terracotta, -4.72 + side * .23, 2.01, -.6).rotation.z = -side * .38;
    }
    for (const [x, z] of [[-3.4, 3.18], [3.7, -2.8], [3.1, -3.18]]) {
      box(.83, .38, .74, slab, x, .31, z);
      mesh(new THREE.CylinderGeometry(.053,.086,.6,7), trunk, x, .72, z).rotation.z = .12;
      for (const [dx, dy, dz] of [[-.13, .14, 0], [.14, .2, -.04], [.03, .04, .12], [0, .3, .03]]) {
        const crown = mesh(new THREE.IcosahedronGeometry(.27, 1), dy > .15 ? leafLight : leaf, x + dx, 1.03 + dy, z + dz);
        crown.scale.set(1.07, .69, 1.04);
      }
    }
    box(2.8, .20, 1.33, pier, 4.62, .18, 2.15);
    for (let slat = 0; slat < 13; slat += 1) {
      box(.186, .05, 1.39, slat % 3 === 0 ? slab : pier, 3.38 + slat * .21, .30, 2.15);
    }
    for (const x of [3.5, 5.7]) for (const z of [1.51, 2.78]) {
      mesh(new THREE.CylinderGeometry(.062, .078, .60, 8), pier, x, .21, z);
    }
    for (let step = 0; step < 6; step += 1) {
      box(.33, .18 * (step + 1), 1.64, step % 2 ? slab : stone, 5.46 - step * .30, .09 * (step + 1), -.45);
    }
  } else {
    const glass = new THREE.MeshPhysicalMaterial({ color: '#6fb1c8', opacity: .34, transparent: true, roughness: .19, metalness: .24, clearcoat: .8 });
    const steel = new THREE.MeshStandardMaterial({ color: '#9eb6c7', roughness: .24, metalness: .61 });
    const window = new THREE.MeshStandardMaterial({ color: '#6b8d9d', emissive: '#8bb4d0', emissiveIntensity: .24, roughness: .27 });
    const promenade = new THREE.MeshStandardMaterial({ color: '#3b4659', roughness: .67 });
    box(8.35, .2, 1.0, promenade, 0, .45, 3.97);
    box(8.4, .045, .058, lights[1], 0, .58, 4.42);
    for (let rail = 0; rail < 10; rail += 1) {
      const x = (rail - 4.5) * .835;
      box(.81, .35, .027, glass, x, .75, 4.43);
      box(.028, .49, .042, steel, x - .416, .78, 4.43);
    }
    box(8.37, .039, .065, steel, 0, .976, 4.43);
    for (const [x, z, h, w] of [[-4.97, -3.34, 2.18, .72], [-5.61, -2.82, 2.77, .66], [-4.82, -2.34, 1.37, .84], [-5.36, -1.51, 1.02, .92]]) {
      box(w, h, .58, slab, x, h / 2, z);
      for (let floor = .29; floor < h - .12; floor += .23) {
        box(w * .84, .061, .017, window, x, floor, z + .292);
        box(.015, .061, .48, window, x + w * .502, floor, z);
      }
      box(w + .035, .035, .62, lights[3], x, h, z);
    }
    const pearlMaterial = new THREE.MeshStandardMaterial({ color: '#ccb0ba', metalness: .16, roughness: .36, emissive: '#bb688d', emissiveIntensity: .59 });
    mesh(new THREE.CylinderGeometry(.062, .13, 2.76, 12), steel, -4.71, 1.38, .48);
    for (const dx of [-.24, .24]) {
      mesh(new THREE.CylinderGeometry(.040, .071, 1.17, 8), steel, -4.71 + dx * .62, .58, .48).rotation.z = -dx * .82;
    }
    mesh(new THREE.SphereGeometry(.30, 20, 14), pearlMaterial, -4.71, 1.44, .48);
    mesh(new THREE.SphereGeometry(.184, 16, 12), pearlMaterial, -4.71, 2.17, .48);
    mesh(new THREE.CylinderGeometry(.018, .035, .52, 8), steel, -4.71, 2.89, .48);
    box(1.4, .16, 2.58, promenade, 4.44, .28, -.63);
    box(.08, .055, 2.6, lights[0], 5.17, .38, -.62);
  }
  return { root, lights };
}
