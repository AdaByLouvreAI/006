(() => {
  // ============================================================
  // 📜 THE SCHIZO LAW BOOK (ON-SCREEN)
  // ============================================================
  const LAW = {
    enabled: true,
    max: 52,
    lines: [],
    error: null,

    beats: 0,
    fps: 0,
    frameCount: 0,
    frameT0: performance.now(),

    verse: Object.create(null),

    counts: {
      spawns: 0,
      kills: 0,
      buffs: 0,
      buffRolls: 0,
      hits: 0,
      boom: 0,
      status: 0,
      resets: 0,
      failsafes: 0,
      ricochets: 0,
      volleys: 0,
      spawnBlocked: 0,
      fleetCapBlocks: 0,
    },

    throttle: Object.create(null),
  };

  function ensureLawOverlay() {
    let el = document.getElementById("__dbg_overlay__");
    if (el) return el;
    el = document.createElement("pre");
    el.id = "__dbg_overlay__";
    el.style.position = "fixed";
    el.style.left = "10px";
    el.style.bottom = "10px";
    el.style.width = "560px";
    el.style.maxHeight = "66vh";
    el.style.overflow = "auto";
    el.style.padding = "12px";
    el.style.background = "rgba(0,0,0,0.72)";
    el.style.color = "rgba(230,245,255,0.95)";
    el.style.fontFamily =
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    el.style.fontSize = "11px";
    el.style.lineHeight = "1.25";
    el.style.borderRadius = "12px";
    el.style.border = "1px solid rgba(180,220,255,0.22)";
    el.style.zIndex = "999999";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
    return el;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function law(sectionNum, sectionTitle, ...msg) {
    if (!LAW.enabled) return;
    const sN = pad2(sectionNum);
    LAW.verse[sN] = (LAW.verse[sN] || 0) + 1;
    const vN = LAW.verse[sN];
    const text = msg
      .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
      .join(" ");
    const line = `${sN}.${vN} §${sectionTitle}: ${text}`;
    LAW.lines.push(line);
    if (LAW.lines.length > LAW.max) LAW.lines.shift();
    console.log("%cLAW", "color:#8ef", line);
  }

  function lawThrottle(throttleKey, ms, sectionNum, sectionTitle, ...msg) {
    const now = performance.now();
    const last = LAW.throttle[throttleKey] || 0;
    if (now - last < ms) return;
    LAW.throttle[throttleKey] = now;
    law(sectionNum, sectionTitle, ...msg);
  }

  function lawWarn(sectionNum, sectionTitle, ...msg) {
    law(sectionNum, sectionTitle, "⚠️", ...msg);
  }

  function renderLawBook(extra = "") {
    const el = ensureLawOverlay();
    if (LAW.error) return;

    const now = performance.now();
    LAW.frameCount++;
    if (now - LAW.frameT0 >= 500) {
      LAW.fps = Math.round((LAW.frameCount * 1000) / (now - LAW.frameT0));
      LAW.frameCount = 0;
      LAW.frameT0 = now;
    }

    const c = LAW.counts;
    el.textContent =
      "📜 THE SCHIZO LAW BOOK (DEBUG)\n" +
      `FPS: ${LAW.fps} | Beats: ${LAW.beats}\n` +
      `Counts: spawns=${c.spawns} kills=${c.kills} buffs=${c.buffs} buffRolls=${c.buffRolls} hits=${c.hits} ricochet=${c.ricochets} boom=${c.boom} volleys=${c.volleys} resets=${c.resets} blocked=${c.spawnBlocked} fleetCapBlocks=${c.fleetCapBlocks}\n` +
      (extra ? extra + "\n" : "") +
      "— — — — — — — — — — — — — —\n" +
      LAW.lines.join("\n");
  }

  function setFatal(err) {
    LAW.error = err;
    console.error(err);
    const el = ensureLawOverlay();
    const msg =
      err && (err.stack || err.message) ? err.stack || err.message : String(err);
    el.style.background = "rgba(80,0,0,0.85)";
    el.style.border = "1px solid rgba(255,150,150,0.55)";
    el.textContent =
      "🔥 FATAL ERROR (GAME DID NOT START)\n\n" +
      msg +
      "\n\n---\n" +
      LAW.lines.join("\n");
  }

  window.addEventListener("error", (e) => setFatal(e.error || e.message || e));
  window.addEventListener("unhandledrejection", (e) =>
    setFatal(e.reason || e)
  );

  function sanityCheckElement(id, optional = false) {
    const el = document.getElementById(id);
    if (!el && !optional) lawWarn(1, "BOOT", `MISSING ELEMENT: #${id}`);
    if (el) law(1, "BOOT", `FOUND ELEMENT: #${id}`);
    return el;
  }

  // ============================================================
  // GAME BOOT
  // ============================================================
  try {
    law(1, "BOOT", "game.js loaded → entering init…");

    // ===== Canvas setup =====
    const canvas = sanityCheckElement("c");
    if (!canvas) throw new Error('Canvas not found. Need: <canvas id="c"></canvas>');
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context 2D failed.");

    function resize() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(innerWidth * dpr);
      canvas.height = Math.floor(innerHeight * dpr);
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lawThrottle("resize", 350, 2, "CANVAS", "RESIZE", {
        w: innerWidth,
        h: innerHeight,
        dpr,
      });
    }
    addEventListener("resize", resize);
    resize();

    // ===== HUD (optional) =====
    const hpbar = sanityCheckElement("hpbar", true);
    const xpbar = sanityCheckElement("xpbar", true);
    const lvlEl = sanityCheckElement("lvl", true);
    const scoreEl = sanityCheckElement("score", true);
    const timeEl = sanityCheckElement("time", true);
    const dmgEl = sanityCheckElement("dmg", true);
    const rofEl = sanityCheckElement("rof", true);
    const spdEl = sanityCheckElement("spd", true);
    const buffsEl = sanityCheckElement("buffs", true);

    // ===== Input =====
    const keys = new Set();
    addEventListener("keydown", (e) => {
      keys.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key))
        e.preventDefault();
    });
    addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
    law(3, "INPUT", "listeners attached");

    // ===== Utilities =====
    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const dist2 = (ax, ay, bx, by) => {
      const dx = ax - bx,
        dy = ay - by;
      return dx * dx + dy * dy;
    };
    function angleTo(ax, ay, bx, by) {
      return Math.atan2(by - ay, bx - ax);
    }

    // ============================================================
    // SETTINGS
    // ============================================================
    const SETTINGS = {
      // 04.1 §SPAWN CONTROL
      SPAWN_OVER_TIME: true,
      SPAWN_PER_KILL: 3,
      MAX_ENEMIES_SPAWN_STOP: 100, // ✅ spawn cap now 100

      // 06.0 §BUFFS
      BUFF_RANDOM_ENABLED: true,
      BUFF_ROLL_BASE_PER_KILL: 0.18,
      BUFF_ROLL_GAIN_PER_MIN: 0.012,
      BUFF_ROLL_GAIN_PER_LVL: 0.002,
      BUFF_ROLL_CAP: 0.55,

      // 01.0 §TANK META
      PLAYER_HP_BASE: 160,
      PLAYER_DR_FLAT_BASE: 0.9,
      PLAYER_DR_PCT_BASE: 0.10,

      // 02.0 §PELLETS
      PELLET_CAP: 20,

      // 03.0 §ENEMY VOLLEY LEVELS
      ENEMY_SHOTLEVEL_MAX: 10,

      // 07.0 §SCORE SCALING
      SCORE_HP_CAP: 450000,

      // ✅ 07.9 §ENEMY HP MULTIPLIER
      ENEMY_HP_MULT: 100.0, // ✅ buff enemy hp by 100x

      // ✅ 11.0 §FLEET CAP
      FLEET_MAX: 6, // ✅ limit fleet buff
    };

    // ===== Game state =====
    const state = { score: 0, startTime: performance.now() };
    const camera = { x: 0, y: 0 };

    // ============================================================
    // PLAYER
    // ============================================================
    const player = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 14,

      hp: SETTINGS.PLAYER_HP_BASE,
      hpMax: SETTINGS.PLAYER_HP_BASE,
      xp: 0,
      xpNeed: 60,
      lvl: 1,

      shipAngle: 0,

      thrust: 1900,
      maxSpeed: 420,
      drag: 4.2,

      baseDamage: 10,
      critChance: 0.05,
      critMult: 2.0,

      // tankiness
      drFlat: SETTINGS.PLAYER_DR_FLAT_BASE,
      drPct: SETTINGS.PLAYER_DR_PCT_BASE,
      iFrame: 0,
      iFrameOnHit: 0.26,
      regen: 0.35,

      // elements / explosive
      element: "none",
      elementDmg: 0,
      elementRadius: 0,

      explosive: false,
      exploMult: 0.55,
      exploRadius: 0,

      // fleet
      fleet: 0,
      fleetDmgMult: 0.35,
      fleetFireMult: 0.75,

      // shooting
      fireRate: 6.0,
      bulletSpeed: 560,
      bulletLife: 1.05,
      bulletSize: 4,

      spreadBase: 0.12,
      pierce: 0,
      ricochet: 0,
    };

    camera.x = player.x;
    camera.y = player.y;

    const bullets = [];
    const ebullets = [];
    const enemies = [];
    const particles = [];
    const followers = [];

    let fireCooldown = 0;
    let spawnTimer = 0;
    let last = performance.now();
    let aimLock = false;

    // ============================================================
    // 01 — DEFENSE / DAMAGE APPLICATION
    // ============================================================
    function applyDamageToPlayer(raw) {
      if (player.iFrame > 0) return 0;

      let d = Math.max(0, raw - player.drFlat);
      d *= 1 - clamp(player.drPct, 0, 0.85);
      d = Math.max(0.2, d);

      player.hp -= d;
      player.iFrame = player.iFrameOnHit;
      return d;
    }

    // ============================================================
    // 02 — PELLET SCALING
    // ============================================================
    function pelletCountFrom(speed, size) {
      const s = clamp(speed / 500, 0.6, 2.4);
      const z = clamp((size - 2) / 7, 0, 1.4);
      const raw = 1 + s * 3.2 + z * 6.0;
      return clamp(Math.floor(raw), 1, SETTINGS.PELLET_CAP);
    }
    function pelletSpreadFrom(speed, size) {
      const spdTight = clamp(520 / Math.max(220, speed), 0.45, 1.55);
      const sizeTight = clamp(1.22 - size * 0.05, 0.6, 1.18);
      return 0.28 * spdTight * sizeTight;
    }
    function pelletRadiusFrom(size) {
      return clamp(1.8 + size * 0.75, 2.0, 12.0);
    }

    function puff(x, y, n = 10) {
      for (let i = 0; i < n; i++) {
        particles.push({
          x,
          y,
          vx: rand(-140, 140),
          vy: rand(-140, 140),
          life: rand(0.25, 0.6),
        });
      }
    }

    // ============================================================
    // 11 — FLEET CAP ENFORCEMENT
    // ============================================================
    function enforceFleetCap() {
      if (player.fleet <= SETTINGS.FLEET_MAX) return;
      player.fleet = SETTINGS.FLEET_MAX;
      LAW.counts.fleetCapBlocks++;
      lawThrottle("fleetcap", 450, 11, "FLEET", `CAP enforced → fleet=${player.fleet}`);
    }

    function syncFleet() {
      enforceFleetCap();

      while (followers.length < player.fleet) {
        followers.push({
          x: player.x + rand(-60, 60),
          y: player.y + rand(-60, 60),
          vx: 0,
          vy: 0,
          r: 8,
        });
      }
      while (followers.length > player.fleet) followers.pop();
      lawThrottle("fleet", 450, 11, "FLEET", "sync →", followers.length);
    }

    function updateFollowers(dt) {
      if (!followers.length) return;

      const sepDist = 26;
      const followDist = 68;
      const maxFSpd = player.maxSpeed * 0.92;
      const fAccel = 900;

      for (let i = 0; i < followers.length; i++) {
        const f = followers[i];

        const back = player.shipAngle + Math.PI;
        const side = i - (followers.length - 1) / 2;

        const tx =
          player.x +
          Math.cos(back) * followDist +
          Math.cos(back + Math.PI / 2) * (side * 22);
        const ty =
          player.y +
          Math.sin(back) * followDist +
          Math.sin(back + Math.PI / 2) * (side * 22);

        let ax = tx - f.x,
          ay = ty - f.y;
        const al = Math.hypot(ax, ay) || 1;
        ax /= al;
        ay /= al;

        let sx = 0,
          sy = 0;
        for (let j = 0; j < followers.length; j++) {
          if (j === i) continue;
          const o = followers[j];
          const dx = f.x - o.x,
            dy = f.y - o.y;
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < sepDist) {
            sx += dx / d;
            sy += dy / d;
          }
        }

        const fx = ax * 0.85 + sx * 0.55;
        const fy = ay * 0.85 + sy * 0.55;

        f.vx += fx * fAccel * dt;
        f.vy += fy * fAccel * dt;

        f.vx -= f.vx * 3.8 * dt;
        f.vy -= f.vy * 3.8 * dt;

        const sp = Math.hypot(f.vx, f.vy);
        if (sp > maxFSpd) {
          const k = maxFSpd / sp;
          f.vx *= k;
          f.vy *= k;
        }

        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }
    }

    function nearestEnemy(x, y, exclude = null) {
      let best = null;
      let bestD = Infinity;
      for (const e of enemies) {
        if (!e || e.hp <= 0) continue;
        if (exclude && e === exclude) continue;
        const d = dist2(x, y, e.x, e.y);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      return best;
    }

    function followersShoot() {
      if (!followers.length) return;
      const tgt = nearestEnemy(player.x, player.y);
      if (!tgt) return;

      for (let i = 0; i < followers.length; i++) {
        const f = followers[i];
        const side = i - (followers.length - 1) / 2;
        const a = player.shipAngle + side * 0.06;

        bullets.push({
          x: f.x + Math.cos(a) * (f.r + 2),
          y: f.y + Math.sin(a) * (f.r + 2),
          vx: Math.cos(a) * (player.bulletSpeed * 0.92) + f.vx * 0.1,
          vy: Math.sin(a) * (player.bulletSpeed * 0.92) + f.vy * 0.1,
          r: Math.max(2, player.bulletSize - 1),
          life: player.bulletLife * 0.95,
          pierce: Math.max(0, player.pierce - 1),
          ricochet: Math.max(0, player.ricochet - 1),
          dmg: player.baseDamage * player.fleetDmgMult,
          target: tgt,
          hasHit: false,
        });
      }
    }

    // ============================================================
    // 06 — BUFFS (fleet buff respects cap)
    // ============================================================
    const buffs = [];
    const BUFF_TIERS = [
      { tier: 1, weight: 72 },
      { tier: 2, weight: 22 },
      { tier: 3, weight: 5 },
      { tier: 4, weight: 1 },
    ];

    function pickTier() {
      const total = BUFF_TIERS.reduce((s, t) => s + t.weight, 0);
      let r = Math.random() * total;
      for (const t of BUFF_TIERS) {
        r -= t.weight;
        if (r <= 0) return t.tier;
      }
      return 1;
    }

    function safeFleetAdd(n) {
      const before = player.fleet;
      player.fleet = Math.min(SETTINGS.FLEET_MAX, player.fleet + n);
      if (player.fleet === before) {
        LAW.counts.fleetCapBlocks++;
        lawThrottle("fleet_add_block", 500, 11, "FLEET", `buff blocked by cap (${SETTINGS.FLEET_MAX})`);
        return false;
      }
      syncFleet();
      return true;
    }

    const BUFFS = [
      { tier: 2, name: "Fleet +1", pos: () => safeFleetAdd(1), neg: () => (player.spreadBase *= 1.08) },
      { tier: 3, name: "Fleet +2", pos: () => safeFleetAdd(2), neg: () => (player.spreadBase *= 1.10) },
      { tier: 2, name: "Fleet Damage", pos: () => (player.fleetDmgMult *= 1.22), neg: () => (player.fireRate *= 0.96) },
      { tier: 2, name: "Fleet ROF", pos: () => (player.fleetFireMult *= 1.16), neg: () => (player.baseDamage *= 0.96) },

      { tier: 1, name: "Armor Plating I", pos: () => (player.drFlat += 0.35), neg: () => (player.maxSpeed *= 0.97) },
      { tier: 2, name: "Armor Plating II", pos: () => (player.drFlat += 0.65), neg: () => (player.maxSpeed *= 0.96) },

      { tier: 1, name: "Hull Reinforce I", pos: () => { player.hpMax += 20; player.hp = Math.min(player.hp + 20, player.hpMax); }, neg: () => (player.fireRate *= 0.97) },
      { tier: 2, name: "Hull Reinforce II", pos: () => { player.hpMax += 35; player.hp = Math.min(player.hp + 35, player.hpMax); }, neg: () => (player.fireRate *= 0.96) },

      { tier: 1, name: "Damage Amp I", pos: () => (player.baseDamage *= 1.15), neg: () => (player.drPct = Math.max(0, player.drPct - 0.012)) },
      { tier: 2, name: "Overclock II", pos: () => (player.fireRate *= 1.20), neg: () => (player.drag *= 0.95) },

      { tier: 1, name: "Ballistics I", pos: () => (player.bulletSpeed *= 1.14), neg: () => (player.spreadBase *= 1.08) },
      { tier: 2, name: "Bigger Pellets II", pos: () => (player.bulletSize += 2), neg: () => (player.bulletSpeed *= 0.94) },
    ];

    function autoPickBuff() {
      const tier = pickTier();
      const pool = BUFFS.filter((b) => b.tier === tier);
      if (!pool.length) return;

      const chosen = pool[Math.floor(Math.random() * pool.length)];
      const ok = chosen.pos();
      chosen.neg();

      buffs.push({ name: `T${tier} ${chosen.name}${ok === false ? " (CAP)" : ""}`, apply() {} });
      LAW.counts.buffs++;
      law(6, "BUFF", `T${tier} ${chosen.name} (+) AND (-)`);
    }

    function maybeRandomBuffRoll(triggerLabel = "kill") {
      if (!SETTINGS.BUFF_RANDOM_ENABLED) return;

      const minutes = (performance.now() - state.startTime) / 60000;
      let p =
        SETTINGS.BUFF_ROLL_BASE_PER_KILL +
        minutes * SETTINGS.BUFF_ROLL_GAIN_PER_MIN +
        player.lvl * SETTINGS.BUFF_ROLL_GAIN_PER_LVL;

      p = clamp(p, 0, SETTINGS.BUFF_ROLL_CAP);

      LAW.counts.buffRolls++;
      if (Math.random() < p) {
        law(6, "BUFF", `ROLL SUCCESS p=${p.toFixed(2)} trigger=${triggerLabel}`);
        autoPickBuff();
      } else {
        lawThrottle("buff_fail", 280, 6, "BUFF", `roll fail p=${p.toFixed(2)} trigger=${triggerLabel}`);
      }
    }

    // ============================================================
    // XP / LEVEL
    // ============================================================
    function giveXP(amount) {
      player.xp += amount;
      while (player.xp >= player.xpNeed) {
        player.xp -= player.xpNeed;
        player.lvl++;
        player.xpNeed = Math.floor(player.xpNeed * 1.22 + 10);
        player.hp = Math.min(player.hpMax, player.hp + 18);
        law(8, "LEVEL", `Lvl Up → ${player.lvl} (xpNeed=${player.xpNeed})`);
      }
    }

    // ============================================================
    // SPAWN GATE (cap 100)
    // ============================================================
    function canSpawnEnemies() {
      if (enemies.length >= SETTINGS.MAX_ENEMIES_SPAWN_STOP) {
        LAW.counts.spawnBlocked++;
        lawThrottle(
          "spawn_stop",
          650,
          14,
          "SAFETY",
          `SPAWN STOP: enemies=${enemies.length} >= ${SETTINGS.MAX_ENEMIES_SPAWN_STOP}`
        );
        return false;
      }
      return true;
    }

    // ============================================================
    // ENEMY VOLLEY (kept from prior)
    // ============================================================
    function arcForShotLevel(lvl) {
      lvl = clamp(lvl, 1, SETTINGS.ENEMY_SHOTLEVEL_MAX);
      if (lvl <= 5) {
        const t = (lvl - 1) / 4;
        return t * Math.PI;
      } else {
        const t = (lvl - 5) / 5;
        return Math.PI + t * Math.PI;
      }
    }

    function fireEnemyBullet(x, y, ang, spd, size, dmg) {
      ebullets.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        r: size,
        dmg,
        life: 6.0,
      });
    }

    function enemyShoot(e) {
      const aim = angleTo(e.x, e.y, player.x, player.y);
      const sx = e.x + Math.cos(aim) * (e.r + 4);
      const sy = e.y + Math.sin(aim) * (e.r + 4);

      const lvl = clamp(e.shotLevel || 1, 1, SETTINGS.ENEMY_SHOTLEVEL_MAX);
      const count = lvl;
      const arc = arcForShotLevel(lvl);

      const wob = (e.floatSpeed || 0) * 0.0032;
      e.floatPhase = (e.floatPhase || 0) + 0.7;

      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
        const ang = aim + t * (arc * 0.5);
        const ang2 = ang + Math.sin((e.floatPhase || 0) + i * 0.7) * wob;
        fireEnemyBullet(sx, sy, ang2, e.bulletSpeed, e.bulletSize, e.bulletDmg);
      }

      LAW.counts.volleys++;
      lawThrottle(
        "volley",
        220,
        10,
        "VOLLEY",
        `lvl=${lvl} bullets=${count} arcDeg=${Math.round((arc * 180) / Math.PI)}`
      );
    }

    // ============================================================
    // DIFFICULTY + SCORE HP FACTOR
    // ============================================================
    function difficultyFactor(minutes, lvl) {
      const t = minutes + lvl * 0.18;
      return Math.pow(1 + t * 0.14, 1.15) + t * 0.02;
    }
    function scoreHpFactor(score) {
      const s = Math.min(score, SETTINGS.SCORE_HP_CAP);
      return 1 + Math.pow(s / 500, 0.70) * 0.22;
    }

    // ============================================================
    // SPAWN ENEMY (HP x100)
    // ============================================================
    function spawnEnemy() {
      if (!canSpawnEnemies()) return;

      const w = innerWidth;
      const h = innerHeight;
      const cx = camera.x;
      const cy = camera.y;

      const minutes = (performance.now() - state.startTime) / 60000;
      const diff = difficultyFactor(minutes, player.lvl);

      const roll = Math.random();
      let sizeBlocks = 1;
      if (roll > 0.75) sizeBlocks = 2;
      if (roll > 0.88) sizeBlocks = 3;
      if (roll > 0.94) sizeBlocks = 4;
      if (roll > 0.975) sizeBlocks = 5;
      if (roll > 0.992) sizeBlocks = 6;

      const basePad = 260;
      const pad = basePad + sizeBlocks * 150 + rand(0, 140);

      const side = Math.floor(Math.random() * 4);
      let x, y;
      if (side === 0) {
        x = cx + rand(-w / 2 - pad, w / 2 + pad);
        y = cy - h / 2 - pad;
      } else if (side === 1) {
        x = cx + w / 2 + pad;
        y = cy + rand(-h / 2 - pad, h / 2 + pad);
      } else if (side === 2) {
        x = cx + rand(-w / 2 - pad, w / 2 + pad);
        y = cy + h / 2 + pad;
      } else {
        x = cx - w / 2 - pad;
        y = cy + rand(-h / 2 - pad, h / 2 + pad);
      }

      const r = 10 + sizeBlocks * 8 + rand(-2, 2);

      const hpBase = 18 + minutes * 9 + player.lvl * 2.2;
      const sizeHP = Math.pow(1.62, sizeBlocks - 1);
      const sizeHP2 = 1 + sizeBlocks * sizeBlocks * 0.22;
      let hpMax = hpBase * sizeHP * sizeHP2 + sizeBlocks * sizeBlocks * 12;

      hpMax *= scoreHpFactor(state.score);
      hpMax *= Math.pow(diff, 0.22);

      // ✅ BUFF HP BY 100x
      hpMax *= SETTINGS.ENEMY_HP_MULT;

      const spdBase = 70 + minutes * 12 + player.lvl * 1.8;
      let spd = spdBase * (1.25 - 0.11 * sizeBlocks) + rand(-10, 15);

      const floatSpeed = rand(55, 210) * (1 + diff * 0.02);
      const floatAmp = rand(14, 44) * (1 + sizeBlocks * 0.08);

      let bulletSpeed = 250 + minutes * 10 + player.lvl * 2 + rand(-12, 20);
      const bulletSize = 3 + Math.floor(sizeBlocks / 2);
      let bulletDmg =
        (5.5 + minutes * 1.1 + player.lvl * 0.35) * (1 + 0.22 * (sizeBlocks - 1));

      let shotLevel =
        1 + Math.floor(diff * 0.45 + sizeBlocks * 0.75 + minutes * 0.22);
      shotLevel = clamp(shotLevel, 1, SETTINGS.ENEMY_SHOTLEVEL_MAX);

      spd *= rand(0.78, 1.30);
      bulletSpeed *= rand(0.92, 1.10);

      enemies.push({
        x,
        y,
        r,
        sizeBlocks,
        hp: hpMax,
        hpMax,

        spd,
        contactDmg: (12 + minutes * 2.2) * (1 + diff * 0.03),

        bulletSpeed,
        bulletSize,
        bulletDmg,

        shotCd: rand(0.25, 1.1),
        fireDelay: clamp(1.35 - minutes * 0.06 - player.lvl * 0.01, 0.16, 1.4),

        shotLevel,

        floatSpeed,
        floatAmp,
        floatPhase: rand(0, Math.PI * 2),
        status: null,
      });

      LAW.counts.spawns++;
      lawThrottle(
        "spawn",
        170,
        9,
        "SPAWN",
        `+enemy size=${sizeBlocks} lvl=${shotLevel} hp=${hpMax.toFixed(0)} enemies=${enemies.length}/${SETTINGS.MAX_ENEMIES_SPAWN_STOP}`
      );
    }

    function spawnOnKill(count) {
      if (!canSpawnEnemies()) return;
      for (let i = 0; i < count; i++) spawnEnemy();
    }

    function killEnemy(e, idxHint = -1) {
      if (!e) return;

      let idx = -1;
      if (idxHint >= 0 && idxHint < enemies.length && enemies[idxHint] === e) idx = idxHint;
      else idx = enemies.indexOf(e);
      if (idx === -1) return;

      LAW.counts.kills++;

      const sb = e.sizeBlocks || 1;
      state.score += 10 + sb * 7;
      giveXP(7 + Math.random() * 10 + sb * 4);

      maybeRandomBuffRoll("kill");
      spawnOnKill(SETTINGS.SPAWN_PER_KILL);

      enemies.splice(idx, 1);
    }

    // ============================================================
    // PLAYER SHOOT
    // ============================================================
    function shoot() {
      const tgt = nearestEnemy(player.x, player.y);
      if (!tgt) return;

      const pelletCount = pelletCountFrom(player.bulletSpeed, player.bulletSize);
      const spread = pelletSpreadFrom(player.bulletSpeed, player.bulletSize) * player.spreadBase;
      const pr = pelletRadiusFrom(player.bulletSize);

      for (let i = 0; i < pelletCount; i++) {
        const t = pelletCount === 1 ? 0 : (i / (pelletCount - 1)) * 2 - 1;
        const a = player.shipAngle + t * spread;

        bullets.push({
          x: player.x + Math.cos(a) * player.r,
          y: player.y + Math.sin(a) * player.r,
          vx: Math.cos(a) * player.bulletSpeed + player.vx * 0.15,
          vy: Math.sin(a) * player.bulletSpeed + player.vy * 0.15,
          r: pr,
          life: player.bulletLife,
          pierce: player.pierce,
          ricochet: player.ricochet,
          dmg: player.baseDamage,
          target: tgt,
          hasHit: false,
        });
      }
    }

    // ============================================================
    // RESET
    // ============================================================
    function resetRun() {
      LAW.counts.resets++;
      law(12, "RESET", "Run reset invoked");

      state.score = 0;
      state.startTime = performance.now();

      bullets.length = 0;
      ebullets.length = 0;
      enemies.length = 0;
      particles.length = 0;

      player.x = 0;
      player.y = 0;
      player.vx = 0;
      player.vy = 0;
      player.shipAngle = 0;

      camera.x = 0;
      camera.y = 0;

      player.hpMax = SETTINGS.PLAYER_HP_BASE;
      player.hp = SETTINGS.PLAYER_HP_BASE;
      player.xp = 0;
      player.xpNeed = 60;
      player.lvl = 1;

      player.drFlat = SETTINGS.PLAYER_DR_FLAT_BASE;
      player.drPct = SETTINGS.PLAYER_DR_PCT_BASE;
      player.iFrame = 0;
      player.regen = 0.35;

      player.fleet = 0;
      followers.length = 0;
      buffs.length = 0;

      aimLock = false;
      fireCooldown = 0;
      spawnTimer = 0;
      last = performance.now();
    }

    // ============================================================
    // HUD + DRAW (minimal)
    // ============================================================
    function updateHud() {
      if (hpbar) hpbar.style.width = `${clamp(player.hp / player.hpMax, 0, 1) * 100}%`;
      if (xpbar) xpbar.style.width = `${clamp(player.xp / player.xpNeed, 0, 1) * 100}%`;
      if (lvlEl) lvlEl.textContent = `Lvl ${player.lvl}`;
      if (scoreEl) scoreEl.textContent = `Score ${Math.floor(state.score)}`;
      if (timeEl) timeEl.textContent = `${Math.floor((performance.now() - state.startTime) / 1000)}s`;
      if (dmgEl) dmgEl.textContent = `DMG ${player.baseDamage.toFixed(0)}`;
      if (rofEl) rofEl.textContent = `ROF ${player.fireRate.toFixed(1)}/s`;
      if (spdEl) spdEl.textContent = `SPD ${Math.hypot(player.vx, player.vy).toFixed(0)}`;

      if (buffsEl) {
        const counts = new Map();
        for (const b of buffs) counts.set(b.name, (counts.get(b.name) || 0) + 1);
        buffsEl.innerHTML =
          [...counts.entries()]
            .slice(-12)
            .map(([name, c]) => `• ${name}${c > 1 ? ` x${c}` : ""}`)
            .join("<br>") || `<span style="opacity:.75">No buffs yet.</span>`;
      }
    }

    function draw() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.fillStyle = "rgba(7,10,14,1)";
      ctx.fillRect(0, 0, innerWidth, innerHeight);

      ctx.save();
      ctx.translate(innerWidth / 2 - camera.x, innerHeight / 2 - camera.y);

      for (const e of enemies) {
        if (!e) continue;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,110,110,0.88)";
        ctx.fill();
      }

      for (const b of ebullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,190,90,0.95)";
        ctx.fill();
      }

      for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fill();
      }

      // ship
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.shipAngle);
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -10);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fillStyle = "rgba(200,235,255,0.95)";
      ctx.fill();
      ctx.restore();

      ctx.restore();
    }

    // ============================================================
    // MAIN LOOP (trimmed for this patch)
    // ============================================================
    function step(now) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      LAW.beats++;

      if (player.regen > 0) player.hp = Math.min(player.hpMax, player.hp + player.regen * dt);
      if (player.iFrame > 0) player.iFrame -= dt;

      // movement
      let ax = 0, ay = 0;
      if (keys.has("a")) ax -= 1;
      if (keys.has("d")) ax += 1;
      if (keys.has("w")) ay -= 1;
      if (keys.has("s")) ay += 1;

      if (ax !== 0 || ay !== 0) {
        const len = Math.hypot(ax, ay);
        ax /= len;
        ay /= len;
      }

      player.vx += ax * player.thrust * dt;
      player.vy += ay * player.thrust * dt;
      player.vx -= player.vx * player.drag * dt;
      player.vy -= player.vy * player.drag * dt;

      const sp2 = Math.hypot(player.vx, player.vy);
      if (sp2 > player.maxSpeed) {
        const k = player.maxSpeed / sp2;
        player.vx *= k;
        player.vy *= k;
      }

      player.x += player.vx * dt;
      player.y += player.vy * dt;
      camera.x = player.x;
      camera.y = player.y;

      // aim
      const tgt = nearestEnemy(player.x, player.y);
      if (tgt) player.shipAngle = angleTo(player.x, player.y, tgt.x, tgt.y);
      else if (sp2 > 2) player.shipAngle = Math.atan2(player.vy, player.vx);

      // shoot
      fireCooldown -= dt;
      const period = 1 / Math.max(0.5, player.fireRate);
      if (fireCooldown <= 0) {
        shoot();
        fireCooldown = period;
      }

      // spawn over time
      if (SETTINGS.SPAWN_OVER_TIME) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          if (canSpawnEnemies()) spawnEnemy();
          spawnTimer = 0.45 + rand(0, 0.35);
        }
      }

      // bullets move (simple)
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (!b.hasHit) {
          if (!b.target || b.target.hp <= 0) b.target = nearestEnemy(b.x, b.y);
          if (b.target) {
            const ang = angleTo(b.x, b.y, b.target.x, b.target.y);
            const spdB = Math.hypot(b.vx, b.vy) || player.bulletSpeed;
            b.vx = Math.cos(ang) * spdB;
            b.vy = Math.sin(ang) * spdB;
          }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0) bullets.splice(i, 1);
      }

      // enemies move + shoot
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (!e) continue;

        const a = angleTo(e.x, e.y, player.x, player.y);
        const perp = a + Math.PI / 2;

        e.floatPhase += (e.floatSpeed * 0.0032) * dt * 60;
        const drift = Math.sin(e.floatPhase) * (e.floatAmp || 28);

        e.x += (Math.cos(a) * e.spd + Math.cos(perp) * drift * 0.35) * dt;
        e.y += (Math.sin(a) * e.spd + Math.sin(perp) * drift * 0.35) * dt;

        e.shotCd -= dt;
        if (e.shotCd <= 0) {
          enemyShoot(e);
          e.shotCd = e.fireDelay * rand(0.75, 1.25);
        }
      }

      // enemy bullets hit player
      for (let i = ebullets.length - 1; i >= 0; i--) {
        const b = ebullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;

        const rr = b.r + player.r;
        if (dist2(b.x, b.y, player.x, player.y) < rr * rr) {
          applyDamageToPlayer(b.dmg);
          puff(b.x, b.y, 8);
          ebullets.splice(i, 1);
          if (player.hp <= 0) {
            resetRun();
            break;
          }
          continue;
        }
        if (b.life <= 0) ebullets.splice(i, 1);
      }

      // bullets hit enemies
      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const b = bullets[bi];
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
          const e = enemies[ei];
          const rr = e.r + b.r;
          if (dist2(e.x, e.y, b.x, b.y) < rr * rr) {
            LAW.counts.hits++;
            e.hp -= b.dmg;
            b.hasHit = true;

            if (e.hp <= 0) killEnemy(e, ei);

            if (b.ricochet > 0) {
              b.ricochet--;
              const next = nearestEnemy(b.x, b.y, e);
              if (next) {
                LAW.counts.ricochets++;
                b.target = next;
                b.hasHit = false;
              } else {
                bullets.splice(bi, 1);
              }
            } else {
              bullets.splice(bi, 1);
            }
            break;
          }
        }
      }

      updateHud();
      draw();

      renderLawBook(
        `Entities: enemies=${enemies.length}/${SETTINGS.MAX_ENEMIES_SPAWN_STOP} bullets=${bullets.length} ebullets=${ebullets.length} followers=${followers.length}\n` +
          `EnemyHPx=${SETTINGS.ENEMY_HP_MULT} | Fleet=${player.fleet}/${SETTINGS.FLEET_MAX}\n`
      );

      requestAnimationFrame(step);
    }

    law(1, "BOOT", "START: requestAnimationFrame(step)");
    updateHud();
    requestAnimationFrame(step);
  } catch (err) {
    setFatal(err);
  }
})();