import * as THREE from "three";
import { QUESTIONS } from "./questions.js";
import { clearParticles, updateParticles } from "./effects.js";
import { createGameplay } from "./gameplay.js";
import { createCityScenery } from "./scenery.js";
import { UI_STATES, initUI, saveLeaderboardScore, setPlayerProfile, setQuestion, setUIState, showAnswerFeedback, showGameOver, updateHud } from "./ui.js";
import { createPlayer } from "./player.js";
import { createEnvironment } from "./world.js";

const INITIAL_STATE = Object.freeze({
  score: 0,
  lives: 3,
  currentQuestionIndex: 0,
  speed: 20
});
const DEFAULT_PROFILE = Object.freeze({
  name: "PLAYER",
  avatarUrl: ""
});
const SWIPE_MIN_DISTANCE = 38;
const SWIPE_MAX_DURATION_MS = 650;
const SWIPE_DIRECTION_LOCK_RATIO = 1.15;

const gameState = {
  ...INITIAL_STATE,
  playerProfile: { ...DEFAULT_PROFILE },
  questionResults: [],
  phase: UI_STATES.START
};

const canvasRoot = document.getElementById("canvas-root");

if (!canvasRoot) {
  throw new Error("Missing #canvas-root element.");
}

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5.2, 9.5);
camera.lookAt(0, 0.6, -18);
createEnvironment(scene);
const player = createPlayer(scene);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.className = "block h-full w-full";
renderer.domElement.style.touchAction = "none";
canvasRoot.appendChild(renderer.domElement);
canvasRoot.style.touchAction = "none";

const clock = new THREE.Clock();
const scenery = createCityScenery({
  scene,
  gameState
});

const gameplay = createGameplay({
  scene,
  player,
  questions: QUESTIONS,
  gameState,
  onHudUpdate: syncHud,
  onAnswerFeedback: showAnswerFeedback,
  onGameOver: () => {
    scenery.clear();
    showGameOver(gameState.score, gameState.questionResults);
  }
});

function syncHud() {
  updateHud({
    score: gameState.score,
    lives: gameState.lives
  });

  setQuestion(QUESTIONS[gameState.currentQuestionIndex]?.question ?? "Все вопросы пройдены.");
}

function normalizeProfile(profile = {}) {
  return {
    name: String(profile.name || DEFAULT_PROFILE.name).trim().slice(0, 18) || DEFAULT_PROFILE.name,
    avatarUrl: profile.avatarUrl || ""
  };
}

function resetGameState(profile = gameState.playerProfile) {
  gameState.score = INITIAL_STATE.score;
  gameState.lives = INITIAL_STATE.lives;
  gameState.currentQuestionIndex = INITIAL_STATE.currentQuestionIndex;
  gameState.speed = INITIAL_STATE.speed;
  gameState.playerProfile = normalizeProfile(profile);
  gameState.questionResults = [];
  setPlayerProfile(gameState.playerProfile);
  player.reset();
  gameplay.reset();
  scenery.reset();
  clearParticles();
}

function startGame(profile = gameState.playerProfile) {
  resetGameState(profile);
  gameState.phase = UI_STATES.PLAYING;
  syncHud();
  setUIState(UI_STATES.PLAYING);
  gameplay.start();
}

function restartGame() {
  startGame(gameState.playerProfile);
}

function pauseGame() {
  if (gameState.phase !== UI_STATES.PLAYING) {
    return;
  }

  gameState.phase = UI_STATES.PAUSED;
  setUIState(UI_STATES.PAUSED);
}

function resumeGame() {
  if (gameState.phase !== UI_STATES.PAUSED) {
    return;
  }

  gameState.phase = UI_STATES.PLAYING;
  setUIState(UI_STATES.PLAYING);
}

