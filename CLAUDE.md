# Office Survivors - Project Instructions

## What This Is

A satirical pixel-art browser game. Top-down arcade delivery game (Overcooked meets Diner Dash) set in a corporate office. Player starts as intern, picks up tasks, delivers to color-coded departments, avoids chaos agents, levels up through career ladder, survives a 10-minute workday. Portfolio piece for rohitgarrg.com.

Reference game for core mechanic: https://the-librarian-game.vercel.app/

## Tech Stack

- **Engine:** Phaser 3.80.1 (pin exact version)
- **Language:** JavaScript (ES modules, NOT TypeScript)
- **Build:** Vite 5.x
- **Physics:** Phaser Arcade Physics only (no Matter.js)
- **Canvas:** 960x540px, 32x32 tile size, 40x24 tile map
- **Hosting:** Astro site on Vercel (primary) + standalone at office-survivors.vercel.app

## Project Structure

Standalone project, separate from the Astro website. Built output gets copied to Astro's `public/` for deployment.

- `src/scenes/` — Phaser scenes: Boot, Title, HowToPlay, Game, UI (parallel HUD), LevelUp, GameOver
- `src/entities/` — Player, Task (state machine), ChaosAgent base + 5 subclasses, Assistant
- `src/systems/` — TaskManager, StressManager, UpgradeManager, WaveManager, ProgressionManager, ParticleManager, SoundManager, TutorialManager
- `src/config/` — gameConfig.js (single source of truth), taskData, upgradeData, agentSchedule, mapData
- `src/ui/` — HUD, UpgradeCard, PromotionPopup, FloatingText, Toast
- `src/utils/` — helpers (color, math, random), analytics (GA4 event tracking)
- `public/assets/` — sprites, tiles, furniture, environment, decor, ui, audio

## Critical Architecture Rules

1. **Config is the single source of truth.** Every tunable number lives in `src/config/gameConfig.js`. No magic numbers anywhere in game logic. Always import from config.
2. **UIScene runs parallel to GameScene.** UIScene receives events from GameScene and updates the HUD. GameScene handles gameplay only, not text/DOM rendering.
3. **Task is a state machine:** SPAWNED (on map) -> CARRIED (in inventory) -> DELIVERING (multi-stop partial) -> DONE.
4. **Object pool for tasks.** Maintain a pool of 30 Task entities. Activate/deactivate. Never create/destroy at runtime. Prevents GC spikes.
5. **Arcade Physics only.** AABB collisions for walls. Overlap checks for zones. No Matter.js.
6. **Vite base path must be `/projects/office-survivors/`** in vite.config.js. Without this, assets work standalone but break when iframed on the Astro site.

## Communication Between Systems

Systems talk via Phaser's event emitter, NOT direct method calls:

```javascript
// Emitting
this.scene.events.emit('task-delivered', { task, department, xp });

// Listening (from UIScene or another system)
this.scene.get('GameScene').events.on('task-delivered', this.onTaskDelivered, this);
```

## Event Contract

Events follow naming patterns: `task-*`, `stress-*`, `xp-*`, `level-up`, `upgrade-*`, `agent-*`, `department-*`, `game-*`, `ceo-milestone`, `milestone-*`, `water-cooler-*`, `pressure-*`. See emitters/listeners in source files for exact payloads. Key events:

- `task-spawned/picked-up/delivered/expired/partial-delivery/pickup-failed` — task lifecycle
- `stress-changed/threshold/max` — stress system (max triggers game over)
- `level-up` `{ level, tier, isPromotion }` — triggers LevelUpScene
- `game-over` `{ won, stats }` — passed as scene launch param, not event listener

## Department Colors

| Department | Color | Hex |
|---|---|---|
| CEO Office | Gold | `#FFD700` |
| Marketing | Orange | `#FF8C00` |
| Engineering | Blue | `#4169E1` |
| Finance | Green | `#2E8B57` |
| HR | Purple | `#8B5CF6` |

## Code Style

- ES module imports (`import`/`export`)
- Descriptive variable names, no abbreviations
- Every class in its own file
- JSDoc comments on public methods
- Console.log with prefixes: `[TaskManager]`, `[StressManager]`, etc.
- Debug logging via `console.debug()` so it can be filtered

## Debug Mode

Debug flags live in `gameConfig.js` under `DEBUG` (god mode, stress freeze, fast spawn, etc.). Console commands are exposed on `window.game` in `GameScene.create()` (addXP, setStress, setLevel, spawnAgent, etc.). See those files for details.

---

## Astro Website Integration

The game deploys INTO the Astro website's `public/projects/office-survivors/` directory. The Astro page iframes the game's `index.html`.

- **Deploy to Astro:** Run `./deploy.sh /path/to/rohitgarrg.com` (builds game + copies output)
- **Standalone:** `npm run build:standalone` (base `/`). Vercel auto-deploys from GitHub via `vercel.json`.
- **Embed page:** See `astro-embed-reference.md` for the full Astro page template
- **Base path:** Must be `/projects/office-survivors/` in vite.config.js (Critical Architecture Rule #6)

---

## Common Pitfalls

1. **Diagonal speed:** Normalize velocity vector when both WASD keys pressed. Without this, diagonal is 1.41x faster.
2. **Phaser scene lifecycle:** Don't put logic in `create()` that depends on other scenes being ready. Use events.
3. **Object pool exhaustion:** If all 30 tasks active, TaskManager skips spawn cycle. Never crash.
4. **Camera bounds:** `camera.setBounds(0, 0, 1280, 960)` prevents void beyond map edges.
5. **Stress timing:** Use `delta` from `update(time, delta)`. Never assume 60fps.
6. **Vite base path:** Must be `/projects/office-survivors/`. #1 integration bug.
7. **Event listener cleanup:** Remove in scene `shutdown()`. Prevents leaks and duplicate handlers.
8. **Placeholder art:** Generate via Phaser Graphics API + `generateTexture()`. No external images needed for phases 1-4.

## The Full Spec

`office-survivors-spec-v3.1.md` at project root. Contains:
- Detailed map layout with tile coordinates
- All task data pools per tier
- Chaos agent behaviors with exact numbers
- Stress math with validation scenarios
- XP economy validated against play time
- Upgrade effects and tier gates
- Config defaults (copy into gameConfig.js)

**Important:** `upgrade-rebalance-v2.md` at project root documents all balance changes applied on top of the spec. When spec values and gameConfig.js disagree, gameConfig.js is the source of truth. Key changes:
- Stress rates reduced ~30% from spec values
- Stress relief on delivery significantly increased
- Passive stress decay added (0.65%/sec above 50% stress)
- All 15 upgrades overhauled to S or A tier (no filler). Many timed upgrades are now permanent.
- XP curve reduced for late levels (5-9)
- Pickup radius 36px, stamina regen 15/sec, spawn interval starts at 6000ms
