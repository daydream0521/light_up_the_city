import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createCity} from './city';
import {mix,smooth} from './geometry';
import {sites} from './landmarks';
import {setLights,setupLighting} from './lighting';
import {makeRiver,riverLife} from './river';
import { cityFrameFailed, connectPresentation, firstCityFrame, playRevival, reportCityControls, reportCityShow } from '../presentation';

type Landmark=keyof typeof sites;
const views={
  city:[[-121,256,347],[-14,0,1]],
  bund:[[-81,12,-38],[28,21,-39]],
  pudong:[[-25,29,-40],[-94,6,-40]],
  waterfront:[[-79,29,35],[-35,2,1]],
  lujiazui:[[-76,48,22],[55,28,-4]],
  heritage:[[-72,10,-44],[-95,4,-44]],
  top:[[2,296,-10],[2,0,-11]],
} as const;
type View=keyof typeof views|Landmark;
// The free-view presets are named after the bank the viewer stands on.
const revivalViews = ['pudong', 'waterfront', 'pearl', 'lujiazui'] as const;
const close:Record<Landmark,[number,number,number,number]> = {
  pearl:[-64,24,40,23],
  tower:[-70,38,70,33],
  finance:[18,32,-74,25],
  jin:[-44,28,-49,23],
  customs:[14,8,11,4.3],
  peace:[24,10,10,4.25],
};
const $=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const mobile=matchMedia('(pointer: coarse)');
const presets=[...document.querySelectorAll<HTMLButtonElement>('[data-view]')];

