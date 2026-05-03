const UI_STATES = Object.freeze({
  START: "start",
  PLAYING: "playing",
  PAUSED: "paused",
  GAMEOVER: "gameover"
});

const LEADERBOARD_KEY = "tmo_runner_scores";
const MAX_STORED_SCORES = 10;
const MAX_RENDERED_SCORES = 5;
const DEFAULT_PLAYER_NAME = "PLAYER";
const ACCEPTED_AVATAR_TYPES = new Set(["image/png", "image/jpeg"]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const elements = {};
let fallbackScores = [];
let avatarObjectUrl = "";
let feedbackTimer = 0;
let activeProfile = {
  name: DEFAULT_PLAYER_NAME,
  avatarUrl: ""
};

function requireElement(id) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing required UI element: #${id}`);
  }

  return element;
}

function cacheElements() {
  elements.startScreen = requireElement("start-screen");
  elements.hud = requireElement("hud");
  elements.pauseScreen = requireElement("pause-screen");
  elements.gameOverScreen = requireElement("game-over-screen");
  elements.answerFeedbackCurtain = requireElement("answer-feedback-curtain");
  elements.answerFeedbackText = requireElement("answer-feedback-text");
  elements.startButton = requireElement("start-button");
  elements.pauseButton = requireElement("pause-button");
  elements.resumeButton = requireElement("resume-button");
  elements.pauseRestartButton = requireElement("pause-restart-button");
  elements.restartButton = requireElement("restart-button");
  elements.startPlayerNameInput = requireElement("start-player-name-input");
  elements.startAvatarInput = requireElement("start-avatar-input");
  elements.startAvatarPreview = requireElement("start-avatar-preview");
  elements.startAvatarPlaceholder = requireElement("start-avatar-placeholder");
  elements.startAvatarFeedback = requireElement("start-avatar-feedback");
  elements.scoreValue = requireElement("score-value");
  elements.livesValue = requireElement("lives-value");
  elements.questionText = requireElement("question-text");
  elements.hudPlayerName = requireElement("hud-player-name");
  elements.hudAvatar = requireElement("hud-avatar");
  elements.hudAvatarPlaceholder = requireElement("hud-avatar-placeholder");
  elements.gameOverPlayerName = requireElement("gameover-player-name");
  elements.gameOverAvatar = requireElement("gameover-avatar");
  elements.gameOverAvatarPlaceholder = requireElement("gameover-avatar-placeholder");
  elements.finalScoreValue = requireElement("final-score-value");
  elements.playerNameInput = requireElement("player-name-input");
  elements.saveScoreButton = requireElement("save-score-button");
  elements.saveScoreFeedback = requireElement("save-score-feedback");
  elements.startLeaderboardList = requireElement("start-leaderboard-list");
  elements.gameOverLeaderboardList = requireElement("gameover-leaderboard-list");
  elements.questionReviewList = requireElement("question-review-list");
}

function setVisible(element, isVisible, displayClass = "flex") {
  element.classList.toggle("hidden", !isVisible);

  if (isVisible) {
    element.classList.add(displayClass);
  } else {
    element.classList.remove(displayClass);
  }
}

function clampLives(lives) {
  return Math.max(0, Math.min(3, Number.isFinite(lives) ? lives : 0));
}

function normalizeScore(score) {
  return Math.max(0, Math.floor(Number.isFinite(score) ? score : 0));
}

function sanitizeName(name) {
  const sanitized = String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 18);

  return sanitized || DEFAULT_PLAYER_NAME;
}

function setAvatarPreview(url) {
  const hasAvatar = Boolean(url);
  elements.startAvatarPreview.classList.toggle("hidden", !hasAvatar);
  elements.startAvatarPlaceholder.classList.toggle("hidden", hasAvatar);
  elements.hudAvatar.classList.toggle("hidden", !hasAvatar);
  elements.hudAvatarPlaceholder.classList.toggle("hidden", hasAvatar);
  elements.gameOverAvatar.classList.toggle("hidden", !hasAvatar);
  elements.gameOverAvatarPlaceholder.classList.toggle("hidden", hasAvatar);

  if (hasAvatar) {
    elements.startAvatarPreview.src = url;
    elements.hudAvatar.src = url;
    elements.gameOverAvatar.src = url;
  } else {
    elements.startAvatarPreview.removeAttribute("src");
    elements.hudAvatar.removeAttribute("src");
    elements.gameOverAvatar.removeAttribute("src");
  }
}

function readStartProfile() {
  return {
    name: sanitizeName(elements.startPlayerNameInput.value),
    avatarUrl: avatarObjectUrl
  };
}

