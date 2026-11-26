import * as T from 'three';
import { bake, between, block, clay, column, dark, group, jar, limestone, masonry, path, pick, piece, plaster, prism, random, rock, roof, wood } from './model';
import { coast, height } from './terrain';

const cream = '#e1c8a1';
const rust = '#a65540';
const blue = '#3c6174';
const occupied: [number, number, number][] = [];
type Lamp = { x: number; y: number; z: number; large?: boolean };

function temple(root: T.Group, lamps: Lamp[]) {
  const y = 20.4;
  const site = group(root, -20, y, -24, -.11);
  for (let i = 0; i < 4; i++) {
    const w = 13.8 - i * .57;
    const d = 22.7 - i * .57;
    block(site, limestone[i], 0, .24 + i * .39, 0, w, .48, d);
    for (let x = -w / 2 + .58; x < w / 2; x += 1.19) {
      block(site, '#a58e72', x, .24 + i * .39, d / 2 + .006, .025, .36, .027);
    }
  }
  const base = 1.64;
  for (const z of [-9.25, 9.25]) {
    for (let i = 0; i < 6; i++) column(site, (i - 2.5) * 2.1, base, z, 5.55, .54);
  }
  for (const x of [-5.25, 5.25]) {
    for (let i = 1; i < 10; i++) column(site, x, base, -9.25 + i * 1.85, 5.55, .54);
  }
  block(site, cream, 0, 4.43, -.6, 7.3, 5.55, 12.6);
  block(site, dark, 0, 3.53, 5.73, 1.9, 3.62, .12);
  block(site, '#c3a27e', 0, 5.45, 5.89, 2.4, .38, .35);
  for (const x of [-1.06, 1.06]) block(site, '#b49775', x, 3.52, 5.9, .22, 3.66, .32);
  block(site, cream, 0, 7.45, 0, 12.55, .51, 20.95);
  block(site, rust, 0, 7.94, 0, 12.34, .51, 20.75);
  for (const side of [-1, 1]) {
    for (let x = -5.85; x < 6; x += .68) {
      block(site, cream, x, 7.95, side * 10.44, .22, .43, .15);
    }
    for (let z = -10; z < 10.2; z += .68) {
      block(site, cream, side * 6.23, 7.95, z, .13, .43, .22);
    }
  }
  block(site, '#f1dcaf', 0, 8.27, 0, 13.02, .27, 21.42);
  piece(site, prism(12.65, 21.1, 1.98), '#bf9470', 0, 8.4, 0);
  for (const side of [-1, 1]) {
    const z = side * 10.62;
    block(site, blue, 0, 8.49, z, 11.28, .16, .12);
    for (let i = -4; i <= 4; i++) {
      const h = 1.12 - Math.abs(i) * .18;
      const relief = group(site, i * 1.06, 8.56, z);
      const lean = i === 0 ? 0 : Math.sign(i) * (.15 + Math.abs(i) * .13);
      const drapery = piece(relief, new T.CylinderGeometry(.21, .35, h*.74, 7), cream, 0, h*.37, 0);
      drapery.rotation.z = lean;
      rock(relief, cream, -Math.sin(lean)*h*.35, h*.83, .02, .15, .18, .115);
      block(relief, limestone[1], Math.sign(i)*.23, h*.54, .11, .35, .12, .12).rotation.z = lean - .55;
    }
    rock(site, '#c08c56', 0, 10.67, z, .36, .52, .24);
  }
  for (const side of [-1, 1]) {
    const slant = block(site, '#edd1a0', side * 3.22, 9.47, 0, 6.78, .22, 21.43);
    slant.rotation.z = -side * Math.atan2(2, 6.45);
    for (let z = -10.65; z < 10.7; z += .39) {
      block(site, pick(clay), side * 3.23, 9.59, z, 6.84, .16, .38).rotation.z = slant.rotation.z;
    }
  }
  block(site, '#bc7750', 0, 10.61, 0, .24, .23, 21.62);
  for (let i = 0; i < 7; i++) {
    const h = 1.5 - i * .2;
    block(site, pick(limestone), 0, h / 2, 10.5 + i * .41, 5.9, h, .68);
  }
  for (const x of [-34, -4]) masonry(root, x, y - 2.6, -24, 24, 2.85, .65, 'x');
  for (const [x, w] of [[-29, 11], [-8, 8]]) masonry(root, x, y - 3.2, -12.1, w, 3.45, .8);
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 3; j++) {
      block(root,pick(limestone),-31.7+j*.97,y+.032,-30.35+i*1.42,.94,.075,1.39);
      block(root,pick(limestone),-12.1+j*.97,y+.032,-30.35+i*1.42,.94,.075,1.39);
    }
  }
  block(root,limestone[1],-8.5,y+.19,-19.5,2.05,.37,1.72);
  block(root,cream,-8.5,y+.67,-19.5,1.56,.59,1.17);
  block(root,limestone[2],-8.5,y+1,-19.5,1.83,.20,1.45);
  const gate = group(root, -18, y, -11.8, -.09);
  block(gate, cream, 0, .18, 0, 6.7, .36, 2.4);
  for (const x of [-2.5, -1.2, 1.2, 2.5]) column(gate, x, .36, -.3, 2.65, .28);
  block(gate, cream, 0, 3.05, -.3, 6.32, .45, 1.48);
  for (const x of [-23.7, -15.1]) lamps.push({ x, y: y + 1.4, z: -13.4 });
}

