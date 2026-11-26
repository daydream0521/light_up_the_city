import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { atmosphereAndSea } from './atmosphere';
import { city } from './city';
import { cityLife } from './life';
import { height, landscape } from './terrain';
import './style.css';

const views = {
  city: { target: [0, 10, -5], camera: [65, 57, 130] },
  temple: { target: [-19, 23.8, -24], camera: [5, 37, 10] },
  theatre: { target: [28, 4.8, -9], camera: [53, 29, -28] },
  harbour: { target: [16, 2.8, 22], camera: [42, 14.5, 51] },
  overhead: { target: [0, 0, -13], camera: [0, 190, -12.6] },
} as const;
type View = keyof typeof views;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const view = document.querySelector<HTMLElement>('#view')!;
const status = document.querySelector<HTMLElement>('#status')!;
const slider = document.querySelector<HTMLInputElement>('#time')!;
const phase = document.querySelector<HTMLElement>('#phase')!;
const clock = document.querySelector<HTMLOutputElement>('#clock')!;
const play = document.querySelector<HTMLButtonElement>('#play')!;
const orbit = document.querySelector<HTMLButtonElement>('#orbit')!;
const visibility = document.querySelector<HTMLButtonElement>('#visibility')!;
const presets = [...document.querySelectorAll<HTMLButtonElement>('[data-view]')];