function mount(){
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  $('view').append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','左键旋转，右键平移，滚轮缩放');
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(40,1,.27,1400);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;
  controls.dampingFactor=.085;
  controls.screenSpacePanning=false;
  controls.minDistance=2.25;
  controls.maxDistance=580;
  controls.minPolarAngle=.0015;
  controls.maxPolarAngle=Math.PI/2-.032;
  controls.rotateSpeed=.50;
  controls.zoomSpeed=.77;
  controls.autoRotateSpeed=.39;
  const light=setupLighting(scene);
  createCity(scene);
  const refreshRiver=makeRiver(scene,mobile.matches);
  const life=riverLife(scene);
  const slider=$<HTMLInputElement>('time'), select=$<HTMLSelectElement>('landmark');
  const play=$<HTMLButtonElement>('play'), show=$<HTMLButtonElement>('show');
  const target=new T.Vector3(), eye=new T.Vector3();
  const before=new T.Vector3(), lastEye=new T.Vector3(), lastAim=new T.Vector3();
  let view:View='city', travel=false, selected=true, dirty=true, playing=false;
  let homeMode = false;
  let previewMode = false;
  let revival: ReturnType<typeof playRevival> | undefined;
  let targetFov = camera.fov;
  let time=0, hour=Number(slider.value), showStart:number|null=null;
  let pixelScale=1, slowFrames=0, frame=0, prev=performance.now(), reflectAt=-1;

  function syncTime(){
    const minutes=Math.floor(hour*60+.01);
    const clock=String(Math.floor(minutes/60)%24).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
    const phase=hour<5.8||hour>=20.75?'深夜':hour<8.65?'清晨':hour<16.9?'白昼':hour<18.8?'黄金时刻':'蓝调时刻';
    $<HTMLOutputElement>('clock').value=clock;
    $('phase').textContent=phase;
    slider.setAttribute('aria-valuetext',phase+' '+clock);
  }
  function setPlay(active:boolean){
    playing=active;
    play.textContent=active?'❚❚':'▶';
    play.setAttribute('aria-label',active?'暂停昼夜':'播放昼夜');
    play.setAttribute('aria-pressed',String(active));
  }
  function setOrbit(active:boolean){
    controls.autoRotate=active;
    $('orbit').setAttribute('aria-pressed',String(active));
  }
  function move(name:View,jump=false){
    view=name;
    selected=true;
    const landmark=name in sites;
    if(landmark){
      const [x,z]=sites[name as Landmark], [dx,y,dz,aim]=close[name as Landmark];
      target.set(x,aim,z); eye.set(x+dx,y,z+dz);
    }else{
      const [position,aim]=views[name as keyof typeof views];
      target.fromArray(aim);eye.fromArray(position);
    }
    const framed=name==='city';
    targetFov=(framed?27:40)+(framed?36:30)*(1-smooth(camera.aspect,.45,.95));
    const portrait=T.MathUtils.clamp((framed?.98:.82)/camera.aspect,1,1.48);
    eye.sub(target).multiplyScalar(portrait * (homeMode ? 1.13 : 1)).add(target);
    presets.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
    select.value=landmark?name:'';
    travel=!jump&&!reduced.matches;
    if(!travel){camera.fov=targetFov;camera.updateProjectionMatrix();controls.target.copy(target);camera.position.copy(eye);controls.update();}
    dirty=true;
  }
  function resizeBuffer(){
    const container=$('view');
    renderer.setPixelRatio(Math.min(devicePixelRatio,mobile.matches?1.16:1.32)*pixelScale);
    renderer.setSize(container.clientWidth,container.clientHeight,false);
    dirty=true;
  }
  function resize(){
    const container=$('view');
    camera.aspect=container.clientWidth/Math.max(1,container.clientHeight);
    camera.fov=(view==='city'?27:40)+(view==='city'?36:30)*(1-smooth(camera.aspect,.45,.95));
    const width = container.clientWidth, height = container.clientHeight;
    camera.clearViewOffset();
    if (homeMode) camera.setViewOffset(width, height, width > 800 ? -width * .105 : 0, width <= 800 ? height * .13 : 0, width, height);
    resizeBuffer();
    if(selected)move(view,true);
  }

  function showState(active:boolean){
    show.setAttribute('aria-pressed',String(active));
    show.textContent=active?'结束演出':'点亮两岸';
    reportCityShow(active);
  }
  function finishShow(){
    if(showStart===null)return;
    showStart=null;
    showState(false);
    dirty=true;
  }
  function startShow(){
    if(showStart!==null){finishShow();return;}
    setPlay(false);
    setOrbit(false);
    move('city');
    hour=17.7;
    slider.value=String(hour);
    syncTime();
    showStart=performance.now();
    showState(true);
    dirty=true;
  }
  controls.addEventListener('start',()=>{
    travel=false;selected=false;
    setOrbit(false);
    presets.forEach(b=>b.setAttribute('aria-pressed','false'));
    select.value='';
  });
  controls.addEventListener('change',()=>{dirty=true;});
  presets.forEach(b=>b.addEventListener('click',()=>{setOrbit(false);move(b.dataset.view as View);}));
  select.addEventListener('change',()=>{if(select.value){setOrbit(false);move(select.value as Landmark);}});
  $('orbit').addEventListener('click',()=>setOrbit(!controls.autoRotate));
  show.addEventListener('click',startShow);
  play.addEventListener('click',()=>{finishShow();setPlay(!playing);});
  slider.addEventListener('input',()=>{
    finishShow();setPlay(false);hour=Number(slider.value);syncTime();dirty=true;
  });
  function toggle(){
    const button=$('hide');
    const hidden=button.getAttribute('aria-expanded')==='true';
    reportCityControls(hidden);
    document.querySelectorAll<HTMLElement>('.chrome').forEach(el=>{el.hidden=hidden;});
    button.setAttribute('aria-expanded',String(!hidden));
    button.textContent=hidden?'显示界面':'隐藏界面';
  }
  $('hide').addEventListener('click',toggle);
  document.addEventListener('keydown',e=>{
    if(!homeMode&&!revival&&e.key.toLowerCase()==='h'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey)toggle();
  });
  addEventListener('resize',resize);
  reduced.addEventListener('change', () => { if (homeMode) setOrbit(!reduced.matches); });
  renderer.domElement.addEventListener('webglcontextlost', () => {
    renderer.setAnimationLoop(null);
    cityFrameFailed('Shanghai WebGL context lost');
  });
  const animate = (now: number) => {
    const delta=now-prev;
    const dt=Math.min(.15,Math.max(0,delta/1000));
    prev=now;
    if(!reduced.matches){
      time+=dt;
      if(!document.hidden&&pixelScale>.61){
        slowFrames=delta>51?slowFrames+1:Math.max(0,slowFrames-2);
        if(slowFrames>=11){pixelScale*=.78;slowFrames=0;resizeBuffer();}
      }
    }
    const shot = revival?.(now, reduced.matches);
    if(travel){
      const a=1-Math.exp(-8*dt);
      camera.position.lerp(eye,a);controls.target.lerp(target,a);
      camera.fov=mix(camera.fov,targetFov,a);camera.updateProjectionMatrix();
      if(camera.position.distanceToSquared(eye)<.02&&controls.target.distanceToSquared(target)<.02){
        camera.position.copy(eye);controls.target.copy(target);camera.fov=targetFov;camera.updateProjectionMatrix();travel=false;
      }
    }
    controls.update(dt);
    before.copy(controls.target);
    controls.target.set(T.MathUtils.clamp(before.x,-144,156),T.MathUtils.clamp(before.y,0,74),T.MathUtils.clamp(before.z,-150,151));
    camera.position.add(before.negate().add(controls.target));
    camera.position.y=Math.max(1.03,camera.position.y);

    const cue=showStart===null?null:Math.max(0,(now-showStart)/1000);
    if(cue!==null){
      hour=mix(17.65,21.05,smooth(cue,0,23));
      slider.value=String(hour);syncTime();
      show.textContent=cue<5?'暮色降临 · 结束':cue<10?'外滩亮灯 · 结束':cue<17?'陆家嘴复苏 · 结束':'两岸灯火 · 结束';
      if(cue>=24)finishShow();
    }else if(playing){
      hour=(hour+Math.min(.8,Math.max(0,delta/1000))*.22)%24;
      slider.value=String(hour);syncTime();
    }
    if(reduced.matches&&!dirty&&!playing&&!controls.autoRotate&&cue===null&&!shot?.animating)return;
    dirty=false;
    const night=light(hour);
    const bund=cue===null?smooth(night,.23,.89):smooth(cue,4,9.2);
    const pudong=cue===null?smooth(night,.34,.91):smooth(cue,9,17.2);
    const street=cue===null?smooth(night,.21,.81):smooth(cue,6.3,21.5);
    const progress = shot?.progress ?? (previewMode && cue === null ? [1, 1, 1, 1] : [bund, street, pudong, pudong]);
    setLights(progress,time,shot!==undefined);
    life(time,progress[1]);
    const cameraChanged=camera.position.distanceToSquared(lastEye)>.008||controls.target.distanceToSquared(lastAim)>.008;
    if(cameraChanged||Math.abs(hour-reflectAt)>.015||frame%(shot?.animating?3:6)===0){
      refreshRiver();reflectAt=hour;lastEye.copy(camera.position);lastAim.copy(controls.target);
    }
    renderer.render(scene,camera);
    frame++;
    firstCityFrame();
  };

  connectPresentation((mode, progress) => {
    if (mode === 'park') {
      renderer.setAnimationLoop(null);
      return;
    }
    homeMode = mode === 'home';
    previewMode = mode === 'preview';
    const wasRevisiting = revival !== undefined;
    revival = progress && playRevival(progress, () => move('city'));
    controls.enabled = !homeMode && !revival;
    if (!homeMode && !revival && $('hide').getAttribute('aria-expanded') === 'false') toggle();
    finishShow();
    setPlay(false);
    setOrbit(homeMode && !reduced.matches);
    if (homeMode || revival || wasRevisiting || mode === 'preview') {
      hour = mode === 'preview' ? 20.6 : revival ? 20.0 : homeMode ? 19.65 : hour;
      slider.value = String(hour);
      view = progress?.change ? revivalViews[progress.change.district] : 'city';
      selected = true;
    }
    reflectAt = -1;
    resize();
    if (mode === 'show') startShow();
    syncTime();
    prev = performance.now();
    renderer.setAnimationLoop(animate);
  });
}

try{mount();}
catch(error){cityFrameFailed(error);}
