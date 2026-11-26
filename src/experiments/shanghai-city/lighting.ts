import * as T from 'three';
import {mix,smooth} from './geometry';

const atmos = {
  upper:{value:new T.Color()}, horizon:{value:new T.Color()}, sun:{value:new T.Color()},
  direction:{value:new T.Vector3()}, night:{value:0}, time:{value:0},
};
export const skyUniforms = atmos;
const glassVertex = /* glsl */`
  varying vec3 world;
  varying vec3 face;
  varying vec2 tex;
  varying vec3 shade;
  void main(){
    world=(modelMatrix*vec4(position,1.)).xyz;
    face=normalize(mat3(modelMatrix)*normal);
    tex=uv;
    shade=color;
    gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
  }
`;
const glassFragment = /* glsl */`
  varying vec3 world; varying vec3 face; varying vec2 tex; varying vec3 shade;
  uniform vec3 upper,horizon,sun,direction;
  uniform float night,power,style,time;
  float rnd(vec2 p) {
    vec3 q=fract(vec3(p.xyx)*.1031);
    q+=dot(q,q.yzx+33.33);
    return fract((q.x+q.y)*q.z);
  }
  void main(){
    vec3 n=normalize(face);
    if(!gl_FrontFacing)n=-n;
    vec3 v=normalize(cameraPosition-world);
    vec3 r=reflect(-v,n);
    float sunDot=max(dot(n,direction),0.);
    float dist=distance(cameraPosition,world);
    bool curved=style>1.5&&style<3.5;
    vec2 st=(curved ? tex : vec2(dot(world.xz,normalize(vec2(n.z+.0001,-n.x))),world.y))*
      vec2(curved ? 1.9 : 2.1,curved ? 2.35 : 2.65);
    vec2 pix=fwidth(st);
    vec2 cells=floor(st);
    vec2 q=fract(st);
    float crisp=1.-smoothstep(.27,1.0,max(pix.x,pix.y));
    float pane=smoothstep(.06,.18,q.x)*(1.-smoothstep(.85,.96,q.x))*smoothstep(.14,.28,q.y)*(1.-smoothstep(.81,.94,q.y));
    float id=rnd(cells+floor(world.xz*.095));
    float open=smoothstep(.74,.94,id);
    float anis=pow(max(dot(r,direction),0.),12.);
    vec3 env=mix(horizon,upper,smoothstep(-.18,.72,r.y));
    float fres=pow(1.-max(dot(v,n),0.),3.);
    vec3 col=shade*(.17+.73*sunDot)*(1.-night*.72)+env*(.14+.52*fres)*(1.-night*.63);
    col+=sun*anis*(1.-night)*.37;
    col*=mix(.76,1.12,pane*crisp+.25*(1.-crisp));
    vec3 lamp=mix(vec3(1.0,.54,.24),vec3(.35,.65,1.0),step(.88,id));
    col+=power*lamp*(pane*open*crisp*.45+.020*(1.-crisp))*(1.-smoothstep(.38,.85,abs(n.y)));
    if(style>1.5){
      float bands=.5+.5*cos((world.y*.16+tex.x*.021)*6.283);
      float frame=smoothstep(.89,1.,bands);
      vec3 feature=style>4.5?vec3(.86,.17,.43):style>3.5?vec3(.89,.66,.34):style>2.5?vec3(.31,.69,1.):vec3(.53,.73,1.);
      float pulse=.88+.12*sin(time*.75-world.y*.15);
      col+=feature*power*frame*pulse*.30;
    }
    col=mix(col,horizon,smoothstep(225.,600.,dist)*.72);
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const glass = [0,1,2,3,4,5].map(style=>new T.ShaderMaterial({
  uniforms:{...atmos,style:{value:style},power:{value:0}},
  vertexShader:glassVertex,fragmentShader:glassFragment,vertexColors:true,side:T.DoubleSide,
}));

const westPower={value:0};
const nightSurfaces: {material:T.MeshStandardMaterial; stage:number; level:number}[] = [];
export function luminous(color:string, stage:number, level=1) {
  const material=new T.MeshStandardMaterial({vertexColors:true,emissive:color,roughness:.68});
  if(stage===0){
    material.onBeforeCompile=shader=>{
      shader.uniforms.westPower=westPower;
      shader.vertexShader='varying vec3 riverFacade;\n'+shader.vertexShader.replace(
        '#include <begin_vertex>','#include <begin_vertex>\n riverFacade=position;');
      shader.fragmentShader='varying vec3 riverFacade; uniform float westPower;\n'+shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          float sequence=.17+.61*smoothstep(-72.,52.,riverFacade.z);
          float wash=.72+.28*cos(riverFacade.y*.43);
          totalEmissiveRadiance*=smoothstep(sequence-.12,sequence+.12,westPower)*wash;`);
    };
  }
  nightSurfaces.push({material,stage,level});
  return material;
}
export function setLights(bund: number,pudong: number,waterfront: number,time:number) {
  westPower.value=bund;
  const cues=[bund,pudong,waterfront];
  glass.forEach((material,i)=>{
    material.uniforms.power.value=pudong*smooth(pudong,.05+i*.075,.48+i*.07);
  });
  nightSurfaces.forEach(({material,stage,level})=>{
    material.emissiveIntensity=cues[stage]*level;
  });
  atmos.time.value=time;
}

