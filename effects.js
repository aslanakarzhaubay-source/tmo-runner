import * as THREE from "three";

const PARTICLE_COUNT = 28;
const EFFECT_DURATION = 0.72;
const BASE_PARTICLE_SIZE = 0.12;
const GRAVITY = 8.5;
const BOUNCE_DAMPING = 0.42;
const AIR_DRAG = 0.985;
const activeEffects = [];

function randomDirection() {
  const direction = new THREE.Vector3(
    Math.random() * 2 - 1,
    Math.random() * 1.4 + 0.25,
    Math.random() * 2 - 1
  );

  return direction.normalize();
}

function disposeEffect(effect) {
  effect.scene.remove(effect.group);
  effect.geometry.dispose();
  effect.material.dispose();
}

export function spawnParticles(scene, position, isCorrect) {
  const group = new THREE.Group();
  group.name = isCorrect ? "CorrectParticleBurst" : "WrongParticleBurst";
  group.position.copy(position);

  const color = isCorrect ? 0x22c55e : 0xef4444;
  const geometry = new THREE.BoxGeometry(BASE_PARTICLE_SIZE, BASE_PARTICLE_SIZE, BASE_PARTICLE_SIZE);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.8,
    transparent: true,
    opacity: 1,
    roughness: 0.25,
    metalness: 0.18
  });

  const particles = [];

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const mesh = new THREE.Mesh(geometry, material);
    const scale = THREE.MathUtils.lerp(0.7, 1.35, Math.random());
    const speed = THREE.MathUtils.lerp(2.8, 6.2, Math.random());

    mesh.scale.setScalar(scale);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    mesh.userData.velocity = randomDirection().multiplyScalar(speed);
    mesh.userData.spin = new THREE.Vector3(
      Math.random() * 7 - 3.5,
      Math.random() * 7 - 3.5,
      Math.random() * 7 - 3.5
    );
    mesh.userData.startScale = scale;

    group.add(mesh);
    particles.push(mesh);
  }

  const flash = new THREE.PointLight(color, 2.8, 6);
  flash.name = "ParticleBurstFlash";
  group.add(flash);

  scene.add(group);
  activeEffects.push({
    scene,
    group,
    geometry,
    material,
    particles,
    flash,
    age: 0
  });
}

export function updateParticles(deltaTime) {
  for (let index = activeEffects.length - 1; index >= 0; index -= 1) {
    const effect = activeEffects[index];
    effect.age += deltaTime;

    const progress = THREE.MathUtils.clamp(effect.age / EFFECT_DURATION, 0, 1);
    const fade = 1 - progress;
    effect.material.opacity = fade;
    effect.flash.intensity = 2.8 * fade;
    const groundY = -effect.group.position.y + BASE_PARTICLE_SIZE * 0.5;

    for (const particle of effect.particles) {
      particle.userData.velocity.y -= GRAVITY * deltaTime;
      particle.position.addScaledVector(particle.userData.velocity, deltaTime);

      if (particle.position.y < groundY) {
        particle.position.y = groundY;
        particle.userData.velocity.y = Math.abs(particle.userData.velocity.y) * BOUNCE_DAMPING;
        particle.userData.velocity.x *= 0.72;
        particle.userData.velocity.z *= 0.72;
      }

      particle.userData.velocity.multiplyScalar(AIR_DRAG);
      particle.rotation.x += particle.userData.spin.x * deltaTime;
      particle.rotation.y += particle.userData.spin.y * deltaTime;
      particle.rotation.z += particle.userData.spin.z * deltaTime;
      particle.scale.setScalar(Math.max(0.001, particle.userData.startScale * fade));
    }

    if (progress >= 1) {
      disposeEffect(effect);
      activeEffects.splice(index, 1);
    }
  }
}

export function clearParticles() {
  for (const effect of activeEffects) {
    disposeEffect(effect);
  }

  activeEffects.length = 0;
}
