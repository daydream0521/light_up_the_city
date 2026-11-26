import * as T from 'three';
import dataset from './map.json';
import {add,bake,box,extrude,inside,randomSeed,shape,stone,strip,type Polygon,type XY} from './geometry';
import {glass,luminous} from './lighting';
import {landmarks,sites} from './landmarks';

export const banks = dataset.banks as XY[][];
export const roads = dataset.roads as [number,XY[]][];
const random=randomSeed(91913);
const choose=<V>(v:V[])=>v[Math.floor(random()*v.length)];
const heritage=['#a99b87','#b4a392','#c6b39a','#8d7770','#ae9e93','#a59884'];
const modern=['#60859b','#7395a7','#507691','#436985','#839eaa','#598199'];
const concrete=['#727f92','#969594','#9f9c9a','#7d8490','#ada49b'];
const facade=luminous('#ca8e56',0,.32);
const historicWall=luminous('#d89555',0,.23);
const lamps=luminous('#ffd099',2,1.95);
const bulb=new T.SphereGeometry(1,10,7);
const leaves=new T.IcosahedronGeometry(1,1);
const column=new T.CylinderGeometry(1,1,1,8);
const dome=new T.SphereGeometry(1,28,12,0,Math.PI*2,0,Math.PI/2);
const noInfill=Object.entries(sites).map(([id,[x,z]])=>[x,z,id==='pearl'?9:id==='tower'?7.5:['customs','peace'].includes(id)?4.7:6.1]);
const buildingData=dataset.buildings as [Polygon,number|null,number|null,string,string][];

export function bankAt(side:number,z:number) {
  const points=banks[side];
  if(z<=points[0][1]) return points[0][0];
  if(z>=points.at(-1)![1]) return points.at(-1)![0];
  const i=points.findIndex(p=>p[1]>=z);
  const [a,s]=points[i-1],[b,t]=points[i];
  return T.MathUtils.lerp(a,b,(z-s)/(t-s));
}

function center(ring:XY[]) {
  return ring.reduce(([a,b],[x,z])=>[a+x/ring.length,b+z/ring.length],[0,0] as XY);
}

function historical(rings:Polygon,h:number,kind:string) {
  add(extrude(rings,h),historicWall,kind,0,.24,0);
  const path=rings[0];
  for(let j=0;j<path.length;j++){
    const [ax,az]=path[j],[bx,bz]=path[(j+1)%path.length];
    const dx=bx-ax,dz=bz-az,wide=Math.hypot(dx,dz);
    if(wide<.65)continue;
    const a=Math.atan2(-dz,dx);
    let nx=-dz/wide,nz=dx/wide;
    if(inside((ax+bx)/2+nx*.12,(az+bz)/2+nz*.12,path)){nx=-nx;nz=-nz;}
    for(const y of [.5,h*.48,h-.04]){
      box(facade,'#c5b295',(ax+bx)/2+nx*.008,.25+y,(az+bz)/2+nz*.008,wide+.058,.095,.16,a);
    }
    const rows=Math.min(7,Math.max(2,Math.round(h/.56)));
    const cells=Math.floor(wide/.57);
    for(let i=0;i<cells;i++){
      const t=(i+.5)/cells;
      const x=ax+dx*t+nx*.033,z=az+dz*t+nz*.033;
      for(let r=1;r<rows;r++){
        const y=.27+h*r/rows;
        box(stone,'#4a4e54',x,y,z,.219,.29,.065,a);
        if(r===1||r===rows-1)box(facade,'#bba47e',x+nx*.021,y-.17,z+nz*.021,.275,.068,.11,a);
      }
    }
  }
}

function cityBlocks() {
  for(const [rings,height,levels,name] of buildingData) {
    const poly=rings[0];
    const [x,z]=center(poly);
    const w=Math.max(...poly.map(p=>p[0]))-Math.min(...poly.map(p=>p[0]));
    const d=Math.max(...poly.map(p=>p[1]))-Math.min(...poly.map(p=>p[1]));
    if(noInfill.some(([a,b,r])=>Math.hypot(x-a,z-b)<r || inside(a,b,poly)))continue;
    if(/Oriental Pearl|Shanghai Tower|World Financial Center|Jin Mao Tower|Customs House|Peace Hotel|东方明珠|上海环球金融中心|金茂大厦|上海中心大厦|上海海关大楼|和平饭店北楼/i.test(name))continue;
    const outer=x<-126||x>147||z<-134||z>133;
    const old=x<bankAt(0,z)&&Math.abs(x-bankAt(0,z))<21&&z>-67&&z<64;
    const measured=height!==null?height/10:levels!==null?levels*.36:null;
    const east=x>bankAt(1,z);
    const green=Math.hypot(x-29,z+36)<12;
    const bulge=Math.exp(-Math.hypot(x-54,z+5)/43);
    const high=east&&!green&&!old && Math.min(w,d)>3.2 && random()<.4;
    const estimate=old ? 2.9+random()*1.35 : high ? 5.7+random()*bulge*15 : 1.8+random()*3.5;
    let h=Math.max(.34,Math.min(old?7.7:38,measured??estimate));
    if(w*d<2.7&&measured===null)h=Math.min(h,1.8);
    if(old&&Math.min(w,d)>1.5) {
      historical(rings,h,choose(heritage));
      continue;
    }
    const tower=h>4.9&&Math.min(w,d)>2.1;
    if(outer){
      add(extrude(rings,h),tower?glass[1]:stone,choose(tower?modern:concrete),0,.24,0);
      continue;
    }
    const material=tower?glass[east?0:1]:stone;
    const color=choose(tower?modern:concrete);
    if(tower) add(extrude(rings,Math.min(1.12,h*.24)),stone,'#747d87',0,.24,0);
    const podium=tower?Math.min(1.15,h*.24):0;
    add(extrude(rings,h-podium),material,color,0,.24+podium,0);
    const roofPoint=inside(x,z,poly)&&!rings.slice(1).some(r=>inside(x,z,r));
    if(tower&&roofPoint && random()>.16){
      box(stone,'#80909a',x,h+.54,z,Math.min(w*.31,2.4),.61,Math.min(d*.28,2.7));
      if(h>11)box(stone,'#9da8af',x,h+.92,z,.056,1.52,.056);
    }
  }
}

