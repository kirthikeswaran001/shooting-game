import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let playerId = "";

// LOGIN FUNCTION
window.login = async function () {
  const input = document.getElementById("playerIdInput").value.trim();

  if (!input) {
    alert("Enter Player ID");
    return;
  }

  playerId = input;

  const ref = doc(db, "players", playerId);
  const snap = await getDoc(ref);

  // If new user → create account
  if (!snap.exists()) {
    await setDoc(ref, {
      name: playerId,
      score: 0,
      friends: []
    });
  }

  alert("Logged in as " + playerId);

  showPage("homePage");
};
const screens = {
  login: document.getElementById("loginScreen"),
  home: document.getElementById("homeScreen"),
  costumes: document.getElementById("costumesScreen"),
  levels: document.getElementById("levelsScreen"),
  leaderboard: document.getElementById("leaderboardScreen"),
  game: document.getElementById("gameScreen"),
};
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const bossHealthEl = document.getElementById("bossHealth");
const modeTextEl = document.getElementById("modeText");
const overlay = document.getElementById("overlay");
const overlayEyebrow = document.getElementById("overlayEyebrow");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const leaveGameButton = document.getElementById("leaveGameButton");
const loginForm = document.getElementById("loginForm");
const loginPlayerId = document.getElementById("loginPlayerId");
const loginDisplayName = document.getElementById("loginDisplayName");
const loginStatus = document.getElementById("loginStatus");
const profileName = document.getElementById("profileName");
const profileId = document.getElementById("profileId");
const profileForm = document.getElementById("profileForm");
const editPlayerId = document.getElementById("editPlayerId");
const editDisplayName = document.getElementById("editDisplayName");
const profileStatus = document.getElementById("profileStatus");
const friendForm = document.getElementById("friendForm");
const friendIdInput = document.getElementById("friendIdInput");
const friendList = document.getElementById("friendList");
const friendStatus = document.getElementById("friendStatus");
const friendsScoreList = document.getElementById("friendsScoreList");
const worldScoreList = document.getElementById("worldScoreList");
const levelGuide = document.getElementById("levelGuide");
const costumeButtons = document.querySelectorAll("[data-costume]");
const controlButtons = document.querySelectorAll("[data-control]");
const navButtons = document.querySelectorAll("[data-go]");
const boardViewButtons = document.querySelectorAll("[data-board-view]");
const controlMap = Object.fromEntries(Array.from(controlButtons, (button) => [button.dataset.control, button]));
const mobileQuery = window.matchMedia("(max-width: 720px)");
const keys = new Set();
const touchInput = { left: false, right: false, fire: false, pointerId: null };
const sound = { ctx: null, unlocked: false };
const storageKeys = {
  currentPlayer: "skyline-current-player",
  players: "skyline-local-players",
  scores: "skyline-local-scores",
};
const costumeThemes = {
  classic: { body: "#d9faff", wing: "#67e8f9", glow: "#22d3ee" },
  stealth: { body: "#d1d5db", wing: "#94a3b8", glow: "#cbd5e1" },
  nova: { body: "#fef3c7", wing: "#fb7185", glow: "#fbbf24" },
  leaf: { body: "#dcfce7", wing: "#86efac", glow: "#22c55e" },
};
const enemyPalette = [
  { color: "#fbbf24", score: 9, hp: 1, speed: 0.95 },
  { color: "#fb7185", score: 12, hp: 1, speed: 1.05 },
  { color: "#34d399", score: 15, hp: 2, speed: 1.12 },
  { color: "#60a5fa", score: 18, hp: 2, speed: 1.18 },
];
const state = {
  activeScreen: "login",
  backend: null,
  player: null,
  selectedCostume: "classic",
  running: false,
  paused: false,
  awaitingStart: true,
  overlayMode: "pause",
  score: 0,
  lives: 3,
  level: 1,
  enemyTimer: 0,
  enemyInterval: 850,
  killsThisLevel: 0,
  killsNeeded: 8,
  boss: null,
  bossFight: false,
  bossIntroTimer: 0,
  lastTime: 0,
  screenShake: 0,
  shakePower: 0,
  stars: [],
  skyline: [],
  bullets: [],
  enemies: [],
  particles: [],
  flashTimer: 0,
  ship: null,
  leaderboardView: "friends",
};

