import * as THREE from 'three';
import { OPTICS_HEIGHT, type PieceKind } from '../game/levels';

const HEIGHT = OPTICS_HEIGHT;

function add(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

export function addChapterBeacon(group: THREE.Group, city: 1 | 2, flames: THREE.Group[]): string {
  const aegean = city === 1;
  const color = aegean ? '#ffbc69' : '#a8e4ff';
  const body = new THREE.MeshStandardMaterial({ color: aegean ? '#ae743d' : '#6598af', metalness: .43, roughness: .4 });
  const glow = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .75 });
  add(group, new THREE.CylinderGeometry(.14, .27, .46, aegean ? 12 : 6), body, 0, 1.96, 0);
  if (aegean) {
    add(group, new THREE.CylinderGeometry(.29, .12, .16, 18), body, 0, HEIGHT - .08, 0);
    addFlame(group, HEIGHT - .03, 0, 1.05, flames);
  } else {
    add(group, new THREE.CylinderGeometry(.25, .25, .18, 6), glow, 0, HEIGHT, 0);
    add(group, new THREE.CylinderGeometry(.18, .30, .11, 6), body, 0, HEIGHT + .14, 0);
    for (const x of [-.23, .23]) add(group, new THREE.BoxGeometry(.035, .58, .08), body, x, HEIGHT, 0);
  }
  return color;
}

export function createChapterDevice(
  city: 1 | 2, kind: PieceKind, lit: boolean, gateActive: boolean, flames: THREE.Group[],
): THREE.Group {
  const rotor = new THREE.Group();
  const aegean = city === 1;
  const frame = new THREE.MeshStandardMaterial({ color: aegean ? '#b98847' : '#9eb8c7', roughness: aegean ? .36 : .23, metalness: .54 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: aegean ? '#fff2be' : '#aee7f9', roughness: .17, metalness: .32, clearcoat: 1,
    emissive: aegean ? '#e5b255' : '#5baace', emissiveIntensity: .22,
  });

  if (kind === 'checkpoint') {
    const pillar = new THREE.MeshStandardMaterial({ color: aegean ? '#e5cc9f' : '#4f6478', roughness: aegean ? .76 : .35, metalness: aegean ? .02 : .48 });
    const panel = new THREE.MeshStandardMaterial({ color: '#c9bdf7', emissive: '#9f86ff', emissiveIntensity: gateActive ? 1.75 : .28 });
    for (const x of [-.43, .43]) {
      add(rotor, new THREE.BoxGeometry(.18, .65, .24), pillar, x, 2.13, 0);
      add(rotor, new THREE.BoxGeometry(.22, .075, .28), frame, x, 1.84, 0);
      add(rotor, new THREE.BoxGeometry(.21, .065, .26), frame, x, 2.44, 0);
      add(rotor, new THREE.BoxGeometry(.032, .24, .145), panel, x * .8, 2.18, 0);
    }
    const lintel = aegean ? new THREE.TorusGeometry(.43, .042, 6, 22, Math.PI) : new THREE.BoxGeometry(.98, .075, .15);
    add(rotor, lintel, frame, 0, aegean ? 2.42 : 2.48, 0);
    add(rotor, new THREE.BoxGeometry(.068, .016, .87), panel, 0, 1.82, 0);
    return rotor;
  }

  if (kind === 'splitter') {
    const prism = add(rotor, new THREE.OctahedronGeometry(.45), glass, 0, HEIGHT, 0);
    prism.scale.set(1.14, 1, .55);
    const rim = add(rotor, new THREE.TorusGeometry(.44, .022, 5, 4), frame, 0, HEIGHT, 0);
    rim.rotation.z = Math.PI / 2;
    return rotor;
  }

  const isTarget = kind === 'single';
  const reflector = isTarget ? .66 : .86;
  const shape = aegean ? new THREE.CylinderGeometry(reflector * .51, reflector * .51, .065, 28) : new THREE.BoxGeometry(reflector, .69, .066);
  const face = aegean ? new THREE.CylinderGeometry(reflector * .43, reflector * .43, .075, 28) : new THREE.BoxGeometry(reflector - .11, .58, .078);
  const mount = add(rotor, shape, frame, 0, HEIGHT, 0);
  const mirror = add(rotor, face, glass, 0, HEIGHT, .01);
  if (aegean) mount.rotation.x = mirror.rotation.x = Math.PI / 2;
  if (!aegean && !isTarget) {
    for (const x of [-.16, .16]) add(rotor, new THREE.BoxGeometry(.016, .62, .02), frame, x, HEIGHT, .055);
    add(rotor, new THREE.BoxGeometry(.75, .018, .02), frame, 0, HEIGHT, -.054);
  }
  if (isTarget) {
    // The status light stays on the same local -Z face as the Reflection backlight.
    const amber = new THREE.MeshStandardMaterial({ color: '#ffc97a', emissive: '#ffad50', emissiveIntensity: lit ? 1.5 : .23 });
    if (aegean) {
      add(rotor, new THREE.CylinderGeometry(.18, .07, .13, 16), frame, 0, HEIGHT - .14, -.23);
      add(rotor, new THREE.CylinderGeometry(.14, .14, .025, 16), amber, 0, HEIGHT - .07, -.23);
      if (lit) addFlame(rotor, HEIGHT - .07, -.23, .65, flames);
    } else {
      add(rotor, new THREE.BoxGeometry(.48, .34, .06), amber, 0, HEIGHT, -.12);
      for (const y of [-.098, 0, .098]) add(rotor, new THREE.BoxGeometry(.43, .024, .025), frame, 0, HEIGHT + y, -.16);
    }
  }
  return rotor;
}

function addFlame(parent: THREE.Group, y: number, z: number, size: number, flames: THREE.Group[]): void {
  const group = new THREE.Group();
  group.position.set(0, y, z);
  group.scale.setScalar(size);
  group.userData.size = size;
  const colors = ['#ff862f', '#ffe3a3'];
  for (const [index, color] of colors.entries()) {
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: index === 0 ? .73 : 1.1 });
    const points = [new THREE.Vector2(0, 0), new THREE.Vector2(.12 - index * .049, .13), new THREE.Vector2(.08 - index * .034, .24 - index * .07), new THREE.Vector2(0, .43 - index * .145)];
    add(group, new THREE.LatheGeometry(points, 12), material, index * .043, 0, .014 + index * .045);
  }
  parent.add(group);
  flames.push(group);
}

export function animateChapterFlame(flame: THREE.Group, time: number): void {
  const wave = Math.sin(time * 12) * .105 + Math.sin(time * 23) * .045;
  const size = Number(flame.userData.size);
  flame.scale.set(size * (1 - wave * .6), size * (1 + wave), size);
  flame.rotation.z = Math.sin(time * 9) * .13;
}