function start() {
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', '拖动旋转，滚动缩放，右键拖动平移');
  view.append(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, .30, 1700);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .065;
  controls.screenSpacePanning = false;
  controls.minDistance = 2.1;
  controls.maxDistance = 240;
  controls.minPolarAngle = .001;
  controls.maxPolarAngle = Math.PI / 2 - .025;
  controls.rotateSpeed = .49;
  controls.zoomSpeed = .75;
  controls.autoRotateSpeed = .34;
  controls.target.set(...views.city.target);
  camera.position.set(...views.city.camera);
  controls.update();

  landscape(scene);
  const lighting = atmosphereAndSea(scene, matchMedia('(pointer: coarse)').matches);
  const animateCity = cityLife(scene, city(scene));
  const target = new T.Vector3();
  const position = new T.Vector3();
  const offset = new T.Vector3();
  let preset: View = 'city';
  let framing = true;
  let hour = Number(slider.value);
  let playing = false;
  let dirty = true;
  let scale = 1;
  let slowFrames = 0;

  function syncClock() {
    const minutes = Math.floor(hour * 60 + .01);
    const format = (n: number) => String(n).padStart(2,'0');
    const label = hour < 5.5 || hour >= 20.25 ? '夜晚' : hour < 8.5 ? '清晨' : hour < 17.4 ? '白昼' : '黄昏';
    const display = format(Math.floor(minutes / 60) % 24) + ':' + format(minutes % 60);
    clock.value = display;
    phase.textContent = label;
    slider.setAttribute('aria-valuetext', label + ' ' + display);
  }

  function setPlay(active: boolean) {
    playing = active;
    play.setAttribute('aria-pressed', String(active));
    play.textContent = active ? '❚❚' : '▶';
    const label = active ? '暂停昼夜' : '播放昼夜';
    play.setAttribute('aria-label', label);
    play.title = label;
  }

  function frameView(name: View, instant = false) {
    preset = name;
    dirty = true;
    target.fromArray(views[name].target);
    position.fromArray(views[name].camera);
    const portrait = T.MathUtils.clamp(.79 / camera.aspect, 1, 1.44);
    position.sub(target).multiplyScalar(portrait).add(target);
    if (instant || reducedMotion.matches) {
      controls.target.copy(target);
      camera.position.copy(position);
      controls.update();
      framing = false;
    } else {
      framing = true;
    }
    presets.forEach(p => p.setAttribute('aria-pressed', String(p.dataset.view === name)));
  }

  function sizeRenderer() {
    const width = view.clientWidth;
    renderer.setPixelRatio(Math.min(devicePixelRatio, width < 620 ? 1.18 : 1.35) * scale);
    renderer.setSize(width,view.clientHeight,false);
    dirty = true;
  }

  function resize() {
    const width = view.clientWidth;
    const height = view.clientHeight;
    sizeRenderer();
    camera.aspect = width / height;
    camera.fov = 40 + 25 * (1 - T.MathUtils.smoothstep(camera.aspect,.44,.92));
    camera.updateProjectionMatrix();
    if (framing || presets.some(p => p.getAttribute('aria-pressed') === 'true')) frameView(preset,true);
  }
  resize();
  window.addEventListener('resize',resize);

  function setOrbit(active: boolean) {
    controls.autoRotate = active;
    orbit.setAttribute('aria-pressed',String(active));
  }
  presets.forEach(b => b.addEventListener('click',() => {
    setOrbit(false);
    frameView(b.dataset.view as View);
  }));
  controls.addEventListener('change', () => { dirty = true; });
  controls.addEventListener('start', () => {
    framing = false;
    setOrbit(false);
    presets.forEach(b => b.setAttribute('aria-pressed','false'));
  });
  orbit.addEventListener('click',() => setOrbit(!controls.autoRotate));
  play.addEventListener('click',() => setPlay(!playing));
  slider.addEventListener('input', () => {
    setPlay(false);
    hour = Number(slider.value);
    dirty = true;
    syncClock();
  });

  function toggleUI() {
    const hidden = visibility.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll<HTMLElement>('.chrome').forEach(element => { element.hidden = hidden; });
    visibility.setAttribute('aria-expanded',String(!hidden));
    visibility.textContent = hidden ? '显示界面' : '隐藏界面';
    visibility.title = visibility.textContent + '（H）';
  }
  visibility.addEventListener('click',toggleUI);
  document.addEventListener('keydown',(event) => {
    if (event.key.toLowerCase() === 'h' && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey) toggleUI();
  });
  syncClock();

  let elapsed = 0;
  let previous = performance.now();
  renderer.setAnimationLoop(now => {
    const frameTime = now - previous;
    const dt = Math.min(.18, frameTime / 1000);
    // Lower the pixel workload when interactive rendering cannot keep up.
    if (!reducedMotion.matches && !document.hidden && scale > .63) {
      slowFrames = frameTime > 54 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
      if (slowFrames >= 12) {
        scale *= .79;
        slowFrames = 0;
        sizeRenderer();
      }
    }
    previous = now;
    if (!reducedMotion.matches) elapsed += dt;
    if (playing) {
      hour = (hour + dt * .23) % 24;
      slider.value = String(hour);
      syncClock();
    }
    if (framing) {
      const alpha = 1 - Math.exp(-dt * 7.5);
      controls.target.lerp(target,alpha);
      camera.position.lerp(position,alpha);
      if (camera.position.distanceToSquared(position) < .007 && controls.target.distanceToSquared(target) < .007) {
        controls.target.copy(target);
        camera.position.copy(position);
        framing = false;
      }
    }
    controls.update(dt);
    offset.copy(controls.target);
    controls.target.x = T.MathUtils.clamp(offset.x,-86,86);
    controls.target.z = T.MathUtils.clamp(offset.z,-79,105);
    controls.target.y = T.MathUtils.clamp(offset.y,0,36);
    offset.negate().add(controls.target);
    camera.position.add(offset);
    camera.position.y = Math.max(camera.position.y, height(camera.position.x,camera.position.z) + 1, .75);

    if (reducedMotion.matches && !dirty && !playing && !controls.autoRotate) return;
    dirty = false;
    const night = lighting(hour,elapsed);
    animateCity(elapsed,night);
    renderer.render(scene,camera);
    status.hidden = true;
  });
}

try {
  start();
} catch (error) {
  status.textContent = '无法载入三维场景，请检查浏览器 WebGL 支持。';
  console.error(error);
}
