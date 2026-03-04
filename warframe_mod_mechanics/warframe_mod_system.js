// Warframe-style mod mechanics for your ship game.
// Paste this function into static/version_controller.js, then follow README hooks.

function createWarframeModSystem({ player, buffs, law, clamp }) {
  const polarityTypes = ["madurai", "vazarin", "naramon", "zenurik", "none"];

  const slotLayout = [
    { id: "aura", polarity: "madurai", aura: true },
    { id: "s1", polarity: "none" },
    { id: "s2", polarity: "none" },
    { id: "s3", polarity: "vazarin" },
    { id: "s4", polarity: "none" },
    { id: "s5", polarity: "madurai" },
    { id: "s6", polarity: "none" },
    { id: "s7", polarity: "naramon" },
    { id: "s8", polarity: "none" },
  ];

  const modDefs = [
    {
      id: "serration",
      name: "Serration",
      polarity: "madurai",
      baseDrain: 4,
      maxRank: 10,
      tags: ["weapon"],
      apply: (rank, out) => {
        out.damageMult += 0.12 * rank;
      },
    },
    {
      id: "split_chamber",
      name: "Split Chamber",
      polarity: "madurai",
      baseDrain: 9,
      maxRank: 5,
      tags: ["weapon"],
      apply: (rank, out) => {
        out.damageMult += 0.08 * rank;
        out.fireRateMult += 0.05 * rank;
      },
    },
    {
      id: "point_strike",
      name: "Point Strike",
      polarity: "madurai",
      baseDrain: 4,
      maxRank: 5,
      tags: ["weapon"],
      apply: (rank, out) => {
        out.critChanceFlat += 0.04 * rank;
      },
    },
    {
      id: "vital_sense",
      name: "Vital Sense",
      polarity: "madurai",
      baseDrain: 4,
      maxRank: 5,
      tags: ["weapon"],
      apply: (rank, out) => {
        out.critMultFlat += 0.16 * rank;
      },
    },
    {
      id: "speed_trigger",
      name: "Speed Trigger",
      polarity: "naramon",
      baseDrain: 4,
      maxRank: 5,
      tags: ["weapon"],
      apply: (rank, out) => {
        out.fireRateMult += 0.09 * rank;
      },
    },
    {
      id: "heavy_caliber",
      name: "Heavy Caliber",
      polarity: "vazarin",
      baseDrain: 6,
      maxRank: 10,
      tags: ["weapon"],
      apply: (rank, out) => {
        out.damageMult += 0.14 * rank;
        out.spreadMult += 0.04 * rank;
      },
    },
    {
      id: "vitality",
      name: "Vitality",
      polarity: "vazarin",
      baseDrain: 2,
      maxRank: 10,
      tags: ["frame"],
      apply: (rank, out) => {
        out.hpMult += 0.05 * rank;
      },
    },
    {
      id: "steel_fiber",
      name: "Steel Fiber",
      polarity: "vazarin",
      baseDrain: 4,
      maxRank: 10,
      tags: ["frame"],
      apply: (rank, out) => {
        out.drFlat += 0.16 * rank;
      },
    },
    {
      id: "redirection",
      name: "Redirection",
      polarity: "vazarin",
      baseDrain: 4,
      maxRank: 10,
      tags: ["frame"],
      apply: (rank, out) => {
        out.regenFlat += 0.03 * rank;
      },
    },
    {
      id: "rush",
      name: "Rush",
      polarity: "naramon",
      baseDrain: 2,
      maxRank: 5,
      tags: ["frame"],
      apply: (rank, out) => {
        out.maxSpeedMult += 0.06 * rank;
      },
    },
    {
      id: "continuity",
      name: "Continuity",
      polarity: "zenurik",
      baseDrain: 4,
      maxRank: 5,
      tags: ["frame"],
      apply: (rank, out) => {
        out.bulletLifeMult += 0.08 * rank;
      },
    },
    {
      id: "energy_siphon",
      name: "Energy Siphon",
      polarity: "madurai",
      baseDrain: 2,
      maxRank: 5,
      aura: true,
      tags: ["aura"],
      apply: (rank, out) => {
        out.auraCapacity += 2 + rank;
        out.regenFlat += 0.03 * rank;
      },
    },
  ];

  const byId = new Map(modDefs.map((m) => [m.id, m]));

  const state = {
    level: 1,
    endo: 0,
    credits: 0,
    collection: new Map(),
    installed: new Map(), // slotId -> {modId, rank}
    stats: null,
    dirty: true,
    base: {
      hpMax: player.hpMax,
      drFlat: player.drFlat,
      drPct: player.drPct,
      regen: player.regen,
      baseDamage: player.baseDamage,
      fireRate: player.fireRate,
      bulletSpeed: player.bulletSpeed,
      bulletSize: player.bulletSize,
      bulletLife: player.bulletLife,
      spreadBase: player.spreadBase,
      maxSpeed: player.maxSpeed,
      critChance: player.critChance,
      critMult: player.critMult,
    },
  };

  function ensureOwned(modId) {
    if (!state.collection.has(modId)) state.collection.set(modId, { rank: 0, dupes: 0 });
    return state.collection.get(modId);
  }

  function addDrop(modId, count) {
    const owned = ensureOwned(modId);
    owned.dupes += count;
  }

  function randomModId(weightTag) {
    const pool = modDefs.filter((m) => (weightTag ? m.tags.includes(weightTag) : !m.aura));
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  function drainFor(slot, mod, rank) {
    const raw = mod.baseDrain + rank;
    if (slot.aura && mod.aura) return raw * -2; // aura adds capacity
    if (slot.polarity === "none") return raw;
    if (slot.polarity === mod.polarity) return Math.ceil(raw * 0.5);
    return Math.ceil(raw * 1.25);
  }

  function capacityForLevel(level) {
    return 20 + Math.min(level, 30);
  }

  function usageAndCap(build = state.installed) {
    let drain = 0;
    let auraBonus = 0;

    for (const slot of slotLayout) {
      const cell = build.get(slot.id);
      if (!cell) continue;

      const mod = byId.get(cell.modId);
      if (!mod) continue;

      const d = drainFor(slot, mod, cell.rank);
      if (d < 0) auraBonus += -d;
      else drain += d;
    }

    return {
      used: drain,
      cap: capacityForLevel(state.level) + auraBonus,
      auraBonus,
    };
  }

  function scoreBuild(build = state.installed) {
    const out = {
      hpMult: 1,
      damageMult: 1,
      fireRateMult: 1,
      maxSpeedMult: 1,
      bulletLifeMult: 1,
      spreadMult: 1,
      regenFlat: 0,
      drFlat: 0,
      critChanceFlat: 0,
      critMultFlat: 0,
      auraCapacity: 0,
    };

    for (const slot of slotLayout) {
      const cell = build.get(slot.id);
      if (!cell) continue;
      const mod = byId.get(cell.modId);
      if (!mod) continue;
      mod.apply(cell.rank, out);
    }

    const cap = usageAndCap(build);
    return { ...out, ...cap };
  }

  function canInstall(slotId, modId, rank) {
    const slot = slotLayout.find((s) => s.id === slotId);
    const mod = byId.get(modId);
    if (!slot || !mod) return false;
    if (slot.aura && !mod.aura) return false;
    if (!slot.aura && mod.aura) return false;

    const tmp = new Map(state.installed);
    tmp.set(slotId, { modId, rank });
    const cap = usageAndCap(tmp);
    return cap.used <= cap.cap;
  }

  function install(slotId, modId) {
    const owned = ensureOwned(modId);
    const rank = owned.rank;
    if (!canInstall(slotId, modId, rank)) return false;
    state.installed.set(slotId, { modId, rank });
    state.dirty = true;
    return true;
  }

  function uninstall(slotId) {
    state.installed.delete(slotId);
    state.dirty = true;
  }

  function rankCost(nextRank) {
    return {
      endo: 50 + nextRank * 35,
      credits: 180 + nextRank * 110,
    };
  }

  function tryRankUp(modId, times = 1) {
    const def = byId.get(modId);
    if (!def) return 0;

    const owned = ensureOwned(modId);
    let done = 0;

    for (let i = 0; i < times; i++) {
      if (owned.rank >= def.maxRank) break;
      const next = owned.rank + 1;
      const cost = rankCost(next);
      if (state.endo < cost.endo || state.credits < cost.credits) break;
      state.endo -= cost.endo;
      state.credits -= cost.credits;
      owned.rank = next;
      done++;
    }

    if (done > 0) {
      for (const [slotId, cell] of state.installed) {
        if (cell.modId === modId) state.installed.set(slotId, { ...cell, rank: owned.rank });
      }
      state.dirty = true;
    }

    return done;
  }

  function autoInstallBest() {
    // Greedy by rank and preferred offensive weight.
    const candidates = [];
    for (const [modId, owned] of state.collection) {
      if (owned.rank < 1) continue;
      const mod = byId.get(modId);
      if (!mod) continue;
      const weight =
        mod.tags.includes("weapon") ? 3 : mod.tags.includes("frame") ? 2 : mod.tags.includes("aura") ? 4 : 1;
      candidates.push({ modId, rank: owned.rank, weight, aura: !!mod.aura });
    }

    candidates.sort((a, b) => b.weight * (b.rank + 1) - a.weight * (a.rank + 1));

    const next = new Map();

    for (const slot of slotLayout) {
      for (const c of candidates) {
        if (slot.aura !== c.aura) continue;
        if ([...next.values()].some((x) => x.modId === c.modId)) continue;

        const tmp = new Map(next);
        tmp.set(slot.id, { modId: c.modId, rank: c.rank });
        const cap = usageAndCap(tmp);
        if (cap.used <= cap.cap) {
          next.set(slot.id, { modId: c.modId, rank: c.rank });
          break;
        }
      }
    }

    state.installed = next;
    state.dirty = true;
  }

  function applyToPlayer() {
    if (!state.dirty && state.stats) return state.stats;

    const stat = scoreBuild(state.installed);
    state.stats = stat;
    state.dirty = false;

    const hpRatio = player.hpMax > 0 ? player.hp / player.hpMax : 1;

    player.hpMax = Math.max(20, state.base.hpMax * stat.hpMult);
    player.hp = clamp(player.hpMax * hpRatio, 1, player.hpMax);
    player.drFlat = Math.max(0, state.base.drFlat + stat.drFlat);
    player.drPct = clamp(state.base.drPct, 0, 0.85);
    player.regen = Math.max(0, state.base.regen + stat.regenFlat);

    player.baseDamage = Math.max(1, state.base.baseDamage * stat.damageMult);
    player.fireRate = Math.max(0.5, state.base.fireRate * stat.fireRateMult);
    player.bulletSpeed = Math.max(180, state.base.bulletSpeed);
    player.bulletSize = clamp(state.base.bulletSize, 2, 18);
    player.bulletLife = Math.max(0.4, state.base.bulletLife * stat.bulletLifeMult);
    player.spreadBase = clamp(state.base.spreadBase * stat.spreadMult, 0.04, 0.6);
    player.maxSpeed = Math.max(120, state.base.maxSpeed * stat.maxSpeedMult);

    player.critChance = clamp(state.base.critChance + stat.critChanceFlat, 0, 0.95);
    player.critMult = Math.max(1.1, state.base.critMult + stat.critMultFlat);

    return stat;
  }

  function onEnemyKill(sizeBlocks) {
    const sb = Math.max(1, sizeBlocks || 1);
    state.endo += 12 + sb * 7;
    state.credits += 18 + sb * 12;

    // 35% drop chance baseline; higher on bigger enemies.
    const p = clamp(0.35 + sb * 0.05, 0, 0.8);
    if (Math.random() < p) {
      const tag = Math.random() < 0.62 ? "weapon" : "frame";
      const modId = randomModId(tag);
      addDrop(modId, 1);
      const owned = ensureOwned(modId);
      if (owned.rank === 0) {
        owned.rank = 1;
        state.dirty = true;
      }

      const mod = byId.get(modId);
      buffs.push({ name: `MOD DROP ${mod.name} R${owned.rank}`, apply() {} });
      if (law) law(16, "MOD", `DROP ${mod.name} rank=${owned.rank} endo=${state.endo}`);
    }

    // occasional auto-rank to keep momentum.
    if (Math.random() < 0.2) {
      const rankedPool = [...state.collection.keys()];
      if (rankedPool.length) {
        const id = rankedPool[Math.floor(Math.random() * rankedPool.length)];
        const up = tryRankUp(id, 1);
        if (up > 0) {
          const mod = byId.get(id);
          buffs.push({ name: `MOD RANK ${mod.name} +${up}`, apply() {} });
          if (law) law(16, "MOD", `RANK UP ${mod.name} +${up}`);
        }
      }
    }

    autoInstallBest();
    applyToPlayer();
  }

  function onLevelUp(level) {
    state.level = level;

    // Give level-up resources and one guaranteed drop every 3 levels.
    state.endo += 45 + level * 4;
    state.credits += 100 + level * 25;

    if (level % 3 === 0) {
      const modId = randomModId(Math.random() < 0.65 ? "weapon" : "frame");
      addDrop(modId, 1);
      const owned = ensureOwned(modId);
      if (owned.rank === 0) owned.rank = 1;
      if (law) law(16, "MOD", `LEVEL DROP ${byId.get(modId).name} lvl=${level}`);
    }

    autoInstallBest();
    applyToPlayer();
  }

  function resetForNewRun() {
    state.level = 1;
    state.endo = 0;
    state.credits = 0;
    state.collection.clear();
    state.installed.clear();
    state.stats = null;
    state.dirty = true;

    // starter kit
    ["serration", "vitality", "energy_siphon"].forEach((id) => {
      const o = ensureOwned(id);
      o.rank = 1;
    });

    autoInstallBest();
    applyToPlayer();
  }

  function hudLines() {
    const stat = applyToPlayer();
    const equipped = [];
    for (const slot of slotLayout) {
      const cell = state.installed.get(slot.id);
      if (!cell) continue;
      const mod = byId.get(cell.modId);
      if (!mod) continue;
      equipped.push(`${slot.id.toUpperCase()}: ${mod.name} R${cell.rank}`);
    }

    return {
      summary: `MODS ${stat.used}/${stat.cap} | Endo ${state.endo} | Credits ${state.credits}`,
      list: equipped,
    };
  }

  // boot starter set
  resetForNewRun();

  return {
    state,
    slotLayout,
    modDefs,
    ensureOwned,
    install,
    uninstall,
    tryRankUp,
    autoInstallBest,
    applyToPlayer,
    onEnemyKill,
    onLevelUp,
    resetForNewRun,
    hudLines,
  };
}