function normalizePlayerId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 18);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function readJson(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function createLocalBackend() {
  const getPlayers = () => readJson(storageKeys.players, {});
  const getScores = () => readJson(storageKeys.scores, {});
  return {
    mode: "local",
    async login({ playerId, displayName, costume }) {
      const players = getPlayers();
      const existing = players[playerId] || { friendIds: [] };
      players[playerId] = { playerId, displayName, costume: costume || existing.costume || "classic", friendIds: existing.friendIds || [] };
      writeJson(storageKeys.players, players);
      localStorage.setItem(storageKeys.currentPlayer, playerId);
      return players[playerId];
    },
    async saveProfile(player) {
      const players = getPlayers();
      players[player.playerId] = { ...players[player.playerId], ...player };
      writeJson(storageKeys.players, players);
      return players[player.playerId];
    },
    async updateIdentity(currentPlayerId, nextPlayerId, nextDisplayName, costume) {
      const players = getPlayers();
      const scores = getScores();
      const current = players[currentPlayerId];
      if (!current) throw new Error("Current player was not found.");
      if (nextPlayerId !== currentPlayerId && players[nextPlayerId]) {
        throw new Error("That player ID is already taken.");
      }

      const updatedPlayer = {
        ...current,
        playerId: nextPlayerId,
        displayName: nextDisplayName,
        costume: costume || current.costume || "classic",
      };

      delete players[currentPlayerId];
      players[nextPlayerId] = updatedPlayer;

      Object.values(players).forEach((player) => {
        player.friendIds = (player.friendIds || []).map((id) => (id === currentPlayerId ? nextPlayerId : id));
      });

      if (scores[currentPlayerId]) {
        const best = scores[currentPlayerId];
        delete scores[currentPlayerId];
        scores[nextPlayerId] = {
          ...best,
          playerId: nextPlayerId,
          displayName: nextDisplayName,
        };
      }

      writeJson(storageKeys.players, players);
      writeJson(storageKeys.scores, scores);
      localStorage.setItem(storageKeys.currentPlayer, nextPlayerId);
      return players[nextPlayerId];
    },
    async fetchPlayer(playerId) { return getPlayers()[playerId] || null; },
    async addFriend(playerId, friendId) {
      const players = getPlayers();
      if (!players[friendId]) throw new Error("Friend ID not found yet. Ask your friend to log in once first.");
      players[playerId].friendIds = Array.from(new Set([...(players[playerId].friendIds || []), friendId]));
      writeJson(storageKeys.players, players);
      return players[playerId];
    },
    async removeFriend(playerId, friendId) {
      const players = getPlayers();
      players[playerId].friendIds = (players[playerId].friendIds || []).filter((id) => id !== friendId);
      writeJson(storageKeys.players, players);
      return players[playerId];
    },
    async saveScore(player, score, level) {
      const scores = getScores();
      const best = scores[player.playerId];
      if (!best || score > best.score) {
        scores[player.playerId] = { playerId: player.playerId, displayName: player.displayName, score, level };
        writeJson(storageKeys.scores, scores);
      }
    },
    async fetchScoreboard(playerId) {
      const players = getPlayers();
      const scores = getScores();
      const player = players[playerId] || null;
      if (!player) return { player: null, friends: [], friendsBoard: [], worldBoard: [] };
      const allowed = Array.from(new Set([playerId, ...(player.friendIds || [])]));
      const friendsBoard = allowed.map((id) => {
        const profile = players[id];
        if (!profile) return null;
        const best = scores[id] || { playerId: id, displayName: profile.displayName, score: 0, level: 0 };
        return { playerId: id, displayName: best.displayName || profile.displayName, score: best.score || 0, level: best.level || 0 };
      }).filter(Boolean).sort((a, b) => b.score - a.score);
      const worldBoard = Object.values(players).map((profile) => {
        const best = scores[profile.playerId] || { playerId: profile.playerId, displayName: profile.displayName, score: 0, level: 0 };
        return {
          playerId: profile.playerId,
          displayName: best.displayName || profile.displayName,
          score: best.score || 0,
          level: best.level || 0,
        };
      }).sort((a, b) => b.score - a.score);
      const friends = (player.friendIds || []).map((id) => players[id]).filter(Boolean);
      return { player, friends, friendsBoard, worldBoard };
    },
  };
}

function createFirebaseBackend(config) {
  let sdkReady = false;
  let auth;
  let db;
  let sdk;
  async function ensureSdk() {
    if (sdkReady) return;
    const appSdk = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const authSdk = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    const firestoreSdk = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    const app = appSdk.initializeApp(config);
    auth = authSdk.getAuth(app);
    db = firestoreSdk.getFirestore(app);
    sdk = { authSdk, firestoreSdk };
    sdkReady = true;
  }
  return {
    mode: "firebase",
    async login({ playerId, displayName, costume }) {
      await ensureSdk();
      await sdk.authSdk.signInAnonymously(auth);
      const ref = sdk.firestoreSdk.doc(db, "players", playerId);
      await sdk.firestoreSdk.setDoc(ref, { playerId, displayName, costume: costume || "classic", friendIds: [], updatedAt: sdk.firestoreSdk.serverTimestamp() }, { merge: true });
      return (await sdk.firestoreSdk.getDoc(ref)).data();
    },
    async saveProfile(player) {
      await ensureSdk();
      const ref = sdk.firestoreSdk.doc(db, "players", player.playerId);
      await sdk.firestoreSdk.setDoc(ref, { ...player, updatedAt: sdk.firestoreSdk.serverTimestamp() }, { merge: true });
      return (await sdk.firestoreSdk.getDoc(ref)).data();
    },
    async updateIdentity(currentPlayerId, nextPlayerId, nextDisplayName, costume) {
      await ensureSdk();
      const oldPlayerRef = sdk.firestoreSdk.doc(db, "players", currentPlayerId);
      const oldPlayerSnap = await sdk.firestoreSdk.getDoc(oldPlayerRef);
      if (!oldPlayerSnap.exists()) throw new Error("Current player was not found.");

      if (nextPlayerId !== currentPlayerId) {
        const newPlayerSnap = await sdk.firestoreSdk.getDoc(sdk.firestoreSdk.doc(db, "players", nextPlayerId));
        if (newPlayerSnap.exists()) throw new Error("That player ID is already taken.");
      }

      const current = oldPlayerSnap.data();
      const updatedPlayer = {
        ...current,
        playerId: nextPlayerId,
        displayName: nextDisplayName,
        costume: costume || current.costume || "classic",
        updatedAt: sdk.firestoreSdk.serverTimestamp(),
      };

      await sdk.firestoreSdk.setDoc(sdk.firestoreSdk.doc(db, "players", nextPlayerId), updatedPlayer, { merge: true });

      const oldScoreRef = sdk.firestoreSdk.doc(db, "scores", currentPlayerId);
      const oldScoreSnap = await sdk.firestoreSdk.getDoc(oldScoreRef);
      if (oldScoreSnap.exists()) {
        await sdk.firestoreSdk.setDoc(
          sdk.firestoreSdk.doc(db, "scores", nextPlayerId),
          {
            ...oldScoreSnap.data(),
            playerId: nextPlayerId,
            displayName: nextDisplayName,
            updatedAt: sdk.firestoreSdk.serverTimestamp(),
          },
          { merge: true }
        );
      }

      const playersSnap = await sdk.firestoreSdk.getDocs(sdk.firestoreSdk.collection(db, "players"));
      for (const playerSnap of playersSnap.docs) {
        const data = playerSnap.data();
        const friendIds = (data.friendIds || []).map((id) => (id === currentPlayerId ? nextPlayerId : id));
        if (JSON.stringify(friendIds) !== JSON.stringify(data.friendIds || [])) {
          await sdk.firestoreSdk.setDoc(
            sdk.firestoreSdk.doc(db, "players", playerSnap.id),
            { friendIds, updatedAt: sdk.firestoreSdk.serverTimestamp() },
            { merge: true }
          );
        }
      }

      if (nextPlayerId !== currentPlayerId) {
        await sdk.firestoreSdk.deleteDoc(oldPlayerRef);
        if (oldScoreSnap.exists()) {
          await sdk.firestoreSdk.deleteDoc(oldScoreRef);
        }
      }

      localStorage.setItem(storageKeys.currentPlayer, nextPlayerId);
      const finalSnap = await sdk.firestoreSdk.getDoc(sdk.firestoreSdk.doc(db, "players", nextPlayerId));
      return finalSnap.data();
    },
    async fetchPlayer(playerId) {
      await ensureSdk();
      const snap = await sdk.firestoreSdk.getDoc(sdk.firestoreSdk.doc(db, "players", playerId));
      return snap.exists() ? snap.data() : null;
    },
    async addFriend(playerId, friendId) {
      await ensureSdk();
      const meRef = sdk.firestoreSdk.doc(db, "players", playerId);
      const friendRef = sdk.firestoreSdk.doc(db, "players", friendId);
      const friendSnap = await sdk.firestoreSdk.getDoc(friendRef);
      if (!friendSnap.exists()) throw new Error("Friend ID not found. Your friend needs to log in first.");
      const me = (await sdk.firestoreSdk.getDoc(meRef)).data();
      const friendIds = Array.from(new Set([...(me.friendIds || []), friendId]));
      await sdk.firestoreSdk.setDoc(meRef, { friendIds }, { merge: true });
      return (await sdk.firestoreSdk.getDoc(meRef)).data();
    },
    async removeFriend(playerId, friendId) {
      await ensureSdk();
      const meRef = sdk.firestoreSdk.doc(db, "players", playerId);
      const me = (await sdk.firestoreSdk.getDoc(meRef)).data();
      const friendIds = (me.friendIds || []).filter((id) => id !== friendId);
      await sdk.firestoreSdk.setDoc(meRef, { friendIds }, { merge: true });
      return (await sdk.firestoreSdk.getDoc(meRef)).data();
    },
    async saveScore(player, score, level) {
      await ensureSdk();
      const ref = sdk.firestoreSdk.doc(db, "scores", player.playerId);
      const snap = await sdk.firestoreSdk.getDoc(ref);
      const best = snap.exists() ? snap.data() : null;
      if (!best || score > (best.score || 0)) {
        await sdk.firestoreSdk.setDoc(ref, { playerId: player.playerId, displayName: player.displayName, score, level, updatedAt: sdk.firestoreSdk.serverTimestamp() }, { merge: true });
      }
    },
    async fetchScoreboard(playerId) {
      await ensureSdk();
      const playersSnap = await sdk.firestoreSdk.getDocs(sdk.firestoreSdk.collection(db, "players"));
      const scoresSnap = await sdk.firestoreSdk.getDocs(sdk.firestoreSdk.collection(db, "scores"));
      const players = new Map();
      const scores = new Map();
      playersSnap.forEach((snap) => players.set(snap.id, snap.data()));
      scoresSnap.forEach((snap) => scores.set(snap.id, snap.data()));
      const player = players.get(playerId) || null;
      if (!player) return { player: null, friends: [], friendsBoard: [], worldBoard: [] };
      const allowed = Array.from(new Set([playerId, ...(player.friendIds || [])]));
      const friendsBoard = allowed.map((id) => {
        const profile = players.get(id);
        if (!profile) return null;
        const best = scores.get(id) || { playerId: id, displayName: profile.displayName, score: 0, level: 0 };
        return { playerId: id, displayName: best.displayName || profile.displayName, score: best.score || 0, level: best.level || 0 };
      }).filter(Boolean).sort((a, b) => b.score - a.score);
      const worldBoard = Array.from(players.values()).map((profile) => {
        const best = scores.get(profile.playerId) || { playerId: profile.playerId, displayName: profile.displayName, score: 0, level: 0 };
        return {
          playerId: profile.playerId,
          displayName: best.displayName || profile.displayName,
          score: best.score || 0,
          level: best.level || 0,
        };
      }).sort((a, b) => b.score - a.score);
      const friends = (player.friendIds || []).map((id) => players.get(id)).filter(Boolean);
      return { player, friends, friendsBoard, worldBoard };
    },
  };
}

function getBackend() { return window.SKYLINE_FIREBASE_CONFIG ? createFirebaseBackend(window.SKYLINE_FIREBASE_CONFIG) : createLocalBackend(); }
function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => element.classList.toggle("screen--active", key === name));
  state.activeScreen = name;
}
function getKillsNeeded(level) { return 7 + Math.floor(level * 1.5); }
function getBossHealth(level) { return level + 5; }
function buildLevelGuide() {
  levelGuide.innerHTML = Array.from({ length: 20 }, (_, index) => {
    const level = index + 1;
    const label = level % 5 === 0 ? `Boss health: ${getBossHealth(level)}` : `Clear ${getKillsNeeded(level)} targets`;
    return `<article class="level-card"><span class="eyebrow">${level % 5 === 0 ? "Boss" : "Wave"}</span><strong>Level ${level}</strong><span>${label}</span></article>`;
  }).join("");
}
function resizeCanvas() {
  if (mobileQuery.matches) { canvas.width = 960; canvas.height = 540; } else { canvas.width = 720; canvas.height = 960; }
  buildScene();
  if (!state.running) render();
}
function buildScene() {
  state.stars = Array.from({ length: mobileQuery.matches ? 54 : 88 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2 + 1, speed: Math.random() * 30 + 20 }));
  const count = mobileQuery.matches ? 16 : 12;
  const gap = canvas.width / count;
  state.skyline = Array.from({ length: count }, (_, index) => {
    const width = gap * 0.82;
    const height = canvas.height * (0.12 + ((index * 17) % 25) / 100);
    const x = index * gap;
    const windows = [];
    for (let wy = canvas.height - height + 18; wy < canvas.height - 30; wy += 18) {
      for (let wx = x + 10; wx < x + width - 8; wx += 14) if (Math.random() > 0.35) windows.push({ x: wx, y: wy });
    }
    return { x, width, height, windows };
  });
}
function createShip() {
  return { width: mobileQuery.matches ? 58 : 62, height: mobileQuery.matches ? 26 : 28, x: canvas.width / 2 - 30, y: canvas.height - (mobileQuery.matches ? 88 : 110), speed: mobileQuery.matches ? 520 : 440, cooldown: 0 };
}
function ensureAudio() {
  if (!sound.ctx) sound.ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (!sound.unlocked && sound.ctx.state === "suspended") sound.ctx.resume();
  sound.unlocked = true;
}
function playSound(kind) {
  if (!sound.ctx || !sound.unlocked) return;
  const now = sound.ctx.currentTime;
  const oscillator = sound.ctx.createOscillator();
  const gain = sound.ctx.createGain();
  const map = {
    shoot: { type: "square", start: 520, end: 220, gain: 0.035, time: 0.06 },
    hit: { type: "triangle", start: 260, end: 160, gain: 0.05, time: 0.08 },
    destroy: { type: "sawtooth", start: 180, end: 70, gain: 0.08, time: 0.18 },
    bossHit: { type: "square", start: 120, end: 80, gain: 0.07, time: 0.12 },
    hurt: { type: "triangle", start: 140, end: 70, gain: 0.08, time: 0.2 },
    level: { type: "sine", start: 420, end: 620, gain: 0.07, time: 0.2 },
    boss: { type: "sawtooth", start: 90, end: 140, gain: 0.09, time: 0.28 },
  }[kind];
  if (!map) return;
  oscillator.connect(gain); gain.connect(sound.ctx.destination); oscillator.type = map.type;
  oscillator.frequency.setValueAtTime(map.start, now);
  oscillator.frequency.exponentialRampToValueAtTime(map.end, now + map.time);
  gain.gain.setValueAtTime(map.gain, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + map.time);
  oscillator.start(now); oscillator.stop(now + map.time);
}
function vibrate(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }
function addScreenShake(power) { state.screenShake = Math.min(0.36, state.screenShake + 0.12); state.shakePower = Math.min(20, state.shakePower + power); }
function spawnBurst(x, y, color, count, force = 140) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * force + force * 0.3;
    state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: Math.random() * 0.45 + 0.2, color, size: Math.random() * 3 + 1.5 });
  }
}
function createEnemy() {
  const roll = Math.random();
  const size = roll > 0.72 ? 28 : roll > 0.28 ? 40 : 56;
  const palette = enemyPalette[Math.floor(Math.random() * enemyPalette.length)];
  return { x: 28 + Math.random() * (canvas.width - size - 56), y: -size - 12, size, speed: (Math.random() * 50 + 110) * palette.speed * (1 + state.level * 0.05), drift: (Math.random() - 0.5) * 70, color: palette.color, score: palette.score + Math.round((62 - size) * 0.4), hp: palette.hp + (size > 45 ? 1 : 0) };
}
function spawnBoss() {
  state.boss = { x: canvas.width / 2 - 90, y: 76, width: mobileQuery.matches ? 180 : 220, height: mobileQuery.matches ? 76 : 96, hp: getBossHealth(state.level), maxHp: getBossHealth(state.level), speed: 160 + state.level * 3, direction: 1, score: 120 + state.level * 18 };
  state.bossFight = true; playSound("boss"); vibrate([60, 30, 60]);
}
function syncHud() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent = String(state.lives);
  levelEl.textContent = String(state.level);
  bossHealthEl.textContent = state.boss ? `${state.boss.hp}/${state.boss.maxHp}` : "-";
  modeTextEl.textContent = state.bossFight ? `Boss fight level ${state.level}` : `Wave ${state.level} - ${state.killsThisLevel}/${state.killsNeeded}`;
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
}
function showOverlay(mode, title, text, buttonLabel) {
  state.overlayMode = mode;
  overlayEyebrow.textContent = mode === "pause" ? "Wait" : "Run Over";
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonLabel;
  overlay.hidden = false;
}
function hideOverlay() { overlay.hidden = true; }
function resetGameState() {
  touchInput.left = false; touchInput.right = false; touchInput.fire = false; touchInput.pointerId = null;
  Object.values(controlMap).forEach((button) => button.classList.remove("is-active"));
  state.running = false; state.paused = false; state.awaitingStart = true; state.score = 0; state.lives = 3; state.level = 1;
  state.enemyTimer = 0; state.enemyInterval = 850; state.killsThisLevel = 0; state.killsNeeded = getKillsNeeded(1); state.boss = null;
  state.bossFight = false; state.bossIntroTimer = 0; state.lastTime = 0; state.screenShake = 0; state.shakePower = 0;
  state.bullets = []; state.enemies = []; state.particles = []; state.flashTimer = 0; state.ship = createShip();
  buildScene(); syncHud();
}
function startGame() { resetGameState(); hideOverlay(); state.awaitingStart = false; state.running = true; showScreen("game"); window.requestAnimationFrame(loop); }
function leaveGame() { state.running = false; state.paused = false; hideOverlay(); showScreen("home"); }
function togglePause(force) {
  if (state.awaitingStart || !state.running) return;
  state.paused = typeof force === "boolean" ? force : !state.paused;
  syncHud();
  if (state.paused) showOverlay("pause", "Game paused", "Press P or tap resume when you want to continue.", "Resume");
  else hideOverlay();
}
function fireBullet() {
  if (!state.ship || state.ship.cooldown > 0 || state.paused) return;
  state.bullets.push({ x: state.ship.x + state.ship.width / 2 - 3, y: state.ship.y - 10, width: 6, height: 18, speed: mobileQuery.matches ? 760 : 700 });
  state.ship.cooldown = 0.14; playSound("shoot");
}
function maybeAdvanceLevel() {
  if (state.bossFight) return;
  if (state.killsThisLevel >= state.killsNeeded && state.enemies.length === 0) {
    state.level += 1; state.killsThisLevel = 0; state.killsNeeded = getKillsNeeded(state.level); state.enemyInterval = Math.max(280, 860 - state.level * 22);
    state.bossIntroTimer = state.level % 5 === 0 ? 0.8 : 0; playSound("level"); vibrate(40);
  }
}
async function saveRunScore() {
  if (!state.player || !state.backend) return;
  await state.backend.saveScore(state.player, state.score, state.level);
  await refreshLeaderboard();
}
function update(delta) {
  if (!state.running || state.paused || !state.ship) return;
  const ship = state.ship;
  const left = touchInput.left || keys.has("ArrowLeft") || keys.has("a") || keys.has("A");
  const right = touchInput.right || keys.has("ArrowRight") || keys.has("d") || keys.has("D");
  const fire = touchInput.fire || keys.has(" ") || keys.has("Space") || keys.has("Spacebar");
  if (left) ship.x -= ship.speed * delta;
  if (right) ship.x += ship.speed * delta;
  ship.x = Math.max(16, Math.min(canvas.width - ship.width - 16, ship.x));
  ship.cooldown = Math.max(0, ship.cooldown - delta);
  if (fire) fireBullet();
  for (const star of state.stars) {
    star.y += star.speed * delta;
    if (star.y > canvas.height) { star.y = -star.size; star.x = Math.random() * canvas.width; }
  }
  if (state.level % 5 === 0 && !state.bossFight && !state.boss && state.bossIntroTimer > 0) {
    state.bossIntroTimer -= delta;
    if (state.bossIntroTimer <= 0) spawnBoss();
  }
  if (!state.bossFight && state.level % 5 !== 0) {
    state.enemyTimer += delta * 1000;
    if (state.enemyTimer >= state.enemyInterval && state.killsThisLevel < state.killsNeeded) { state.enemyTimer = 0; state.enemies.push(createEnemy()); }
  }
  state.bullets.forEach((bullet) => { bullet.y -= bullet.speed * delta; });
  state.bullets = state.bullets.filter((bullet) => bullet.y + bullet.height > 0);
  state.enemies.forEach((enemy) => {
    enemy.y += enemy.speed * delta; enemy.x += enemy.drift * delta;
    if (enemy.x < 10 || enemy.x + enemy.size > canvas.width - 10) enemy.drift *= -1;
  });
  if (state.boss) {
    state.boss.x += state.boss.speed * delta * state.boss.direction;
    if (state.boss.x <= 24 || state.boss.x + state.boss.width >= canvas.width - 24) state.boss.direction *= -1;
  }
  state.particles.forEach((particle) => {
    particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 100 * delta; particle.life -= delta;
  });
  state.particles = state.particles.filter((particle) => particle.life > 0);
  const nextEnemies = [];
  for (const enemy of state.enemies) {
    let destroyed = false;
    for (const bullet of state.bullets) {
      const hit = bullet.x < enemy.x + enemy.size && bullet.x + bullet.width > enemy.x && bullet.y < enemy.y + enemy.size && bullet.y + bullet.height > enemy.y;
      if (hit) {
        bullet.y = -999; enemy.hp -= 1; addScreenShake(2 + enemy.score * 0.08); spawnBurst(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.color, 4, 70);
        playSound(enemy.hp <= 0 ? "destroy" : "hit"); vibrate(enemy.hp <= 0 ? 30 : 14);
        if (enemy.hp <= 0) { destroyed = true; state.score += enemy.score; state.killsThisLevel += 1; spawnBurst(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.color, 12, 140); }
        break;
      }
    }
    const shipHit = ship.x < enemy.x + enemy.size && ship.x + ship.width > enemy.x && ship.y < enemy.y + enemy.size && ship.y + ship.height > enemy.y;
    if (shipHit && !destroyed) {
      destroyed = true; state.lives -= 1; state.flashTimer = 0.18; addScreenShake(10); spawnBurst(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, "#fb7185", 18, 160); playSound("hurt"); vibrate([60, 30, 40]);
    }
    if (!destroyed && enemy.y < canvas.height + enemy.size) nextEnemies.push(enemy);
    else if (!destroyed && enemy.y >= canvas.height + enemy.size) {
      state.lives -= 1; state.flashTimer = 0.18; addScreenShake(8); playSound("hurt"); vibrate([50, 25, 40]);
    }
  }
  state.enemies = nextEnemies;
  if (state.boss) {
    for (const bullet of state.bullets) {
      const hit = bullet.x < state.boss.x + state.boss.width && bullet.x + bullet.width > state.boss.x && bullet.y < state.boss.y + state.boss.height && bullet.y + bullet.height > state.boss.y;
      if (hit) {
        bullet.y = -999; state.boss.hp -= 1; addScreenShake(4); spawnBurst(state.boss.x + state.boss.width / 2, state.boss.y + state.boss.height / 2, "#fbbf24", 5, 90); playSound(state.boss.hp <= 0 ? "destroy" : "bossHit"); vibrate(state.boss.hp <= 0 ? [80, 40, 80] : 22);
      }
    }
    const bossHit = ship.x < state.boss.x + state.boss.width && ship.x + ship.width > state.boss.x && ship.y < state.boss.y + state.boss.height && ship.y + ship.height > state.boss.y;
    if (bossHit) state.lives = 0;
    if (state.boss.hp <= 0) {
      state.score += state.boss.score;
      spawnBurst(state.boss.x + state.boss.width / 2, state.boss.y + state.boss.height / 2, "#fbbf24", 26, 210);
      state.boss = null; state.bossFight = false; state.level += 1; state.killsThisLevel = 0; state.killsNeeded = getKillsNeeded(state.level); state.enemyInterval = Math.max(280, 860 - state.level * 22); playSound("level"); vibrate([70, 35, 70]);
    }
  }
  state.bullets = state.bullets.filter((bullet) => bullet.y > -100);
  state.flashTimer = Math.max(0, state.flashTimer - delta);
  state.screenShake = Math.max(0, state.screenShake - delta);
  state.shakePower = Math.max(0, state.shakePower - delta * 22);
  maybeAdvanceLevel();
  syncHud();
  if (state.lives <= 0) {
    state.running = false;
    saveRunScore();
    showOverlay("gameover", "Game over", `Pilot ${state.player.displayName} scored ${state.score} and reached level ${state.level}.`, "Play Again");
  }
}
function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#0d1b38");
  gradient.addColorStop(0.55, "#081120");
  gradient.addColorStop(1, "#02050b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(103, 232, 249, 0.8)";
  for (const star of state.stars) { ctx.globalAlpha = 0.35 + star.size / 4; ctx.fillRect(star.x, star.y, star.size, star.size * 2); }
  ctx.globalAlpha = 1;
}
function drawCity() {
  const baseY = canvas.height - 12;
  ctx.fillStyle = "#03111d";
  for (const building of state.skyline) {
    ctx.fillRect(building.x, baseY - building.height, building.width, building.height);
    ctx.fillStyle = "rgba(251, 191, 36, 0.2)";
    building.windows.forEach((light) => ctx.fillRect(light.x, light.y, 5, 8));
    ctx.fillStyle = "#03111d";
  }
}
function drawShip() {
  if (!state.ship) return;
  const ship = state.ship;
  const theme = costumeThemes[state.selectedCostume];
  ctx.save(); ctx.translate(ship.x, ship.y); ctx.shadowColor = theme.glow; ctx.shadowBlur = 18; ctx.fillStyle = theme.body;
  ctx.beginPath(); ctx.moveTo(ship.width / 2, 0); ctx.lineTo(ship.width, ship.height); ctx.lineTo(ship.width * 0.72, ship.height * 0.82); ctx.lineTo(ship.width * 0.58, ship.height); ctx.lineTo(ship.width / 2, ship.height * 0.72); ctx.lineTo(ship.width * 0.42, ship.height); ctx.lineTo(ship.width * 0.28, ship.height * 0.82); ctx.lineTo(0, ship.height); ctx.closePath(); ctx.fill();
  ctx.fillStyle = theme.wing; ctx.fillRect(ship.width * 0.18, ship.height * 0.42, ship.width * 0.18, ship.height * 0.18); ctx.fillRect(ship.width * 0.64, ship.height * 0.42, ship.width * 0.18, ship.height * 0.18);
  ctx.fillStyle = theme.glow; ctx.beginPath(); ctx.moveTo(ship.width / 2 - 8, ship.height - 6); ctx.lineTo(ship.width / 2, ship.height + 14 + Math.random() * 6); ctx.lineTo(ship.width / 2 + 8, ship.height - 6); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.shadowBlur = 0;
}
function drawBullets() { ctx.fillStyle = "#67e8f9"; ctx.shadowColor = "#67e8f9"; ctx.shadowBlur = 12; state.bullets.forEach((bullet) => ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height)); ctx.shadowBlur = 0; }
function drawEnemies() {
  for (const enemy of state.enemies) {
    ctx.save(); ctx.translate(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2); ctx.rotate(enemy.y * 0.02); ctx.fillStyle = enemy.color;
    ctx.beginPath(); ctx.moveTo(0, -enemy.size / 2); ctx.lineTo(enemy.size / 2, 0); ctx.lineTo(0, enemy.size / 2); ctx.lineTo(-enemy.size / 2, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(-5, -5, 10, 10); ctx.restore();
  }
}
function drawBoss() {
  if (!state.boss) return;
  const boss = state.boss;
  ctx.save(); ctx.translate(boss.x, boss.y); ctx.fillStyle = "#f59e0b";
  ctx.beginPath(); ctx.moveTo(boss.width * 0.5, 0); ctx.lineTo(boss.width, boss.height * 0.38); ctx.lineTo(boss.width * 0.85, boss.height); ctx.lineTo(boss.width * 0.15, boss.height); ctx.lineTo(0, boss.height * 0.38); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff7ed"; ctx.fillRect(boss.width * 0.2, boss.height * 0.4, boss.width * 0.16, boss.height * 0.14); ctx.fillRect(boss.width * 0.64, boss.height * 0.4, boss.width * 0.16, boss.height * 0.14);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(0, -20, boss.width, 10); ctx.fillStyle = "#ef4444"; ctx.fillRect(0, -20, boss.width * (boss.hp / boss.maxHp), 10); ctx.restore();
}
function drawParticles() {
  for (const particle of state.particles) { ctx.globalAlpha = Math.max(0, particle.life * 2); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function drawFlash() { if (state.flashTimer > 0) { ctx.fillStyle = `rgba(251, 113, 133, ${state.flashTimer * 0.8})`; ctx.fillRect(0, 0, canvas.width, canvas.height); } }
function render() {
  ctx.save();
  if (state.screenShake > 0) ctx.translate((Math.random() - 0.5) * state.shakePower, (Math.random() - 0.5) * state.shakePower);
  drawBackground(); drawCity(); drawShip(); drawBullets(); drawEnemies(); drawBoss(); drawParticles(); drawFlash();
  ctx.restore();
}
function loop(timestamp) {
  if (!state.running) return;
  if (!state.lastTime) state.lastTime = timestamp;
  const delta = Math.min((timestamp - state.lastTime) / 1000, 0.032);
  state.lastTime = timestamp;
  update(delta); render();
  if (state.running) window.requestAnimationFrame(loop);
}
function setControlState(control, pressed) {
  if (!(control in touchInput)) return;
  touchInput[control] = pressed;
  const button = controlMap[control];
  if (button) button.classList.toggle("is-active", pressed);
}
function releaseTouchMovement(pointerId = null) {
  if (pointerId === null || touchInput.pointerId === pointerId) { touchInput.pointerId = null; touchInput.left = false; touchInput.right = false; }
}
function moveShipToClientX(clientX) {
  if (!state.ship) return;
  const rect = canvas.getBoundingClientRect();
  const relativeX = (clientX - rect.left) / rect.width;
  const targetX = relativeX * canvas.width - state.ship.width / 2;
  state.ship.x = Math.max(16, Math.min(canvas.width - state.ship.width - 16, targetX));
}
function handleCanvasPointerDown(event) {
  if (!overlay.hidden) return;
  ensureAudio(); touchInput.pointerId = event.pointerId; moveShipToClientX(event.clientX); touchInput.fire = true; canvas.setPointerCapture?.(event.pointerId); event.preventDefault();
}
function handleCanvasPointerMove(event) { if (touchInput.pointerId === event.pointerId) { moveShipToClientX(event.clientX); event.preventDefault(); } }
function handleCanvasPointerUp(event) { if (touchInput.pointerId === event.pointerId) { releaseTouchMovement(event.pointerId); touchInput.fire = false; } }
function setSelectedCostume(costume) {
  state.selectedCostume = costume;
  costumeButtons.forEach((button) => button.classList.toggle("is-selected", button.dataset.costume === costume));
}
async function persistPlayerProfile() {
  if (!state.player || !state.backend) return;
  state.player.costume = state.selectedCostume;
  state.player = await state.backend.saveProfile(state.player);
}
function renderProfile() {
  if (!state.player) return;
  profileName.textContent = state.player.displayName;
  profileId.textContent = state.player.playerId;
  editPlayerId.value = state.player.playerId;
  editDisplayName.value = state.player.displayName;
}
function dedupeBoardEntries(entries) {
  const byId = new Map();
  for (const entry of entries) {
    const existing = byId.get(entry.playerId);
    if (!existing || entry.score > existing.score) {
      byId.set(entry.playerId, entry);
    }
  }

  const byName = new Map();
  for (const entry of byId.values()) {
    const key = entry.displayName.trim().toLowerCase();
    const existing = byName.get(key);
    const shouldReplace =
      !existing ||
      entry.playerId === state.player?.playerId ||
      entry.score > existing.score;

    if (shouldReplace) {
      byName.set(key, entry);
    }
  }

  return Array.from(byName.values()).sort((a, b) => b.score - a.score);
}
function renderScoreEntries(target, entries, emptyTitle, emptyText) {
  const uniqueEntries = dedupeBoardEntries(entries);
  target.innerHTML = uniqueEntries.length
    ? uniqueEntries.map((entry, index) => `<li class="score-row"><span class="score-rank">#${index + 1}</span><div class="score-meta"><strong>${escapeHtml(entry.displayName)}</strong><span>${escapeHtml(entry.playerId)} - Level ${entry.level}</span></div><strong class="score-points">${entry.score}</strong></li>`).join("")
    : `<li class="score-row"><span class="score-rank">--</span><div class="score-meta"><strong>${emptyTitle}</strong><span>${emptyText}</span></div><strong class="score-points">0</strong></li>`;
}
function syncBoardView() {
  const showingFriends = state.leaderboardView === "friends";
  friendsScoreList.hidden = !showingFriends;
  worldScoreList.hidden = showingFriends;
  boardViewButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.boardView === state.leaderboardView);
  });
}
async function refreshLeaderboard() {
  if (!state.player || !state.backend) return;
  const data = await state.backend.fetchScoreboard(state.player.playerId);
  if (data.player) { state.player = data.player; setSelectedCostume(data.player.costume || state.selectedCostume); renderProfile(); }
  friendList.innerHTML = data.friends.length ? data.friends.map((friend) => `<li class="friend-row"><div class="friend-meta"><strong>${escapeHtml(friend.displayName)}</strong><span>${escapeHtml(friend.playerId)}</span></div><button class="ghost-button" data-remove-friend="${escapeHtml(friend.playerId)}" type="button">Remove</button></li>`).join("") : `<li class="friend-row"><div class="friend-meta"><strong>No friends yet</strong><span>Add a real player ID to build the board.</span></div></li>`;
  renderScoreEntries(
    friendsScoreList,
    data.friendsBoard || [],
    "No friend scores yet",
    "Add friends and finish runs to populate this board."
  );
  renderScoreEntries(
    worldScoreList,
    data.worldBoard || [],
    "No world scores yet",
    "When players join, this board fills automatically."
  );
  syncBoardView();
  friendList.querySelectorAll("[data-remove-friend]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.player = await state.backend.removeFriend(state.player.playerId, button.dataset.removeFriend);
      friendStatus.textContent = `Removed ${button.dataset.removeFriend} from your friends list.`;
      await refreshLeaderboard();
    });
  });
}
async function handleLogin(event) {
  event.preventDefault();
  const playerId = normalizePlayerId(loginPlayerId.value);
  const displayName = loginDisplayName.value.trim().slice(0, 16);
  if (!playerId || !displayName) { loginStatus.textContent = "Enter both a player ID and a display name."; return; }
  loginStatus.textContent = "Signing in...";
  try {
    state.player = await state.backend.login({ playerId, displayName, costume: state.selectedCostume });
    state.selectedCostume = state.player.costume || state.selectedCostume;
    setSelectedCostume(state.selectedCostume);
    renderProfile();
    loginStatus.textContent = state.backend.mode === "firebase" ? "Hosted sync is active." : "Offline local mode is active on this browser.";
    await refreshLeaderboard();
    showScreen("home");
  } catch (error) {
    loginStatus.textContent = error.message || "Login failed.";
  }
}
async function handleAddFriend(event) {
  event.preventDefault();
  const friendId = normalizePlayerId(friendIdInput.value);
  if (!friendId) { friendStatus.textContent = "Enter a valid player ID first."; return; }
  if (friendId === state.player.playerId) { friendStatus.textContent = "You already appear on your own scoreboard."; return; }
  try {
    state.player = await state.backend.addFriend(state.player.playerId, friendId);
    friendIdInput.value = "";
    friendStatus.textContent = `Added ${friendId}.`;
    await refreshLeaderboard();
  } catch (error) {
    friendStatus.textContent = error.message || "Could not add that friend ID.";
  }
}
async function handleProfileUpdate(event) {
  event.preventDefault();
  if (!state.player || !state.backend) return;

  const nextPlayerId = normalizePlayerId(editPlayerId.value);
  const nextDisplayName = editDisplayName.value.trim().slice(0, 16);

  if (!nextPlayerId || !nextDisplayName) {
    profileStatus.textContent = "Enter both a player ID and a display name.";
    return;
  }

  try {
    state.player = await state.backend.updateIdentity(
      state.player.playerId,
      nextPlayerId,
      nextDisplayName,
      state.selectedCostume
    );
    loginPlayerId.value = state.player.playerId;
    loginDisplayName.value = state.player.displayName;
    profileStatus.textContent = "Profile updated successfully.";
    await refreshLeaderboard();
  } catch (error) {
    profileStatus.textContent = error.message || "Could not update your profile.";
  }
}
function handleNavigation(target) { if (target === "game") { ensureAudio(); startGame(); } else { if (state.running) leaveGame(); showScreen(target); } }
async function init() {
  state.backend = getBackend();
  buildLevelGuide(); resizeCanvas(); resetGameState(); render();
  loginStatus.textContent = state.backend.mode === "firebase" ? "Hosted sync is active." : "Offline mode works now. Hosted sync starts when Firebase config is added.";
  const rememberedId = localStorage.getItem(storageKeys.currentPlayer);
  if (rememberedId) {
    const remembered = await state.backend.fetchPlayer(rememberedId);
    if (remembered) {
      state.player = remembered; state.selectedCostume = remembered.costume || state.selectedCostume; setSelectedCostume(state.selectedCostume); renderProfile();
      loginPlayerId.value = remembered.playerId; loginDisplayName.value = remembered.displayName; await refreshLeaderboard(); showScreen("home"); return;
    }
  }
  showScreen("login");

}
loginForm.addEventListener("submit", handleLogin);
profileForm.addEventListener("submit", handleProfileUpdate);
friendForm.addEventListener("submit", handleAddFriend);
navButtons.forEach((button) => button.addEventListener("click", () => handleNavigation(button.dataset.go)));
boardViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.leaderboardView = button.dataset.boardView;
    syncBoardView();
  });
});
costumeButtons.forEach((button) => button.addEventListener("click", async () => { setSelectedCostume(button.dataset.costume); if (state.player) { await persistPlayerProfile(); await refreshLeaderboard(); } render(); }));
controlButtons.forEach((button) => {
  const control = button.dataset.control;
  button.addEventListener("pointerdown", (event) => { ensureAudio(); setControlState(control, true); event.preventDefault(); });
  button.addEventListener("pointerup", () => setControlState(control, false));
  button.addEventListener("pointercancel", () => setControlState(control, false));
  button.addEventListener("pointerleave", (event) => { if (event.buttons === 0) setControlState(control, false); });
});
pauseButton.addEventListener("click", () => { ensureAudio(); togglePause(); });
leaveGameButton.addEventListener("click", () => leaveGame());
startButton.addEventListener("click", () => { ensureAudio(); if (state.overlayMode === "pause") togglePause(false); else startGame(); });
canvas.addEventListener("pointerdown", handleCanvasPointerDown);
canvas.addEventListener("pointermove", handleCanvasPointerMove);
canvas.addEventListener("pointerup", handleCanvasPointerUp);
canvas.addEventListener("pointercancel", handleCanvasPointerUp);
window.addEventListener("keydown", (event) => {
  keys.add(event.key);
  if (event.key.toLowerCase() === "p") { togglePause(); event.preventDefault(); return; }
  if (["ArrowLeft", "ArrowRight", " ", "Space", "Spacebar"].includes(event.key)) event.preventDefault();
});
window.addEventListener("keyup", (event) => keys.delete(event.key));
window.addEventListener("pointerup", () => { touchInput.fire = false; });
window.addEventListener("pointercancel", () => { touchInput.fire = false; releaseTouchMovement(); });
if (typeof mobileQuery.addEventListener === "function") mobileQuery.addEventListener("change", resizeCanvas);
else if (typeof mobileQuery.addListener === "function") mobileQuery.addListener(resizeCanvas);
init();
