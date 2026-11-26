import * as T from 'three';
import {add,box,extrude,inside,stone,type Polygon,type XY} from './geometry';
import {luminous} from './lighting';

const ashlar=luminous('#dd9856',0,.24);
const cornice=luminous('#e5a064',0,.28);
const rooms=luminous('#b97837',0,.35);
const trim='#e4cdb0';
const dark='#37444a';
const shaft=new T.CylinderGeometry(.92,1,1,12);
const dome=new T.SphereGeometry(1,36,16,0,Math.PI*2,0,Math.PI/2);
const hip=new T.ConeGeometry(1,1,4);
const profiles={
  bank: { stride:.69, plinth:.28, cornice:.22, arch:true, columns:true, attic:.36 },
  arcade: { stride:.60, plinth:.23, cornice:.15, arch:true, columns:false, attic:.19 },
  deco: { stride:.54, plinth:.12, cornice:.11, arch:false, columns:true, attic:.62 },
  mansard: { stride:.57, plinth:.20, cornice:.19, arch:false, columns:false, attic:.76 },
  classical: { stride:.66, plinth:.18, cornice:.17, arch:false, columns:false, attic:.18 },
};
type Profile=keyof typeof profiles;
const styles:Record<string,Profile>={
  r2380996:'bank', w1196704498:'arcade', w177995050:'deco', w178405872:'classical',
  w1196704497:'arcade', w177998982:'mansard', w178405875:'mansard', w178408827:'arcade',
  w177993356:'deco', w1196704496:'classical',
};

function archedOpening(width:number,height:number) {
  const r=width*.5;
  const s=new T.Shape();
  s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,height-r);
  s.absarc(0,height-r,r,0,Math.PI,false);
  s.closePath();
  return new T.ShapeGeometry(s,10);
}

