const GRID_SIZE = 20;
const TICK_MS = 120;
const INITIAL_LENGTH = 3;
const SCORE_PER_FOOD = 1;
const SWIPE_THRESHOLD_PX = 30;

const STORAGE_KEYS = {
  HIGH_SCORE: 'snakeHighScore',
  WRAP_PREF: 'snakeWrapPreference',
};

const STATE = {
  LOADING: 'loading',
  INTRO: 'intro',
  RUNNING: 'running',
  PAUSED: 'paused',
  GAMEOVER: 'gameover',
};

const DIRECTION_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTION = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const dom = {
  loading: document.getElementById('loading-screen'),
  intro: document.getElementById('intro-screen'),
  wrapToggle: document.getElementById('wrap-toggle'),
  startBtn: document.getElementById('start-btn'),
  canvas: document.getElementById('game-canvas'),
  score: document.getElementById('score'),
  highScore: document.getElementById('high-score'),
  pauseBtn: document.getElementById('pause-btn'),
  restartBtn: document.getElementById('restart-btn'),
  pausedOverlay: document.getElementById('paused-overlay'),
  gameoverOverlay: document.getElementById('gameover-overlay'),
  gameoverScore: document.getElementById('gameover-score'),
  gameoverHighScore: document.getElementById('gameover-high-score'),
  restartOverlayBtn: document.getElementById('restart-overlay-btn'),
};

const ctx = dom.canvas.getContext('2d');

const game = {
  state: STATE.LOADING,
  snake: [],
  food: null,
  score: 0,
  highScore: Number(localStorage.getItem(STORAGE_KEYS.HIGH_SCORE)) || 0,
  wrapEnabled: localStorage.getItem(STORAGE_KEYS.WRAP_PREF) === 'true',
  direction: 'right',
  pendingDirection: 'right',
  tickTimer: null,
  touchStart: null,
};

function init() {
  dom.wrapToggle.checked = game.wrapEnabled;
  updateScoreLabels();
  bindEvents();
  setState(STATE.LOADING);

  setTimeout(() => {
    setState(STATE.INTRO);
    render();
  }, 650);
}

function bindEvents() {
  dom.startBtn.addEventListener('click', startGame);
  dom.pauseBtn.addEventListener('click', togglePause);
  dom.restartBtn.addEventListener('click', restartGame);
  dom.restartOverlayBtn.addEventListener('click', restartGame);

  dom.wrapToggle.addEventListener('change', () => {
    game.wrapEnabled = dom.wrapToggle.checked;
    localStorage.setItem(STORAGE_KEYS.WRAP_PREF, String(game.wrapEnabled));
  });

  window.addEventListener('keydown', handleKeyDown);

  dom.canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
  dom.canvas.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();

  if (key === ' ') {
    event.preventDefault();
    togglePause();
    return;
  }

  if (key === 'r') {
    event.preventDefault();
    restartGame();
    return;
  }

  const map = {
    arrowup: 'up',
    w: 'up',
    arrowdown: 'down',
    s: 'down',
    arrowleft: 'left',
    a: 'left',
    arrowright: 'right',
    d: 'right',
  };

  const next = map[key];
  if (!next) {
    return;
  }

  queueDirection(next);
}

function handleTouchStart(event) {
  if (!event.changedTouches || event.changedTouches.length === 0) {
    return;
  }
  const t = event.changedTouches[0];
  game.touchStart = { x: t.clientX, y: t.clientY };
}

function handleTouchEnd(event) {
  if (!game.touchStart || !event.changedTouches || event.changedTouches.length === 0) {
    return;
  }

  const t = event.changedTouches[0];
  const dx = t.clientX - game.touchStart.x;
  const dy = t.clientY - game.touchStart.y;

  if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) {
    game.touchStart = null;
    return;
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    queueDirection(dx > 0 ? 'right' : 'left');
  } else {
    queueDirection(dy > 0 ? 'down' : 'up');
  }

  game.touchStart = null;
}

function queueDirection(nextDirection) {
  if (game.state !== STATE.RUNNING) {
    return;
  }
  if (OPPOSITE_DIRECTION[game.direction] === nextDirection) {
    return;
  }
  game.pendingDirection = nextDirection;
}

function setState(next) {
  game.state = next;
  dom.loading.classList.toggle('active', next === STATE.LOADING);
  dom.intro.classList.toggle('active', next === STATE.INTRO);
  dom.pausedOverlay.classList.toggle('active', next === STATE.PAUSED);
  dom.pausedOverlay.setAttribute('aria-hidden', String(next !== STATE.PAUSED));
  dom.gameoverOverlay.classList.toggle('active', next === STATE.GAMEOVER);
  dom.gameoverOverlay.setAttribute('aria-hidden', String(next !== STATE.GAMEOVER));

  const pauseLabel = next === STATE.PAUSED ? 'Resume' : 'Pause';
  dom.pauseBtn.textContent = pauseLabel;
}