function theatre(root: T.Group, lamps: Lamp[]) {
  const y = 4.23;
  const site = group(root, 28, y, -8);
  const circle = new T.CylinderGeometry(4.75, 4.75, .22, 48);
  piece(site, circle, '#ceb289', 0, .065, 0);
  const ring = new T.RingGeometry(4.39, 4.53, 64).rotateX(-Math.PI / 2);
  piece(site, ring, '#eee0bb', 0, .181, 0);
  for (let row = 0; row < 11; row++) {
    const r = 4.93 + row * .53;
    const n = 28 + row * 2;
    for (let j = 0; j < n; j++) {
      const a = Math.PI * (j + .5) / n;
      const stair = [Math.PI / 4, Math.PI / 2, Math.PI * .75].some(v => Math.abs(a - v) < .26 / r);
      const h = .26 + row * .245;
      const x = Math.cos(a) * r;
      const z = -Math.sin(a) * r;
      block(site, stair ? '#aa9379' : pick(limestone), x, h - (stair ? .18 : .06), z, Math.PI * r / n - .014, .26, .61).rotation.y = a - Math.PI / 2;
      if (row === 10) {
        block(site, '#aa9176', x, h - .43, z, Math.PI * r / n + .025, .79, .64).rotation.y = a - Math.PI / 2;
      }
    }
  }
  block(site, '#c4a688', 0, .16, 5.1, 9.1, .48, 2.55);
  block(site, cream, 0, 1.27, 6.1, 9.1, 2.08, .49);
  for (const x of [-3.8, -2.5, 2.5, 3.8]) column(site, x, .4, 5, 2, .21);
  for (const x of [-2.9, 0, 2.9]) block(site, dark, x, 1.09, 5.84, .85, 1.5, .06);
  block(site, rust, 0, 2.4, 5.48, 9.45, .23, 1.8);
  for (const x of [-5, 5]) lamps.push({ x: 28 + x, y: y + 1.1, z: -3.6 });
}

