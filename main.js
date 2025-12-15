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
    thanose: { track_factor: 0.13,  fall_min: 23, fall_max: 25, color: "#8c00ff", dx_cap: 15  },
    sniper:  { track_factor: 0.01,  fall_min: 40, fall_max: 40, color: "#ff5050", dx_cap: 3  },
  };
  const PROFILE_POP = ["dumb", "papapig", "thanose", "sniper"];
  const PROFILE_WTS = [30, 30, 20, 15];

  // =========================
  // Game State
  // =========================
  const STATE = {
    LOGIN: "login",
    MENU: "menu",
    COUNTDOWN: "countdown",
    PLAYING: "playing",
    GAMEOVER: "gameover",
  };
  let state = STATE.MENU;

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

  // Login panel
  const panelLogin = document.getElementById("panel-login");
  const emailInput = document.getElementById("emailInput");
  const loginNameInput = document.getElementById("loginNameInput");
  const loginBtn = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");

  // Account summary
  const accountNameEl = document.getElementById("accountName");
  const bestTimeEl = document.getElementById("bestTime");
  const accountNameEl2 = document.getElementById("accountName2");
  const bestTimeEl2 = document.getElementById("bestTime2");

  function showPanel(which) {
    if (panelLogin) panelLogin.classList.toggle("hidden", which !== STATE.LOGIN);
    panelMenu.classList.toggle("hidden", which !== STATE.MENU);
    panelCountdown.classList.toggle("hidden", which !== STATE.COUNTDOWN);
    panelPlaying.classList.toggle("hidden", which !== STATE.PLAYING);
    panelGameover.classList.toggle("hidden", which !== STATE.GAMEOVER);
  }

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

  // 世界 -> 視窗縮放比例
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

  function randInt(lo, hi) {
    return Math.floor(lo + Math.random() * (hi - lo + 1));
  }

  // =========================
  // Account Stats (per-email, local demo)
  // =========================
  let currentUser = null; // { email, name }

  const USER_KEY = "doge_user_v1";
  const USER_STATS_KEY = "doge_user_stats_v1"; // { [email]: { gamesPlayed, totalTime, bestTime } }

  function loadAllUserStats() {
    try { return JSON.parse(localStorage.getItem(USER_STATS_KEY) || "{}"); }
    catch { return {}; }
  }
  function saveAllUserStats(map) {
    localStorage.setItem(USER_STATS_KEY, JSON.stringify(map));
  }
  function getUserStats(email) {
    const all = loadAllUserStats();
    return all[email] || { gamesPlayed: 0, totalTime: 0, bestTime: 0 };
  }
  function updateUserStats(email, timeSec) {
    const all = loadAllUserStats();
    const s = all[email] || { gamesPlayed: 0, totalTime: 0, bestTime: 0 };
    s.gamesPlayed += 1;
    s.totalTime += timeSec;
    if (timeSec > s.bestTime) s.bestTime = timeSec;
    all[email] = s;
    saveAllUserStats(all);
    return s;
  }
  function renderAccountSummary() {
    if (!currentUser?.email) return;
    const s = getUserStats(currentUser.email);
    const avg = s.gamesPlayed > 0 ? (s.totalTime / s.gamesPlayed) : 0;

    if (accountNameEl) accountNameEl.textContent = `Account: ${currentUser.name}`;
    if (bestTimeEl) bestTimeEl.textContent = `Best: ${s.bestTime.toFixed(2)}s`;
    gamesPlayedEl.textContent = `Games Played: ${s.gamesPlayed}`;
    avgTimeEl.textContent = `Avg Time: ${avg.toFixed(2)}s`;

    if (accountNameEl2) accountNameEl2.textContent = `Account: ${currentUser.name}`;
    if (bestTimeEl2) bestTimeEl2.textContent = `Best: ${s.bestTime.toFixed(2)}s`;
    gamesPlayedEl2.textContent = `Games Played: ${s.gamesPlayed}`;
    avgTimeEl2.textContent = `Avg. Time: ${avg.toFixed(2)}s`;
  }

  // =========================
  // Leaderboard (localStorage, global list)
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
  function bestTimeGlobal() {
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
      if (!ol) return;
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

    // 這裡保留「全站統計」，帳號統計改由 renderAccountSummary 控制
    // 若你不想顯示全站統計，可在 HTML 移除 gamesPlayed/avgTime 或不更新它們
    // 目前仍更新為全站值（不影響 account summary）
  }

  // =========================
  // Cloud leaderboard
  // =========================
  async function refreshCloudLeaderboard() {
    if (!window.fbscores) return;
    try {
      const [best5, worst5] = await Promise.all([
        window.fbscores.fetchTop(5),
        window.fbscores.fetchBottom(5),
      ]);

      function fillList(ol, rows) {
        if (!ol) return;
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
  // Login Gate (Demo: email + name as password)
  // =========================
  function setLoginError(msg) {
    if (!loginError) return;
    loginError.style.display = msg ? "block" : "none";
    loginError.textContent = msg || "";
  }
  function isValidEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }
  function loadUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
    catch { return null; }
  }
  function saveUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function enterMenuWithUser(user) {
    currentUser = user;

    // Menu：不再輸入 name，直接顯示 account
    if (nameInput) {
      nameInput.value = user.name || "";
      nameInput.setAttribute("readonly", "readonly");
      const nameRow = nameInput.closest(".row");
      if (nameRow) nameRow.style.display = "none";
    }

    setLoginError("");
    state = STATE.MENU;
    showPanel(STATE.MENU);

    renderAccountSummary();
    refreshCloudLeaderboard();
  }

  function doLogin() {
    const email = (emailInput?.value || "").trim().toLowerCase();
    const name = (loginNameInput?.value || "").trim();

    if (!isValidEmail(email)) return setLoginError("Invalid email.");
    if (!name) return setLoginError("Name is required.");
    if (name.length > 12) return setLoginError("Name too long (max 12).");

    const user = { email, name };
    saveUser(user);
    enterMenuWithUser(user);
  }

  function bootLoginGate() {
    const user = loadUser();
    if (user && user.email && user.name) {
      enterMenuWithUser(user);
    } else {
      state = STATE.LOGIN;
      showPanel(STATE.LOGIN);
      setLoginError("");
    }
  }

  if (loginBtn) loginBtn.addEventListener("click", doLogin);
  if (emailInput) emailInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  if (loginNameInput) loginNameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

  // =========================
  // Game runtime
  // =========================
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
      if (state === STATE.LOGIN) doLogin();
      else if (state === STATE.MENU) startCountdown();
      else if (state === STATE.GAMEOVER) startCountdown();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") key.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") key.right = false;
  });

  if (startBtn) startBtn.addEventListener("click", startCountdown);

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

  // =========================
  // Render helpers
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

  function hexToRgba(hex, a) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // =========================
  // Main loop
  // =========================
  let lastFrame = 0;
  function loop(ts) {
    requestAnimationFrame(loop);

    // cap FPS
    if (lastFrame) {
      const dt = ts - lastFrame;
      if (dt < (1000 / FPS_CAP)) return;
    }
    lastFrame = ts;

    // clear
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (state === STATE.MENU || state === STATE.LOGIN) {
      return; // UI 由 HTML 負責
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
      if (countText) countText.textContent = txt;
      return;
    }

    if (state === STATE.PLAYING) {
      const elapsed = (ts - startMs) / 1000;

      spawnMs =
        elapsed < 5  ? 950 :
        elapsed < 15 ? 750 :
        elapsed < 30 ? 550 :
        elapsed < 60 ? 350 :
        MIN_SPAWN_MS;

      // move player
      if (key.left) player.x -= PLAYER_SPEED;
      if (key.right) player.x += PLAYER_SPEED;
      player.x = clamp(player.x, 0, LOGIC_W - player.w);

      // spawn enemies
      if (ts - lastSpawnMs >= spawnMs) {
        enemies.push(spawnEnemy(ts));
        lastSpawnMs = ts;
      }

      // update enemies
      let collided = false;
      let killer = null;

      for (const e of enemies) {
        // sniper warning
        if (e.warning_ms > 0) {
          const t = ts - e.spawn_tick;
          if (t < e.warning_ms) {
            const phase = Math.floor(t / (e.warning_ms / 4));
            const on = (phase % 2 === 0);

            if (on) {
              const baseY = 40;
              const shakeAmp = 8;
              const shakeHz = 10;
              const shake = Math.sin((t / 1000) * (2 * Math.PI * shakeHz)) * shakeAmp;

              const pulse = 0.5 + 0.5 * Math.sin((t / 1000) * 2 * Math.PI * 6);
              const alpha = 0.3 + 0.7 * pulse;

              const wx = e.x + shake;
              const wy = baseY;

              ctx.fillStyle = `rgba(0,0,0,${0.18 * alpha})`;
              roundRect(ctx, vx(wx) + 3, vy(wy) + 3, vw(e.w), vh(e.h), 10);
              ctx.fill();

              ctx.fillStyle = hexToRgba(e.color, alpha);
              roundRect(ctx, vx(wx), vy(wy), vw(e.w), vh(e.h), 10);
              ctx.fill();
            }
            continue;
          } else {
            e.warning_ms = 0;
            e.y = 0;
          }
        }

        e.y += e.fall_v;
        const dx = clamp((player.x + player.w / 2 - (e.x + e.w / 2)) * e.track_factor, -e.dx_cap, e.dx_cap);
        e.x = clamp(e.x + Math.trunc(dx), 0, LOGIC_W - e.w);

        drawBlock(e.x, e.y, e.w, e.h, e.color);

        if (!collided && aabbHit(player, e)) {
          collided = true;
          killer = e;
        }
      }

      drawBlock(player.x, player.y, player.w, player.h, COLORS.BLUE);
      if (timeText) timeText.textContent = `Time: ${elapsed.toFixed(2)}s`;

      if (collided && killer) {
        finalSurvivalSec = elapsed;
        finalKilledBy = killer.type;
        finalKilledColor = killer.color;

        // 全站破紀錄（local global）
        recordBreaking = finalSurvivalSec > bestTimeGlobal();

        // 使用登入名字（不再取 input）
        const name = (currentUser?.name || "Player").trim();

        // local global leaderboard
        pushScore(name, finalSurvivalSec);
        renderLeaderboard();

        // ✅ 更新該帳號統計（per-email）
        if (currentUser?.email) {
          updateUserStats(currentUser.email, finalSurvivalSec);
          renderAccountSummary();
        }

        // cloud write + refresh
        if (window.fbscores) {
          window.fbscores.submitScore({
            name,
            time: finalSurvivalSec,
            killedBy: finalKilledBy,
          }).then(refreshCloudLeaderboard).catch(console.warn);
        }

        // gameover UI
        if (finalTimeEl) finalTimeEl.textContent = finalSurvivalSec.toFixed(2);
        if (killedByEl) {
          killedByEl.textContent = `Kill by ${finalKilledBy}`;
          killedByEl.style.color = finalKilledColor;
        }
        if (recordEl) recordEl.classList.toggle("hidden", !recordBreaking);

        state = STATE.GAMEOVER;
        showPanel(STATE.GAMEOVER);
      }

      return;
    }

    if (state === STATE.GAMEOVER) {
      return;
    }
  }

  // =========================
  // Boot
  // =========================
  loadScores();
  renderLeaderboard();
  refreshCloudLeaderboard();

  bootLoginGate();
  requestAnimationFrame(loop);
})();