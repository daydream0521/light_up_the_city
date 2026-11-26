import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {bankAt,roads} from './city';
import {extrude,type XY} from './geometry';
import {riverColor,skyUniforms} from './lighting';

const riverVertex = /* glsl */`
  uniform mat4 textureMatrix;
  varying vec4 projected;
  varying vec3 world;
  void main(){
    projected=textureMatrix*vec4(position,1.);
    world=(modelMatrix*vec4(position,1.)).xyz;
    gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
  }
`;
const riverFragment = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform vec3 upper,horizon,sun,direction,water;
  uniform float time,night;
  varying vec4 projected;
  varying vec3 world;
  vec2 hashed(vec2 p){
    vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
    q+=dot(q,q.yzx+33.33);
    return fract((q.xx+q.yz)*q.zy);
  }
  vec2 noise(vec2 p){
    vec2 i=floor(p), u=fract(p);
    u=u*u*(3.-2.*u);
    return mix(mix(hashed(i),hashed(i+vec2(1,0)),u.x),mix(hashed(i+vec2(0,1)),hashed(i+1.),u.x),u.y);
  }
  void main(){
    vec2 p=world.xz;
    vec3 v=normalize(cameraPosition-world);
    float dist=length(cameraPosition-world);
    vec2 broad=noise(p*vec2(.13,.23)+vec2(time*.025,-time*.048));
    vec2 fine=noise(p*vec2(.66,1.34)+vec2(time*.12,time*.15)+broad*1.45);
    vec2 du=(fine-.5)*.0049+(broad-.5)*.0025;
    vec2 uv=projected.xy/max(projected.w,.01);
    vec3 reflected=texture2D(tDiffuse,clamp(uv+du,.002,.998)).rgb;
    float fres=pow(1.-max(0.,v.y),2.2);
    vec3 n=normalize(vec3((fine.x-.5)*.18,1.,(fine.y-.5)*.13));
    float gold=max(dot(reflect(-v,n),direction),0.);
    vec3 col=mix(water*(.77+.37*broad.x),reflected,.35+.43*fres+night*.13);
    col+=sun*pow(gold,75.)*.46*(1.-night);
    col=mix(col,horizon,smoothstep(192.,420.,dist));
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function makeRiver(scene:T.Scene,small:boolean) {
  const mirror=new Reflector(new T.PlaneGeometry(950,950),{
    textureWidth:small?320:512,textureHeight:small?256:360,multisample:0,clipBias:.001,
    shader:{
      vertexShader:riverVertex, fragmentShader:riverFragment,
      uniforms:{color:{value:new T.Color()},tDiffuse:{value:null},textureMatrix:{value:new T.Matrix4()}},
    },
  });
  Object.assign((mirror.material as T.ShaderMaterial).uniforms,skyUniforms,{water:riverColor});
  mirror.rotation.x=-Math.PI/2;
  scene.add(mirror);
  const reflect=mirror.onBeforeRender;
  let update=true;
  mirror.onBeforeRender=(...args)=>{
    if(update) {
      update=false;
      reflect.call(mirror,...args);
    }
  };
  return ()=>{update=true;};
}

const wood=new T.MeshStandardMaterial({color:'#263d4c',roughness:.68});
const cream=new T.MeshStandardMaterial({color:'#d7d8d4',roughness:.72});
const windows=new T.MeshStandardMaterial({color:'#435c77',emissive:'#ffbd76',emissiveIntensity:0,roughness:.42});
const accent=new T.MeshStandardMaterial({color:'#b95b49',emissive:'#f99c63',emissiveIntensity:0});
const wakeGeometry=new T.PlaneGeometry(3.3,6).rotateX(-Math.PI/2).translate(0,0,-4.9);
const cube=new T.BoxGeometry();
function part(group:T.Group,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){
  const mesh=new T.Mesh(cube,m);
  mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
  group.add(mesh);
}
function cruise(scene:T.Scene,scale:number){
  const group=new T.Group();
  group.scale.setScalar(scale);
  scene.add(group);
  const hull:XY[]=[[-.62,-2.5],[.62,-2.5],[.83,-2],[.86,1.38],[.61,2.29],[0,2.95],[-.61,2.29],[-.86,1.38],[-.83,-2]];
  const boat=new T.Mesh(extrude([hull],.43),wood);
  boat.position.y=-.13;
  group.add(boat);
  part(group,cream,0,.38,-.1,1.64,.16,4.34);
  part(group,windows,0,.63,.04,1.36,.42,3.51);
  part(group,cream,0,.87,.04,1.48,.11,3.64);
  part(group,windows,0,1.005,.31,1.24,.19,2.59);
  part(group,cream,0,1.15,.35,1.33,.13,2.68);
  part(group,accent,0,.26,0,1.67,.08,3.88);
  part(group,cream,-.28,1.35,-.84,.092,.49,.09);
  part(group,accent,-.28,1.62,-.84,.15,.095,.14);
  for(let k=0;k<9;k++)for(const x of [-.69,.69]){
    part(group,cream,x,.64,-1.43+k*.37,.041,.42,.048);
  }
  const wake=new T.Mesh(wakeGeometry,new T.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{time:skyUniforms.time},
    vertexShader:'varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 v;uniform float time;void main(){
      float width=.07+(1.-v.y)*.34;
      float line=exp(-abs(abs(v.x-.5)-width)*42.);
      float flt=.58+.42*sin(v.y*52.+time*3.8+v.x*9.);
      gl_FragColor=vec4(.74,.81,.91,line*flt*smoothstep(0.,.84,v.y)*.32);
    }`,
  }));
  wake.position.y=.011;
  group.add(wake);
  return group;
}

export function riverLife(scene:T.Scene){
  const ships=[cruise(scene,.86),cruise(scene,1.15),cruise(scene,.77)];
  const lanes=roads.filter(([code, points])=>code>=2 && points.length>=2 &&
    points.every(([x,z])=>Math.abs(z)<105 && Math.min(Math.abs(x-bankAt(0,z)),Math.abs(x-bankAt(1,z)))<25))
    .map(([,points])=>new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,.43,z)),false,'centripetal'))
    .sort((a,b)=>b.getLength()-a.getLength()).slice(0,8);
  const carBody=new T.MeshStandardMaterial({color:'#8096a9'});
  const headlights=new T.MeshStandardMaterial({color:'#ac9f90',emissive:'#ffe1b6'});
  const tail=new T.MeshStandardMaterial({color:'#85363c',emissive:'#ff303a'});
  const cars=Array.from({length:10},(_,i)=>{
    const car=new T.Group();
    part(car,carBody,0,.12,0,.245,.15,.53);
    part(car,wood,0,.22,-.03,.203,.1,.27);
    for(const side of [-1,1]){
      part(car,headlights,side*.08,.12,.27,.072,.042,.016);
      part(car,tail,side*.08,.12,-.27,.062,.04,.016);
    }
    scene.add(car);
    return {car,lane:lanes[i%lanes.length],phase:i*.103};
  });
  return (time:number,night:number)=>{
    for(let i=0;i<ships.length;i++){
      const t=time*(i===1?-.65:.76)+[19,-37,-85][i];
      const z=((t+122)%244+244)%244-122;
      const side=i===1?.67:i===0?.40:.53;
      const x=T.MathUtils.lerp(bankAt(0,z),bankAt(1,z),side);
      const next=T.MathUtils.lerp(bankAt(0,z+1),bankAt(1,z+1),side);
      ships[i].position.set(x,0,z);
      ships[i].rotation.y=Math.atan2(next-x,1)+(i===1?Math.PI:0);
    }
    for(const {car,lane,phase} of cars) {
      const t=(phase+time*.58/Math.max(1,lane.getLength()))%1;
      car.position.copy(lane.getPointAt(t));
      const v=lane.getTangentAt(t);
      car.rotation.y=Math.atan2(v.x,v.z);
    }
    windows.emissiveIntensity=night*.8;
    accent.emissiveIntensity=night*.65;
    headlights.emissiveIntensity=night*2.1;
    tail.emissiveIntensity=night*1.1;
  };
}