export function historic(rings:Polygon,h:number,color:string,id:string) {
  const path=rings[0];
  const [cx,cz]=path.reduce(([a,b],[x,z])=>[a+x/path.length,b+z/path.length],[0,0] as XY);
  const bucket=Math.abs(Math.floor(cx*13+cz*19))%7;
  const kind=styles[id]??(['classical','arcade','mansard','classical','deco','classical','arcade'] as const)[bucket];
  const p=profiles[kind];
  const y0=.24;
  const footprint=(scale:number)=>rings.map(r=>r.map(([a,b])=>[cx+(a-cx)*scale,cz+(b-cz)*scale] as XY));
  add(extrude(rings,h),ashlar,color,0,y0,0);
  add(extrude(footprint(1.018),p.plinth),stone,'#a3917f',0,y0,0);
  add(extrude(footprint(1.02),p.cornice),cornice,trim,0,y0+h-p.cornice,0);
  add(extrude(footprint(kind==='deco'?.76:.86),p.attic),ashlar,color,0,y0+h,0);
  add(extrude(footprint(kind==='deco'?.77:.88),.08),stone,kind==='mansard'?'#655b63':'#a7a094',0,y0+h+p.attic,0);

  for(let j=0;j<path.length;j++){
    const [ax,az]=path[j],[bx,bz]=path[(j+1)%path.length];
    const dx=bx-ax,dz=bz-az,wide=Math.hypot(dx,dz);
    if(wide<.82)continue;
    let nx=-dz/wide,nz=dx/wide;
    if(inside((ax+bx)/2+nx*.12,(az+bz)/2+nz*.12,path)){nx=-nx;nz=-nz;}
    const alongX=nz,alongZ=-nx;
    const rotation=Math.atan2(nx,nz);
    const mx=(ax+bx)/2,mz=(az+bz)/2;
    const detail=nx>.36 || (styles[id] && wide>2.3);
    const fixture=(m:T.Material,c:string,t:number,y:number,z:number,w:number,height:number,d:number)=>{
      box(m,c,mx+t*alongX+z*nx,y0+y,mz+t*alongZ+z*nz,w,height,d,rotation);
    };
    const rows=Math.min(7,Math.max(3,Math.floor(h/.54)));
    const ground=kind==='deco'?h*.21:h*.27;
    const storey=(h-ground-.26)/(rows-1);
    fixture(cornice,trim,0,ground,.025,wide,.078,.15);
    if(!detail)continue;
    const cells=Math.max(1,Math.floor((wide-.14)/p.stride));
    const span=wide/cells;
    for(let i=0;i<cells;i++){
      const t=(i+.5)*span-wide/2;
      const bw=Math.min(.44,span*.64);
      const frontage=(i===Math.floor(cells/2) && wide>2.45);
      if(p.arch||frontage){
        const ah=ground*.74;
        add(archedOpening(bw+.09,ah+.085),cornice,trim,mx+t*alongX+.029*nx,y0+.10,mz+t*alongZ+.029*nz,1,1,1,rotation);
        add(archedOpening(bw,ah),rooms,dark,mx+t*alongX+.045*nx,y0+.13,mz+t*alongZ+.045*nz,1,1,1,rotation);
        fixture(cornice,trim,t,.12+ah,.087,.10,.14,.15);
      }else{
        fixture(rooms,dark,t,ground*.48,.031,bw,ground*.61,.031);
        fixture(cornice,trim,t,ground*.83,.06,bw+.11,.075,.124);
      }
      for(let r=0;r<rows-1;r++){
        const y=ground+(r+.55)*storey;
        const hh=storey*(kind==='deco'?.72:.59);
        fixture(stone,'#81766c',t,y,.016,bw+.068,hh+.093,.052);
        fixture(rooms,dark,t,y,.044,bw*.82,hh,.033);
        fixture(cornice,trim,t,y-hh*.49,.073,bw+.095,.049,.13);
        if(r===0||kind==='deco')fixture(stone,'#a9a090',t,y,.071,.028,hh,.033);
      }
      if((p.columns && cells>2)||((kind==='classical'||kind==='mansard')&&i%2===0)){
        const side=t-span*.45;
        const ph=h-ground-.37;
        const at=.10;
        if(kind==='bank'){
          add(shaft,cornice,trim,mx+side*alongX+at*nx,y0+ground+ph*.5,mz+side*alongZ+at*nz,.125,ph,.125);
          fixture(cornice,trim,side,ground+ph,.10,.32,.13,.27);
          fixture(cornice,trim,side,ground,.10,.32,.13,.27);
        }else fixture(cornice,trim,side,ground+ph*.5,.074,kind==='deco'?.083:.123,ph,.13);
      }
      if(kind==='mansard'&&i%2===0)fixture(stone,'#685e62',t,h+.26,-.33,.30,.43,.43);
    }
    if(kind==='deco'||kind==='bank')fixture(cornice,trim,0,h-.32,.066,wide,.078,.18);
  }

  if(kind==='bank'){
    const frontX=Math.max(...path.map(([a])=>a));
    const x=T.MathUtils.lerp(cx,frontX,.40);
    add(shaft,ashlar,'#bdad95',x,h+.9,cz,1.45,.93,1.45);
    add(shaft,cornice,trim,x,h+1.33,cz,1.59,.17,1.59);
    add(dome,stone,'#5f796d',x,h+1.42,cz,1.49,1.19,1.49);
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      box(cornice,'#cdbb9d',x+Math.cos(a)*1.41,h+.92,cz+Math.sin(a)*1.41,.116,.72,.17,-a);
    }
    add(shaft,cornice,'#a99167',x,h+2.62,cz,.22,.31,.22);
  }
  if(kind==='mansard'&&styles[id]){
    const width=Math.max(...path.map(([a])=>Math.abs(a-cx)));
    add(hip,stone,'#725c5e',cx,h+.59,cz,Math.min(1.18,width*.65),.60,1.28,Math.PI/4);
  }
}