function house(root: T.Group, lamps: Lamp[], x: number, z: number, w: number, d: number, rot: number, type: number) {
  const y = height(x, z);
  const site = group(root, x, y, z, rot);
  occupied.push([x, z, Math.hypot(w, d) * .52]);
  const h = type === 1 ? between(3.5, 4.4) : between(2.25, 2.95);
  const color = pick(plaster);
  const plinth = .48 + Math.max(...[-1, 1].flatMap(a => [-1, 1].map(b => {
    const dx = w / 2 * a;
    const dz = d / 2 * b;
    return y - height(x + dx * Math.cos(rot) + dz * Math.sin(rot), z - dx * Math.sin(rot) + dz * Math.cos(rot));
  })));
  block(site, '#a48a70', 0, -plinth / 2, 0, w + .2, plinth + .18, d + .2);
  block(site, color, 0, h / 2, 0, w, h, d);
  block(site, '#b9a287', 0, .26, d / 2, w + .08, .51, .15);
  if (type === 3) {
    block(site, '#c0a47d', 0, h + .06, 0, w + .28, .18, d + .29);
    masonry(site, 0, h, -d / 2, w, .29, .19);
    masonry(site, 0, h, d / 2, w, .29, .19);
    jar(site, w * .28, h + .17, d * .24, .65);
  } else {
    roof(site, h, w + .48, d + .54, w * (type === 1 ? .21 : .25));
  }

  const door = type === 2 ? -.2 * w : .12 * w;
  block(site, wood, door, .95, d / 2 + .041, .72, 1.75, .11);
  block(site, '#84634b', door, 1.85, d / 2 + .1, .91, .15, .24);
  block(site, cream, door, .1, d / 2 + .25, 1.16, .21, .57);
  for (let j = 0; j < 5; j++) {
    block(site, dark, door - .28 + j * .14, .91, d / 2 + .108, .025, 1.59, .034);
  }
  for (const level of type === 1 ? [1.48, 2.91] : [1.64]) {
    for (const side of [-1, 1]) {
      const px = side * w * .32;
      block(site, dark, px, level, d / 2 + .04, .49, .63, .07);
      block(site, pick([wood, blue, '#587266']), px + side * .24, level, d / 2 + .1, .21, .66, .09);
      block(site, cream, px, level - .35, d / 2 + .11, .63, .11, .26);
      block(site, dark, side * (w / 2 + .023), level, -.2, .065, .56, .38);
      block(site, dark, px, level, -d / 2 - .025, .39, .50, .07);
    }
  }
  for (let i = 0; i < 9; i++) {
    const p = between(-.47, .47) * w;
    block(site, pick(limestone), p, between(.36, .78), d / 2 + .016, between(.2, .6), .13, .062);
  }

  if (type === 2) {
    const wing = group(site, -w * .33, 0, d / 2 + .56);
    block(wing, color, 0, .8, .36, w * .34, 1.61, 1.84);
    roof(wing, 1.61, w * .39, 2.1, .44);
    jar(site, w * .29, .05, d / 2 + .4, .68);
  }
  if (type === 1) {
    const stair = group(site, w / 2 + .32, 0, -.5);
    for (let i = 0; i < 8; i++) {
      const h = (i + 1) * .24;
      block(stair, pick(limestone), 0, h / 2, 1.18 - i * .29, .82, h, .35);
    }
    block(site, wood, w / 2 + .04, 2.8, -1.48, .14, 1.62, .66);
  }
  if (random() < .22) lamps.push({ x: x + w * .33, y: y + 1.5, z: z + d / 2 + .4 });
}

