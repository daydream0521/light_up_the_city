import * as T from 'three';
import {add,box,loft,mix,stone} from './geometry';
import {glass,luminous} from './lighting';

export const sites = {
  pearl:[2.50,-65.50],
  tower:[59.72,4.95],
  finance:[76.58,-6.41],
  jin:[61.01,-13.90],
  customs:[-91.09,-29.06],
  peace:[-100.06,-56.77],
};
const white='#b7c1ce', silver='#8b9fae', gray='#637789';
const warm=luminous('#d78b46',0,.40);
const limestone=luminous('#dc9a54',0,.25);
const clockLight=luminous('#ffe7c0',0,1.15);
const pearlPink=luminous('#ff457c',1,.94);
const pearlRose=luminous('#f969a6',1,.30);
const strips=luminous('#a4d5ff',1,.79);
const brass=luminous('#eac181',1,.8);

const sphere=new T.SphereGeometry(1,36,22);
const cylinder=new T.CylinderGeometry(1,1,1,18);
const taper=new T.CylinderGeometry(.45,1,1,16);
const cone=new T.ConeGeometry(1,1,4);
const ring=new T.TorusGeometry(1,.045,6,36).rotateX(Math.PI/2);

function rod(m:T.Material,c:string,a:T.Vector3,b:T.Vector3,r:number) {
  const g=cylinder.clone();
  const delta=b.clone().sub(a);
  g.scale(r,delta.length(),r);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
  g.translate(...a.clone().lerp(b,.5).toArray());
  add(g,m,c);
  g.dispose();
}
function pearl() {
  const [x,z]=sites.pearl;
  add(cylinder,stone,'#6e8492',x,.6,z,8.5,1.2,8.5);
  add(cylinder,glass[1],'#5a829a',x,1.65,z,6.6,1.6,6.6);
  add(cylinder,stone,'#b5b5b3',x,2.47,z,7.15,.48,7.15);
  for(let j=0;j<3;j++) {
    const a=j*Math.PI*2/3+.3;
    const leg=(radius:number,y:number)=>new T.Vector3(x+Math.cos(a)*radius,y,z+Math.sin(a)*radius);
    rod(stone,white,leg(2.22,2),leg(2.22,27.25),.46);
    rod(stone,'#adb7bc',leg(7.7,.3),leg(2.45,12.2),.61);
    rod(strips,'#adc9e3',leg(2.72,2.2),leg(2.72,26.3),.075);
  }
  for(const [y,r] of [[9.6,2.55],[27.1,2.15],[34.75,.83]]) {
    add(sphere,pearlRose,'#a12e5d',x,y,z,r,r,r);
    for(const q of [-.43,.08,.41]) {
      const rr=r*Math.sqrt(1-q*q);
      add(ring,pearlPink,'#e47a98',x,y+q*r,z,rr,.86,rr);
    }
    add(cylinder,glass[5],'#604763',x,y-.32*r,z,r*.955,.26*r,r*.955);
  }
  for(let i=0;i<5;i++) {
    const a=i*Math.PI*2/5;
    add(sphere,pearlRose,'#985678',x+Math.cos(a)*4,2.4,z+Math.sin(a)*4,1.12,.98,1.12);
  }
  add(cylinder,stone,white,x,31.22,z,.51,6.4,.51);
  add(taper,stone,white,x,36.1,z,.63,2.68,.63);
  [ [38.9,.28,4.3],[42.4,.19,2.7],[44.6,.125,2.4],[46.5,.073,1.8] ].forEach(([y,r,h],i)=>{
    add(cylinder,i%2?pearlPink:stone,i%2?'#b14b55':white,x,y,z,r,h,r);
  });
}