export function setPlayerProfile(profile = {}) {
  activeProfile = {
    name: sanitizeName(profile.name),
    avatarUrl: profile.avatarUrl || ""
  };

  elements.hudPlayerName.textContent = activeProfile.name;
  elements.hudAvatarPlaceholder.textContent = activeProfile.name.slice(0, 1).toUpperCase();
  elements.gameOverPlayerName.textContent = activeProfile.name;
  elements.gameOverAvatarPlaceholder.textContent = activeProfile.name.slice(0, 1).toUpperCase();
  setAvatarPreview(activeProfile.avatarUrl);
  return activeProfile;
}

function clearAvatarSelection(message = "PNG, JPG или JPEG с устройства.") {
  if (avatarObjectUrl) {
    URL.revokeObjectURL(avatarObjectUrl);
  }

  avatarObjectUrl = "";
  elements.startAvatarInput.value = "";
  elements.startAvatarFeedback.textContent = message;
  setAvatarPreview("");
}

function handleAvatarSelection() {
  const file = elements.startAvatarInput.files?.[0];

  if (!file) {
    clearAvatarSelection();
    return;
  }

  if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
    clearAvatarSelection("Только PNG, JPG или JPEG.");
    return;
  }

  if (file.size > MAX_AVATAR_BYTES) {
    clearAvatarSelection("Файл слишком большой. Максимум 5 MB.");
    return;
  }

  if (avatarObjectUrl) {
    URL.revokeObjectURL(avatarObjectUrl);
  }

  avatarObjectUrl = URL.createObjectURL(file);
  elements.startAvatarFeedback.textContent = file.name;
  setAvatarPreview(avatarObjectUrl);
}

function sortScores(scores) {
  return [...scores]
    .sort((first, second) => second.score - first.score)
    .slice(0, MAX_STORED_SCORES);
}

export function loadLeaderboardScores() {
  try {
    const rawScores = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");

    if (!Array.isArray(rawScores)) {
      return fallbackScores;
    }

    fallbackScores = sortScores(rawScores
      .map((entry) => ({
        name: sanitizeName(entry?.name),
        score: normalizeScore(Number(entry?.score))
      }))
      .filter((entry) => entry.score >= 0));
    return fallbackScores;
  } catch {
    return fallbackScores;
  }
}

function persistLeaderboardScores(scores) {
  fallbackScores = sortScores(scores);

  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(fallbackScores));
  } catch {
    // In-memory fallback keeps the board usable when storage is blocked.
  }
}

function createScoreRow(entry, index, variant = "default") {
  const isStartMenu = variant === "start";
  const item = document.createElement("li");
  item.className = isStartMenu
    ? "font-game grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-lg border border-cyan-300/35 bg-blue-900/58 px-3 py-2 text-xs text-blue-50"
    : "grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-sm font-black text-white";

  const rank = document.createElement("span");
  rank.className = isStartMenu
    ? "rounded bg-cyan-300 px-2 py-1 text-center text-[0.65rem] text-blue-950"
    : "rounded bg-yellow-300 px-2 py-1 text-center text-xs text-slate-950";
  rank.textContent = `#${index + 1}`;

  const name = document.createElement("span");
  name.className = "truncate uppercase tracking-wide";
  name.textContent = entry.name;

  const score = document.createElement("span");
  score.className = isStartMenu
    ? "text-right tabular-nums text-cyan-200"
    : "text-right tabular-nums text-cyan-300";
  score.textContent = String(entry.score);

  item.append(rank, name, score);
  return item;
}

function renderLeaderboardList(listElement, scores) {
  listElement.replaceChildren();
  const variant = listElement.id === "start-leaderboard-list" ? "start" : "default";

  if (scores.length === 0) {
    const empty = document.createElement("li");
    empty.className = variant === "start"
      ? "font-game rounded-lg border border-dashed border-cyan-300/35 px-3 py-4 text-center text-xs text-blue-100"
      : "rounded-lg border border-dashed border-white/20 px-3 py-4 text-center text-sm font-bold text-slate-300";
    empty.textContent = "No scores yet";
    listElement.append(empty);
    return;
  }

  scores.slice(0, MAX_RENDERED_SCORES).forEach((entry, index) => {
    listElement.append(createScoreRow(entry, index, variant));
  });
}

export function renderLeaderboards() {
  const scores = loadLeaderboardScores();
  renderLeaderboardList(elements.startLeaderboardList, scores);
  renderLeaderboardList(elements.gameOverLeaderboardList, scores);
}

