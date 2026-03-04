(() => {
  // ===============================
  // SCHIZO DEBUG MODE (ON-SCREEN)
  // ===============================
  const DBG = {
    enabled: true,
    lines: [],
    max: 28,
    beats: 0,
    fps: 0,
    frameCount: 0,
    frameT0: performance.now(),
    error: null,
  };

  function dbg(...msg) {
    if (!DBG.enabled) return;
    const s = msg.map(x => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
    DBG.lines.push(`[${new Date().toLocaleTimeString()}] ${s}`);
    if (DBG.lines.length > DBG.max) DBG.lines.shift();
    console.log("%cDBG", "color:#8ef", s);
  }

  function ensureDebugOverlay() {
    let el = document.getElementById("__dbg_overlay__");
    if (el) return el;
    el = document.createElement("pre");
    el.id = "__dbg_overlay__";
    el.style.position = "fixed";
    el.style.left = "10px";
    el.style.bottom = "10px";
    el.style.width = "460px";
    el.style.maxHeight = "55vh";
    el.style.overflow = "auto";
    el.style.padding = "10px";
    el.style.background = "rgba(0,0,0,0.72)";
    el.style.color = "rgba(230,245,255,0.95)";
    el.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    el.style.fontSize = "11px";
    el.style.lineHeight = "1.25";
    el.style.borderRadius = "12px";
    el.style.border = "1px solid rgba(180,220,255,0.22)";
    el.style.zIndex = "999999";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
    return el;
  }

  function setFatal(err) {
    DBG.error = err;
    console.error(err);
    const el = ensureDebugOverlay();
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    el.style.background = "rgba(80,0,0,0.85)";
    el.style.border = "1px solid rgba(255,150,150,0.55)";
    el.textContent =
      "🔥 FATAL ERROR (GAME DID NOT START)\n\n" +
      msg +
      "\n\n---\n" +
      DBG.lines.join("\n");
  }

  window.addEventListener("error", (e) => setFatal(e.error || e.message || e));
  window.addEventListener("unhandledrejection", (e) => setFatal(e.reason || e));

  function sanityCheckElement(id, optional = false) {
    const el = document.getElementById(id);
    if (!el && !optional) dbg(`❌ MISSING ELEMENT: #${id}`);
    if (el) dbg(`✅ FOUND ELEMENT: #${id}`);
    return el;
  }

  function renderDebugOverlay(extra = "") {
    const el = ensureDebugOverlay();
    if (DBG.error) return;

    const now = performance.now();
    DBG.frameCount++;
    if (now - DBG.frameT0 >= 500) {
      DBG.fps = Math.round((DBG.frameCount * 1000) / (now - DBG.frameT0));
      DBG.frameCount = 0;
      DBG.frameT0 = now;
    }

    el.textContent =
      "🧠 SCHIZO DEBUG MODE\n" +
      `FPS: ${DBG.fps} | Beats: ${DBG.beats}\n` +
      extra +
      "\n---\n" +
      DBG.lines.join("\n");
  }

  // ===============================
  // GAME BOOT
  // ===============================
  try {
    dbg("BOOT: game.js loaded, entering init...");

    // ===== Canvas setup =====
    const canvas = sanityCheckElement("c");
    if (!canvas) throw new Error('Canvas not found. HTML must have: <canvas id="c"></canvas>');

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context 2D failed.");

    function resize() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(innerWidth * dpr);
      canvas.height = Math.floor(innerHeight * dpr);
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dbg("RESIZE:", { w: innerWidth, h: innerHeight, dpr });
    }
    addEventListener("resize", resize);
    resize();

    // ===== HUD sanity checks (optional) =====
    const hpbar  = sanityCheckElement("hpbar", true);
    const xpbar  = sanityCheckElement("xpbar", true);
    const lvlEl  = sanityCheckElement("lvl", true);
    const scoreEl= sanityCheckElement("score", true);
    const timeEl = sanityCheckElement("time", true);
    const dmgEl  = sanityCheckElement("dmg", true);
    const rofEl  = sanityCheckElement("rof", true);
    const spdEl  = sanityCheckElement("spd", true);
    const buffsEl= sanityCheckElement("buffs", true);

    // ===== Input =====
    const keys = new Set();
    addEventListener("keydown", (e) => {
      keys.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key)) e.preventDefault();
    });
    addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
    dbg("INPUT: listeners attached");

    // ===== Utilities =====
    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const dist2 = (ax, ay, bx, by) => {
      const dx = ax - bx, dy = ay - by;
      return dx * dx + dy * dy;
    };
    function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

    // ===== Game state =====
    const state = { score: 0, startTime: performance.now() };
    const camera = { x: 0, y: 0 };

    // ===============================
    // SCALING SETTINGS (INFINITE)
    // ===============================
    const SCALE = {
      hpPow: 1.22,
      dmgPow: 1.10,
      spdPow: 1.06,
      shotPow: 0.96,
      spdRandMin: 0.75,
      spdRandMax: 1.35,
    };

    // ===============================
    // BUFF PER KILL SETTINGS
    // ===============================
    const BUFF_PER_KILL = true;
    const BUFF_CHANCE = 1.0;
    const BUFF_ON_CARD_ONLY = false;
    const BUFF_RANDOM_MULT = true;

    // ===============================
    // SPAWN PER KILL SETTINGS
    // ===============================
    const SPAWN_PER_KILL = 3;

    const player = {
      x: 0, y: 0,
      vx: 0, vy: 0,
      r: 14,

      hp: 100, hpMax: 100,
      xp: 0, xpNeed: 50, lvl: 1,

      shipAngle: 0,

      thrust: 1800,
      maxSpeed: 420,
      drag: 4.2,

      baseDamage: 10,
      critChance: 0.05,
      critMult: 2.0,

      element: "none",
      elementDmg: 0,
      elementRadius: 0,

      explosive: false,
      exploMult: 0.55,
      exploRadius: 0,

      fleet: 0,
      fleetDmgMult: 0.35,
      fleetFireMult: 0.75,

      fireRate: 6.0,
      bulletSpeed: 560,
      bulletLife: 1.0,
      bulletSize: 4,

      multishot: 1,
      spread: 0.12,
      pierce: 0,

      regen: 0.0,
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

    function puff(x, y, n = 10) {
      for (let i = 0; i < n; i++) {
        particles.push({ x, y, vx: rand(-140, 140), vy: rand(-140, 140), life: rand(0.25, 0.6) });
      }
    }

    function syncFleet() {
      while (followers.length < player.fleet) {
        followers.push({
          x: player.x + rand(-60, 60),
          y: player.y + rand(-60, 60),
          vx: 0, vy: 0,
          r: 8,
        });
      }
      while (followers.length > player.fleet) followers.pop();
      dbg("FLEET:", followers.length);
    }

    function applyStatus(e, type, a, t) {
      e.status ||= {};
      const s = e.status;

      if (type === "burn") {
        s.burnT = (s.burnT || 0) + t;
        s.burnDps = clamp((s.burnDps || 0) + a, 0, 999999);
      } else if (type === "poison") {
        s.poiT = (s.poiT || 0) + t;
        s.poiDps = clamp((s.poiDps || 0) + a, 0, 999999);
      } else if (type === "slow") {
        s.slowT = Math.max(s.slowT || 0, t);
        s.slowPct = clamp(Math.max(s.slowPct || 0, a), 0, 0.75);
      }
    }

    // ===== Buff system =====
    const buffs = [];
    const BUFFS = [
      { name: "+Damage", apply() { player.baseDamage *= 1.20; } },
      { name: "+Fire Rate", apply() { player.fireRate *= 1.18; } },
      { name: "Multishot", apply() { player.multishot += 1; player.spread *= 1.08; } },
      { name: "Pierce", apply() { player.pierce += 1; } },
      { name: "Criticals", apply() { player.critChance = clamp(player.critChance + 0.06, 0, 0.75); } },
      { name: "Crit Damage", apply() { player.critMult += 0.35; } },
      { name: "Bullet Speed", apply() { player.bulletSpeed *= 1.18; } },
      { name: "Bigger Bullets", apply() { player.bulletSize += 1; } },
      { name: "Bullet Life+", apply() { player.bulletLife *= 1.15; } },
      { name: "Regen", apply() { player.regen += 0.6; } },
      { name: "Max HP", apply() { player.hpMax += 20; player.hp = Math.min(player.hp + 20, player.hpMax); } },
      { name: "Thrusters", apply() { player.thrust *= 1.20; player.maxSpeed *= 1.10; } },
      { name: "Less Drift", apply() { player.drag *= 1.12; } },
      { name: "Overclock", apply() { player.fireRate *= 1.10; player.thrust *= 1.06; } },

      { name: "Explosive Rounds", apply() { player.explosive = true; player.exploRadius += 40; } },
      { name: "Bigger Boom", apply() { player.explosive = true; player.exploRadius += 24; player.exploMult += 0.10; } },
      { name: "Blast Mastery", apply() { player.explosive = true; player.exploMult += 0.14; } },

      { name: "Element: Fire", apply() { player.element = "fire"; player.elementDmg += 3.5; player.elementRadius += 10; } },
      { name: "Element: Ice", apply() { player.element = "ice"; player.elementDmg += 2.2; player.elementRadius += 18; } },
      { name: "Element: Shock", apply() { player.element = "shock"; player.elementDmg += 2.8; player.elementRadius += 36; } },
      { name: "Element: Poison", apply() { player.element = "poison"; player.elementDmg += 3.0; player.elementRadius += 14; } },
      { name: "Element Power", apply() { player.elementDmg += 2.6; } },
      { name: "Element Radius", apply() { player.elementRadius += 18; } },

      { name: "Fleet +1", apply() { player.fleet += 1; syncFleet(); } },
      { name: "Fleet +2", apply() { player.fleet += 2; syncFleet(); } },
      { name: "Fleet Damage", apply() { player.fleetDmgMult *= 1.22; } },
      { name: "Fleet ROF", apply() { player.fleetFireMult *= 1.16; } },
    ];

    function autoPickBuff() {
      const chosen = BUFFS[Math.floor(Math.random() * BUFFS.length)];

      let times = 1;
      if (BUFF_RANDOM_MULT) {
        const r = Math.random();
        if (r > 0.94) times = 3;
        else if (r > 0.78) times = 2;
      }

      for (let i = 0; i < times; i++) chosen.apply();
      buffs.push({ name: `${chosen.name}${times > 1 ? ` x${times}` : ""}`, apply(){} });
      dbg("BUFF:", chosen.name, "x", times);
    }

    function maybeBuffOnKill(e) {
      if (!BUFF_PER_KILL) return;
      if (BUFF_ON_CARD_ONLY && !e.isCard) return;
      if (Math.random() > BUFF_CHANCE) return;
      autoPickBuff();
    }

    // ===============================
    // ENEMY CARD SYSTEM
    // ===============================
    const CARDS = [
      { name: "DMG",    buff: () => { player.baseDamage *= 1.25; } },
      { name: "ROF",    buff: () => { player.fireRate *= 1.20; } },
      { name: "MULTI",  buff: () => { player.multishot += 1; player.spread *= 1.08; } },
      { name: "PIERCE", buff: () => { player.pierce += 1; } },
      { name: "CRIT%",  buff: () => { player.critChance = clamp(player.critChance + 0.07, 0, 0.85); } },
      { name: "CRITx",  buff: () => { player.critMult += 0.40; } },
      { name: "BSPD",   buff: () => { player.bulletSpeed *= 1.18; } },
      { name: "BSIZE",  buff: () => { player.bulletSize += 1; } },
      { name: "REGEN",  buff: () => { player.regen += 0.7; } },
      { name: "HP+",    buff: () => { player.hpMax += 25; player.hp = Math.min(player.hp + 25, player.hpMax); } },
      { name: "THRUST", buff: () => { player.thrust *= 1.20; player.maxSpeed *= 1.10; } },
    ];

    function pickCard() { return CARDS[Math.floor(Math.random() * CARDS.length)]; }
    function cardTierFrom(minutes, lvl) { return 1 + Math.floor(minutes * 0.9 + lvl * 0.25); }
    function cardDropChance(minutes, lvl) { return clamp(0.06 + minutes * 0.01 + lvl * 0.002, 0.06, 0.22); }

    function applyCardReward(e) {
      if (!e || !e.card) return;
      e.card.buff();
      buffs.push({ name: `Card ${e.card.name} T${e.cardTier}`, apply(){} });
      dbg("🃏 CARD CLAIMED:", e.card.name, "Tier", e.cardTier);
      player.hp = Math.min(player.hpMax, player.hp + 6 + e.cardTier * 0.2);
    }

    function giveXP(amount) {
      player.xp += amount;
      while (player.xp >= player.xpNeed) {
        player.xp -= player.xpNeed;
        player.lvl++;
        player.xpNeed = Math.floor(player.xpNeed * 1.25 + 8);
        player.hp = Math.min(player.hpMax, player.hp + 12);
      }
    }

    function nearestEnemy(x, y) {
      let best = null;
      let bestD = Infinity;
      for (const e of enemies) {
        const d = dist2(x, y, e.x, e.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      return best;
    }

    // ✅ spawn 3 per kill
    function spawnOnKill(count = SPAWN_PER_KILL) {
      for (let i = 0; i < count; i++) spawnEnemy();
    }

    function killEnemy(e, idxHint = -1) {
      if (!e) return;

      let idx = -1;
      if (idxHint >= 0 && idxHint < enemies.length && enemies[idxHint] === e) idx = idxHint;
      else idx = enemies.indexOf(e);

      if (idx === -1) return;

      maybeBuffOnKill(e);

      const sb = e.sizeBlocks || 1;
      state.score += 10 + sb * 6;
      giveXP(7 + Math.random() * 10 + sb * 3);

      if (e.isCard) applyCardReward(e);

      // ✅ SPAWN 3 PER KILL (cap so it won't explode into 10k enemies)
      spawnOnKill(SPAWN_PER_KILL);

      enemies.splice(idx, 1);
    }

    function dealAreaDamage(cx, cy, radius, dmg) {
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const r = radius + e.r;
        if (dist2(cx, cy, e.x, e.y) <= r * r) {
          e.hp -= dmg;
          puff(e.x, e.y, 3);
          if (e.hp <= 0) killEnemy(e, i);
        }
      }
    }

    function chainShock(fromEnemy, baseDmg, range, chains) {
      let cur = fromEnemy;
      for (let c = 0; c < chains; c++) {
        let best = null, bestD = Infinity;
        for (const e of enemies) {
          if (e === cur) continue;
          const d = dist2(cur.x, cur.y, e.x, e.y);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (!best) break;
        if (Math.sqrt(bestD) > range) break;

        best.hp -= baseDmg * 0.65;
        puff(best.x, best.y, 6);
        cur = best;
      }
    }

    // ===== followers =====
    function followersShoot() {
      if (!followers.length) return;
      const tgt = nearestEnemy(player.x, player.y);
      if (!tgt) return;

      const aim = player.shipAngle;

      for (let i = 0; i < followers.length; i++) {
        const f = followers[i];
        const side = (i - (followers.length - 1) / 2);
        const a = aim + side * 0.06;

        bullets.push({
          x: f.x + Math.cos(a) * (f.r + 2),
          y: f.y + Math.sin(a) * (f.r + 2),
          vx: Math.cos(a) * (player.bulletSpeed * 0.92) + f.vx * 0.10,
          vy: Math.sin(a) * (player.bulletSpeed * 0.92) + f.vy * 0.10,
          r: Math.max(2, player.bulletSize - 1),
          life: player.bulletLife * 0.95,
          pierce: Math.max(0, player.pierce - 1),
          dmg: player.baseDamage * player.fleetDmgMult,
          target: tgt,

          element: player.element,
          elementDmg: player.elementDmg,
          elementRadius: player.elementRadius,
          explosive: player.explosive,
          exploMult: player.exploMult,
          exploRadius: player.exploRadius,
        });
      }
    }

    function updateFollowers(dt) {
      if (!followers.length) return;

      const sepDist = 26;
      const followDist = 66;
      const maxFSpd = player.maxSpeed * 0.92;
      const fAccel = 900;

      for (let i = 0; i < followers.length; i++) {
        const f = followers[i];

        const back = player.shipAngle + Math.PI;
        const side = (i - (followers.length - 1) / 2);

        const tx = player.x + Math.cos(back) * followDist + Math.cos(back + Math.PI / 2) * (side * 22);
        const ty = player.y + Math.sin(back) * followDist + Math.sin(back + Math.PI / 2) * (side * 22);

        let ax = tx - f.x, ay = ty - f.y;
        const al = Math.hypot(ax, ay) || 1;
        ax /= al; ay /= al;

        let sx = 0, sy = 0;
        for (let j = 0; j < followers.length; j++) {
          if (j === i) continue;
          const o = followers[j];
          const dx = f.x - o.x, dy = f.y - o.y;
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < sepDist) { sx += dx / d; sy += dy / d; }
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
          f.vx *= k; f.vy *= k;
        }

        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }
    }

    // ===== Enemy bullets =====
    function fireEnemyBullet(x, y, ang, spd, size, dmg) {
      ebullets.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        r: size,
        dmg,
        life: 6.0
      });
    }

    function enemyShoot(e) {
      const ang = angleTo(e.x, e.y, player.x, player.y);
      const sx = e.x + Math.cos(ang) * (e.r + 4);
      const sy = e.y + Math.sin(ang) * (e.r + 4);

      if (e.pattern === "sniper") {
        fireEnemyBullet(sx, sy, ang, e.bulletSpeed * 1.15, e.bulletSize, e.bulletDmg);
      } else if (e.pattern === "cannon") {
        fireEnemyBullet(sx, sy, ang, e.bulletSpeed * 0.65, e.bulletSize + 2, e.bulletDmg * 1.6);
      } else if (e.pattern === "triple") {
        const spread = 0.22;
        fireEnemyBullet(sx, sy, ang - spread, e.bulletSpeed, e.bulletSize, e.bulletDmg * 0.9);
        fireEnemyBullet(sx, sy, ang, e.bulletSpeed, e.bulletSize, e.bulletDmg * 0.9);
        fireEnemyBullet(sx, sy, ang + spread, e.bulletSpeed, e.bulletSize, e.bulletDmg * 0.9);
      } else if (e.pattern === "burst") {
        const spd = e.bulletSpeed * 0.95;
        fireEnemyBullet(sx, sy, ang, spd, e.bulletSize, e.bulletDmg * 0.75);
        fireEnemyBullet(sx, sy, ang + rand(-0.06, 0.06), spd, e.bulletSize, e.bulletDmg * 0.75);
        fireEnemyBullet(sx, sy, ang + rand(-0.06, 0.06), spd, e.bulletSize, e.bulletDmg * 0.75);
      } else if (e.pattern === "fan") {
        const count = 5 + Math.floor(e.r / 18);
        const cone = 0.65;
        for (let i = 0; i < count; i++) {
          const t = (count === 1) ? 0 : (i / (count - 1)) * 2 - 1;
          const a = ang + t * cone * 0.5;
          fireEnemyBullet(sx, sy, a, e.bulletSpeed * 0.9, e.bulletSize, e.bulletDmg * 0.6);
        }
      }
    }

    // ===============================
    // INFINITE SCALING CURVE
    // ===============================
    function difficultyFactor(minutes, lvl) {
      const t = minutes + lvl * 0.18;
      return Math.pow(1 + t * 0.14, 1.15) + t * 0.02;
    }

    // ===============================
    // SPAWN ENEMY
    // ===============================
    function spawnEnemy() {
      const w = innerWidth;
      const h = innerHeight;
      const cx = camera.x;
      const cy = camera.y;

      const minutes = (performance.now() - state.startTime) / 60000;
      const lvl = player.lvl;
      const diff = difficultyFactor(minutes, lvl);

      const isCard = Math.random() < cardDropChance(minutes, lvl);
      const cardTier = isCard ? cardTierFrom(minutes, lvl) : 0;
      const card = isCard ? pickCard() : null;

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
      if (side === 0) { x = cx + rand(-w / 2 - pad, w / 2 + pad); y = cy - h / 2 - pad; }
      else if (side === 1) { x = cx + w / 2 + pad; y = cy + rand(-h / 2 - pad, h / 2 + pad); }
      else if (side === 2) { x = cx + rand(-w / 2 - pad, w / 2 + pad); y = cy + h / 2 + pad; }
      else { x = cx - w / 2 - pad; y = cy + rand(-h / 2 - pad, h / 2 + pad); }

      const r = 10 + sizeBlocks * 8 + rand(-2, 2);

      // ✅ HP scales with size HARD
      const hpBase = 14 + minutes * 9 + lvl * 2.0;
      const sizeHP = Math.pow(1.55, sizeBlocks - 1);
      const sizeHP2 = 1 + (sizeBlocks * sizeBlocks) * 0.18;
      let hpMax = hpBase * sizeHP * sizeHP2 + (sizeBlocks * sizeBlocks * 10);

      const spdBase = 70 + minutes * 12 + lvl * 1.8;
      let spd = spdBase * (1.25 - 0.11 * sizeBlocks) + rand(-10, 15);

      const patternsSmall = ["sniper", "triple"];
      const patternsMed = ["sniper", "triple", "burst", "cannon"];
      const patternsBig = ["triple", "burst", "cannon", "fan"];
      const pool = sizeBlocks <= 2 ? patternsSmall : (sizeBlocks <= 4 ? patternsMed : patternsBig);
      const pattern = pool[Math.floor(Math.random() * pool.length)];

      let dmg = (4 + minutes * 0.9 + lvl * 0.25) * (1 + 0.28 * (sizeBlocks - 1));
      let bulletSpeed = 220 + minutes * 10 + lvl * 2 + (pattern === "sniper" ? 180 : 0);
      let bulletSize = (pattern === "cannon") ? (6 + sizeBlocks * 2) : (3 + Math.floor(sizeBlocks / 2));
      let fireDelay = clamp(1.4 - minutes * 0.06 - lvl * 0.01, 0.35, 1.4) * (pattern === "burst" ? 1.2 : 1.0);

      // infinite scaling
      hpMax *= Math.pow(diff, SCALE.hpPow * 0.18);
      dmg   *= Math.pow(diff, SCALE.dmgPow * 0.13);
      spd   *= Math.pow(diff, SCALE.spdPow * 0.06);
      fireDelay *= Math.pow(diff, (1 - SCALE.shotPow) * 0.10);
      fireDelay = clamp(fireDelay, 0.18, 1.6);

      // speed randomizer per enemy
      spd *= rand(SCALE.spdRandMin, SCALE.spdRandMax);
      bulletSpeed *= rand(0.92, 1.10);

      // card scaling
      if (isCard) {
        hpMax *= (1 + cardTier * 0.35);
        dmg *= (1 + cardTier * 0.25);
      }

      enemies.push({
        x, y, vx: 0, vy: 0,
        r, sizeBlocks,
        hp: hpMax, hpMax,
        spd,
        contactDmg: (10 + minutes * 2) * (1 + diff * 0.03),
        pattern,
        shotCd: rand(0.2, 1.0),
        fireDelay,
        bulletSpeed,
        bulletSize,
        bulletDmg: dmg,
        isCard,
        cardTier,
        card,
      });
    }

    // ===== Shoot (player) =====
    function shoot() {
      const tgt = nearestEnemy(player.x, player.y);
      if (!tgt) return;

      const aim = player.shipAngle;
      const count = player.multishot;
      const spread = player.spread;

      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
        const a = aim + t * spread;

        bullets.push({
          x: player.x + Math.cos(a) * player.r,
          y: player.y + Math.sin(a) * player.r,
          vx: Math.cos(a) * player.bulletSpeed + player.vx * 0.15,
          vy: Math.sin(a) * player.bulletSpeed + player.vy * 0.15,
          r: player.bulletSize,
          life: player.bulletLife,
          pierce: player.pierce,
          dmg: player.baseDamage,
          target: tgt,

          element: player.element,
          elementDmg: player.elementDmg,
          elementRadius: player.elementRadius,
          explosive: player.explosive,
          exploMult: player.exploMult,
          exploRadius: player.exploRadius,
        });
      }
    }

    function updateHud() {
      if (hpbar) hpbar.style.width = `${clamp(player.hp / player.hpMax, 0, 1) * 100}%`;
      if (xpbar) xpbar.style.width = `${clamp(player.xp / player.xpNeed, 0, 1) * 100}%`;
      if (lvlEl) lvlEl.textContent = `Lvl ${player.lvl}`;
      if (scoreEl) scoreEl.textContent = `Score ${Math.floor(state.score)}`;
      if (timeEl) timeEl.textContent = `${Math.floor((performance.now() - state.startTime)/1000)}s`;
      if (dmgEl) dmgEl.textContent = `DMG ${player.baseDamage.toFixed(0)}`;
      if (rofEl) rofEl.textContent = `ROF ${player.fireRate.toFixed(1)}/s`;
      if (spdEl) spdEl.textContent = `SPD ${Math.hypot(player.vx, player.vy).toFixed(0)}`;

      if (buffsEl) {
        const counts = new Map();
        for (const b of buffs) counts.set(b.name, (counts.get(b.name) || 0) + 1);
        buffsEl.innerHTML = [...counts.entries()]
          .slice(-12)
          .map(([name, c]) => `• ${name}${c > 1 ? ` x${c}` : ""}`)
          .join("<br>") || `<span style="opacity:.75">No buffs yet.</span>`;
      }
    }

    function drawGrid() {
      const spacing = 64;
      const ox = (camera.x * 0.15) % spacing;
      const oy = (camera.y * 0.15) % spacing;

      ctx.globalAlpha = 0.08;
      ctx.lineWidth = 1;
      ctx.beginPath();

      const left = camera.x - innerWidth / 2 - spacing;
      const right = camera.x + innerWidth / 2 + spacing;
      const top = camera.y - innerHeight / 2 - spacing;
      const bottom = camera.y + innerHeight / 2 + spacing;

      for (let x = Math.floor(left / spacing) * spacing; x < right; x += spacing) {
        ctx.moveTo(x - ox, top);
        ctx.lineTo(x - ox, bottom);
      }
      for (let y = Math.floor(top / spacing) * spacing; y < bottom; y += spacing) {
        ctx.moveTo(left, y - oy);
        ctx.lineTo(right, y - oy);
      }

      ctx.strokeStyle = "#cfe6ff";
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function drawShip() {
      const a = player.shipAngle;
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(a);

      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -10);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fillStyle = "rgba(200,235,255,0.95)";
      ctx.fill();
      ctx.strokeStyle = "rgba(120,200,255,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();

      const moving = !(player.vx === 0 && player.vy === 0);
      if (moving) {
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-18 - rand(0, 8), -4);
        ctx.lineTo(-18 - rand(0, 8), 4);
        ctx.closePath();
        ctx.fillStyle = "rgba(120,255,170,0.65)";
        ctx.fill();
      }

      ctx.restore();
    }

    function drawFollower(f) {
      const a = player.shipAngle;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-7, -6);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-7, 6);
      ctx.closePath();
      ctx.fillStyle = "rgba(170,245,210,0.95)";
      ctx.fill();
      ctx.strokeStyle = "rgba(90,220,170,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.fillStyle = "rgba(7,10,14,1)";
      ctx.fillRect(0, 0, innerWidth, innerHeight);

      ctx.save();
      ctx.translate(innerWidth / 2 - camera.x, innerHeight / 2 - camera.y);

      drawGrid();

      for (const p of particles) {
        ctx.globalAlpha = clamp(p.life * 2, 0, 0.9);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(180,220,255,1)";
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const e of enemies) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = e.isCard ? "rgba(120,210,255,0.95)" : "rgba(255,110,110,0.85)";
        ctx.fill();

        if (e.isCard) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = "rgba(10,20,30,0.95)";
          ctx.font = "12px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("T" + e.cardTier, e.x, e.y);
          ctx.globalAlpha = 1;
        }
      }

      for (const f of followers) drawFollower(f);

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

      drawShip();
      ctx.restore();
    }

    // ===============================
    // MAIN LOOP
    // ===============================
    function step(now) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      DBG.beats++;

      if (player.regen > 0) player.hp = Math.min(player.hpMax, player.hp + player.regen * dt);

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

      const sp = Math.hypot(player.vx, player.vy);
      const cap = clamp(1 - sp / player.maxSpeed, 0.05, 1);
      const accel = player.thrust * cap;

      player.vx += ax * accel * dt;
      player.vy += ay * accel * dt;

      player.vx -= player.vx * player.drag * dt;
      player.vy -= player.vy * player.drag * dt;

      const noInput = (ax === 0 && ay === 0);
      if (noInput) {
        player.vx -= player.vx * 8.5 * dt;
        player.vy -= player.vy * 8.5 * dt;
      }

      if (Math.hypot(player.vx, player.vy) < 10) {
        player.vx = 0;
        player.vy = 0;
      }

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

      updateFollowers(dt);

      // aim lock
      const isStopped = (player.vx === 0 && player.vy === 0);
      const tgt = nearestEnemy(player.x, player.y);

      if (isStopped && tgt) aimLock = true;
      else {
        if (aimLock) fireCooldown = 0;
        aimLock = false;
      }

      if (aimLock && tgt) player.shipAngle = angleTo(player.x, player.y, tgt.x, tgt.y);
      else if (!isStopped) player.shipAngle = Math.atan2(player.vy, player.vx);

      // shoot
      fireCooldown -= dt;
      const period = 1 / Math.max(0.5, player.fireRate);
      if (aimLock && fireCooldown <= 0) {
        shoot();
        fireCooldown = period;

        if (followers.length) {
          const chance = clamp(player.fleetFireMult, 0.25, 1.0);
          if (Math.random() < chance) followersShoot();
        }
      }

      // spawn (still spawns over time too)
      spawnTimer -= dt;
      const minutes = (now - state.startTime) / 60000;
      const rate = 0.95 + minutes * 0.38 + player.lvl * 0.06;
      const spawnPeriod = 1 / clamp(rate, 0.6, 7.0);
      if (spawnTimer <= 0) {
        spawnEnemy();
        spawnTimer = spawnPeriod * rand(0.65, 1.25);
      }

      // bullets homing
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (!b.target || b.target.hp <= 0) b.target = nearestEnemy(b.x, b.y);
        if (b.target) {
          const ang = angleTo(b.x, b.y, b.target.x, b.target.y);
          const spdB = Math.hypot(b.vx, b.vy) || player.bulletSpeed;
          b.vx = Math.cos(ang) * spdB;
          b.vy = Math.sin(ang) * spdB;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0) bullets.splice(i, 1);
      }

      // enemies
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (!e) continue;

        const a = angleTo(e.x, e.y, player.x, player.y);
        let spdNow = e.spd;
        if (e.status && (e.status.slowT || 0) > 0) spdNow *= (1 - (e.status.slowPct || 0));

        e.vx = Math.cos(a) * spdNow;
        e.vy = Math.sin(a) * spdNow;
        e.x += e.vx * dt;
        e.y += e.vy * dt;

        const rr = e.r + player.r;
        if (dist2(e.x, e.y, player.x, player.y) < rr * rr) {
          player.hp -= e.contactDmg * dt;
          if (player.hp <= 0) { resetRun(); break; }
        }

        e.shotCd -= dt;
        if (e.shotCd <= 0) {
          enemyShoot(e);
          e.shotCd = e.fireDelay * rand(0.75, 1.25);
        }

        if (e.status) {
          if ((e.status.burnT || 0) > 0) { e.status.burnT -= dt; e.hp -= (e.status.burnDps || 0) * dt; }
          if ((e.status.poiT || 0) > 0) { e.status.poiT -= dt; e.hp -= (e.status.poiDps || 0) * dt; }
          if ((e.status.slowT || 0) > 0) e.status.slowT -= dt;
        }

        if (e.hp <= 0) killEnemy(e, i);
      }

      // enemy bullets
      for (let i = ebullets.length - 1; i >= 0; i--) {
        const b = ebullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;

        const rr = b.r + player.r;
        if (dist2(b.x, b.y, player.x, player.y) < rr * rr) {
          player.hp -= b.dmg;
          puff(b.x, b.y, 10);
          ebullets.splice(i, 1);
          if (player.hp <= 0) { resetRun(); break; }
          continue;
        }

        if (b.life <= 0) ebullets.splice(i, 1);
      }

      // bullets hit enemies
      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const b = bullets[bi];

        for (let ei = enemies.length - 1; ei >= 0; ei--) {
          const e = enemies[ei];
          if (!e) continue;

          const rr = e.r + b.r;
          if (dist2(e.x, e.y, b.x, b.y) < rr * rr) {
            let dmg = b.dmg;
            if (Math.random() < player.critChance) dmg *= player.critMult;

            e.hp -= dmg;
            puff(b.x, b.y, 6);

            if (b.explosive && b.exploRadius > 0) {
              const boomDmg = dmg * (b.exploMult || 0.55);
              dealAreaDamage(b.x, b.y, b.exploRadius, boomDmg);
              puff(b.x, b.y, 10);
            }

            if (b.element && b.element !== "none") {
              const ed = (b.elementDmg || 0);
              const er = (b.elementRadius || 0);

              if (b.element === "fire") applyStatus(e, "burn", 3.0 + ed * 0.9, 2.2);
              else if (b.element === "poison") applyStatus(e, "poison", 2.2 + ed * 0.8, 4.0);
              else if (b.element === "ice") applyStatus(e, "slow", clamp(0.20 + ed * 0.03, 0, 0.70), 2.2);
              else if (b.element === "shock") {
                e.hp -= 1.8 + ed * 0.75;
                const chains = clamp(Math.floor(1 + ed * 0.25), 1, 6);
                const range = clamp(er + 80, 90, 260);
                chainShock(e, 2.0 + ed * 0.8, range, chains);
              }
            }

            if (e.hp <= 0) killEnemy(e);

            if (b.pierce > 0) b.pierce--;
            else bullets.splice(bi, 1);

            break;
          }
        }
      }

      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx -= p.vx * 6 * dt;
        p.vy -= p.vy * 6 * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      updateHud();
      draw();

      const cardCount = enemies.reduce((n, e) => n + (e && e.isCard ? 1 : 0), 0);
      renderDebugOverlay(
        `Entities: enemies=${enemies.length} (cards=${cardCount}) followers=${followers.length} bullets=${bullets.length} ebullets=${ebullets.length}\n` +
        `Player: hp=${player.hp.toFixed(1)}/${player.hpMax} lvl=${player.lvl} xp=${player.xp.toFixed(1)}/${player.xpNeed}\n` +
        `SpawnOnKill: ${SPAWN_PER_KILL} | diff=${difficultyFactor((now - state.startTime)/60000, player.lvl).toFixed(2)} | spdRand=[${SCALE.spdRandMin},${SCALE.spdRandMax}]\n`
      );

      requestAnimationFrame(step);
    }

    dbg("START: requestAnimationFrame(step)");
    updateHud();
    requestAnimationFrame(step);

  } catch (err) {
    setFatal(err);
  }
})();