function agora(root: T.Group, lamps: Lamp[]) {
  const site = group(root, .8, 5.11, 3.2);
  block(site, '#baa07b', 0, .04, 0, 19.2, .18, 11.4);
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 12; j++) {
      block(site, pick(['#c7af8e', '#d2ba99', '#dcc3a1', '#cbb493']), (i - 12.5) * .73, .15, (j - 5.5) * .94, .70, .075, .91);
    }
  }
  const stoa = group(site, -.6, .22, -4.34, -Math.PI / 2);
  block(stoa, cream, 0, .18, 0, 3.25, .36, 17.5);
  block(stoa, '#bfa17f', -1.25, 1.59, 0, .25, 2.55, 17.46);
  for (let i = 0; i < 11; i++) column(stoa, 1.23, .36, i * 1.57 - 7.85, 2.42, .24);
  block(stoa, cream, 0, 2.9, 0, 3.38, .31, 17.65);
  roof(stoa, 3.05, 3.72, 17.86, .88);
  for (const [x, z, color] of [[-7, -1, rust], [-7, 2.7, '#cb9b53'], [6.3, -.45, blue], [6.6, 3.1, rust]] as const) {
    const stall = group(site, x, .22, z, between(-.15, .15));
    for (const a of [-1.27, 1.27]) {
      for (const b of [-.81, .81]) block(stall, wood, a, 1.1, b, .09, 2.2 + a * .13, .09);
    }
    for (let i = 0; i < 9; i++) {
      const cloth = block(stall, i % 3 === 0 ? '#e9d3a8' : color, (i - 4) * .31, 2.15 + Math.sin(i * .39) * .13, 0, .32, .075, 1.99);
      cloth.rotation.z = .08 * Math.cos(i * .39);
      block(stall, i % 3 === 0 ? '#e9d3a8' : color, (i - 4) * .31, 2, 1, .32, .31, .037);
    }
    block(stall, wood, 0, .77, .25, 2.31, .19, .87);
    for (let i = 0; i < 6; i++) jar(stall, between(-1.01, 1.01), i < 4 ? .87 : 0, between(-.46, .66), between(.35, .65));
  }
  const statue = group(site, 0, .22, .78);
  block(statue, cream, 0, .1, 0, 2.16, .2, 2.06);
  block(statue, '#be9c77', 0, .52, 0, 1.22, .84, 1.19);
  block(statue, cream, 0, .96, 0, 1.48, .18, 1.42);
  const patina = '#55746a';
  piece(statue, new T.CylinderGeometry(.25, .4, 1.5, 11), patina, 0, 1.77, 0);
  rock(statue, patina, 0, 2.65, 0, .32, .42, .24);
  block(statue, patina, .43, 2.05, 0, .21, .89, .23).rotation.z = .58;
  block(statue, wood, .72, 2.22, 0, .067, 2.76, .067);
  for (const x of [-8.6, 9.4]) lamps.push({ x, y: 6.4, z: 7.7, large: x > 0 });
}

const houses: [number, number, number, number, number, number][] = [
  [-38,-4,4.8,4.1,.22,1],[-31,-3,4.7,3.6,.13,0],[-25,-4,3.9,4.5,-.11,3],[-19,-4,4.3,3.7,.16,2],
  [-43,3,5.8,3.8,.31,2],[-36,4,4.2,4.1,.22,3],[-30,5,4.3,3.4,.12,1],[-23,5,4.9,4.25,-.15,0],[-16,5,4.1,3.4,.05,0],
  [-46,11,4.3,3.7,.28,0],[-39,11,5.5,4.5,.33,1],[-32,12,5,4.8,.19,2],[-24,13,4.7,3.9,.11,3],[-17,12,4.9,4.4,-.19,2],[-10,12,3.9,3.65,.1,0],
  [-42,19,4.7,3.3,.46,0],[-36,19,3.7,3.7,.24,1],[-30,20,4.9,4,.18,0],[-23,20,5.9,4.3,-.01,2],[-15,19,4.2,4.2,-.24,1],[-8,18,4.45,3.5,.06,3],
  [-45,-12,3.9,4,.42,2],[-39,-11,4.2,4.3,.22,0],[-12,-4,4.5,3.1,-.18,1],[-6,-7,4.35,4,-.14,2],[.6,-9,4.9,3.7,-.08,3],[7,-9,5,4.5,.29,1],
  [1,-18,4.7,3.7,-.28,2],[8,-19,4,4.1,.1,0],[15,-16,4.2,3.9,.21,1],[9,-26,4.8,4.5,.31,0],
  [40,1,5,3.7,-.3,0],[46,2,4.4,4.2,-.22,1],[50,9,4.6,3.8,-.18,2],[42,9,4.6,3.8,-.29,3],
  [38,15,5,4.3,-.23,1],[45,16,5,3.7,-.32,2],[50,18,4,4.2,-.38,0],[35,6,3.7,3.2,-.28,2],
  [9,13,4.5,3.8,.07,0],[15,13,4.5,3.9,.04,3],[23,13,6,4.6,-.04,0],[29,13,4,3.8,-.12,0],
];

