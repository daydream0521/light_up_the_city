import * as T from 'three';

export function seeded(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const smooth = T.MathUtils.smoothstep;
const mix = T.MathUtils.lerp;
export const coast = (x: number) => 18 + 12 * (1 - Math.exp(-((x - 9) ** 2) / 540))
  + 2.6 * Math.sin(x * .135) + 1.7 * Math.sin(x * .28 + 2);

export const shelves = [
  { x: -19, z: -24, w: 30, d: 24.5, y: 20.4, blend: 5 },
  { x: 1, z: 3, w: 21, d: 13, y: 5.1, blend: 4 },
  { x: 15, z: 14.4, w: 22, d: 6.4, y: 1.9, blend: 2 },
];

export function height(x: number, z: number) {
  const edge = (1 - Math.hypot((x + 2 + 2.6 * Math.sin(z * .18)) / 70,
    (z + 16 + 3.5 * Math.sin(x * .10)) / 56)) * 54;
  const bay = coast(x) - z;
  const quay = 18.55 - z;
  const shore = Math.min(edge, mix(bay, Math.min(bay,quay),
    smooth(x,0,4) * (1 - smooth(x,27,32))));
  const hill = 21 * Math.exp(-(((x + 19) / 26) ** 2) - (((z + 29) / 28) ** 2))
    + 8.7 * Math.exp(-(((x - 38) / 22) ** 2) - (((z + 37) / 28) ** 2));
  const grain = Math.sin(x * .18 + z * .087) * Math.cos(z * .21) * .85
    + Math.sin(x * .46 - z * .12) * Math.sin(z * .49 + x * .17) * .36
    + .21 * Math.sin(z * .89 + x * .64);
  let y = (1.1 + hill + grain) * smooth(shore, -1, 10)
    + Math.max(-9, Math.min(shore * .39, 1.1));
  for (const s of shelves) {
    const edge = Math.max(Math.abs(x - s.x) - s.w / 2, Math.abs(z - s.z) - s.d / 2);
    y = mix(s.y, y, smooth(edge, 0, s.blend));
  }
  // The auditorium cuts into the slope, with a lower approach in front of the stage.
  const r = Math.hypot((x - 28), (z + 8));
  const bowl = 4.2 + Math.max(0, r - 4.7) * (z < -8 ? .28 : .04);
  y = mix(bowl, y, smooth(r, 10.8, 14.5));
  return y;
}

export function landscape(scene: T.Scene) {
  const ground = new T.PlaneGeometry(158, 135, 193, 165);
  ground.rotateX(-Math.PI / 2);
  ground.translate(0, 0, -20);
  const pos = ground.attributes.position;
  const colors: number[] = [];
  const random = seeded(820);
  const ochre = new T.Color('#aa8c64');
  const grass = new T.Color('#7b8353');
  const stone = new T.Color('#c4a98b');
  const wet = new T.Color('#a1a583');
  const color = new T.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = height(x, z);
    pos.setY(i, y);
    const slope = Math.hypot(height(x + .6, z) - y, height(x, z + .6) - y);
    const patches = .5 + .28 * Math.sin(x * .15 + z * .19) + .19 * Math.sin(x * .52 - z * .37);
    color.copy(ochre).lerp(grass, smooth(patches, .17, .73))
      .lerp(stone, smooth(slope, .27, .88)).lerp(wet, 1 - smooth(y, .12, 1.35));
    color.multiplyScalar(.93 + random() * .13);
    colors.push(color.r, color.g, color.b);
  }
  ground.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(256, 256);
  for (let i = 0; i < image.data.length; i += 4) {
    const grain = 224 + random() * 31;
    image.data.set([grain, grain, grain, 255], i);
  }
  context.putImageData(image, 0, 0);
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(31, 24);
  texture.anisotropy = 4;
  const mesh = new T.Mesh(ground, new T.MeshStandardMaterial({
    vertexColors: true, roughness: 1, map: texture,
  }));
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Low islands sit across the strait outside the camera's playable range.
  const islands = [[-129,-290,104,43,29],[-289,-203,78,31,14],[79,-320,92,41,16],
    [187,-251,66,33,19],[-170,158,46,27,14],[224,110,58,23,17]];
  for (const [x,z,w,d,h] of islands) {
    const island = new T.PlaneGeometry(w*2,d*2,48,28).rotateX(-Math.PI/2);
    const p = island.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = p.getX(i) / w;
      const b = p.getZ(i) / d;
      const profile = Math.max(0, 1 - Math.hypot(a,b + .14*Math.sin(a*8+x)));
      const ridge = .79 + .22 * Math.sin(a*6+b*3) + .14*Math.sin(a*16-b*4);
      p.setY(i, Math.pow(profile,.91)*h*ridge - .41);
    }
    island.computeVertexNormals();
    const land = new T.Mesh(island, new T.MeshStandardMaterial({color:'#85919a', roughness:1}));
    land.position.set(x,0,z);
    scene.add(land);
  }
}

export function shoreDepth() {
  const size = 256;
  const pixels = new Uint8Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i + .5) / size * 180 - 90;
      const z = (j + .5) / size * 160 - 85;
      let depth = Math.max(0, -height(x, z));
      // Underwater shelves beneath the quays and the rubble breakwater.
      const wharf = Math.max(Math.abs(x - 15) - 13, Math.abs(z - 18) - 2);
      const mole = Math.max(Math.abs(x - 34) - 2, Math.abs(z - 26) - 9);
      depth = Math.min(depth, Math.max(0, Math.min(wharf, mole)) * .85);
      pixels[j * size + i] = Math.round(Math.min(1, depth / 8) * 255);
    }
  }
  const texture = new T.DataTexture(pixels, size, size, T.RedFormat);
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
