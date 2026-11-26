import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type XY = [number, number];
export type Polygon = XY[][];
export const mix = T.MathUtils.lerp;
export const smooth = T.MathUtils.smoothstep;
export const stone = new T.MeshStandardMaterial({ vertexColors:true, roughness:.83 });
const cube = new T.BoxGeometry();
const parts = new Map<T.Material, T.BufferGeometry[]>();
const transform = new T.Matrix4();
const position = new T.Vector3(), scale = new T.Vector3();
const rotation = new T.Quaternion();
const euler = new T.Euler();

export function randomSeed(value: number) {
  return () => {
    value = (Math.imul(value,1664525)+1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function add(geometry: T.BufferGeometry, material: T.Material, color: string|T.Color,
  x=0,y=0,z=0,w=1,h=1,d=1,ry=0,rz=0) {
  position.set(x,y,z);
  scale.set(w,h,d);
  rotation.setFromEuler(euler.set(0,ry,rz,'YXZ'));
  transform.compose(position,rotation,scale);
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  g.applyMatrix4(transform);
  const c = new T.Color(color);
  const p = g.attributes.position;
  const tint = new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++) tint.set([c.r,c.g,c.b],i*3);
  g.setAttribute('color',new T.BufferAttribute(tint,3));
  const list = parts.get(material) ?? [];
  list.push(g);
  parts.set(material,list);
}

export function box(material: T.Material, color: string, x: number,y: number,z: number,w: number,h: number,d: number,ry=0,rz=0) {
  add(cube,material,color,x,y,z,w,h,d,ry,rz);
}

export function bake(scene: T.Scene) {
  for(const [material, geometries] of parts) {
    const merged = mergeGeometries(geometries)!;
    const mesh = new T.Mesh(merged,material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    geometries.forEach(g=>g.dispose());
  }
  parts.clear();
}

export function shape(rings: Polygon) {
  const path = (ring: XY[], target: T.Path) => {
    ring.forEach(([x,z], i) => i ? target.lineTo(x,-z) : target.moveTo(x,-z));
    target.closePath();
    return target;
  };
  const result = path(rings[0],new T.Shape()) as T.Shape;
  result.holes = rings.slice(1).map(r=>path(r,new T.Path()));
  return result;
}

export function extrude(rings: Polygon, h: number) {
  return new T.ExtrudeGeometry(shape(rings),{ depth:h,bevelEnabled:false }).rotateX(-Math.PI/2);
}

export function inside(x: number,z: number,ring: XY[]) {
  let result=false;
  for(let j=ring.length-1,i=0;i<ring.length;j=i++) {
    const [a,b]=ring[i], [c,d]=ring[j];
    if ((b>z)!==(d>z) && x<(c-a)*(z-b)/(d-b)+a) result=!result;
  }
  return result;
}

export function strip(points: XY[], width: number, y: number) {
  const p: number[] = [], uv: number[] = [], idx: number[] = [];
  for(let i=0;i<points.length;i++){
    const [x,z]=points[i];
    const a=points[Math.max(i-1,0)],b=points[Math.min(i+1,points.length-1)];
    const dx=b[0]-a[0],dz=b[1]-a[1],n=Math.hypot(dx,dz)||1;
    p.push(x+dz*width*.5/n,y,z-dx*width*.5/n,x-dz*width*.5/n,y,z+dx*width*.5/n);
    uv.push(0,i,1,i);
    if(i) {const k=i*2;idx.push(k-2,k-1,k,k,k-1,k+1);}
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function loft(rings: T.Vector3[][]) {
  const p:number[]=[], uv:number[]=[], idx:number[]=[];
  const k=rings[0].length;
  let u=0;
  for(let j=0;j<rings.length;j++) {
    u=0;
    for(let i=0;i<=k;i++) {
      const v=rings[j][i%k];
      if(i)u+=rings[0][i%k].distanceTo(rings[0][(i-1)%k]);
      p.push(v.x,v.y,v.z);uv.push(u,v.y);
      if(j&&i) {
        const a=j*(k+1)+i;
        idx.push(a-k-2,a-1,a-k-1,a-k-1,a-1,a);
      }
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