function createQuestionReviewRow(result, displayIndex) {
  const item = document.createElement("li");
  item.className = result.isCorrect
    ? "rounded-lg border border-emerald-300/40 bg-emerald-500/12 px-3 py-2"
    : "rounded-lg border border-red-300/45 bg-red-500/12 px-3 py-2";

  const header = document.createElement("div");
  header.className = "flex items-start gap-2";

  const marker = document.createElement("span");
  marker.className = result.isCorrect
    ? "font-game shrink-0 text-sm text-emerald-300"
    : "font-game shrink-0 text-sm text-red-300";
  marker.textContent = result.isCorrect ? "OK" : "ERR";

  const question = document.createElement("p");
  question.className = "min-w-0 text-sm font-bold leading-5 text-white";
  question.textContent = `${displayIndex + 1}. ${result.question}`;

  header.append(marker, question);
  item.append(header);

  if (!result.isCorrect) {
    const details = document.createElement("p");
    details.className = "mt-2 text-xs font-semibold leading-5 text-slate-300";
    details.textContent = `Твой ответ: ${result.selectedAnswer || "нет ответа"} | Правильно: ${result.correctAnswer}`;
    item.append(details);
  }

  return item;
}

function renderQuestionReview(results = []) {
  elements.questionReviewList.replaceChildren();

  if (!Array.isArray(results) || results.length === 0) {
    const empty = document.createElement("li");
    empty.className = "rounded-lg border border-dashed border-white/20 px-3 py-4 text-center text-sm font-bold text-slate-300";
    empty.textContent = "Нет данных по вопросам.";
    elements.questionReviewList.append(empty);
    return;
  }

  results.forEach((result, index) => {
    elements.questionReviewList.append(createQuestionReviewRow(result, index));
  });
}

export function saveLeaderboardScore({ name, score }) {
  const nextScores = sortScores([
    ...loadLeaderboardScores(),
    {
      name: sanitizeName(name),
      score: normalizeScore(score)
    }
  ]);

  persistLeaderboardScores(nextScores);
  renderLeaderboards();
  return nextScores;
}

function resetSaveScoreControls() {
  elements.playerNameInput.value = activeProfile.name;
  elements.playerNameInput.disabled = false;
  elements.saveScoreButton.disabled = false;
  elements.saveScoreFeedback.textContent = "";
}

export function initUI({ onStart, onPause, onResume, onRestart, onSaveScore }) {
  cacheElements();
  setPlayerProfile(activeProfile);
  elements.startAvatarInput.addEventListener("change", handleAvatarSelection);
  elements.startButton.addEventListener("click", () => {
    onStart(setPlayerProfile(readStartProfile()));
  });
  elements.pauseButton.addEventListener("click", onPause);
  elements.resumeButton.addEventListener("click", onResume);
  elements.pauseRestartButton.addEventListener("click", onRestart);
  elements.restartButton.addEventListener("click", onRestart);
  elements.saveScoreButton.addEventListener("click", () => {
    const saved = onSaveScore(elements.playerNameInput.value);
    if (!saved) {
      return;
    }

    elements.playerNameInput.disabled = true;
    elements.saveScoreButton.disabled = true;
    elements.saveScoreFeedback.textContent = "Score saved.";
  });

  renderLeaderboards();
  setUIState(UI_STATES.START);
}

export function setUIState(state) {
  if (!Object.values(UI_STATES).includes(state)) {
    throw new Error(`Unsupported UI state: ${state}`);
  }

  setVisible(elements.startScreen, state === UI_STATES.START);
  setVisible(elements.hud, state === UI_STATES.PLAYING || state === UI_STATES.PAUSED, "block");
  setVisible(elements.pauseScreen, state === UI_STATES.PAUSED);
  setVisible(elements.gameOverScreen, state === UI_STATES.GAMEOVER);

  if (state === UI_STATES.START || state === UI_STATES.GAMEOVER) {
    renderLeaderboards();
  }
}

export function updateHud({ score, lives }) {
  elements.scoreValue.textContent = String(normalizeScore(score));

  const safeLives = clampLives(lives);
  elements.livesValue.textContent = safeLives > 0 ? Array(safeLives).fill("♥").join(" ") : "0";
  elements.livesValue.setAttribute("aria-label", `${safeLives} lives`);
}

export function setQuestion(questionText) {
  elements.questionText.textContent = questionText || "Вопрос не загружен.";
}

export function showAnswerFeedback(isCorrect) {
  window.clearTimeout(feedbackTimer);

  elements.answerFeedbackText.textContent = isCorrect ? "Правильно!" : "Неправильно!";
  elements.answerFeedbackCurtain.classList.toggle("correct", isCorrect);
  elements.answerFeedbackCurtain.classList.toggle("wrong", !isCorrect);
  elements.answerFeedbackCurtain.classList.remove("is-visible");

  void elements.answerFeedbackCurtain.offsetWidth;
  elements.answerFeedbackCurtain.classList.add("is-visible");

  feedbackTimer = window.setTimeout(() => {
    elements.answerFeedbackCurtain.classList.remove("is-visible");
  }, 920);
}

export function showGameOver(finalScore, questionResults = []) {
  setPlayerProfile(activeProfile);
  elements.finalScoreValue.textContent = String(normalizeScore(finalScore));
  renderQuestionReview(questionResults);
  resetSaveScoreControls();
  setUIState(UI_STATES.GAMEOVER);
}

export { UI_STATES };
