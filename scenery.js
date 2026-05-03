import * as THREE from "three";

const SPAWN_Z = -150;
const CLEANUP_Z = 18;
const INITIAL_MIN_Z = -24;
const INITIAL_MAX_Z = -150;
const BUILDING_GAP = 14;
const SIDE_OFFSET_MIN = 6.2;
const SIDE_OFFSET_MAX = 11.4;
const TEXTURE_SIZE = 512;
const TEXTURE_POOL_SIZE = 10;
const BUILDING_COLORS = Object.freeze([
  "#eff6ff",
  "#dbeafe",
  "#bae6fd",
  "#e0f2fe",
  "#f8fafc",
  "#ccfbf1",
  "#ede9fe"
]);
const WINDOW_COLORS = Object.freeze(["#0ea5e9", "#38bdf8", "#67e8f9", "#bfdbfe"]);
const SIGN_COLORS = Object.freeze(["#2563eb", "#0891b2", "#0f766e", "#1d4ed8"]);
const BUILDING_SWAY_SPEED = 0.9;

function randomBetween(min, max) {
  return THREE.MathUtils.lerp(min, max, Math.random());
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function drawFacadeTexture(seed) {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;

  const context = canvas.getContext("2d");
  const baseColor = BUILDING_COLORS[seed % BUILDING_COLORS.length];
  const windowColor = WINDOW_COLORS[(seed * 3) % WINDOW_COLORS.length];
  const signColor = SIGN_COLORS[(seed * 5) % SIGN_COLORS.length];

  context.fillStyle = baseColor;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  const sideShade = context.createLinearGradient(0, 0, TEXTURE_SIZE, 0);
  sideShade.addColorStop(0, "rgba(15, 23, 42, 0.16)");
  sideShade.addColorStop(0.48, "rgba(255, 255, 255, 0)");
  sideShade.addColorStop(1, "rgba(15, 23, 42, 0.10)");
  context.fillStyle = sideShade;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  context.fillStyle = "rgba(15, 23, 42, 0.18)";
  context.fillRect(0, 0, TEXTURE_SIZE, 28);

  const columns = 4 + (seed % 3);
  const rows = 7 + (seed % 5);
  const marginX = 48;
  const marginY = 58;
  const gapX = 22;
  const gapY = 22;
  const windowWidth = (TEXTURE_SIZE - marginX * 2 - gapX * (columns - 1)) / columns;
  const windowHeight = Math.min(34, (TEXTURE_SIZE - marginY * 2 - gapY * (rows - 1)) / rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = marginX + column * (windowWidth + gapX);
      const y = marginY + row * (windowHeight + gapY);
      const lit = (row + column + seed) % 4 !== 0;

      context.fillStyle = lit ? windowColor : "rgba(15, 23, 42, 0.32)";
      context.fillRect(x, y, windowWidth, windowHeight);
      context.fillStyle = "rgba(255, 255, 255, 0.34)";
      context.fillRect(x + 4, y + 4, windowWidth * 0.34, 5);
    }
  }

  context.fillStyle = signColor;
  context.fillRect(54, TEXTURE_SIZE - 118, TEXTURE_SIZE - 108, 48);
  context.fillStyle = "#e0f2fe";
  context.font = "900 24px Arial, Helvetica, sans-serif";
  context.textAlign = "center";
  context.fillText(seed % 2 === 0 ? "METRO" : "QUIZ", TEXTURE_SIZE / 2, TEXTURE_SIZE - 87);

  context.fillStyle = "#1e293b";
  context.fillRect(TEXTURE_SIZE / 2 - 36, TEXTURE_SIZE - 60, 72, 60);
  context.fillStyle = "rgba(255, 255, 255, 0.35)";
  context.fillRect(TEXTURE_SIZE / 2 - 26, TEXTURE_SIZE - 48, 18, 24);
  context.fillRect(TEXTURE_SIZE / 2 + 8, TEXTURE_SIZE - 48, 18, 24);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

const facadeTexturePool = Array.from({ length: TEXTURE_POOL_SIZE }, (_, index) => drawFacadeTexture(index));

function getFacadeTexture() {
  return facadeTexturePool[Math.floor(Math.random() * facadeTexturePool.length)];
}

function disposeObject(object) {
  object.traverse((node) => {
    if (node.geometry) {
      node.geometry.dispose();
    }

    if (Array.isArray(node.material)) {
      for (const material of node.material) {
        material.dispose();
      }
    } else if (node.material) {
      node.material.dispose();
    }
  });
}

function createBuilding(side, z) {
  const width = randomBetween(2.0, 4.8);
  const height = randomBetween(6.5, 22);
  const depth = randomBetween(2.8, 7.0);
  const xOffset = randomBetween(SIDE_OFFSET_MIN, SIDE_OFFSET_MAX);
  const x = side === "left" ? -xOffset : xOffset;
  const accentColor = new THREE.Color(pick([0x0284c7, 0x06b6d4, 0x2563eb, 0x14b8a6]));

  const facadeMaterial = new THREE.MeshStandardMaterial({
    map: getFacadeTexture(),
    roughness: 0.5,
    metalness: 0.04
  });
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: accentColor.clone().lerp(new THREE.Color(0xffffff), 0.35),
    roughness: 0.58,
    metalness: 0.02
  });
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.42,
    metalness: 0.08
  });
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const building = new THREE.Mesh(geometry, [
    sideMaterial,
    sideMaterial,
    roofMaterial,
    sideMaterial,
    facadeMaterial,
    facadeMaterial
  ]);

  building.name = "CityBuilding";
  building.position.set(x, height / 2, z);
  building.userData.baseX = x;
  building.userData.swayPhase = Math.random() * Math.PI * 2;
  building.userData.swayAmount = randomBetween(0.015, 0.055) * (height / 12);
  building.userData.tiltAmount = randomBetween(0.0015, 0.006) * Math.min(height / 10, 2);
  building.castShadow = true;
  building.receiveShadow = true;
  return building;
}