function startGame() {
  game.wrapEnabled = dom.wrapToggle.checked;
  localStorage.setItem(STORAGE_KEYS.WRAP_PREF, String(game.wrapEnabled));
  resetRound();
  setState(STATE.RUNNING);
  startLoop();
  render();
}

function restartGame() {
  if (game.state === STATE.LOADING) {
    return;
  }
  resetRound();
  setState(STATE.RUNNING);
  startLoop();
  render();
}

function togglePause() {
  if (game.state === STATE.RUNNING) {
    setState(STATE.PAUSED);
    stopLoop();
  } else if (game.state === STATE.PAUSED) {
    setState(STATE.RUNNING);
    startLoop();
  }
}

function resetRound() {
  stopLoop();

  const center = Math.floor(GRID_SIZE / 2);
  game.snake = [];
  for (let i = 0; i < INITIAL_LENGTH; i += 1) {
    game.snake.push({ x: center - i, y: center });
  }

  game.direction = 'right';
  game.pendingDirection = 'right';
  game.score = 0;
  spawnFood();
  updateScoreLabels();
}

function startLoop() {
  stopLoop();
  game.tickTimer = window.setInterval(tick, TICK_MS);
}

function stopLoop() {
  if (game.tickTimer) {
    window.clearInterval(game.tickTimer);
    game.tickTimer = null;
  }
}

function tick() {
  game.direction = game.pendingDirection;

  const vector = DIRECTION_VECTORS[game.direction];
  const head = game.snake[0];
  let newHead = {
    x: head.x + vector.x,
    y: head.y + vector.y,
  };

  if (game.wrapEnabled) {
    newHead = wrapPosition(newHead);
  } else {
    const outside =
      newHead.x < 0 ||
      newHead.x >= GRID_SIZE ||
      newHead.y < 0 ||
      newHead.y >= GRID_SIZE;

    if (outside) {
      return gameOver();
    }
  }

  if (hitsSnake(newHead)) {
    return gameOver();
  }

  game.snake.unshift(newHead);

  if (newHead.x === game.food.x && newHead.y === game.food.y) {
    game.score += SCORE_PER_FOOD;
    if (game.score > game.highScore) {
      game.highScore = game.score;
      localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, String(game.highScore));
    }

    if (game.snake.length >= GRID_SIZE * GRID_SIZE) {
      return gameOver();
    }

    spawnFood();
  } else {
    game.snake.pop();
  }

  updateScoreLabels();
  render();
  return null;
}

function gameOver() {
  stopLoop();
  setState(STATE.GAMEOVER);
  dom.gameoverScore.textContent = String(game.score);
  dom.gameoverHighScore.textContent = String(game.highScore);
  updateScoreLabels();
  render();
}

function wrapPosition(pos) {
  let x = pos.x;
  let y = pos.y;

  if (x < 0) x = GRID_SIZE - 1;
  if (x >= GRID_SIZE) x = 0;
  if (y < 0) y = GRID_SIZE - 1;
  if (y >= GRID_SIZE) y = 0;

  return { x, y };
}

function hitsSnake(point) {
  return game.snake.some((segment) => segment.x === point.x && segment.y === point.y);
}

function spawnFood() {
  const occupied = new Set(game.snake.map((segment) => `${segment.x},${segment.y}`));
  const free = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const key = `${x},${y}`;
      if (!occupied.has(key)) {
        free.push({ x, y });
      }
    }
  }

  if (free.length === 0) {
    game.food = { x: -1, y: -1 };
    return;
  }

  game.food = free[Math.floor(Math.random() * free.length)];
}

function updateScoreLabels() {
  dom.score.textContent = String(game.score);
  dom.highScore.textContent = String(game.highScore);
}

function render() {
  const size = dom.canvas.width;
  const tile = size / GRID_SIZE;

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID_SIZE; i += 1) {
    const p = i * tile;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  if (game.food && game.food.x >= 0) {
    ctx.fillStyle = '#ef4444';
    drawRoundedRect(game.food.x * tile + 2, game.food.y * tile + 2, tile - 4, tile - 4, 6);
    ctx.fill();
  }

  game.snake.forEach((segment, index) => {
    ctx.fillStyle = index === 0 ? '#86efac' : '#22c55e';
    drawRoundedRect(segment.x * tile + 1.5, segment.y * tile + 1.5, tile - 3, tile - 3, 5);
    ctx.fill();
  });
}

function drawRoundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

init();
