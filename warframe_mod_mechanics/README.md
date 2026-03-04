# Warframe Mod Mechanics (Paste Guide)

This folder gives you a drop-in Warframe-style mod system for your ship game.

## Files
- `warframe_mod_system.js`: Main mod engine to paste into `static/version_controller.js`.
- `paste_hooks.js`: Small hook snippets to paste into your existing functions.

## What this adds
- Mod slots with polarity and drain/capacity rules.
- Aura slot that increases capacity.
- Mod drops from kills.
- Endo + Credits resources.
- Mod rank-up costs.
- Auto-install best build under capacity.
- Real stat application to your existing `player` object.

## Paste Steps
1. Open `static/version_controller.js`.
2. Paste all of `warframe_mod_system.js` above `// ============================================================ // XP / LEVEL`.
3. Paste hook lines from `paste_hooks.js` at the matching locations.
4. Keep your existing card-roll buffs. This mod system stacks on top.

## Notes
- The mod system resets each run (`resetRun` hook).
- Starter mods are granted automatically.
- If you want manual equip UI later, this system already exposes install/uninstall APIs.
