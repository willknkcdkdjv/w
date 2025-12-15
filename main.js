(() => {
  // =========================
  // Config
  // =========================
  const LOGIC_W = 1600, LOGIC_H = 1000;
  const VIEW_W = 800, VIEW_H = 500;
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
    BLUE: "#4682ff",
  };

  const AI_PROFILES = {
    dumb:    { track_factor: 0.001, fall_min: 8,  fall_max: 8,  color: "#b4b4b4", dx_cap: 1  },
    papapig: { track_factor: 0.17,  fall_min: 15, fall_max: 18, color: "#ff78b4", dx_cap: 24 },
    thanose: { track_factor: 0.13,  fall_min: 23, fall_max: 25, color: "#8c00ff", dx_cap: 15 },
    sniper:  { track_factor: 0.01,  fall_min: 40, fall_max: 40, color: "#ff5050", dx_cap: 3  },
  };
  const PROFILE_POP = ["dumb", "papapig", "thanose", "sniper"];
  const PROFILE_WTS = [30, 30, 20, 15];

  // =========================
  // State
  // =========================
  const STATE = {
    LOGIN: "login",
    MENU: "menu",
    COUNTDOWN: "countdown",
    PLAYING: "playing",
    GAMEOVER: "gameover",
  };
  let state = STATE.LOGIN;

  // =========================
  // DOM
  // =========================
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const panelLogin = document.getElementById("panel-login");
  const panelMenu = document.getElementById("panel-menu");
  const panelCountdown = document.getElementById("panel-countdown");
  const panelPlaying = document.getElementById("panel-playing");
  const panelGameover = document.getElementById("panel-gameover");

  const emailInput = document.getElementById("emailInput");
  const loginNameInput = document.getElementById("loginNameInput");
  const passwordInput = document.getElementById("passwordInput");
  const loginBtn = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");

  const nameInput = document.getElementById("nameInput");
  const startBtn = document.getElementById("startBtn");

  const countText = document.getElementById("countText");
  const timeText = document.getElementById("timeText");

  const finalTimeEl = document.getElementById("finalTime");
  const killedByEl = document.getElementById("killedBy");
  const recordEl = document.getElementById("record");

  const bestList = document.getElementById("bestList");
  const worstList = document.getElementById("worstList");
  const bestList2 = document.getElementById("bestList2");
  const worstList2 = document.getElementById("worstList2");

  const accountNameEl = document.getElementById("accountName");
  const bestTimeEl = document.getElementById("bestTime");
  const gamesPlayedEl = document.getElementById("gamesPlayed");
  const avgTimeEl = document.getElementById("avgTime");

  const accountNameEl2 = document.getElementById("accountName2");
  const bestTimeEl2 = document.getElementById("bestTime2");
  const gamesPlayedEl2 = document.getElementById("gamesPlayed2");
  const avgTimeEl2 = document.getElementById("avgTime2");

  function showPanel(which) {
    panelLogin?.classList.toggle("hidden", which !== STATE.LOGIN);
    panelMenu?.classList.toggle("hidden", which !== STATE.MENU);
    panelCountdown?.classList.toggle("hidden", which !== STATE.COUNTDOWN);
    panelPlaying?.classList.toggle("hidden", which !== STATE.PLAYING);
    panelGameover?.classList.toggle("hidden", which !== STATE.GAMEOVER);
  }

  function setLoginError(msg) {
    if (!loginError) return;
    loginError.style.display = msg ? "block" : "none";
    loginError.textContent = msg || "";
  }

  // =========================
  // Canvas HiDPI
  // =========================
  function setupCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(VIEW_W * dpr);
    canvas.height = Math.floor(VIEW_H * dpr);
    canvas.style.width = `${VIEW_W}px`;
    canvas.style.height = `${VIEW_H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setupCanvas();
  window.addEventListener("resize", setupCanvas);

  const SCALE_X = VIEW_W / LOGIC_W;
  const SCALE_Y = VIEW_H / LOGIC_H;
  const vx = (x) => x * SCALE_X;
  const vy = (y) => y * SCALE_Y;
  const vw = (w) => w * SCALE_X;
  const vh = (h) => h * SCALE_Y;

  // =========================
  // Utils
  // =========================
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

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
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function randInt(lo, hi) {
    return Math.floor(lo + Math.random() * (hi - lo + 1));
  }

  function hexToRgba(hex, a) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
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
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    roundRect(ctx, x + 3, y + 3, w, h, 10);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
  }

  // =========================
  // Firebase-backed account
  // =========================
  let currentUser = null; // { uid, name, email }

  function renderAccountSummaryFromCloud(s) {
    if (!currentUser) return;
    const games = s?.gamesPlayed || 0;
    const total = s?.totalTime || 0;
    const best = s?.bestTime || 0;
    const avg = games > 0 ? total / games : 0;

    if (accountNameEl) accountNameEl.textContent = `Account: ${currentUser.name}`;
    if (bestTimeEl) bestTimeEl.textContent = `Best: ${best.toFixed(2)}s`;
    if (gamesPlayedEl) gamesPlayedEl.textContent = `Games Played: ${games}`;
    if (avgTimeEl) avgTimeEl.textContent = `Avg Time: ${avg.toFixed(2)}s`;

    if (accountNameEl2) accountNameEl2.textContent = `Account: ${currentUser.name}`;
    if (bestTimeEl2) bestTimeEl2.textContent = `Best: ${best.toFixed(2)}s`;
    if (gamesPlayedEl2) gamesPlayedEl2.textContent = `Games Played: ${games}`;
    if (avgTimeEl2) avgTimeEl2.textContent = `Avg. Time: ${avg.toFixed(2)}s`;
  }

  async function refreshCloudLeaderboard() {
    if (!window.fbscores?.fetchTop) return;
    try {
      const [best5, worst5] = await Promise.all([
        window.fbscores.fetchTop(5),
        window.fbscores.fetchBottom(5),
      ]);

      const fillList = (ol, rows) => {
        if (!ol) return;
        ol.innerHTML = "";
        for (const r of rows) {
          const li = document.createElement("li");
          const nm = (r.name || "Player").slice(0, 12);
          const tm = (typeof r.time === "number") ? r.time : 0;
          li.textContent = `${nm}  ${tm.toFixed(2)}s`;
          ol.appendChild(li);
        }
      };

      fillList(bestList, best5);
      fillList(worstList, worst5);
      fillList(bestList2, best5);
      fillList(worstList2, worst5);
    } catch (e) {
      console.warn("Cloud leaderboard failed:", e);
    }
  }

  async function enterMenuWithFirebaseUser(user) {
    currentUser = {
      uid: user.uid,
      email: user.email || "",
      name: (user.displayName || "Player").slice(0, 12),
    };

    // Menu：不再輸入 name，只顯示
    if (nameInput) {
      nameInput.value = currentUser.name;
      nameInput.setAttribute("readonly", "readonly");
      const nameRow = nameInput.closest(".row");
      if (nameRow) nameRow.style.display = "none";
    }

    setLoginError("");
    state = STATE.MENU;
    showPanel(STATE.MENU);

    // 讀 stats + 拉榜
    try {
      const s = await window.fbscores.readMyStats(currentUser.uid);
      renderAccountSummaryFromCloud(s);
    } catch (e) {
      console.warn("readMyStats failed:", e);
      renderAccountSummaryFromCloud({ gamesPlayed: 0, totalTime: 0, bestTime: 0 });
    }
    refreshCloudLeaderboard();
  }

  async function doLogin() {
    if (!window.fbauth?.loginOrRegister) {
      //return setLoginError("Firebase Auth not initialized (check index.html module script).");
    }

    const email = (emailInput?.value || "").trim().toLowerCase();
    const password = (passwordInput?.value || "").trim();
    const displayName = (loginNameInput?.value || "").trim().slice(0, 12);

    if (!email) return setLoginError("Email is required.");
    if (!password) return setLoginError("Password is required.");

    try {
      const user = await window.fbauth.loginOrRegister({ email, password, displayName });
      await enterMenuWithFirebaseUser(user);
    } catch (e) {
      console.warn(e);
      setLoginError("Login failed.");
    }
  }

  function bootAuthGate() {
  window.fbauth.onAuthStateChanged(window.fbauth.auth, (user) => {
    if (user) enterMenuWithFirebaseUser(user);
    else {
      state = STATE.LOGIN;
      showPanel(STATE.LOGIN);
    }
  });
  }

  // Login events
  loginBtn?.addEventListener("click", doLogin);
  emailInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  passwordInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  loginNameInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

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
  let bestGlobalCached = 0;

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

  startBtn?.addEventListener("click", startCountdown);

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

  async function updateGlobalBestCache() {
    // 用雲端 Top1 當 global best（只做參考顯示 record breaking）
    if (!window.fbscores?.fetchTop) return;
    try {
      const top1 = await window.fbscores.fetchTop(1);
      bestGlobalCached = (top1?.[0]?.time || 0);
    } catch {}
  }

  // =========================
  // Main loop
  // =========================
  let lastFrame = 0;
  function loop(ts) {
    requestAnimationFrame(loop);

    if (lastFrame) {
      const dt = ts - lastFrame;
      if (dt < (1000 / FPS_CAP)) return;
    }
    lastFrame = ts;

    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (state === STATE.LOGIN || state === STATE.MENU) return;

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

      if (key.left) player.x -= PLAYER_SPEED;
      if (key.right) player.x += PLAYER_SPEED;
      player.x = clamp(player.x, 0, LOGIC_W - player.w);

      if (ts - lastSpawnMs >= spawnMs) {
        enemies.push(spawnEnemy(ts));
        lastSpawnMs = ts;
      }

      let collided = false;
      let killer = null;

      for (const e of enemies) {
        if (e.warning_ms > 0) {
          const t = ts - e.spawn_tick;
          if (t < e.warning_ms) {
            const phase = Math.floor(t / (e.warning_ms / 4));
            const on = (phase % 2 === 0);

            if (on) {
              const baseY = 40;
              const shake = Math.sin((t / 1000) * (2 * Math.PI * 10)) * 8;
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

        recordBreaking = finalSurvivalSec > (bestGlobalCached || 0);

        // UI
        if (finalTimeEl) finalTimeEl.textContent = finalSurvivalSec.toFixed(2);
        if (killedByEl) {
          killedByEl.textContent = `Kill by ${finalKilledBy}`;
          killedByEl.style.color = finalKilledColor;
        }
        if (recordEl) recordEl.classList.toggle("hidden", !recordBreaking);

        // Cloud write
        if (currentUser?.uid && window.fbscores?.submitScore && window.fbscores?.updateMyStats) {
          const name = currentUser.name || "Player";

          window.fbscores.submitScore({
            uid: currentUser.uid,
            name,
            time: finalSurvivalSec,
            killedBy: finalKilledBy,
          }).then(() => {
            refreshCloudLeaderboard();
            updateGlobalBestCache();
          }).catch(console.warn);

          window.fbscores.updateMyStats(currentUser.uid, finalSurvivalSec)
            .then(() => window.fbscores.readMyStats(currentUser.uid))
            .then((s) => renderAccountSummaryFromCloud(s))
            .catch(console.warn);
        }

        state = STATE.GAMEOVER;
        showPanel(STATE.GAMEOVER);
      }

      return;
    }

    if (state === STATE.GAMEOVER) return;
  }

  // =========================
  // Boot
  // =========================
  showPanel(STATE.LOGIN);
  refreshCloudLeaderboard();
  updateGlobalBestCache();
  bootAuthGate();
  requestAnimationFrame(loop);
})();