function roundedTriangle(radius:number,y:number,turn:number,x:number,z:number) {
  return Array.from({length:60},(_,i)=>{
    const a=i*Math.PI*2/60;
    const r=radius*(.85+.14*Math.cos(a*3)+.022*Math.cos(a*6));
    return new T.Vector3(x+Math.cos(a+turn)*r,y,z+Math.sin(a+turn)*r);
  });
}
function shanghaiTower() {
  const [x,z]=sites.tower;
  const rings=Array.from({length:48},(_,i)=>{
    const t=i/47;
    return roundedTriangle(mix(6.85,3.23,t)+.43*Math.sin(t*Math.PI),.45+62.6*t,-.35+t*2.094,x,z);
  });
  add(loft(rings),glass[2],'#6f9ab2');
  const rim=rings.at(-1)!;
  add(cylinder,stone,'#a9b9c1',x,62.92,z,2.65,.22,2.65);
  for(const j of [0,1,2]) {
    const points=rings.map(r=>r[j*20].clone());
    for(let i=1;i<points.length;i++) rod(strips,'#bfd9e6',points[i-1],points[i],.065);
    const a=rim[j*20];
    box(strips,'#bdc8d4',a.x,63,a.z,.18,.28,.18);
  }
  for(const i of [5,10,15,20,25,30,35,40,46]) {
    add(loft([rings[i].map(p=>p.clone().add(new T.Vector3(0,-.09,0))),rings[i]]),strips,'#8cb3c5');
  }
  box(stone,'#738799',x,1,z,14.3,2,11.3,.2);
}

const financeAngle=-.17;
function financialCenter() {
  const [x,z]=sites.finance;
  const v=(x0:number,y:number,z0:number)=>new T.Vector3(x+x0*Math.cos(financeAngle)+z0*Math.sin(financeAngle),y,
    z-x0*Math.sin(financeAngle)+z0*Math.cos(financeAngle));
  const profile=(y:number,left:number,right:number,d:number)=>
    [v(left,y,-d),v(right,y,-d),v(right,y,d),v(left,y,d)];
  add(loft([profile(.3,-4.85,4.85,4.65),profile(15,-4.6,4.6,3.75),
    profile(36,-4.15,4.15,1.95),profile(43.5,-3.99,3.99,1.23)]),glass[3],'#6999b5');
  for(const side of [-1,1]) {
    const section=(y:number,a:number,b:number,d:number)=>profile(y,side<0?-b:a,side<0?-a:b,d);
    add(loft([section(43.5,1.94,3.99,1.23),section(48.21,2.78,3.86,.79),section(49.03,2.81,3.82,.68)]),glass[3],'#7da9bd');
    for(const f of [-1,1]) {
      rod(strips,white,v(side*1.94,43.5,f*1.23),v(side*2.81,49.03,f*.68),.066);
      rod(strips,white,v(side*4.85,.37,f*4.65),v(side*3.82,49.03,f*.68),.085);
    }
  }
  box(glass[3],'#77adc8',x,48.27,z,7.68,1.32,1.84,financeAngle);
  box(strips,'#8eb9cf',x,48.99,z,7.7,.12,1.89,financeAngle);
  box(stone,gray,x,43.48,z,7.94,.20,2.45,financeAngle);
  box(stone,gray,x,.87,z,12.2,1.74,11.8,financeAngle);
}

function jinMao() {
  const [x,z]=sites.jin;
  let floor=1.05;
  for(let i=0;i<13;i++) {
    const w=9.45*Math.pow(.91,i);
    const h=5.7*Math.pow(.887,i);
    box(glass[4],'#788f9f',x,floor+h*.5,z,w,h,w,.19);
    box(glass[4],'#607a8c',x,floor+h*.5,z,w*.93,h,w*.93,.19+Math.PI/4);
    box(brass,'#8e9ba4',x,floor+h-.12,z,w+.31,.20,w+.31,.19);
    for(const a of [0,1,2,3]) {
      const theta=a*Math.PI/2+.19+Math.PI/4;
      const r=w*.71;
      box(stone,'#9ba8ae',x+Math.cos(theta)*r,floor+h*.5,z+Math.sin(theta)*r,.15,h,.15);
    }
    floor+=h;
  }
  add(taper,stone,silver,x,41.36,z,.49,1.06,.49);
  add(cylinder,brass,'#b8aa8e',x,41.99,z,.076,.29,.076);
  box(stone,gray,x,.66,z,11.3,1.32,10.2,.19);
}

