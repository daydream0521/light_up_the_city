import * as T from 'three';
import { shoreDepth } from './terrain';

const vertexShader = /* glsl */`
  varying vec3 world;
  void main() {
    world = (modelMatrix * vec4(position, 1.)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
  }
`;

const atmosphere = /* glsl */`
  uniform vec3 upper;
  uniform vec3 horizon;
  uniform vec3 sunDir;
  uniform vec3 sunTint;
  uniform float sunlight;
  uniform float night;
  vec3 sky(vec3 ray) {
    float altitude = max(ray.y, 0.);
    float facing = max(dot(ray, sunDir), 0.);
    vec3 lit = mix(horizon, upper, pow(smoothstep(0., .73, altitude), .48));
    return lit + sunTint * sunlight * (pow(facing, 7.) * .19 + pow(facing, 66.) * .29);
  }
  float lattice(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * .1031);
    q += dot(q,q.yzx+33.33);
    return fract((q.x+q.y)*q.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f*f*(3.-2.*f);
    vec4 a = vec4(lattice(i),lattice(i+vec2(1.,0.)),lattice(i+vec2(0.,1.)),lattice(i+1.));
    return mix(mix(a.x,a.y,f.x),mix(a.z,a.w,f.x),f.y);
  }
`;

const skyFragment = /* glsl */`
  varying vec3 world;
  ${atmosphere}
  void main() {
    vec3 ray = normalize(world-cameraPosition);
    vec3 col = sky(ray);
    float facing = dot(ray,sunDir);
    col += sunTint * sunlight * smoothstep(.99978,.99989,facing) * 4.;
    vec2 clouds = ray.xz/(.27 + max(0.,ray.y)) * vec2(4.,9.);
    float bands = noise(clouds)*.55 + noise(clouds*2.2)*.30 + noise(clouds*4.6)*.15;
    float veil = smoothstep(.54,.78,bands)*smoothstep(.015,.11,ray.y)*(1.-smoothstep(.31,.62,ray.y));
    col = mix(col, mix(horizon,sunTint,max(0.,facing)*.29), veil*(.55-night*.45));
    vec2 cell = (ray.xz/(1.+max(0.,ray.y))) * 235.;
    float star = step(.987, noise(floor(cell)))*(1.-smoothstep(.06,.25,length(fract(cell)-.5)));
    col += vec3(.56,.67,.83)*star*night*smoothstep(.02,.22,ray.y);
    gl_FragColor = vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const seaFragment = /* glsl */`
  varying vec3 world;
  ${atmosphere}
  uniform sampler2D shelf;
  uniform float elapsed;
  uniform vec3 shallow;
  uniform vec3 deep;
  uniform vec2 beacons[4];

  vec2 waveSlope(vec2 p, vec2 axis, float frequency, float speed, float amplitude) {
    float phase = dot(p, axis)*frequency + elapsed*speed;
    return axis * cos(phase) * amplitude;
  }
  void main() {
    vec2 p = world.xz;
    vec2 uv = (p + vec2(90.,85.)) / vec2(180.,160.);
    float depth = texture2D(shelf, uv).r;
    vec3 v = normalize(cameraPosition - world);
    float range = distance(cameraPosition, world);
    float detail = 1.-smoothstep(62.,205.,range);
    float warp = noise(p*.13+elapsed*.1);
    vec2 q = p + vec2(noise(p*.15+elapsed*.07),noise(p*.12+vec2(30.,17.)))*2.8;
    float fine = 1.-smoothstep(.16,1.15,max(length(dFdx(p)),length(dFdy(p))));
    vec2 slope = waveSlope(q,vec2(.52,.85),1.36,1.5,.055)
      + waveSlope(q,vec2(-.95,.31),2.01,-1.24,.045)
      + waveSlope(p,vec2(.89,.46),5.55,1.81,.033)*detail*fine
      + waveSlope(q,vec2(.21,-.98),7.8,2.44,.024)*detail*fine;
    vec3 n = normalize(vec3(slope.x,1.,slope.y));
    vec3 reflection = reflect(-v,n);
    float fresnel = pow(1.-max(0.,dot(v,n)),3.25);
    vec3 water = mix(shallow,deep,smoothstep(.014,.78,depth));
    float caustic = pow(.5+.5*sin(p.x*3.8+p.y*2.2+elapsed*1.45+warp*6.),8.);
    water *= .92 + .15*warp + .15*detail*(1.-smoothstep(.06,.42,depth))*caustic;
    vec3 col = mix(water,sky(reflection), .17 + .63*fresnel);
    float facing = max(dot(reflection,sunDir),0.);
    col += sunlight * sunTint * (pow(facing,43.)*.43 + pow(facing,220.)*1.7*(.65+.35*fine));
    float wash = sin(depth*97. - elapsed*2.6 + warp*3.8);
    float foam = (1.-smoothstep(.019,.10,depth))*smoothstep(.52,.94,wash)*smoothstep(.42,.72,warp);
    col += vec3(.24,.34,.30) * foam * (1.-night*.82);
    if (night > .16) for (int i=0;i<4;i++) {
      vec2 base = beacons[i];
      if (distance(p,base) > 29.) continue;
      vec2 axis = normalize(cameraPosition.xz-base);
      vec2 delta = p-base;
      float along = dot(delta,axis);
      float across = dot(delta,vec2(-axis.y,axis.x)) + .38*sin(along*3.3-elapsed*2.);
      float trail = exp(-abs(across)*2.05) * exp(-abs(along)*.20) * smoothstep(-.3,.7,along);
      col += smoothstep(.16,.78,night) * vec3(1.25,.44,.075) * trail * (.22 + .78*pow(.5+.5*sin(along*9.+warp*9.+elapsed*4.),3.));
    }
    col = mix(col, sky(normalize(vec3(-v.x,0.,-v.z))), smoothstep(210.,760.,range)*.87);
    gl_FragColor = vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const keys = [
  { h: 0, upper: '#172952', horizon: '#465675', sun: '#91aaff', deep: '#14284b', shallow: '#245055', direct: 0, ambient: .56, glow: 1 },
  { h: 5, upper: '#304775', horizon: '#8a748c', sun: '#ce9ac1', deep: '#203850', shallow: '#35696d', direct: .18, ambient: .76, glow: .9 },
  { h: 6.5, upper: '#6b9cb7', horizon: '#e7b798', sun: '#ffc477', deep: '#265b78', shallow: '#52a39e', direct: 2.35, ambient: 1.22, glow: .22 },
  { h: 12, upper: '#5a9ac2', horizon: '#c8e5dd', sun: '#fff1cf', deep: '#225e7d', shallow: '#57bda9', direct: 2.85, ambient: 1.57, glow: 0 },
  { h: 17, upper: '#7099ba', horizon: '#efc5a0', sun: '#ffe1a6', deep: '#31647d', shallow: '#5baca4', direct: 2.5, ambient: 1.34, glow: 0 },
  { h: 18.55, upper: '#657eaa', horizon: '#e8ad87', sun: '#ffc38c', deep: '#315970', shallow: '#54a398', direct: 2.7, ambient: 1.43, glow: .15 },
  { h: 20.1, upper: '#3b4e83', horizon: '#ae7790', sun: '#ff9872', deep: '#263c63', shallow: '#376f79', direct: .30, ambient: .78, glow: .9 },
  { h: 21.65, upper: '#1d325e', horizon: '#495778', sun: '#92aaff', deep: '#172c53', shallow: '#265a63', direct: 0, ambient: .63, glow: 1 },
];
const palette = [...keys, { ...keys[0], h: 24 }].map(k => ({
  ...k,
  upper: new T.Color(k.upper), horizon: new T.Color(k.horizon), sun: new T.Color(k.sun),
  shallow: new T.Color(k.shallow), deep: new T.Color(k.deep),
}));

export function atmosphereAndSea(scene: T.Scene, small: boolean) {
  const u = {
    upper: { value: new T.Color() }, horizon: { value: new T.Color() },
    sunDir: { value: new T.Vector3() }, sunTint: { value: new T.Color() },
    sunlight: { value: 0 }, night: { value: 0 },
  };
  const sky = new T.Mesh(new T.SphereGeometry(820, 32, 18), new T.ShaderMaterial({
    uniforms: u, vertexShader, fragmentShader: skyFragment, side: T.BackSide, depthWrite: false,
  }));
  sky.renderOrder = 100;
  scene.add(sky);
  const elapsed = { value: 0 };
  const deep = { value: new T.Color() };
  const shallow = { value: new T.Color() };
  const sea = new T.Mesh(new T.PlaneGeometry(1500, 1500).rotateX(-Math.PI / 2), new T.ShaderMaterial({
    vertexShader, fragmentShader: seaFragment,
    uniforms: { ...u, shelf: { value: shoreDepth() }, elapsed, deep, shallow,
      beacons: { value: [[6,27.6],[21,30.1],[34,33.5],[18,18.4]].map(([x,z]) => new T.Vector2(x,z)) } },
  }));
  sea.position.y = .015;
  scene.add(sea);

  const groundNight = new T.Color('#566299');
  const fog = new T.FogExp2('#a7a2ae', .0039);
  scene.fog = fog;
  const ambient = new T.HemisphereLight('#bacbef', '#9d7967', 1);
  const moon = new T.DirectionalLight('#a4baff', .18);
  moon.position.set(45, 66, 46);
  const sun = new T.DirectionalLight('#ffcf9b', 2);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -83, right: 83, top: 72, bottom: -72, near: .5, far: 220 });
  sun.shadow.normalBias = .13;
  sun.shadow.bias = -.00016;
  sun.shadow.intensity = .8;
  sun.shadow.autoUpdate = false;
  sun.target.position.set(-2, 6, -7);
  scene.add(sun, sun.target, ambient, moon);
  let previousHour = -20;

  return (hour: number, time: number) => {
    elapsed.value = time;
    const hi = palette.findIndex(key => key.h > hour);
    const a = palette[hi < 0 ? palette.length - 2 : hi - 1];
    const b = palette[hi < 0 ? palette.length - 1 : hi];
    const t = T.MathUtils.smoothstep(hour, a.h, b.h);
    u.upper.value.copy(a.upper).lerp(b.upper,t);
    u.horizon.value.copy(a.horizon).lerp(b.horizon,t);
    u.sunTint.value.copy(a.sun).lerp(b.sun,t);
    shallow.value.copy(a.shallow).lerp(b.shallow,t);
    deep.value.copy(a.deep).lerp(b.deep,t);
    const azimuth = .57 + (hour - 6) * Math.PI / 13.6;
    const altitude = Math.sin((hour - 5.15) * Math.PI / 15.0) * 1.02;
    u.sunDir.value.set(Math.cos(azimuth)*Math.cos(altitude), Math.sin(altitude), Math.sin(azimuth)*Math.cos(altitude));
    u.sunlight.value = T.MathUtils.smoothstep(altitude, -.06, .15);
    u.night.value = T.MathUtils.lerp(a.glow,b.glow,t);
    fog.color.copy(u.horizon.value).lerp(u.upper.value,.24);
    sun.color.copy(u.sunTint.value);
    sun.intensity = T.MathUtils.lerp(a.direct,b.direct,t);
    ambient.color.set('#becdeb').lerp(u.upper.value,u.night.value*.62);
    ambient.groundColor.set('#ad927e').lerp(groundNight,u.night.value*.75);
    ambient.intensity = T.MathUtils.lerp(a.ambient,b.ambient,t);
    moon.intensity = .13 + u.night.value * .58;
    if (Math.abs(previousHour-hour) > .065) {
      sun.position.copy(u.sunDir.value).multiplyScalar(111).add(sun.target.position);
      sun.shadow.needsUpdate = sun.intensity > .025;
      previousHour = hour;
    }
    return u.night.value;
  };
}
