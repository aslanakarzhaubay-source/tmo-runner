import * as THREE from "three";
import { loadModel } from "./assets.js";
import { LANE_WIDTH } from "./world.js";

const MODEL_URL = "https://threejs.org/examples/models/gltf/Soldier.glb";
const MIN_LANE_INDEX = -1;
const MAX_LANE_INDEX = 1;
const START_LANE_INDEX = 0;
const PLAYER_Z = 3.2;
const LANE_LERP_SPEED = 11;
const TARGET_MODEL_HEIGHT = 1.85;
const MAX_MODEL_WIDTH = LANE_WIDTH * 0.72;
const MAX_MODEL_DEPTH = 1.15;
const RUN_ANIMATION_PATTERN = /run|walk/i;

function clampLaneIndex(laneIndex) {
  return THREE.MathUtils.clamp(laneIndex, MIN_LANE_INDEX, MAX_LANE_INDEX);
}

function fitModelToRunner(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = Math.min(
    TARGET_MODEL_HEIGHT / Math.max(size.y, 0.001),
    MAX_MODEL_WIDTH / Math.max(size.x, 0.001),
    MAX_MODEL_DEPTH / Math.max(size.z, 0.001)
  );

  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  const fittedBox = new THREE.Box3().setFromObject(model);
  const center = fittedBox.getCenter(new THREE.Vector3());
  const minY = fittedBox.min.y;

  model.position.x -= center.x;
  model.position.y -= minY;
  model.position.z -= center.z;
}

function chooseLocomotionClip(clips) {
  return clips.find((clip) => RUN_ANIMATION_PATTERN.test(clip.name)) ?? clips[0] ?? null;
}

function createFallbackRunner() {
  const group = new THREE.Group();
  group.name = "FallbackRunner";

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.9, 8, 18),
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.42,
      metalness: 0.04
    })
  );
  body.position.y = 0.82;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 20, 16),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.5,
      metalness: 0
    })
  );
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);

  return group;
}

export function createPlayer(scene) {
  const mesh = new THREE.Group();
  mesh.name = "Player";
  mesh.position.set(0, 0, PLAYER_Z);
  scene.add(mesh);

  let laneIndex = START_LANE_INDEX;
  let mixer = null;
  let model = null;
  let ready = true;
  let usingFallback = true;
  let loadError = null;

  model = createFallbackRunner();
  mesh.add(model);

  loadModel(MODEL_URL)
    .then((gltf) => {
      if (model) {
        mesh.remove(model);
      }

      model = gltf.scene;
      model.name = "RunnerModel";
      model.rotation.y = 0;

      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          for (const material of materials) {
            if (material) {
              material.roughness = Math.min(material.roughness ?? 0.65, 0.72);
            }
          }
        }
      });

      fitModelToRunner(model);
      mesh.add(model);

      if (gltf.animations.length > 0) {
        const clip = chooseLocomotionClip(gltf.animations);
        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(clip).reset().play();
      }

      ready = true;
      usingFallback = false;
    })
    .catch((error) => {
      loadError = error;
      ready = true;
      usingFallback = true;
      console.warn(`${error.message}. Using fallback runner so the game can still start.`);
    });

  function setLane(nextLaneIndex) {
    laneIndex = clampLaneIndex(nextLaneIndex);
  }

  function reset() {
    laneIndex = START_LANE_INDEX;
    mesh.position.set(0, 0, PLAYER_Z);
    mesh.rotation.set(0, 0, 0);
  }

  function update(deltaTime, elapsedTime = 0) {
    const targetX = laneIndex * LANE_WIDTH;
    const alpha = Math.min(1, deltaTime * LANE_LERP_SPEED);
    const laneVelocity = targetX - mesh.position.x;

    mesh.position.x = THREE.MathUtils.lerp(mesh.position.x, targetX, alpha);
    mesh.position.y = Math.sin(elapsedTime * 11.5) * 0.025;
    mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, laneVelocity * -0.07, alpha);
    mesh.rotation.x = Math.sin(elapsedTime * 8.5) * 0.012;

    if (mixer) {
      mixer.update(deltaTime);
    }
  }

  return {
    mesh,
    get laneIndex() {
      return laneIndex;
    },
    get ready() {
      return ready;
    },
    get usingFallback() {
      return usingFallback;
    },
    get loadError() {
      return loadError;
    },
    get modelUrl() {
      return MODEL_URL;
    },
    moveLeft() {
      setLane(laneIndex - 1);
    },
    moveRight() {
      setLane(laneIndex + 1);
    },
    reset,
    setLane,
    update
  };
}