function spawnBuildingPair(scene, buildings, z) {
  for (const side of ["left", "right"]) {
    const building = createBuilding(side, z + randomBetween(-3, 3));
    buildings.push(building);
    scene.add(building);
  }
}

export function createCityScenery({ scene, gameState }) {
  const buildings = [];
  let distanceUntilNextSpawn = 0;
  let elapsedTime = 0;

  function clear() {
    for (const building of buildings) {
      scene.remove(building);
      disposeObject(building);
    }

    buildings.length = 0;
  }

  function populateInitialCity() {
    for (let z = INITIAL_MIN_Z; z >= INITIAL_MAX_Z; z -= BUILDING_GAP) {
      spawnBuildingPair(scene, buildings, z);
    }
  }

  function reset() {
    clear();
    distanceUntilNextSpawn = 0;
    elapsedTime = 0;
    populateInitialCity();
  }

  function update(deltaTime) {
    if (gameState.phase !== "playing") {
      return;
    }

    const travelDistance = gameState.speed * deltaTime;
    elapsedTime += deltaTime;
    distanceUntilNextSpawn -= travelDistance;

    for (let index = buildings.length - 1; index >= 0; index -= 1) {
      const building = buildings[index];
      building.position.z += travelDistance;
      building.position.x = building.userData.baseX
        + Math.sin(elapsedTime * BUILDING_SWAY_SPEED + building.userData.swayPhase) * building.userData.swayAmount;
      building.rotation.z = Math.sin(elapsedTime * BUILDING_SWAY_SPEED * 0.74 + building.userData.swayPhase) * building.userData.tiltAmount;

      if (building.position.z > CLEANUP_Z) {
        scene.remove(building);
        disposeObject(building);
        buildings.splice(index, 1);
      }
    }

    while (distanceUntilNextSpawn <= 0) {
      spawnBuildingPair(scene, buildings, SPAWN_Z);
      distanceUntilNextSpawn += BUILDING_GAP;
    }
  }

  return {
    get buildings() {
      return buildings;
    },
    reset,
    clear,
    update
  };
}