const treePalette = ['#68774a', '#829065', '#778558', '#929a65', '#566a4a'];
function grove(root: T.Group, roads: T.CatmullRomCurve3[]) {
  const track = roads.flatMap(road => road.getSpacedPoints(Math.ceil(road.getLength() / 2)));
  for (let i = 0; i < 740; i++) {
    const x = between(-64, 64);
    const z = between(-65, 30);
    const y = height(x, z);
    if (y < .5 || (x > -36 && x < -3 && z < -10 && z > -37) ||
      (x > -10 && x < 12 && z > -4 && z < 10) || (x > 3 && x < 27 && z > 10 && z < 19) ||
      Math.hypot(x - 28, z + 8) < 12.8 ||
      occupied.some(([a,b,r]) => Math.hypot(x-a,z-b) < r + .55) ||
      track.some(p => Math.hypot(x - p.x, z - p.z) < 1.37)) continue;
    const tall = random();
    if (tall < .14) {
      const h = between(2.35, 5.1);
      const tree = group(root, x, y - .16, z);
      block(tree, '#735744', 0, h * .22, 0, .2, h * .49, .19);
      for (let j = 0; j < 4; j++) {
        rock(tree, pick(['#344936', '#445b3d', '#5b6b44']), between(-.14,.14), h * (.36 + j * .14), between(-.11,.11),
          h * (.152 - j * .019), h * .29, h * (.14 - j * .018));
      }
    } else if (tall < .32) {
      const s = between(.69, 1.38);
      block(root, '#806754', x, y + .79 * s, z, .25 * s, 1.8 * s, .26 * s).rotation.z = between(-.18, .18);
      for (let j = 0; j < 5; j++) {
        rock(root, pick(treePalette), x + between(-1,1) * s, y + between(1.6,2.45)*s, z + between(-.82,.82)*s,
          between(.66,1.2)*s, between(.46,.78)*s, between(.63,1.04)*s);
      }
    } else {
      const s = tall > .71 ? between(.24, .84) : between(.45, 1.6);
      rock(root, tall > .71 ? pick(treePalette) : pick(limestone), x, y + s * .11, z, s, s * .54, s * .8);
    }
  }
  for (let i = 0; i < 110; i++) {
    const x = between(-60, 60);
    if (x > -5 && x < 34) continue;
    const z = coast(x) + between(-2.2, 3.3);
    const s = between(.29, 2.5);
    rock(root, pick(['#b99f84', '#988674', '#a38e79', '#c4ae95']), x, Math.max(-.45, height(x,z)), z, s, s * between(.37,.79), s * .75);
  }
}

function harbour(root: T.Group, lamps: Lamp[]) {
  masonry(root, 15, -.7, 18.27, 26, 2.39, 1.65);
  block(root, '#c3a487', 15, 1.76, 17.38, 26, .27, 3.7);
  for (const x of [6, 21]) {
    const d = x === 6 ? 9.8 : 12.3;
    const pier = group(root, x, .91, 18.25 + d / 2);
    for (let j = -d / 2; j <= d / 2; j += .32) block(pier, pick(['#997352','#ad8560','#85664c']), 0, .34, j, 2.8, .2, .3);
    for (const side of [-1, 1]) {
      for (let j = -d / 2; j <= d / 2; j += 1.8) {
        block(pier, wood, side * 1.2, .08, j, .24, 2.02, .27);
      }
    }
    for (let j = 0; j < 3; j++) block(pier, '#a38463', 0, .78 - .14*j, -d / 2 + j * .37, 2.9, .54 - .12*j, .46);
    lamps.push({ x, y: 1.76, z: 17.8 + d, large: x === 21 });
  }
  for (let z = 19; z < 34.8; z += .82) {
    for (let x = 32.9; x <= 35.1; x += .72) rock(root, pick(limestone), x + between(-.29,.29), .26, z,
      between(.68,1.2), between(.71,1.17), between(.65,1.13));
  }
  const beacon = group(root, 34, .8, 33.5);
  block(beacon, cream, 0, .2, 0, 3.55, .42, 3.47);
  block(beacon, '#b79773', 0, 1.75, 0, 2.63, 2.9, 2.59);
  for (const x of [-.92,.92]) for (const z of [-.91,.91]) column(beacon, x, 3.25, z, 1.38, .17);
  block(beacon, cream, 0, 3.23, 0, 2.97, .31, 2.94);
  roof(beacon, 4.69, 2.86, 2.85, .77);
  lamps.push({ x: 34, y: 3.77, z: 33.5, large: true });
  for (const x of [3.8, 12.7, 19, 26.4]) {
    for (let i = 0; i < 6; i++) {
      const z = between(16.42, 17.11);
      if (i < 3) jar(root, x + i * .46, 1.91, z, between(.49, .91));
      else {
        block(root, wood, x + i * .47, 2.19, z, .59, .56, .64).rotation.y = between(-.2,.2);
        block(root, '#9b744e', x + i * .47, 2.26, z + .33, .61, .095, .05);
      }
    }
  }
}

