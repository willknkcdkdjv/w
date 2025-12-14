(() => {
  // =========================
  // Config (對齊你原本 Pygame)
  // =========================
  const LOGIC_W = 1600, LOGIC_H = 1000;      // 遊戲世界邏輯座標
  const VIEW_W = 800, VIEW_H = 500;          // 畫面顯示尺寸（CSS 固定 800x500）
  const FPS_CAP = 120;

  const PLAYER_W = 50, PLAYER_H = 50;
  const PLAYER_SPEED = 25;

  const BASE_SPAWN_MS = 950;
  const MIN_SPAWN_MS = 150;

  const ENEMY_SIZE = 60;

  const NO_SNIPER_FIRST_SEC = 5;
  const COUNTDOWN_SEC = 2;

  const COLORS = {
    WHITE: "#f8f8f8",
    BLACK: "#1e1e1e",
    BLUE: "#4682ff",
    SHADOW: "rgba(0,0,0,0.12)",
    RED: "#dc0000",
  };

  const AI_PROFILES = {
    dumb:    { track_factor: 0.001, fall_min: 8,  fall_max: 8,  color: "#b4b4b4", dx_cap: 1  },
    papapig: { track_factor: 0.17,  fall_min: 15, fall_max: 18, color: "#ff78b4", dx_cap: 24 },
    thanose: { track_factor: 0.10,  fall_min: 23, fall_max: 25, color: "#8c00ff", dx_cap: 15  },
    sniper:  { track_factor: 0.01,  fall_min: 40, fall_max: 40, color: "#ff5050", dx_cap: 3  },
  };
  const PROFILE_POP = ["dumb", "papapig", "thanose", "sniper"];
  const PROFILE_WTS = [30, 30, 20, 15];

  // =========================
  // DOM
  // =========================
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const panelMenu = document.getElementById("panel-menu");
  const panelCountdown = document.getElementById("panel-countdown");
  const panelPlaying = document.getElementById("panel-playing");
  const panelGameover = document.getElementById("panel-gameover");

  const nameInput = document.getElementById("nameInput");
  const startBtn = document.getElementById("startBtn");

  const timeText = document.getElementById("timeText");
  const countText = document.getElementById("countText");

  const finalTimeEl = document.getElementById("finalTime");
  const killedByEl = document.getElementById("killedBy");
  const recordEl = document.getElementById("record");

  const bestList = document.getElementById("bestList");
  const worstList = document.getElementById("worstList");
  const gamesPlayedEl = document.getElementById("gamesPlayed");
  const avgTimeEl = document.getElementById("avgTime");

  const bestList2 = document.getElementById("bestList2");
  const worstList2 = document.getElementById("worstList2");
  const gamesPlayedEl2 = document.getElementById("gamesPlayed2");
  const avgTimeEl2 = document.getElementById("avgTime2");

  // =========================
  // Retina / HiDPI (關鍵：畫質清楚)
  // =========================
  function setupCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(VIEW_W * dpr);
    canvas.height = Math.floor(VIEW_H * dpr);
    canvas.style.width = `${VIEW_W}px`;
    canvas.style.height = `${VIEW_H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 用 CSS 像素座標畫（超清楚）
  }
  setupCanvas();
  window.addEventListener("resize", setupCanvas);

  // 世界 -> 視窗縮放比例（保持你原本 UI/世界設計比例）
  const SCALE_X = VIEW_W / LOGIC_W;
  const SCALE_Y = VIEW_H / LOGIC_H;
  function vx(x) { return x * SCALE_X; }
  function vy(y) { return y * SCALE_Y; }
  function vw(w) { return w * SCALE_X; }
  function vh(h) { return h * SCALE_Y; }

  // =========================
  // Utils
  // =========================
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function weightedChoice(items, weights) {
    let sum = 0;
    for (const w of weights) sum += w;
    let r = Math.random() * sum;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function aabbHit(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  // =========================
  // Leaderboard (localStorage)
  // =========================
  const LS_KEY = "doge_leaderboard_v1";
  const LS_META = "doge_meta_v1"; // gamesPlayed / totalTime


  let leaderboard = []; // [{name,time}]
  let gamesPlayed = 0;
  let totalTime = 0;

  function loadScores() {
    try {
      leaderboard = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      const meta = JSON.parse(localStorage.getItem(LS_META) || "{}");
      gamesPlayed = meta.gamesPlayed || 0;
      totalTime = meta.totalTime || 0;
    } catch {
      leaderboard = [];
      gamesPlayed = 0;
      totalTime = 0;
    }
  }
  function saveScores() {
    localStorage.setItem(LS_KEY, JSON.stringify(leaderboard));
    localStorage.setItem(LS_META, JSON.stringify({ gamesPlayed, totalTime }));
  }
  function bestTime() {
    if (!leaderboard.length) return 0;
    let m = 0;
    for (const s of leaderboard) if (s.time > m) m = s.time;
    return m;
  }
  function pushScore(name, time) {
    leaderboard.push({ name, time });
    gamesPlayed += 1;
    totalTime += time;
    saveScores();
  }
  function renderLeaderboard() {
    const best5 = [...leaderboard].sort((a, b) => b.time - a.time).slice(0, 5);
    const worst5 = [...leaderboard].sort((a, b) => a.time - b.time).slice(0, 5);

    const avg = gamesPlayed > 0 ? (totalTime / gamesPlayed) : 0;

    function fillList(ol, rows) {
      ol.innerHTML = "";
      for (const r of rows) {
        const li = document.createElement("li");
        li.textContent = `${r.name}  ${r.time.toFixed(2)}s`;
        ol.appendChild(li);
      }
    }

    fillList(bestList, best5);
    fillList(worstList, worst5);
    fillList(bestList2, best5);
    fillList(worstList2, worst5);

    gamesPlayedEl.textContent = `Games Played: ${gamesPlayed}`;
    avgTimeEl.textContent = `Avg Time: ${avg.toFixed(2)}s`;
    gamesPlayedEl2.textContent = `Games Played: ${gamesPlayed}`;
    avgTimeEl2.textContent = `Avg. Time: ${avg.toFixed(2)}s`;
  }

  loadScores();
  renderLeaderboard();
  refreshCloudLeaderboard(); // ✅ 進站先拉一次雲端排行榜

  async function refreshCloudLeaderboard() {
  if (!window.fbscores) return;

  try {
    const [best5, worst5] = await Promise.all([
      window.fbscores.fetchTop(5),
      window.fbscores.fetchBottom(5),
    ]);

    function fillList(ol, rows) {
      ol.innerHTML = "";
      for (const r of rows) {
        const li = document.createElement("li");
        const nm = (r.name || "Player").slice(0, 12);
        const tm = (typeof r.time === "number") ? r.time : 0;
        li.textContent = `${nm}  ${tm.toFixed(2)}s`;
        ol.appendChild(li);
      }
    }

    fillList(bestList, best5);
    fillList(worstList, worst5);
    fillList(bestList2, best5);
    fillList(worstList2, worst5);
  } catch (e) {
    console.warn("Cloud leaderboard failed, fallback to local.", e);
  }
}

  // =========================
  // Game State
  // =========================
  const STATE = {
    MENU: "menu",
    COUNTDOWN: "countdown",
    PLAYING: "playing",
    GAMEOVER: "gameover",
  };
  let state = STATE.MENU;

  // Runtime
  let player = null;
  let enemies = [];

  let startMs = 0;
  let lastSpawnMs = 0;
  let spawnMs = BASE_SPAWN_MS;

  let countdownStartMs = 0;

  let finalSurvivalSec = 0;
  let finalKilledBy = "";
  let finalKilledColor = "#1e1e1e";
  let recordBreaking = false;

  // Input
  const key = { left: false, right: false };
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") key.left = true;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") key.right = true;

    if (e.key === "Enter") {
      if (state === STATE.MENU) startCountdown();
      else if (state === STATE.GAMEOVER) startCountdown();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") key.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") key.right = false;
  });

  startBtn.addEventListener("click", startCountdown);

  function showPanel(which) {
    panelMenu.classList.toggle("hidden", which !== STATE.MENU);
    panelCountdown.classList.toggle("hidden", which !== STATE.COUNTDOWN);
    panelPlaying.classList.toggle("hidden", which !== STATE.PLAYING);
    panelGameover.classList.toggle("hidden", which !== STATE.GAMEOVER);
  }

  function newPlayer() {
    return {
      x: LOGIC_W / 2 - PLAYER_W / 2,
      y: LOGIC_H - PLAYER_H - 80,
      w: PLAYER_W,
      h: PLAYER_H,
    };
  }

  function resetGame(now) {
    player = newPlayer();
    enemies = [];
    startMs = now;
    lastSpawnMs = now;
    spawnMs = BASE_SPAWN_MS;
  }

  function startCountdown() {
    countdownStartMs = performance.now();
    state = STATE.COUNTDOWN;
    showPanel(STATE.COUNTDOWN);
  }

  function spawnEnemy(now) {
    const elapsed = (now - startMs) / 1000;

    let name;
    if (elapsed < NO_SNIPER_FIRST_SEC) {
      name = weightedChoice(["dumb", "papapig", "thanose"], [PROFILE_WTS[0], PROFILE_WTS[1], PROFILE_WTS[2]]);
    } else {
      name = weightedChoice(PROFILE_POP, PROFILE_WTS);
    }

    const p = AI_PROFILES[name];
    const x = Math.floor(Math.random() * (LOGIC_W - ENEMY_SIZE));
    return {
      x, y: -ENEMY_SIZE, w: ENEMY_SIZE, h: ENEMY_SIZE,
      fall_v: randInt(p.fall_min, p.fall_max),
      track_factor: p.track_factor,
      dx_cap: p.dx_cap,
      color: p.color,
      type: name,

      spawn_tick: now,
      warning_ms: (name === "sniper") ? 500 : 0,
    };
  }

  function randInt(lo, hi) {
    return Math.floor(lo + Math.random() * (hi - lo + 1));
  }

  // =========================
  // Render helpers (圓角方塊+陰影)
  // =========================
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawBlock(xL, yL, wL, hL, color) {
    const x = vx(xL), y = vy(yL), w = vw(wL), h = vh(hL);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    roundRect(ctx, x + 3, y + 3, w, h, 10);
    ctx.fill();
    // block
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
  }

  // =========================
  // Main loop
  // =========================
  let lastFrame = 0;
  function loop(ts) {
    requestAnimationFrame(loop);

    // cap FPS（避免過度更新）
    if (lastFrame) {
      const dt = ts - lastFrame;
      if (dt < (1000 / FPS_CAP)) return;
    }
    lastFrame = ts;

    // clear
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (state === STATE.MENU) {
      // 背景留白即可（UI 用 HTML）
      return;
    }

    if (state === STATE.COUNTDOWN) {
      const remain = COUNTDOWN_SEC - (ts - countdownStartMs) / 1000;
      if (remain <= 0) {
        resetGame(ts);
        state = STATE.PLAYING;
        showPanel(STATE.PLAYING);
        return;
      }
      const txt = (remain <= 0.5) ? "GO" : String(Math.floor(remain) + 1);
      countText.textContent = txt;
      return;
    }

    if (state === STATE.PLAYING) {
      const elapsed = (ts - startMs) / 1000;

      // spawn rate（對齊你原本）
      spawnMs = elapsed < 5 ? 950 : elapsed < 15 ? 750 :elapsed < 30 ? 550 : elapsed < 60 ? 350 : MIN_SPAWN_MS;

      // move player
      if (key.left) player.x -= PLAYER_SPEED;
      if (key.right) player.x += PLAYER_SPEED;
      player.x = clamp(player.x, 0, LOGIC_W - player.w);

      // spawn enemies
      if (ts - lastSpawnMs >= spawnMs) {
        enemies.push(spawnEnemy(ts));
        lastSpawnMs = ts;
      }

      // draw + update enemies
      let collided = false;
      let killer = null;

      for (const e of enemies) {
        // sniper warning
        if (e.warning_ms > 0) {
          const t = ts - e.spawn_tick;
          if (t < e.warning_ms) {
            const phase = Math.floor(t / (e.warning_ms / 4)); // 0..3
            const on = (phase % 2 === 0);

            if (on) {
              const baseY = 40;
              const shakeAmp = 8;
              const shakeHz = 10;
              const shake = Math.sin((t / 1000) * (2 * Math.PI * shakeHz)) * shakeAmp;

              const pulse = 0.5 + 0.5 * Math.sin((t / 1000) * 2 * Math.PI * 6);
              const alpha = 0.3 + 0.7 * pulse;

              // warning block uses enemy's future x position (centered)
              const wx = e.x + shake;
              const wy = baseY;

              // shadow
              ctx.fillStyle = `rgba(0,0,0,${0.18 * alpha})`;
              roundRect(ctx, vx(wx) + 3, vy(wy) + 3, vw(e.w), vh(e.h), 10);
              ctx.fill();

              // block
              ctx.fillStyle = hexToRgba(e.color, alpha);
              roundRect(ctx, vx(wx), vy(wy), vw(e.w), vh(e.h), 10);
              ctx.fill();
            }
            continue; // warning phase doesn't fall
          } else {
            e.warning_ms = 0;
            e.y = 0;
          }
        }

        // normal movement
        e.y += e.fall_v;
        const dx = clamp((player.x + player.w / 2 - (e.x + e.w / 2)) * e.track_factor, -e.dx_cap, e.dx_cap);
        e.x = clamp(e.x + Math.trunc(dx), 0, LOGIC_W - e.w);

        // draw enemy
        drawBlock(e.x, e.y, e.w, e.h, e.color);

        if (!collided) {
          if (aabbHit(player, e)) {
            collided = true;
            killer = e;
          }
        }
      }

      // draw player
      drawBlock(player.x, player.y, player.w, player.h, COLORS.BLUE);

      // UI
      timeText.textContent = `Time: ${elapsed.toFixed(2)}s`;

      if (collided && killer) {
        finalSurvivalSec = elapsed;
        finalKilledBy = killer.type;
        finalKilledColor = killer.color;
        recordBreaking = finalSurvivalSec > bestTime();

        const name = (nameInput.value || "").trim() || "Player";
        pushScore(name, finalSurvivalSec);
        renderLeaderboard();

        // ✅ 寫入雲端 + 重新拉榜
        if (window.fbscores) {
          window.fbscores.submitScore({
            name,
            time: finalSurvivalSec,
            killedBy: finalKilledBy,
          }).then(refreshCloudLeaderboard).catch(console.warn);
        }

        // update gameover UI
        finalTimeEl.textContent = finalSurvivalSec.toFixed(2);
        killedByEl.textContent = `Kill by ${finalKilledBy}`;
        killedByEl.style.color = finalKilledColor;
        recordEl.classList.toggle("hidden", !recordBreaking);

        state = STATE.GAMEOVER;
        showPanel(STATE.GAMEOVER);
      }

      return;
    }

    if (state === STATE.GAMEOVER) {
      // 背景留白即可（UI 用 HTML）
      return;
    }
  }

  function hexToRgba(hex, a) {
    // hex like #rrggbb
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // 初始狀態
  showPanel(STATE.MENU);
  requestAnimationFrame(loop);
})();