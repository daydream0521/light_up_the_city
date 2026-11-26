import * as T from 'three';
import dataset from './map.json';
import {add,bake,box,extrude,inside,randomSeed,shape,stone,strip,type Polygon,type XY} from './geometry';
import {glass,luminous} from './lighting';
import {land,onDisplay,table} from './display';
import {landmarks,sites} from './landmarks';
import {historic} from './heritage';

export const banks = dataset.banks as XY[][];
export const roads = dataset.roads as [number,XY[]][];
const random=randomSeed(91913);
const choose=<V>(v:V[])=>v[Math.floor(random()*v.length)];
const heritage=['#a99b87','#b4a392','#c6b39a','#8d7770','#ae9e93','#a59884'];
const modern=['#3d7185','#587b98','#567d79','#375d78','#8b9eb1','#728ea6'];
const concrete=['#727f92','#969594','#9f9c9a','#7d8490','#ada49b'];
const lamps=luminous('#ffd099',2,1.95);
const bulb=new T.SphereGeometry(1,10,7);
const leaves=new T.IcosahedronGeometry(1,1);
const column=new T.CylinderGeometry(1,1,1,8);
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

function cityBlocks() {
  for(const [rings,height,levels,name,id] of buildingData) {
    const poly=rings[0];
    const [x,z]=center(poly);
    if(!poly.every(([a,b])=>onDisplay(a,b)))continue;
    const w=Math.max(...poly.map(p=>p[0]))-Math.min(...poly.map(p=>p[0]));
    const d=Math.max(...poly.map(p=>p[1]))-Math.min(...poly.map(p=>p[1]));
    if(noInfill.some(([a,b,r])=>Math.hypot(x-a,z-b)<r || inside(a,b,poly)))continue;
    if(/Oriental Pearl|Shanghai Tower|World Financial Center|Jin Mao Tower|Customs House|Peace Hotel|东方明珠|上海环球金融中心|金茂大厦|上海中心大厦|上海海关大楼|和平饭店北楼/i.test(name))continue;
    const outer=x<-125||x>94||z<-88||z>55;
    const old=x<bankAt(0,z)&&Math.abs(x-bankAt(0,z))<14&&z>-67&&z<64;
    const measured=height!==null?height/10:levels!==null?levels*.36:null;
    const east=x>bankAt(1,z);
    const green=Math.hypot(x-29,z+36)<12;
    const bulge=Math.exp(-Math.hypot(x-54,z+5)/43);
    const high=east&&!green&&!old && Math.min(w,d)>3.2 && random()<.4;
    const estimate=old ? 2.9+random()*1.35 : high ? 5.7+random()*bulge*15 : 1.8+random()*3.5;
    let h=Math.max(.34,Math.min(old?6.0:24,measured??estimate)*(old?1:.72+.28*Math.exp(-Math.hypot(x-43,z+20)/85)));
    if(w*d<2.7&&measured===null)h=Math.min(h,1.8);
    if(old&&Math.min(w,d)>1.5) {
      historic(rings,h,choose(heritage),id);
      continue;
    }
    const tower=h>4.9&&Math.min(w,d)>2.1;
    if(outer){
      add(extrude(rings,h),tower?glass[1]:stone,choose(tower?modern:concrete),0,.24,0);
      continue;
    }
    const material=tower?glass[east&&h>8.1?0:1]:stone;
    const color=choose(tower?modern:concrete);
    const kind=Math.abs(Math.floor(x*11+z*17))%5;
    const inset=(s:number)=>rings.map(r=>r.map(([a,b])=>[x+(a-x)*s,z+(b-z)*s] as XY));
    if(Math.min(w,d)>1.1)add(extrude(inset(1.027),.026),stone,'#595550',0,.24,0);
    const podium=tower?Math.min(kind===2?2.1:1.20,h*.29):Math.min(.34,h*.24);
    add(extrude(rings,podium),tower&&kind===2?glass[0]:stone,'#818787',0,.24,0);
    const setback=tower&&kind===1;
    const body=tower&&kind!==4?inset(kind===2?.82:.93):rings;
    const split=setback?h*.72:h;
    add(extrude(body,split-podium),material,color,0,.24+podium,0);
    if(setback){
      add(extrude(inset(.76),h-split),glass[0],color,0,.24+split,0);
      add(extrude(inset(.95),.105),stone,'#9babb1',0,.23+split,0);
    }else if(tower&&kind===3){
      for(let y=podium+1.05;y<h;y+=1.63)add(extrude(inset(.96),.14),stone,'#a9b1ad',0,.24+y,0);
    }
    if(!setback&&h>1.2)add(extrude(tower?inset(kind===4?1.004:.95):inset(1.013),.11),stone,tower?'#9ca9ae':'#a8a198',0,.236+h,0);
    const roofPoint=inside(x,z,poly)&&!rings.slice(1).some(r=>inside(x,z,r));
    if(tower&&roofPoint && random()>.16){
      box(stone,'#80909a',x,h+.54,z,Math.min(w*.31,2.4),.61,Math.min(d*.28,2.7));
      if(h>11)box(stone,'#9da8af',x,h+.92,z,.056,1.52,.056);
    }
  }
}

export function createCity(scene:T.Scene) {
  table(scene);
  for(const polygon of land)add(extrude(polygon,1.40),stone,'#9b927d',0,-1.16,0);
  for(const polygon of dataset.parks as Polygon[]){
    if(!polygon[0].every(([x,z])=>onDisplay(x,z)))continue;
    const geometry=new T.ShapeGeometry(shape(polygon)).rotateX(-Math.PI/2);
    add(geometry,stone,'#647a5b',0,.27,0);
    if(polygon[0].length>14){
      const [x,z]=center(polygon[0]);
      for(let i=0;i<polygon[0].length;i+=Math.ceil(polygon[0].length/12)){
        const a=T.MathUtils.lerp(x,polygon[0][i][0],.73), b=T.MathUtils.lerp(z,polygon[0][i][1],.73);
        if(!inside(a,b,polygon[0])||polygon.slice(1).some(r=>inside(a,b,r)))continue;
        const h=.55+random()*.82;
        add(column,stone,'#695e50',a,.29+h*.44,b,.062,h*.88,.062);
        add(leaves,stone,choose(['#637943','#4e704c','#819054']),a,.50+h*.73,b,.40,h*.48,.40);
        add(leaves,stone,'#617b51',a-.31,.56+h*.63,b+.14,.28,h*.31,.27);
      }
    }
  }
  for(const [level,source] of roads){
    const coords=source.filter(([x,z])=>onDisplay(x,z));
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
    const promenade=points.filter(([x,z])=> Math.abs(z)<121 && (side===0?x>-110:x<110) && onDisplay(x,z));
    const edge=promenade.map(([x,z])=>[x+sign*.54,z] as XY);
    const path=edge.map(([x,z])=>[x+sign*.72,z] as XY);
    add(strip(edge,1.54,.34),stone,side===0?'#c5b89f':'#a9aaa0');
    add(strip(path,.09,.47),lamps,'#a2947b');
    for(let i=1;i<edge.length;i++){
      const [x,z]=edge[i], [a,b]=edge[i-1];
      if(Math.hypot(x-a,z-b)>9)continue;
      box(stone,'#a4a29f',(a+x)/2,.55,(b+z)/2,Math.hypot(x-a,z-b),.07,.082,Math.atan2(b-z,x-a));
      if(i%2===0){
        if(i%4===0)box(stone,'#746a60',x+sign*.68,.44,z,.29,.22,.73);
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
  landmarks();
  bake(scene);
}
