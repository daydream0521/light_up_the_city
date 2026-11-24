import * as THREE from 'three';
import type { CityVisual } from './cityGeometry';
import { createGlowTexture, windowGeometry } from './cityBuildings';

export interface CityLife {
  update(elapsed: number, delta: number, levels: readonly number[]): void;
}

const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const dimBeacon = new THREE.Color('#3d1c14');
const brightBeacon = new THREE.Color('#ff8a5c');

function smoothstep(value: number, low: number, high: number): number {
  const t = THREE.MathUtils.clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
}

interface Car {
  group: THREE.Group;
  materials: THREE.SpriteMaterial[];
  bodyMaterial: THREE.MeshStandardMaterial;
  direction: number;
  speed: number;
  offset: number;
  threshold: number;
}

export function createCityLife(city: CityVisual, reducedMotion: boolean): CityLife {
  const glowTexture = createGlowTexture();
  const litMaterial = new THREE.MeshStandardMaterial({
    color: '#ffd9a0', emissive: '#ffc477', emissiveIntensity: 1.75, roughness: 0.42,
  });

  const overlays = city.life.map((seed) => {
    const count = Math.max(1, seed.windows.length);
    const mesh = new THREE.InstancedMesh(windowGeometry, litMaterial, count);
    for (let index = 0; index < count; index += 1) mesh.setMatrixAt(index, zeroMatrix);
    if (!seed.windows.length) mesh.visible = false;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    city.group.add(mesh);
    return { mesh, state: new Uint8Array(count) };
  });

  const silhouettes = city.life.map((seed) => {
    const material = new THREE.MeshBasicMaterial({
      color: '#2a1a0c', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    const count = Math.max(1, seed.silhouettes.length);
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.16), material, count);
    seed.silhouettes.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    if (!seed.silhouettes.length) {
      mesh.setMatrixAt(0, zeroMatrix);
      mesh.visible = false;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    city.group.add(mesh);
    return material;
  });

  const carRoot = new THREE.Group();
  city.group.add(carRoot);
  const bodyGeometry = new THREE.BoxGeometry(0.52, 0.15, 0.26);
  const cabinGeometry = new THREE.BoxGeometry(0.24, 0.1, 0.22);
  const cars: Car[] = [0, 1, 2, 3].map((index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: index % 2 === 0 ? '#1b2c3e' : '#2a2438', roughness: 0.32, metalness: 0.6,
      transparent: true, opacity: 0,
    });
    const group = new THREE.Group();
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    const cabin = new THREE.Mesh(cabinGeometry, bodyMaterial);
    cabin.position.set(-0.06, 0.12, 0);
    group.add(body, cabin);
    const materials: THREE.SpriteMaterial[] = [];
    for (const [dx, color, size] of [
      [0.29, '#fff1cd', 0.2], [0.29, '#fff1cd', 0.2], [-0.29, '#ff5a4d', 0.14], [-0.29, '#ff5a4d', 0.14],
    ] as const) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture, color, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      sprite.scale.setScalar(size);
      sprite.position.set(dx, 0.02, materials.length % 2 === 0 ? 0.09 : -0.09);
      materials.push(sprite.material);
      group.add(sprite);
    }
    group.visible = false;
    carRoot.add(group);
    return {
      group, materials, bodyMaterial, direction,
      speed: [1.35, 1.75, 1.1, 1.55][index],
      offset: index * 5.9,
      threshold: 0.22 + index * 0.14,
    };
  });

  const streakGeometry = new THREE.PlaneGeometry(0.42, 6.4);
  const waterStreaks = city.life.map((seed, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: '#ffc679', map: glowTexture, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const streak = new THREE.Mesh(streakGeometry, material);
    streak.rotation.x = -Math.PI / 2;
    const baseX = seed.center.x > 0 ? 0.3 : -0.3;
    streak.position.set(baseX, 0.075, seed.center.z);
    streak.scale.y = 1.15;
    city.group.add(streak);
    return { material, baseX, phase: index * 1.9 };
  });

  const pillars = city.life.map((seed) => {
    const material = new THREE.SpriteMaterial({
      map: glowTexture, color: '#ffcf87', transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.2, 9, 1);
    sprite.position.copy(seed.center).setY(4.2);
    city.group.add(sprite);
    return material;
  });

  const finaleMaterial = new THREE.SpriteMaterial({
    map: glowTexture, color: '#ffd9a0', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const finaleGlow = new THREE.Sprite(finaleMaterial);
  finaleGlow.scale.setScalar(17);
  finaleGlow.position.set(0, 0.6, 0);
  city.group.add(finaleGlow);

  const bridgeReflection = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({
    color: '#ffc679', map: glowTexture, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  bridgeReflection.rotation.x = -Math.PI / 2;
  bridgeReflection.position.set(0, 0.07, 0);
  city.group.add(bridgeReflection);

  return {
    update(elapsed: number, _delta: number, levels: readonly number[]): void {
      let average = 0;
      for (let index = 0; index < 4; index += 1) {
        const level = levels[index] ?? 0;
        average += level;
        const overlay = overlays[index];
        const seed = city.life[index];
        let changed = false;
        for (let i = 0; i < seed.windows.length; i += 1) {
          const want = level > seed.windows[i].threshold ? 1 : 0;
          if (overlay.state[i] !== want) {
            overlay.state[i] = want;
            overlay.mesh.setMatrixAt(i, want ? seed.windows[i].matrix : zeroMatrix);
            changed = true;
          }
        }
        if (changed) overlay.mesh.instanceMatrix.needsUpdate = true;

        silhouettes[index].opacity = smoothstep(level, 0.32, 0.72) * 0.92;
        const streak = waterStreaks[index];
        const shimmer = reducedMotion ? 0 : Math.sin(elapsed * 0.7 + streak.phase) * 0.05;
        streak.material.opacity = level * (0.3 + shimmer);
        pillars[index].opacity = smoothstep(level, 0.88, 1) * 0.3 * (reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(elapsed * 1.2 + index));
      }
      average /= 4;

      for (const material of city.canalLampMaterials) {
        const flicker = reducedMotion ? 1 : 0.92 + 0.08 * Math.sin(elapsed * 13.7);
        material.emissiveIntensity = (0.03 + smoothstep(average, 0.12, 0.5) * 2.3) * flicker;
      }

      city.beacons.forEach((beacon, index) => {
        const material = beacon.material as THREE.MeshBasicMaterial;
        const pulse = reducedMotion ? 0.55 : Math.max(0, Math.sin(elapsed * 2.1 + index * 1.7)) ** 5;
        material.color.copy(dimBeacon).lerp(brightBeacon, pulse);
      });

      cars.forEach((car) => {
        const strength = smoothstep(average, car.threshold, car.threshold + 0.16);
        car.group.visible = strength > 0.02;
        if (!car.group.visible) return;
        car.bodyMaterial.opacity = strength * 0.95;
        car.materials.forEach((material) => { material.opacity = strength; });
        const time = reducedMotion ? car.offset : elapsed * car.speed + car.offset;
        const x = car.direction * (((time % 22.4) + 22.4) % 22.4 - 11.2);
        car.group.position.set(x, 0.14 + 0.44 * smoothstep(Math.abs(x), 2.7, 1.4), car.direction * 0.3);
        car.group.rotation.y = car.direction > 0 ? 0 : Math.PI;
      });

      const bridgeMaterial = bridgeReflection.material as THREE.MeshBasicMaterial;
      bridgeMaterial.opacity = average * 0.22;
      finaleMaterial.opacity = smoothstep(average, 0.96, 1) * 0.16 * (reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(elapsed * 0.8));
    },
  };
}
