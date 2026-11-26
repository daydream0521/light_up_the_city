import * as T from 'three';
import {skyUniforms} from './lighting';
import cut from './display-cut.json';
import {add,extrude,inside,shape,stone,type Polygon,type XY} from './geometry';

export const outline=cut.outline as XY[];
export const land=cut.land as Polygon[];
export const onDisplay=(x:number,z:number)=>inside(x,z,outline);

export function table(scene:T.Scene) {
  const scale=(factor:number)=>[outline.map(([x,z])=>[-16+(x+16)*factor,-19+(z+19)*factor] as XY)];
  const plinth=new T.MeshStandardMaterial({vertexColors:true,roughness:.42,metalness:.14});
  add(extrude(scale(1.012),.95),plinth,'#716454',0,-1.11,0);
  add(extrude(scale(1.043),1.12),plinth,'#c3a575',0,-2.19,0);
  add(extrude(scale(1.052),5.85),plinth,'#202f38',0,-7.97,0);
  add(extrude(scale(1.063),.34),plinth,'#a78a61',0,-7.87,0);
  add(extrude(scale(1.032),1.65),plinth,'#182630',0,-9.37,0);
  add(extrude([outline],.4),stone,'#123e49',0,-.46,0);
  const floor=new T.Mesh(new T.PlaneGeometry(2100,2100),new T.ShaderMaterial({
    uniforms:skyUniforms,
    vertexShader:`varying vec3 world;void main(){
      world=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
    }`,
    fragmentShader:`varying vec3 world;
    uniform vec3 horizon,upper;uniform float night;
    void main(){
      vec3 ray=normalize(world-cameraPosition);
      vec3 sky=mix(horizon,upper,pow(smoothstep(-.20,.74,ray.y),.72));
      float pool=exp(-length((world.xz-vec2(-14.,-19.))*vec2(.0033,.0044)));
      vec3 studio=mix(vec3(.035,.057,.079),vec3(.022,.032,.055),night)+sky*pool*.35;
      vec2 r=abs(world.xz-vec2(-14.,-17.))/vec2(182.5,138.5);
      float edge=pow(pow(r.x,5.)+pow(r.y,5.),.2);
      studio*=.37+.63*smoothstep(.64,.99,edge);
      vec3 col=mix(studio,sky,smoothstep(370.,805.,distance(cameraPosition,world)));
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  }));
  floor.rotation.x=-Math.PI/2;
  floor.position.y=-9.51;
  scene.add(floor);
}

export function waterShape() { return new T.ShapeGeometry(shape([outline])); }