const sand='#b9aa96', cream='#dfcbb1', trim='#e9d6bc';
function tiers(x:number,z:number,w:number,d:number,h:number,color:string) {
  box(limestone,color,x,h*.5,z,w,h,d);
  for(const y of [.28,1.0,h*.65,h-.13,h+.05])box(warm,trim,x,y,z,w+.24,.15,d+.24);
  for(let j=0;j<3;j++) {
    const y=1.27+j*(h-1.2)/3.6;
    for(let p=-d*.44;p<d*.46;p+=.54){
      box(stone,'#474b50',x+w*.5+.013,y,z+p,.052,.43,.24);
      box(warm,cream,x+w*.5+.053,y-.24,z+p,.18,.052,.32);
    }
    for(let p=-w*.43;p<w*.46;p+=.6) for(const k of [-1,1])
      box(stone,'#514e50',x+p,y,z+k*(d*.5+.01),.27,.43,.048);
  }
}

function customsHouse() {
  const [x,z]=sites.customs;
  tiers(x-.68,z,6.55,7.1,3.1,sand);
  const front=x+2.54;
  box(stone,'#916c58',front+.04,1.0,z,.22,1.74,3.13);
  for(const b of [-1.42,-.48,.48,1.42]) {
    add(cylinder,warm,cream,front+.28,1.34,z+b,.127,2.33,.127);
    box(warm,trim,front+.28,2.46,z+b,.36,.14,.40);
  }
  box(warm,cream,front+.18,2.58,z,.83,.19,3.58);
  const tx=x+1.08;
  box(limestone,sand,tx,5.23,z,2.32,4.49,2.48);
  for(const a of [-1,1]) for(const b of [-1,1]){
    box(warm,cream,tx+a*1.08,5.12,z+b*1.13,.25,4.0,.26);
  }
  for(const y of [3.64,5.78,7.12,7.38])box(warm,trim,tx,y,z,2.54,.145,2.67);
  box(stone,'#989183',tx,7.66,z,2.35,.57,2.4);
  const dial=new T.CircleGeometry(.52,32);
  const outer=new T.CircleGeometry(.61,32);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2, nx=Math.sin(a), nz=Math.cos(a);
    const face=1.263;
    const o=outer.clone().rotateY(a);
    const d=dial.clone().rotateY(a);
    add(o,stone,'#424951',tx+nx*face,6.45,z+nz*face);
    add(d,clockLight,'#f6dfb4',tx+nx*(face+.022),6.45,z+nz*(face+.022));
    const px=tx+nx*(face+.035),pz=z+nz*(face+.035);
    for(let j=0;j<12;j++){
      const t=j*Math.PI/6;
      box(stone,'#343039',px+nz*Math.sin(t)*.422,6.45+Math.cos(t)*.422,pz-nx*Math.sin(t)*.422,.039,.071,.027,a,-t);
    }
    box(stone,'#33303b',px+nz*.116,6.54,pz-nx*.116,.045,.29,.04,a,-.94);
    box(stone,'#33303b',px-nz*.08,6.58,pz+nx*.08,.055,.29,.04,a,.58);
  }
}

function peaceHotel() {
  const [x,z]=sites.peace;
  tiers(x-.87,z+.82,6.88,7.36,3.38,'#b4a791');
  tiers(x+.95,z+1.32,3.48,4.31,4.70,'#b8ac9d');
  const px=x+1.72,pz=z+1.65;
  box(limestone,sand,px,5.16,pz,2.86,1.14,2.93);
  for(const a of [-1,1])for(const b of [-1,1])box(warm,cream,px+a*1.32,5.13,pz+b*1.31,.22,1.14,.22);
  box(warm,trim,px,5.76,pz,3.06,.16,3.07);
  for(const dz of [-1.48,-1.14,-.72,.72,1.14,1.48]){
    box(warm,cream,x+2.74,3.84,z+1.32+dz,.152,1.66,.108);
  }
  for(const dz of [-.82,0,.82]){
    box(stone,'#485457',px+1.44,5.13,pz+dz,.039,.46,.231);
    box(warm,trim,px+1.47,4.865,pz+dz,.138,.075,.26);
  }
  add(cone,stone,'#316c64',px,6.75,pz,2.14,1.91,2.14,Math.PI/4);
  add(cylinder,stone,'#52867a',px,7.91,pz,.063,.37,.063);
}

export function landmarks() {
  pearl();
  shanghaiTower();
  financialCenter();
  jinMao();
  customsHouse();
  peaceHotel();
}
