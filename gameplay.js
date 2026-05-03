import * as THREE from "three";
import { spawnParticles } from "./effects.js";
import { LANE_WIDTH } from "./world.js";

const SPAWN_Z = -120;
const CLEANUP_Z = 15;
const ROW_FEEDBACK_SECONDS = 0.34;
const PLAYER_COLLISION_Z_PADDING = 0.46;
const SPEED_INCREMENT = 3;
const MAX_SPEED = 68;
const LANE_INDICES = Object.freeze([-1, 0, 1]);
const PANEL_SIZE = Object.freeze({
  width: 2.42,
  height: 3.25,
  depth: 0.34
});
const TEXTURE_SIZE = 1024;
const ANSWER_FONT_FAMILY = "\"Bungee\", \"Arial Black\", Impact, sans-serif";

function shuffle(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function createRoundRectPath(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function wrapText(context, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  let forcedBreak = false;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;

    if (context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) {
      lines.push(line);
      line = "";
    }

    if (context.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }

    let chunk = "";
    for (const character of word) {
      const candidateChunk = `${chunk}${character}`;
      if (context.measureText(candidateChunk).width > maxWidth && chunk) {
        forcedBreak = true;
        lines.push(chunk);
        chunk = character;
      } else {
        chunk = candidateChunk;
      }
    }
    line = chunk;
  }

  if (line) {
    lines.push(line);
  }

  return {
    lines,
    forcedBreak
  };
}

function createAnswerTexture(answerText) {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;

  const context = canvas.getContext("2d");
  const padding = 42;
  const maxTextWidth = TEXTURE_SIZE - padding * 2;

  const gradient = context.createLinearGradient(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  gradient.addColorStop(0, "#1e3a8a");
  gradient.addColorStop(0.55, "#2563eb");
  gradient.addColorStop(1, "#0f172a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  createRoundRectPath(context, 24, 24, TEXTURE_SIZE - 48, TEXTURE_SIZE - 48, 52);
  context.strokeStyle = "#fde047";
  context.lineWidth = 26;
  context.stroke();

  createRoundRectPath(context, 64, 64, TEXTURE_SIZE - 128, TEXTURE_SIZE - 128, 38);
  context.strokeStyle = "rgba(255, 255, 255, 0.78)";
  context.lineWidth = 10;
  context.stroke();

  let fontSize = 154;
  let lines = [];
  let forcedBreak = false;

  do {
    context.font = `900 ${fontSize}px ${ANSWER_FONT_FAMILY}`;
    const wrapped = wrapText(context, answerText, maxTextWidth);
    lines = wrapped.lines;
    forcedBreak = wrapped.forcedBreak;
    if (!forcedBreak && lines.length <= 7 && lines.length * (fontSize + 18) <= 790) {
      break;
    }
    fontSize -= 8;
  } while (fontSize > 58);

  context.font = `900 ${fontSize}px ${ANSWER_FONT_FAMILY}`;
  lines = wrapText(context, answerText, maxTextWidth).lines;

  const lineHeight = fontSize + 20;
  const blockHeight = lines.length * lineHeight;
  let y = TEXTURE_SIZE / 2 - blockHeight / 2 + lineHeight * 0.76;

  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#f8fafc";
  context.lineWidth = Math.max(8, fontSize * 0.08);
  context.strokeStyle = "rgba(15, 23, 42, 0.92)";
  context.shadowColor = "rgba(15, 23, 42, 0.78)";
  context.shadowBlur = 12;

  for (const line of lines) {
    context.strokeText(line, TEXTURE_SIZE / 2, y);
    context.fillText(line, TEXTURE_SIZE / 2, y);
    y += lineHeight;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  return texture;
}

function createAnswerBlock({ laneIndex, answer, isCorrect }) {
  const block = new THREE.Group();
  const baseY = PANEL_SIZE.height / 2;
  block.position.set(laneIndex * LANE_WIDTH, baseY, 0);
  block.userData = {
    answer,
    isCorrect,
    laneIndex,
    baseY
  };

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.42,
    metalness: 0
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(PANEL_SIZE.width, PANEL_SIZE.height, PANEL_SIZE.depth),
    bodyMaterial
  );
  body.castShadow = true;
  body.receiveShadow = true;
  body.name = `AnswerPanel_${laneIndex}`;
  body.userData = block.userData;
  block.add(body);

  const answerTexture = createAnswerTexture(answer);
  const textMaterial = new THREE.MeshBasicMaterial({
    map: answerTexture,
    transparent: true
  });
  const textPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_SIZE.width * 0.94, PANEL_SIZE.height * 0.92),
    textMaterial
  );
  textPlane.position.z = PANEL_SIZE.depth / 2 + 0.006;
  textPlane.name = `AnswerText_${laneIndex}`;
  textPlane.userData = block.userData;
  block.add(textPlane);

  const glow = new THREE.PointLight(0xfacc15, 0.32, 4);
  glow.position.set(0, 0.2, 0.45);
  block.add(glow);

  return {
    group: block,
    body,
    textPlane,
    glow,
    laneIndex,
    isCorrect,
    answer,
    baseY
  };
}

function disposeMaterial(material) {
  if (!material) {
    return;
  }

  for (const value of Object.values(material)) {
    if (value && typeof value.dispose === "function" && value.isTexture) {
      value.dispose();
    }
  }

  material.dispose();
}

function disposeObject3D(object) {
  const geometries = new Set();
  const materials = new Set();

  object.traverse((node) => {
    if (node.geometry) {
      geometries.add(node.geometry);
    }

    if (Array.isArray(node.material)) {
      for (const material of node.material) {
        materials.add(material);
      }
    } else if (node.material) {
      materials.add(node.material);
    }
  });

  for (const geometry of geometries) {
    geometry.dispose();
  }

  for (const material of materials) {
    disposeMaterial(material);
  }
}

function setBlockFeedback(block, colorHex) {
  block.body.material.color.setHex(colorHex);
  block.body.material.emissive.setHex(colorHex);
  block.body.material.emissiveIntensity = 2.2;
  block.glow.color.setHex(colorHex);
  block.glow.intensity = 2.8;
}

function getBlockWorldPosition(block) {
  const position = new THREE.Vector3();
  block.group.getWorldPosition(position);
  return position;
}

function pickCorrectLane(previousCorrectLane) {
  const lanes = LANE_INDICES.filter((laneIndex) => laneIndex !== previousCorrectLane);
  return lanes[Math.floor(Math.random() * lanes.length)];
}

function createQuestionRow(question, previousCorrectLane) {
  const group = new THREE.Group();
  group.position.z = SPAWN_Z;
  group.name = "QuestionRow";

  const correctLane = pickCorrectLane(previousCorrectLane);
  const wrongAnswers = shuffle(question.wrong_answers).map((text) => ({
    text,
    isCorrect: false
  }));
  const answersByLane = new Map([
    [
      correctLane,
      {
        text: question.correct_answer,
        isCorrect: true
      }
    ]
  ]);

  LANE_INDICES
    .filter((laneIndex) => laneIndex !== correctLane)
    .forEach((laneIndex, index) => {
      answersByLane.set(laneIndex, wrongAnswers[index]);
    });

  const blocks = LANE_INDICES.map((laneIndex) => {
    const answer = answersByLane.get(laneIndex);
    const block = createAnswerBlock({
      laneIndex,
      answer: answer.text,
      isCorrect: answer.isCorrect
    });

    group.add(block.group);
    return block;
  });

  return {
    group,
    blocks,
    correctLane,
    previousZ: SPAWN_Z,
    wobblePhase: Math.random() * Math.PI * 2,
    resolved: false,
    feedbackSeconds: 0,
    nextAction: null
  };
}

function updateRowPhysics(row, deltaTime) {
  row.wobblePhase += deltaTime * 4.2;

  for (const block of row.blocks) {
    const offset = block.laneIndex * 0.45;
    const wobble = Math.sin(row.wobblePhase + offset);
    const recoil = row.resolved ? 0.12 : 0;

    block.group.position.y = block.baseY + wobble * 0.045 + recoil;
    block.group.rotation.x = Math.sin(row.wobblePhase * 0.72 + offset) * 0.018;
    block.group.rotation.y = Math.sin(row.wobblePhase + offset) * 0.035;
    block.group.rotation.z = Math.sin(row.wobblePhase * 0.55 + offset) * 0.012;
  }
}

export function createGameplay({
  scene,
  player,
  questions,
  gameState,
  onHudUpdate,
  onAnswerFeedback = () => {},
  onGameOver
}) {
  let activeRow = null;
  let previousCorrectLane = null;

  function destroyActiveRow() {
    if (!activeRow) {
      return;
    }

    scene.remove(activeRow.group);
    disposeObject3D(activeRow.group);
    activeRow = null;
  }

  function spawnCurrentQuestionRow() {
    destroyActiveRow();
    const question = questions[gameState.currentQuestionIndex];

    if (!question) {
      finishRun();
      return;
    }

    activeRow = createQuestionRow(question, previousCorrectLane);
    previousCorrectLane = activeRow.correctLane;
    scene.add(activeRow.group);
  }

  function recordQuestionResult(hitBlock) {
    const question = questions[gameState.currentQuestionIndex];

    if (!question) {
      return;
    }

    if (!Array.isArray(gameState.questionResults)) {
      gameState.questionResults = [];
    }

    gameState.questionResults.push({
      index: gameState.currentQuestionIndex,
      question: question.question,
      selectedAnswer: hitBlock.answer,
      correctAnswer: question.correct_answer,
      isCorrect: hitBlock.isCorrect
    });
  }

  function advanceQuestion() {
    gameState.currentQuestionIndex += 1;
    return gameState.currentQuestionIndex >= questions.length;
  }

  function finishRun() {
    gameState.phase = "gameover";
    destroyActiveRow();
    onHudUpdate();
    onGameOver();
  }

  function resolveRow(hitBlock) {
    if (!activeRow || activeRow.resolved) {
      return;
    }

    activeRow.resolved = true;
    activeRow.feedbackSeconds = ROW_FEEDBACK_SECONDS;
    recordQuestionResult(hitBlock);
    onAnswerFeedback(hitBlock.isCorrect);
    spawnParticles(scene, getBlockWorldPosition(hitBlock), hitBlock.isCorrect);

    if (hitBlock.isCorrect) {
      setBlockFeedback(hitBlock, 0x22c55e);
      gameState.score += 10;
      gameState.speed = Math.min(MAX_SPEED, gameState.speed + SPEED_INCREMENT);
    } else {
      setBlockFeedback(hitBlock, 0xef4444);
      gameState.lives = Math.max(0, gameState.lives - 1);
    }

    const isDefeated = gameState.lives <= 0;
    const isFinished = advanceQuestion();
    onHudUpdate();

    if (isDefeated || isFinished) {
      activeRow.nextAction = "finish";
      return;
    }

    activeRow.nextAction = "next";
  }

  function checkCollision() {
    if (!activeRow || activeRow.resolved) {
      return;
    }

    const playerZ = player.mesh.position.z;
    const currentZ = activeRow.group.position.z;
    const crossedPlayer = activeRow.previousZ < playerZ && currentZ >= playerZ - PLAYER_COLLISION_Z_PADDING;

    if (!crossedPlayer) {
      return;
    }

    const hitBlock = activeRow.blocks.find((block) => block.laneIndex === player.laneIndex);

    if (!hitBlock) {
      throw new Error(`No answer block for lane ${player.laneIndex}`);
    }

    resolveRow(hitBlock);
  }

  function updateResolvedRow(deltaTime) {
    if (!activeRow?.resolved) {
      return;
    }

    activeRow.feedbackSeconds -= deltaTime;
    updateRowPhysics(activeRow, deltaTime);

    if (activeRow.feedbackSeconds > 0) {
      return;
    }

    const nextAction = activeRow.nextAction;
    destroyActiveRow();

    if (nextAction === "finish") {
      finishRun();
      return;
    }

    if (nextAction === "next") {
      spawnCurrentQuestionRow();
    }
  }

  function update(deltaTime) {
    if (gameState.phase !== "playing") {
      return;
    }

    if (!activeRow) {
      spawnCurrentQuestionRow();
      return;
    }

    if (activeRow.resolved) {
      updateResolvedRow(deltaTime);
      return;
    }

    activeRow.previousZ = activeRow.group.position.z;
    activeRow.group.position.z += gameState.speed * deltaTime;
    updateRowPhysics(activeRow, deltaTime);

    checkCollision();

    if (activeRow && !activeRow.resolved && activeRow.group.position.z > CLEANUP_Z) {
      destroyActiveRow();
      spawnCurrentQuestionRow();
    }
  }

  return {
    get activeRow() {
      return activeRow;
    },
    reset() {
      destroyActiveRow();
      previousCorrectLane = null;
    },
    start() {
      spawnCurrentQuestionRow();
    },
    update
  };
}
