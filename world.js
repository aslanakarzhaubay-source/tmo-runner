import * as THREE from "three";

export const LANE_WIDTH = 2.5;

const SKY_COLOR = 0x60c7ff;
const TRACK_LENGTH = 160;
const TRACK_WIDTH = LANE_WIDTH * 3;
const WORLD_WIDTH = TRACK_WIDTH + 12;
const TRACK_START_Z = 14;
const TRACK_END_Z = TRACK_START_Z - TRACK_LENGTH;
const TRACK_CENTER_Z = (TRACK_START_Z + TRACK_END_Z) / 2;
const LANE_CENTERS = Object.freeze([-LANE_WIDTH, 0, LANE_WIDTH]);

function createFloor() {
  const group = new THREE.Group();

  const grassMaterial = new THREE.MeshStandardMaterial({
    color: 0x10d867,
    roughness: 0.76,
    metalness: 0
  });

  const grass = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_WIDTH, TRACK_LENGTH), grassMaterial);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.018, TRACK_CENTER_Z);
  grass.receiveShadow = true;
  group.add(grass);

  const asphaltMaterial = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.5,
    metalness: 0
  });

  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_WIDTH, TRACK_LENGTH), asphaltMaterial);
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 0, TRACK_CENTER_Z);
  asphalt.receiveShadow = true;
  group.add(asphalt);

  const laneMaterials = LANE_CENTERS.map((_, index) => new THREE.MeshStandardMaterial({
    color: index === 1 ? 0xf8fafc : 0xe0f2fe,
    roughness: 0.46,
    metalness: 0
  }));

  for (const [index, laneX] of LANE_CENTERS.entries()) {
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(LANE_WIDTH - 0.1, TRACK_LENGTH), laneMaterials[index]);
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(laneX, 0.012, TRACK_CENTER_Z);
    lane.receiveShadow = true;
    group.add(lane);
  }

  return group;
}

function createPaintMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.46,
    metalness: 0
  });
}

function createTrackStrip({ x, z, width, depth, color }) {
  const geometry = new THREE.BoxGeometry(width, 0.022, depth);
  const material = createPaintMaterial(color);
  const strip = new THREE.Mesh(geometry, material);

  strip.position.set(x, 0.048, z);
  strip.receiveShadow = false;
  return strip;
}

function createLaneLines() {
  const group = new THREE.Group();
  const boundaryX = [-TRACK_WIDTH / 2, -LANE_WIDTH / 2, LANE_WIDTH / 2, TRACK_WIDTH / 2];

  for (const x of boundaryX) {
    const isOuterBoundary = x === -TRACK_WIDTH / 2 || x === TRACK_WIDTH / 2;
    group.add(createTrackStrip({
      x,
      z: TRACK_CENTER_Z,
      width: isOuterBoundary ? 0.16 : 0.1,
      depth: TRACK_LENGTH,
      color: isOuterBoundary ? 0x059669 : 0xffd400
    }));
  }

  for (let z = TRACK_START_Z; z >= TRACK_END_Z; z -= 8) {
    group.add(createTrackStrip({
      x: 0,
      z,
      width: TRACK_WIDTH,
      depth: 0.035,
      color: 0xffffff
    }));
  }

  return group;
}

function createSideRails() {
  const group = new THREE.Group();
  const railGeometry = new THREE.BoxGeometry(0.18, 0.2, TRACK_LENGTH);
  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0xff6b00,
    roughness: 0.36,
    metalness: 0
  });

  for (const x of [-TRACK_WIDTH / 2 - 0.12, TRACK_WIDTH / 2 + 0.12]) {
    const rail = new THREE.Mesh(railGeometry, railMaterial);
    rail.position.set(x, 0.12, TRACK_CENTER_Z);
    rail.castShadow = true;
    group.add(rail);
  }

  return group;
}

function createLighting(scene) {
  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x5eea8c, 2.35);
  scene.add(hemisphereLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xfff6d8, 3.8);
  directionalLight.position.set(-6, 13, 8);
  directionalLight.castShadow = true;
  scene.add(directionalLight);
}

export function createEnvironment(scene) {
  scene.background = new THREE.Color(SKY_COLOR);
  scene.fog = new THREE.Fog(SKY_COLOR, 45, 132);

  createLighting(scene);
  scene.add(createFloor());
  scene.add(createLaneLines());
  scene.add(createSideRails());
}