const skyVertex = /* glsl */`
  varying vec3 world;
  void main(){
    world=(modelMatrix*vec4(position,1.)).xyz+cameraPosition;
    gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
  }
`;
const skyFragment = /* glsl */`
  varying vec3 world;
  uniform vec3 upper,horizon,sun,direction;
  uniform float night;
  void main(){
    vec3 d=normalize(world-cameraPosition);
    float y=max(d.y,0.);
    float glare=max(dot(d,direction),0.);
    vec3 sky=mix(horizon,upper,pow(smoothstep(-.20,.74,d.y),.72));
    float streak=sin(d.x*19.+y*38.+sin(d.z*7.)*1.8)+.35*sin(y*88.+d.x*11.);
    sky=mix(sky,horizon,smoothstep(.70,1.34,streak)*smoothstep(.02,.10,y)*(1.-smoothstep(.23,.52,y))*.22);
    sky+=sun*(pow(glare,14.)*.23+smoothstep(.99967,.99982,glare)*2.3)*(1.-night);
    gl_FragColor=vec4(sky,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const keys = [
  [0,'#111c40','#374269','#798ef1','#172846',0,.48,1],
  [5.2,'#314b84','#b18d9b','#f7ad8d','#384b67',.12,.74,.83],
  [6.8,'#688fb7','#ebcab9','#ffe2bb','#456774',1.9,1.12,.04],
  [12,'#579ad2','#c4deed','#fff1d8','#517e87',2.8,1.22,0],
  [17.7,'#5477ac','#e4aa8e','#ffbd81','#4d687d',2.45,1.03,.04],
  [18.65,'#465c96','#c596a6','#f5a57c','#435278',.92,.92,.22],
  [19.35,'#263a75','#7486af','#c9a5b9','#243653',.32,.82,.84],
  [20.6,'#152657','#43547a','#8199ff','#1f3050',0,.66,1],
  [24,'#111c40','#374269','#798ef1','#172846',0,.48,1],
] as const;
const colors=keys.map(([h,top,bottom,solar,water,direct,fill,glow])=>(
  {h,top:new T.Color(top),bottom:new T.Color(bottom),solar:new T.Color(solar),water:new T.Color(water),direct,fill,glow}
));
export const riverColor={value:new T.Color()};

export function setupLighting(scene:T.Scene) {
  const sky=new T.Mesh(new T.SphereGeometry(1200,36,20),new T.ShaderMaterial({
    uniforms:atmos,vertexShader:skyVertex,fragmentShader:skyFragment,side:T.BackSide,depthWrite:false,
  }));
  sky.renderOrder=120;
  sky.frustumCulled=false;
  scene.add(sky);
  const ambient=new T.HemisphereLight('#b9d4f4','#8d766a',1);
  const sun=new T.DirectionalLight('#ffdda9',2);
  sun.castShadow=true;
  sun.shadow.mapSize.setScalar(1024);
  Object.assign(sun.shadow.camera,{left:-147,right:147,bottom:-140,top:140,near:10,far:395});
  sun.shadow.normalBias=.12;
  sun.shadow.bias=-.00012;
  sun.shadow.intensity=.72;
  sun.shadow.autoUpdate=false;
  let shadowHour=-1;
  const bounce=new T.DirectionalLight('#6988e2',.35);
  bounce.position.set(68,90,-34);
  scene.add(sun,sun.target,ambient,bounce);
  const fog=new T.FogExp2('#8a95ba',.00155);
  scene.fog=fog;
  return (hour:number)=>{
    const i=colors.findIndex(k=>k.h>=hour && k.h>0);
    const a=colors[i<0?colors.length-2:i-1],b=colors[i<0?colors.length-1:i];
    const t=smooth(hour,a.h,b.h);
    atmos.upper.value.copy(a.top).lerp(b.top,t);
    atmos.horizon.value.copy(a.bottom).lerp(b.bottom,t);
    atmos.sun.value.copy(a.solar).lerp(b.solar,t);
    riverColor.value.copy(a.water).lerp(b.water,t);
    atmos.night.value=mix(a.glow,b.glow,t);
    const elevation=Math.sin((hour-5.6)*Math.PI/13.4)*1.10;
    const angle=-.92+(hour-6)*Math.PI/12.8;
    atmos.direction.value.set(Math.cos(angle)*Math.cos(elevation),Math.sin(elevation),Math.sin(angle)*Math.cos(elevation));
    sun.position.copy(atmos.direction.value).multiplyScalar(180);
    if(Math.abs(hour-shadowHour)>.10){
      sun.shadow.needsUpdate=true;shadowHour=hour;
    }
    sun.color.copy(atmos.sun.value);
    sun.intensity=mix(a.direct,b.direct,t);
    ambient.intensity=mix(a.fill,b.fill,t);
    bounce.intensity=.26+.31*atmos.night.value;
    fog.color.copy(atmos.horizon.value).lerp(atmos.upper.value,.29);
    return atmos.night.value;
  };
}
