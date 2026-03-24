const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");

const keys = new Set();

const state = {
  running: false,
  score: 0,
  lives: 3,
  level: 1,
  lastTime: 0,
  enemyTimer: 0,
  enemyInterval: 1100,
  stars: [],
  skyline: [],
  bullets: [],
  enemies: [],
  particles: [],
  flashTimer: 0,
  ship: null,
};

function resetGame() {
  state.running = false;
  state.score = 0;
  state.lives = 3;
  state.level = 1;
  state.lastTime = 0;
  state.enemyTimer = 0;
  state.enemyInterval = 1100;
  state.bullets = [];
  state.enemies = [];
  state.particles = [];
  state.flashTimer = 0;
  state.ship = {
    width: 52,
    height: 24,
    x: canvas.width / 2 - 26,
    y: canvas.height - 68,
    speed: 420,
    cooldown: 0,
  };
  state.stars = Array.from({ length: 65 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 1,
    speed: Math.random() * 30 + 20,
  }));
  state.skyline = Array.from({ length: 18 }, (_, i) => {
    const width = 36 + (i % 4) * 8;
    const height = 80 + ((i * 31) % 120);
    const x = i * 56;
    const windows = [];

    for (let wy = canvas.height - 12 - height + 12; wy < canvas.height - 24; wy += 16) {
      for (let wx = x + 8; wx < x + width - 8; wx += 12) {
        if (Math.random() > 0.38) {
          windows.push({ x: wx, y: wy });
        }
      }
    }

    return { x, width, height, windows };
  });
  syncHud();
}

function syncHud() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent = String(state.lives);
  levelEl.textContent = String(state.level);
}

function showOverlay(title, text, buttonLabel) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonLabel;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

function startGame() {
  resetGame();
  hideOverlay();
  state.running = true;
  window.requestAnimationFrame(loop);
}

function fireBullet() {
  if (!state.ship || state.ship.cooldown > 0) {
    return;
  }

  state.bullets.push({
    x: state.ship.x + state.ship.width / 2 - 3,
    y: state.ship.y - 10,
    width: 6,
    height: 16,
    speed: 620,
  });

  state.ship.cooldown = 0.22;
}

function spawnEnemy() {
  const size = Math.random() * 18 + 24;
  const lanePadding = 30;
  const maxX = canvas.width - size - lanePadding;
  const difficultyBoost = Math.min(state.level * 0.12, 1.8);
  state.enemies.push({
    x: lanePadding + Math.random() * (maxX - lanePadding),
    y: -size - 10,
    size,
    speed: (Math.random() * 40 + 90) * (1 + difficultyBoost * 0.35),
    drift: (Math.random() - 0.5) * 55,
    hue: 10 + Math.random() * 25,
  });
}

function spawnBurst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 140 + 40;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: Math.random() * 0.4 + 0.25,
      color,
      size: Math.random() * 3 + 1.5,
    });
  }
}

