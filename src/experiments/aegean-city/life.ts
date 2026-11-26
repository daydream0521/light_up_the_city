import * as T from 'three';
import type { Lamp } from './city';
import { bake, between, block, clay, group, jar, pick, piece, rock, wood } from './model';
import { height } from './terrain';

function hull(length: number, width: number) {
  const verts: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const count = 32;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const tip = Math.pow(Math.sin(t * Math.PI), .65);
    const z = (t - .5) * length;
    const w = (.055 + tip * .945) * width * .5;
    const sheer = .24 + .54 * (1 - tip) + .4 * t ** 9;
    for (const [x,y,c] of [[-1,sheer,'#815136'],[-.94,sheer-.13,'#c08651'],
      [-.83,sheer-.28,'#6d3c2b'],[0,-.43+sheer*.35,'#50362e'],[.83,sheer-.28,'#6d3c2b'],
      [.94,sheer-.13,'#c08651'],[1,sheer,'#815136']] as const) {
      verts.push(w*x,y,z);
      const color = new T.Color(c);
      colors.push(color.r,color.g,color.b);
    }
    if (i) {
      for (let j = 0; j < 6; j++) {
        const a = (i - 1) * 7 + j;
        index.push(a,a+1,a+7,a+1,a+8,a+7);
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(verts,3));
  g.setAttribute('color', new T.Float32BufferAttribute(colors,3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function sail(parent: T.Group, w: number, h: number, y: number, blue: boolean) {
  const g = new T.PlaneGeometry(w,h,18,12);
  const color = new T.Color();
  const colors: number[] = [];
  for (let i = 0; i < g.attributes.position.count; i++) {
    const x = g.attributes.position.getX(i);
    color.set(blue && Math.abs(x) > w*.32 ? '#647c84' : '#e9d5ad');
    color.multiplyScalar(.93 + .07*Math.cos(x*11));
    colors.push(color.r,color.g,color.b);
  }
  g.setAttribute('color', new T.Float32BufferAttribute(colors,3));
  const mesh = new T.Mesh(g, new T.MeshStandardMaterial({ side: T.DoubleSide, vertexColors: true, roughness: 1 }));
  mesh.position.y = y;
  mesh.castShadow = true;
  parent.add(mesh);
  return (t: number) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const v = p.getY(i) / h + .5;
      p.setZ(i, Math.cos(x / w * Math.PI) * (Math.sin(v*2.68)*.68 + Math.sin(t*2.1+x*2+v*4)*.10));
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
  };
}

function ship(scene: T.Scene, x: number, z: number, heading: number, scale: number, sailing: boolean) {
  const boat = group(scene,x,.22,z,heading);
  const fittings = new T.Group();
  boat.scale.setScalar(scale);
  const vessel = new T.Mesh(hull(7.1,2.12), new T.MeshStandardMaterial({ vertexColors:true, side:T.DoubleSide, roughness:.9 }));
  vessel.castShadow = vessel.receiveShadow = true;
  boat.add(vessel);
  for (let i = -6; i <= 6; i++) {
    const w = Math.sqrt(1-(i/7.4)**2) * 1.94;
    block(fittings,pick(['#a57952','#92704d','#b0865c']),0,.19 + Math.abs(i) * .018,i*.45,w,.14,.426);
  }
  const mast = sailing ? 5.15 : 3.5;
  block(fittings,wood,0,mast*.5,0,.14,mast,.14);
  block(fittings,'#ab805b',0,mast-.14,0,sailing ? 4.1 : 2.8,.12,.125);
  for (const x of [-.8,.8]) {
    const stays = [new T.Vector3(x,.38,.55),new T.Vector3(0,mast-.07,0),new T.Vector3(x*.55,.53,-2.65)];
    boat.add(new T.Line(new T.BufferGeometry().setFromPoints(stays),new T.LineBasicMaterial({ color:'#79614c' })));
  }
  for (const side of [-1,1]) {
    for (let i = 0; i < (sailing ? 4 : 6); i++) {
      const oar = block(fittings,'#907054',1.19*side,.20,-1.74+i*.57,1.26,.055,.064);
      oar.rotation.z = -.26 * side;
      oar.rotation.y = .23 * side;
      const blade = block(fittings,'#a78058',1.79*side,.035,-1.87+i*.57,.32,.05,.17);
      blade.rotation.copy(oar.rotation);
    }
  }
  for (let i = 0; i < 4; i++) jar(fittings,between(-.65,.65),.28,between(.75,1.8),between(.3,.55));
  const cloth = sailing ? sail(boat,3.95,2.65,mast-1.56,x>10) : null;
  if (!sailing) block(fittings,'#d6bc94',0,mast-.24,0,2.68,.22,.28);
  bake(fittings,boat);
  return (t: number) => {
    boat.position.y = .21 + Math.sin(t*1.35 + x)*.095;
    boat.position.x = x + Math.sin(t*.12+x) * (sailing ? 1.15 : .25);
    boat.position.z = z + Math.sin(t*.08+z) * (sailing ? 2.1 : .18);
    boat.rotation.set(Math.sin(t*1.15+x)*.025, heading+Math.sin(t*.23+z)*.045, Math.cos(t*1.6+x)*.045);
    cloth?.(t);
  };
}

function pennant(scene: T.Scene, x: number, y: number, z: number, color: string, tall: boolean) {
  const h = tall ? 3.5 : 2.65;
  const node = group(scene,x,y,z, .31);
  block(node,wood,0,h*.5,0,.094,h,.094);
  rock(node,'#c89762',0,h+.006,0,.091,.088,.094);
  const g = new T.PlaneGeometry(1.46,.66,16,5).translate(.73,h-.53,0);
  const flag = new T.Mesh(g, new T.MeshStandardMaterial({ color, side: T.DoubleSide, roughness:1 }));
  node.add(flag);
  const p = g.attributes.position;
  return (t: number) => {
    for (let i = 0; i < p.count; i++) {
      const l = p.getX(i);
      p.setZ(i, Math.sin(t*4.1-l*5.4)*l*.20);
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
  };
}

export function lampPower(progress: number, late: boolean): number {
  return late ? T.MathUtils.smoothstep(progress, .52, .94) : T.MathUtils.smoothstep(progress, .06, .46);
}

export function cityLife(scene: T.Scene, markers: Lamp[]) {
  const movers = [
    ship(scene,9.6,26.9,-.08,.81,false), ship(scene,17.4,28.1,-.23,1.12,true),
    ship(scene,27.4,35.8,.71,.88,true), ship(scene,-14.5,42.7,-.88,1.19,true),
    ship(scene,-30,51.7,1.34,.68,false),
    pennant(scene,-12,20.4,-14.5,'#ac5941',true), pennant(scene,-26.5,20.4,-14.5,'#a96844',true),
    pennant(scene,4.6,1.92,17.56,'#a3523c',true), pennant(scene,25.9,1.92,17.6,'#415b6f',true),
  ];
  for (const [x,z] of [[-12.6,-10.3],[-5.1,6.2],[11.8,3.1],[39.1,6.4]]) {
    const y = height(x,z);
    const tree = group(scene,x,y,z);
    block(tree,'#7a604e',0,.85,0,.29,1.74,.26).rotation.z = .14;
    const crown = group(tree,-.1,1.42,0);
    for (let i=0;i<8;i++) rock(crown,pick(['#798963','#87976b','#657956']),between(-.95,.95),between(.2,1),between(-.72,.72),between(.5,.9),between(.38,.67),between(.51,.86));
    movers.push(t => { crown.rotation.z = Math.sin(t*1.38+x)*.037; crown.rotation.x = Math.cos(t*1.5+z)*.024; });
  }
  const glowData = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const r = Math.hypot((x-15.5)/15.5, (y-15.5)/15.5);
      const i = (y*32+x)*4;
      glowData.set([255,174,69,Math.round(Math.max(0,1-r)**2.5*255)],i);
    }
  }
  const map = new T.DataTexture(glowData,32,32);
  map.colorSpace = T.SRGBColorSpace;
  map.needsUpdate = true;
  map.magFilter = T.LinearFilter;
  const flameGeometry = new T.SphereGeometry(.22, 9, 7);
  const fires = [...markers, { x:18,y:2.87,z:18.4,large:true,district:0 }].map(({x,y,z,large,district,late,revivalOnly}) => {
    const torch = group(scene,x,y,z);
    block(torch,wood,0,-.79,0,.11,1.38,.11);
    piece(torch,new T.CylinderGeometry(.24,.105,.21,9),pick(clay),0,-.12,0);
    const fire = new T.Mesh(flameGeometry,new T.MeshBasicMaterial({ color:'#ffd078', toneMapped:false }));
    fire.position.y = .09;
    torch.add(fire);
    const glow = new T.Sprite(new T.SpriteMaterial({ map, transparent:true, depthWrite:false, blending:T.AdditiveBlending, toneMapped:false }));
    glow.position.y = .16;
    torch.add(glow);
    const point = large ? new T.PointLight('#ff9a48',0,revivalOnly ? 15 : 10,1.8) : null;
    if (point) {
      point.position.set(0,.26,.25);
      torch.add(point);
    }
    return (t: number, night: number, progress?: readonly number[]) => {
      torch.visible = !revivalOnly || progress !== undefined;
      const power = progress ? lampPower(progress[district], !!late)
        : revivalOnly ? 0 : T.MathUtils.smoothstep(night, .16, .78);
      fire.visible = glow.visible = power > 0;
      const flicker = .83 + Math.sin(t*17+x) * .10 + Math.sin(t*11+z)*.10;
      const strength = power * flicker * (revivalOnly && large ? district === 3 ? 1.95 : 1.42 : 1);
      fire.scale.set(.53*strength,1.64*strength,.53*strength);
      fire.rotation.z = Math.sin(t*8+x)*.27;
      glow.scale.setScalar(2.9*strength);
      glow.material.opacity = Math.min(1, strength * .82);
      if (point) point.intensity = strength * (revivalOnly ? 73 : 43);
    };
  });
  return (t: number, night: number, progress?: readonly number[]) => {
    movers.forEach(move => move(t));
    fires.forEach(burn => burn(t,night,progress));
  };
}
