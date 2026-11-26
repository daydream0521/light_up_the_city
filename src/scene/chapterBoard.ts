import * as THREE from 'three';
import { GRID_SIZE } from '../game/levels';

export function createChapterBoard(city: 1 | 2) {
  const aegean = city === 1;
  const root = new THREE.Group();
  root.position.set(-GRID_SIZE, 0, -GRID_SIZE);
  const slab = new THREE.MeshStandardMaterial({ color: aegean ? '#af8564' : '#3d566c', roughness: .77 });
  const water = new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(aegean ? '#174451' : '#15334b') } },
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 surface;
      void main() { surface = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 surface;
      uniform vec3 tint;
      void main() {
        vec2 p = surface - vec2(.5);
        float edge = 1. - smoothstep(.16, .47, length(p));
        float swell = sin(p.y * 420. + sin(p.x * 26.) * 1.8) * .035;
        gl_FragColor = vec4(tint * (1. + swell), edge * .93);
      }`,
  });
  const tile = [0, 1].map((i) => new THREE.MeshStandardMaterial({
    color: aegean ? ['#a98b6d', '#baa181'][i] : ['#47586e', '#56677e'][i], roughness: .82,
  }));
  const edge = new THREE.MeshStandardMaterial({ color: aegean ? '#f1c891' : '#6cc9e6', roughness: .55 });
  const lights = [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({
    color: aegean ? '#ffbc72' : '#8cdbfb', emissive: aegean ? '#ff8c32' : '#42bdf6', emissiveIntensity: .03,
  }));

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
  box(8.5, .65, 8.5, slab, 0, .22, 0);
  box(7.5, .95, 7.5, slab, 0, .82, 0);
  for (let z = -2; z <= 2; z += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const surface = box(1.06, .14, 1.06, tile[(x + z + 4) % 2], x * GRID_SIZE, 1.54, z * GRID_SIZE);
      surface.receiveShadow = true;
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
    for (const z of [-1.1, -.38, .38, 1.1]) mesh(new THREE.CylinderGeometry(.11, .15, 1.5, 10), edge, -5, 1.02, z);
    const terracotta = new THREE.MeshStandardMaterial({ color: '#a5593c', roughness: .84 });
    box(.95, .20, 2.9, slab, -5, 1.86, 0);
    box(.91, .16, 2.99, terracotta, -5, 1.99, 0);
    box(1.7, .13, 3.7, slab, 5.15, .24, 0);
  } else {
    for (const [x, z, h] of [[-4.9, -3, 2.4], [-5.85, -3.1, 3.3], [-5.45, -1.9, 1.35]]) {
      box(.68, h, .68, slab, x, h / 2, z);
      box(.69, .065, .69, lights[3], x, h, z);
    }
    mesh(new THREE.CylinderGeometry(.046, .13, 2.8, 10), edge, -4.7, 1.4, .25);
    mesh(new THREE.SphereGeometry(.29, 16, 12), lights[2], -4.7, 1.45, .25);
    mesh(new THREE.SphereGeometry(.16, 16, 12), lights[2], -4.7, 2.18, .25);
  }
  return { root, lights };
}