function togglePause() {
  if (gameState.phase === UI_STATES.PLAYING) {
    pauseGame();
    return;
  }

  if (gameState.phase === UI_STATES.PAUSED) {
    resumeGame();
  }
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function handleControls(event) {
  if (event.repeat) {
    return;
  }

  const key = event.key.toLowerCase();

  if (key === "escape" || key === "p") {
    event.preventDefault();
    togglePause();
    return;
  }

  if (gameState.phase !== UI_STATES.PLAYING) {
    return;
  }

  if (key === "arrowleft" || key === "a") {
    event.preventDefault();
    player.moveLeft();
  }

  if (key === "arrowright" || key === "d") {
    event.preventDefault();
    player.moveRight();
  }
}

function createSwipeControls(targetElement) {
  let gesture = null;

  function isPlaying() {
    return gameState.phase === UI_STATES.PLAYING;
  }

  function beginGesture(clientX, clientY) {
    if (!isPlaying()) {
      gesture = null;
      return;
    }

    gesture = {
      startX: clientX,
      startY: clientY,
      lastX: clientX,
      lastY: clientY,
      startedAt: performance.now(),
      consumed: false
    };
  }

  function updateGesture(clientX, clientY) {
    if (!gesture) {
      return;
    }

    gesture.lastX = clientX;
    gesture.lastY = clientY;
  }

  function finishGesture() {
    if (!gesture || gesture.consumed || !isPlaying()) {
      gesture = null;
      return;
    }

    const deltaX = gesture.lastX - gesture.startX;
    const deltaY = gesture.lastY - gesture.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const duration = performance.now() - gesture.startedAt;
    const isHorizontalSwipe = absX >= SWIPE_MIN_DISTANCE
      && absX > absY * SWIPE_DIRECTION_LOCK_RATIO
      && duration <= SWIPE_MAX_DURATION_MS;

    if (isHorizontalSwipe) {
      if (deltaX < 0) {
        player.moveLeft();
      } else {
        player.moveRight();
      }
    }

    gesture = null;
  }

  targetElement.addEventListener("touchstart", (event) => {
    if (!isPlaying() || event.touches.length !== 1) {
      return;
    }

    event.preventDefault();
    const touch = event.touches[0];
    beginGesture(touch.clientX, touch.clientY);
  }, { passive: false });

  targetElement.addEventListener("touchmove", (event) => {
    if (!gesture || event.touches.length !== 1) {
      return;
    }

    event.preventDefault();
    const touch = event.touches[0];
    updateGesture(touch.clientX, touch.clientY);
  }, { passive: false });

  targetElement.addEventListener("touchend", (event) => {
    if (!gesture) {
      return;
    }

    event.preventDefault();
    finishGesture();
  }, { passive: false });

  targetElement.addEventListener("touchcancel", () => {
    gesture = null;
  }, { passive: true });

  targetElement.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || !isPlaying()) {
      return;
    }

    beginGesture(event.clientX, event.clientY);
  });

  targetElement.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || !gesture) {
      return;
    }

    updateGesture(event.clientX, event.clientY);
  });

  targetElement.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "mouse") {
      return;
    }

    finishGesture();
  });
}

function renderLoop() {
  const deltaTime = clock.getDelta();
  const elapsedTime = clock.elapsedTime;

  if (gameState.phase === UI_STATES.PLAYING) {
    player.update(deltaTime, elapsedTime);
    gameplay.update(deltaTime);
    scenery.update(deltaTime);
    updateParticles(deltaTime);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(renderLoop);
}

window.addEventListener("resize", handleResize);
window.addEventListener("keydown", handleControls);
createSwipeControls(renderer.domElement);

initUI({
  onStart: startGame,
  onPause: pauseGame,
  onResume: resumeGame,
  onRestart: restartGame,
  onSaveScore: (name) => {
    saveLeaderboardScore({
      name: name || gameState.playerProfile.name,
      score: gameState.score
    });
    return true;
  }
});

syncHud();
renderLoop();

window.TMORunnerDebug = Object.freeze({
  gameState,
  gameplay,
  player,
  scenery,
  showGameOver: () => {
    gameState.phase = UI_STATES.GAMEOVER;
    gameplay.reset();
    scenery.clear();
    clearParticles();
    showGameOver(gameState.score, gameState.questionResults);
  },
  pauseGame,
  resumeGame
});