export function createCity(scene:T.Scene) {
  for(const polygon of dataset.land as Polygon[])add(extrude(polygon,1.40),stone,'#636976',0,-1.16,0);
  for(const polygon of dataset.parks as Polygon[]){
    const geometry=new T.ShapeGeometry(shape(polygon)).rotateX(-Math.PI/2);
    add(geometry,stone,'#557364',0,.27,0);
  }
  for(const [level,coords] of roads){
    if(coords.length<2)continue;
    const widths=[.19,.55,1.0,1.63];
    const tints=['#90908b','#747981','#616976','#515d6c'];
    add(strip(coords,widths[level],.287+level*.012),stone,tints[level]);
    if(level>=2){
      for(let i=1;i<coords.length;i++){
        const [ax,az]=coords[i-1],[bx,bz]=coords[i];
        const dx=bx-ax,dz=bz-az,l=Math.hypot(dx,dz);
        for(let k=1;k<l;k+=1.8)box(stone,'#9d9680',ax+dx*k/l,.336+level*.008,az+dz*k/l,.51,.012,.034,Math.atan2(-dz,dx));
      }
    }
  }
  for(const [side,points] of banks.entries()){
    const sign=side===0?-1:1;
    const promenade=points.filter(([x,z])=> Math.abs(z)<121 && (side===0?x>-110:x<110));
    const edge=promenade.map(([x,z])=>[x+sign*.54,z] as XY);
    const path=edge.map(([x,z])=>[x+sign*.72,z] as XY);
    add(strip(edge,1.54,.34),stone,side===0?'#aa9f8e':'#818c8e');
    add(strip(path,.09,.47),lamps,'#a2947b');
    for(let i=1;i<edge.length;i++){
      const [x,z]=edge[i], [a,b]=edge[i-1];
      if(Math.hypot(x-a,z-b)>9)continue;
      box(stone,'#a4a29f',(a+x)/2,.55,(b+z)/2,Math.hypot(x-a,z-b),.07,.082,Math.atan2(b-z,x-a));
      if(i%2===0){
        box(stone,'#4a515e',x,.98,z,.066,1.27,.066);
        add(bulb,lamps,'#fff0c4',x,1.63,z,.123,.10,.123);
      }
      if(i%2===1&&random()<.65) {
        const xx=x+sign*(2.2+random()*.72);
        const h=.72+random()*.67;
        add(column,stone,'#716358',xx,.28+h*.3,z,.062,h*.64,.061);
        add(leaves,stone,choose(['#47644e','#5d755e','#3f6555']),xx,.54+h*.72,z,.49,h*.41,.49);
      }
    }
  }
  for(const [side,z] of [[0,23],[1,31]]) {
    const sign=side===0?-1:1;
    const x=bankAt(side,z);
    box(stone,'#797d85',x-sign*1.26,.23,z,3.65,.13,1.32);
    box(stone,'#8b7360',x-sign*2.9,.17,z,1.27,.21,5.1);
    for(let k=-2;k<=2;k++){
      box(stone,'#646878',x-sign*3.35,.24,z+k*.91,.12,.48,.12);
    }
    box(lamps,'#dac9a8',x-sign*2.9,.305,z,.085,.047,4.9);
  }
  cityBlocks();
  // The classical dome beside the Customs House reinforces the riverside silhouette.
  const [x,z]=sites.customs;
  const hz=z+7.6;
  box(facade,'#b9a990',x-.31,2.89,hz,3.6,.85,3.89);
  add(column,facade,'#bfb098',x-.31,3.52,hz,1.07,.67,1.07);
  add(dome,stone,'#80928e',x-.31,3.77,hz,1.08,.90,1.08);
  landmarks();
  bake(scene);
}