function update(delta) {
  if (!state.running) {
    return;
  }

  const ship = state.ship;
  if (!ship) {
    return;
  }

  const left = keys.has("ArrowLeft") || keys.has("a") || keys.has("A");
  const right = keys.has("ArrowRight") || keys.has("d") || keys.has("D");
  const fire = keys.has(" ") || keys.has("Space") || keys.has("Spacebar");

  if (left) {
    ship.x -= ship.speed * delta;
  }
  if (right) {
    ship.x += ship.speed * delta;
  }
  ship.x = Math.max(20, Math.min(canvas.width - ship.width - 20, ship.x));

  ship.cooldown = Math.max(0, ship.cooldown - delta);
  if (fire) {
    fireBullet();
  }

  for (const star of state.stars) {
    star.y += star.speed * delta;
    if (star.y > canvas.height) {
      star.y = -star.size;
      star.x = Math.random() * canvas.width;
    }
  }

  state.enemyTimer += delta * 1000;
  if (state.enemyTimer >= state.enemyInterval) {
    state.enemyTimer = 0;
    spawnEnemy();
  }

  for (const bullet of state.bullets) {
    bullet.y -= bullet.speed * delta;
  }
  state.bullets = state.bullets.filter((bullet) => bullet.y + bullet.height > 0);

  for (const enemy of state.enemies) {
    enemy.y += enemy.speed * delta;
    enemy.x += enemy.drift * delta;

    if (enemy.x < 14 || enemy.x + enemy.size > canvas.width - 14) {
      enemy.drift *= -1;
    }
  }

  for (const particle of state.particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 100 * delta;
    particle.life -= delta;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);

  const nextEnemies = [];
  for (const enemy of state.enemies) {
    let destroyed = false;

    for (const bullet of state.bullets) {
      const hit =
        bullet.x < enemy.x + enemy.size &&
        bullet.x + bullet.width > enemy.x &&
        bullet.y < enemy.y + enemy.size &&
        bullet.y + bullet.height > enemy.y;

      if (hit) {
        bullet.y = -999;
        destroyed = true;
        state.score += 10;
        spawnBurst(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, "#fb923c", 10);

        const targetLevel = Math.floor(state.score / 120) + 1;
        if (targetLevel > state.level) {
          state.level = targetLevel;
          state.enemyInterval = Math.max(340, 1100 - (state.level - 1) * 95);
        }
        break;
      }
    }

    const collidesWithShip =
      ship.x < enemy.x + enemy.size &&
      ship.x + ship.width > enemy.x &&
      ship.y < enemy.y + enemy.size &&
      ship.y + ship.height > enemy.y;

    if (collidesWithShip && !destroyed) {
      destroyed = true;
      state.lives -= 1;
      state.flashTimer = 0.18;
      spawnBurst(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, "#fb7185", 18);
    }

    if (!destroyed && enemy.y < canvas.height + enemy.size) {
      nextEnemies.push(enemy);
    } else if (!destroyed && enemy.y >= canvas.height + enemy.size) {
      state.lives -= 1;
      state.flashTimer = 0.18;
    }
  }

  state.enemies = nextEnemies;
  state.bullets = state.bullets.filter((bullet) => bullet.y > -100);
  state.flashTimer = Math.max(0, state.flashTimer - delta);
  syncHud();

  if (state.lives <= 0) {
    state.running = false;
    showOverlay(
      "Game over",
      `You scored ${state.score} points and reached level ${state.level}. Press start to jump back in.`,
      "Play Again"
    );
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
  for (const star of state.stars) {
    ctx.globalAlpha = 0.35 + star.size / 4;
    ctx.fillRect(star.x, star.y, star.size, star.size * 2);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(34, 211, 238, 0.08)";
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.arc(150 + i * 180, 100 + i * 14, 110 - i * 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCity() {
  const baseY = canvas.height - 12;
  ctx.fillStyle = "#03111d";
  for (const building of state.skyline) {
    ctx.fillRect(building.x, baseY - building.height, building.width, building.height);

    ctx.fillStyle = "rgba(251, 191, 36, 0.22)";
    for (const windowLight of building.windows) {
      ctx.fillRect(windowLight.x, windowLight.y, 5, 8);
    }
    ctx.fillStyle = "#03111d";
  }
}

function drawShip() {
  const ship = state.ship;
  if (!ship) {
    return;
  }

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.fillStyle = "#d9faff";
  ctx.beginPath();
  ctx.moveTo(0, ship.height);
  ctx.lineTo(ship.width / 2, 0);
  ctx.lineTo(ship.width, ship.height);
  ctx.lineTo(ship.width / 2, ship.height - 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#22d3ee";
  ctx.beginPath();
  ctx.moveTo(ship.width / 2 - 7, ship.height - 6);
  ctx.lineTo(ship.width / 2, ship.height + 12 + Math.random() * 8);
  ctx.lineTo(ship.width / 2 + 7, ship.height - 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBullets() {
  ctx.fillStyle = "#67e8f9";
  for (const bullet of state.bullets) {
    ctx.shadowColor = "#67e8f9";
    ctx.shadowBlur = 12;
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }
  ctx.shadowBlur = 0;
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    ctx.save();
    ctx.translate(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2);
    ctx.rotate(enemy.y * 0.02);

    ctx.fillStyle = `hsl(${enemy.hue} 90% 60%)`;
    ctx.beginPath();
    ctx.moveTo(0, -enemy.size / 2);
    ctx.lineTo(enemy.size / 2, 0);
    ctx.lineTo(0, enemy.size / 2);
    ctx.lineTo(-enemy.size / 2, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life * 2);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFlash() {
  if (state.flashTimer <= 0) {
    return;
  }
  ctx.fillStyle = `rgba(251, 113, 133, ${state.flashTimer * 0.8})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function render() {
  drawBackground();
  drawCity();
  drawShip();
  drawBullets();
  drawEnemies();
  drawParticles();
  drawFlash();
}

function loop(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }
  const delta = Math.min((timestamp - state.lastTime) / 1000, 0.032);
  state.lastTime = timestamp;

  update(delta);
  render();

  if (state.running) {
    window.requestAnimationFrame(loop);
  }
}

window.addEventListener("keydown", (event) => {
  keys.add(event.key);
  if (["ArrowLeft", "ArrowRight", " ", "Spacebar"].includes(event.key)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

startButton.addEventListener("click", startGame);

resetGame();
render();