export function city(scene: T.Scene) {
  const root = new T.Group();
  const lamps: Lamp[] = [];
  temple(root, lamps);
  theatre(root, lamps);
  agora(root, lamps);
  harbour(root, lamps);
  houses.forEach(h => house(root, lamps, ...h));

  const routes: [number, number][][] = [
    [[-44,15.4],[-34,15.7],[-24,16.4],[-15,15],[-7,15.2],[0,13],[2,8.2]],
    [[-44,7.6],[-34,8],[-27,8.9],[-19,8.5],[-12,8.4],[-8,5.4]],
    [[-43,-7.5],[-34,-7.2],[-27,-8.4],[-20,-8.5],[-18,-11.6]],
    [[-10,2.5],[-12,-.2],[-16,.3],[-21,1.2],[-26,-.3],[-34,.02],[-44,-.8]],
    [[1,-2],[3,-5.5],[9,-5.9],[14,-8.1],[17,-12],[15,-20],[7,-22],[-2,-20],[-7,-15],[-12,-13.7],[-16,-11.8]],
    [[8,7.5],[13,8.5],[19,8.5],[23,7.1],[28,4],[29,-.5]],
    [[2,8.6],[3,11.8],[3.3,16.5],[6.2,17.8]],
    [[29,4],[34,2.5],[39,4.7],[46,5.5],[52,3.1]],
    [[46,5.5],[47,10.5],[45,12.1],[38,11.6],[33,12.2],[29,16.5],[27,17.7]],
  ];
  const roads = routes.map((route, i) => path(root, route, i === 4 ? 2.05 : 1.65));
  for (const [x, z, sx, sz] of [[3,10.5,0,.4],[-9,7.2,-.33,.19]]) {
    for (let i = 0; i < 6; i++) {
      const px = x + sx * i;
      const pz = z + sz * i;
      block(root, pick(limestone), px, height(px,pz) + .075, pz, 1.77, .22, .44).rotation.y = Math.atan2(sx,sz);
    }
  }
  // Long retaining courses expose the transition between terraces from the harbour.
  for (const [x,z,w,drop] of [[-34,15,8,1.07],[-21,9.1,7,1.03],[-.3,9.13,6,1.3],
    [8.2,9.13,6,1.4],[19.25,11.4,5.15,1.06],[-26,-1.11,6,1.43]]) {
    const y = height(x,z);
    masonry(root,x,y-drop,z,w,drop+.14,.48);
  }
  const ascent = [[-12.2,-8.5],[-13.6,-8.9],[-15.4,-9.4],[-16.8,-10.45],[-18,-11.8]];
  const stair = new T.CatmullRomCurve3(ascent.map(([x,z]) => new T.Vector3(x,0,z)));
  const segments = stair.getSpacedPoints(25);
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i], b = segments[i+1];
    const x = (a.x+b.x)/2, z = (a.z+b.z)/2;
    const top = Math.max(height(a.x,a.z),height(b.x,b.z)) + .14;
    const h = top - Math.min(height(a.x,a.z),height(b.x,b.z)) + .57;
    block(root,pick(limestone),x,top-h/2,z,2.32,h,a.distanceTo(b)+.08).rotation.y = Math.atan2(b.x-a.x,b.z-a.z);
  }
  for (let i = 0; i < 48; i++) {
    const x = between(-37,-3);
    const z = between(-15.5,-10.5);
    if (x > -20 && x < -12) continue;
    const s = between(.42,2.15);
    const y = height(x,z);
    rock(root,pick(['#b3997c','#a48a70','#c0a68a']),x,y-.09,z,s,s*between(.44,.86),s*.7);
  }
  grove(root, roads);
  bake(root, scene);
  return lamps;
}
