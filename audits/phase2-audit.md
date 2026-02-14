# Phase 2 Audit Report

**Date:** 2026-02-11
**Auditor:** Claude Code (Opus 4.6)
**Phase audited:** Phase 2 — Progression + Upgrades
**Next phase:** Phase 3 — Chaos Agents

---

## Verdict: 1 Critical, 4 Medium, 4 Low

Fix the critical and medium issues before starting Phase 3. Low issues can be batched.

---

## CRITICAL

### C1. Stress calculation ignores multi-stop remaining stops

**File:** `src/systems/StressManager.js:62`
**Spec reference:** "Multi-stop: stress ticks for EACH remaining stop" (spec line ~476)

**Current code:**
```javascript
const carriedTasks = this.scene.player ? this.scene.player.inventory : [];
const totalUndelivered = activeTasks.length + carriedTasks.length;
```

**Problem:** Each carried task counts as 1, regardless of how many stops remain. A 3-stop CEO task at stop 0/3 should count as 3 stress sources, not 1.

**Fix:** Replace `carriedTasks.length` with a sum of remaining stops:
```javascript
const carriedStressUnits = carriedTasks.reduce((sum, task) => {
  return sum + (task.totalStops - task.currentStop);
}, 0);
const totalUndelivered = activeTasks.length + carriedStressUnits;
```

**Impact if not fixed:** Multi-stop tasks feel too easy on stress. CEO tier becomes significantly easier than designed. The spec's stress validation math assumes this mechanic.

---

## MEDIUM

### M1. Assistant wander speed is a magic number

**File:** `src/entities/Assistant.js:28`
**Rule violated:** Config is single source of truth (CLAUDE.md architecture rule #1)

**Current code:**
```javascript
this._speed = 80;
```

**Fix:**
1. Add to `src/config/gameConfig.js`:
```javascript
ASSISTANT_SPEED: 80,
```
2. In `Assistant.js`:
```javascript
this._speed = CONFIG.ASSISTANT_SPEED;
```
Note: Assistant.js currently doesn't import CONFIG. You'll need to add:
```javascript
import CONFIG from '../config/gameConfig.js';
```

Also add the assistant spawn offset (currently hardcoded as `player.x + 40` in `UpgradeManager.js:361,370`):
```javascript
ASSISTANT_SPAWN_OFFSET: 40,
```

---

### M2. Two undocumented events in use

**Files:** `src/scenes/GameScene.js:392`, `src/systems/UpgradeManager.js:113`

Two events are emitted and consumed but not in the CLAUDE.md event contract table:

| Event Name | Payload | Emitted By | Consumed By |
|---|---|---|---|
| `task-partial-delivery` | `{ task, department, currentStop, totalStops }` | GameScene | UIScene |
| `upgrade-capacity-changed` | `{ capacity }` | UpgradeManager | UIScene |

**Fix:** Add both to the Event Contract table in `CLAUDE.md`.

---

### M3. Inbox Zero department tracking bug for multi-stop tasks

**File:** `src/systems/UpgradeManager.js:330-339`

**Current code:**
```javascript
task.currentStop = task.totalStops;  // e.g., sets to 2
task.state = 'DONE';
// ...
department: task.getCurrentDepartment(),  // calls this.route[2] which is undefined
```

**Problem:** `getCurrentDepartment()` does `this.route[this.currentStop]` which is out-of-bounds after setting currentStop to totalStops. Falls back to `this.route[0]`, emitting the wrong department. This pollutes `deliveryCounts` in TaskManager, which affects the Departmental Favorite upgrade's `getMostDeliveredDept()`.

**Fix:** Capture the last valid department before mutating state:
```javascript
for (const task of tasks) {
  // Capture last destination before mutating
  const lastDept = task.route
    ? task.route[task.route.length - 1]
    : task.department;

  task.currentStop = task.totalStops;
  task.state = TASK_STATES.DONE;  // Also fix magic string (see M4)

  const xp = this.scene.taskManager.calculateXP(task);
  const stressRelief = this.scene.taskManager.getStressRelief(task);
  this.scene.taskManager.tasksDelivered++;

  this.scene.events.emit('task-delivered', {
    task,
    department: lastDept,
    xp,
    stressRelief,
  });

  // ...
}
```

---

### M4. Magic strings used instead of TASK_STATES constants

**Files:**
- `src/systems/UpgradeManager.js:331` — `task.state = 'DONE'`
- `src/scenes/GameScene.js:389` — `task.state !== 'DONE'`

**Problem:** Both use string literal `'DONE'` instead of the `TASK_STATES.DONE` constant. The constant is already imported in GameScene but not in UpgradeManager.

**Fix for UpgradeManager.js:** Add import at top:
```javascript
import { TASK_STATES } from '../entities/Task.js';
```
Then use `TASK_STATES.DONE` on line 331.

**Fix for GameScene.js:** Change line 389 from `task.state !== 'DONE'` to `task.state !== TASK_STATES.DONE` (import already exists on line 5).

---

## LOW

### L1. Event cleanup removes all listeners, not just own

**Files:**
- `src/systems/StressManager.js:155-157`
- `src/systems/ProgressionManager.js:131`

Both call `this.scene.events.off('task-delivered')` without specifying the callback function. This removes ALL listeners for that event name, not just the one registered by that system.

**Current (fragile):**
```javascript
// StressManager.destroy()
this.scene.events.off('task-delivered');
```

**Fix pattern:** Store the callback reference and remove only it:
```javascript
// In init():
this._onTaskDelivered = (data) => { this.relieveStress(data.stressRelief); };
this.scene.events.on('task-delivered', this._onTaskDelivered);

// In destroy():
this.scene.events.off('task-delivered', this._onTaskDelivered);
```

Apply to:
- StressManager: `task-delivered` listener, `task-expired` listener
- ProgressionManager: `task-delivered` listener
- UpgradeManager: `upgrade-selected` listener

**Why it works now:** All managers are destroyed together in GameScene.shutdown(). But if you ever need to destroy one manager independently, this will break.

---

### L2. XP multiplier hardcoded in TaskManager

**File:** `src/systems/TaskManager.js:273`

```javascript
xp = Math.round(xp * 1.5);
```

The `1.5` multiplier should read from the upgrade's `apply.value` rather than being hardcoded. Currently matches the upgrade definition, but if someone changes `upgradeData.js` to 1.75x, TaskManager wouldn't pick it up.

**Lower priority** since this value is unlikely to change, but breaks the single-source-of-truth principle.

---

### L3. Player body size magic numbers

**File:** `src/entities/Player.js:44`

```javascript
const bodySize = 24 - 4; // sprite size minus forgiveness margin
```

The comment explains it, but `24` (sprite size) and `4` (margin) aren't from config. Very minor since these are tightly coupled to the placeholder sprite dimensions and will change in Phase 5 anyway.

---

### L4. StressManager cleans up an event it doesn't listen to

**File:** `src/systems/StressManager.js:157`

```javascript
this.scene.events.off('stress-threshold');
```

StressManager *emits* `stress-threshold` but never *listens* to it. This `.off()` call is a no-op but misleading. Remove it.

---

## Config Drift Notes (Not Bugs)

These values were intentionally tuned from spec defaults during Phase 1 playtesting. All have inline comments. **Not issues**, but documenting for reference:

| Config Key | Spec Default | Actual | Comment in Code |
|---|---|---|---|
| MAP_HEIGHT_TILES | 30 | 24 | Map shortened; bottom rooms (mail room, elevator, kitchen) removed |
| PLAYER_PICKUP_RADIUS | 40 | 28 | "tighter to reduce accidental pickups" |
| TASK_SPAWN_INTERVAL_BASE | 3500 | 5000 | "was 3500 — too fast" |
| TASK_SPAWN_INTERVAL_MIN | 1500 | 2500 | "was 1500" |
| TASK_MAX_ON_MAP | 25 | 15 | "was 25 — too much clutter" |
| TASK_EXPIRY_STRESS | 3 | 2 | "was 3 — clusters punished too hard" |
| TASK_RELIEF_SINGLE | 3 | 5 | "was 3 — deliveries need to feel rewarding" |
| TASK_RELIEF_MULTI_2 | 5 | 8 | "was 5" |
| TASK_RELIEF_MULTI_3 | 8 | 12 | "was 8" |
| STRESS_RATE_INTERN | 0.05 | 0.03 | "was 0.05" |
| STRESS_RATE_ASSOCIATE | 0.08 | 0.05 | "was 0.08" |
| STRESS_RATE_MANAGER | 0.12 | 0.08 | "was 0.12" |
| STRESS_RATE_DIRECTOR | 0.15 | 0.11 | "was 0.15" |
| STRESS_RATE_CEO | 0.20 | 0.15 | "was 0.20" |

**New config keys added** (not in spec, but needed):
- `CAMERA_ZOOM: 0.703125` — fits 40x24 map in 960x540 viewport
- `TIMER_WARNING_ORANGE: 120`, `TIMER_WARNING_RED: 60` — timer color thresholds
- `TASK_FLASH_INTERVAL: 300`, `TASK_FLASH_ALPHA: 0.3` — warning flash parameters
- `FLOATING_TEXT_MAX_LENGTH: 30` — matches spec mention
- `GAME_OVER_DELAY: 500` — brief pause before game over screen

**Vite base path:** Spec says `/games/office-survivors/`, CLAUDE.md says `/projects/office-survivors/`. Code matches CLAUDE.md (correct — CLAUDE.md is authority).

---

## Phase 2 Feature Checklist (All Pass Except C1)

- [x] 5-tier system with task pool changes per tier
- [x] Tier transitions at levels 3, 5, 7, 9
- [x] Promotion popup at tier boundaries (2s display, then upgrade cards)
- [x] Multi-stop tasks (2-stop) spawn at Manager tier (level 5+)
- [x] Triple-stop tasks spawn at Director/CEO tier
- [x] Multi-stop tasks stay in inventory (no re-pickup)
- [x] Multi-stop color shifts on partial delivery (Task.advanceStop)
- [x] Multi-stop badge in HUD (stroke thickness change)
- [ ] **Stress ticks per remaining stop** — BROKEN (see C1)
- [x] HUD shows multi-stop route with current stop highlighted
- [x] LevelUpScene: 3 upgrade cards, tier-gated pool filtering
- [x] All 14 upgrade effects implemented in UpgradeManager
- [x] Timed upgrades show countdown in HUD and expire correctly
- [x] Strategic Delegation spawns NPC Assistant (wanders, auto-delivers every 45s)
- [x] Fast Tracker limited to 3 uses, removed from active on exhaustion
- [x] XP scaling: +5/tier for single-stop, +10/tier for multi-stop
- [x] Task spawn rate ramps linearly over 10 minutes
- [x] Title display updates in HUD on level-up
- [x] Tier selection weights: 60% current, 30% below, 10% above

---

## Phase 1 Regression (All Pass)

- [x] Title screen → start game
- [x] WASD/arrow movement with wall collision
- [x] Sprint (Shift) with stamina drain/regen
- [x] Tasks spawn at defined spawn points
- [x] Auto-pickup within radius, carry limit 3
- [x] Auto-deliver on department zone overlap
- [x] Stress rises per undelivered task, drops on delivery
- [x] Task flashing at 45s warning, expiry at 60s (+stress)
- [x] 10-minute countdown timer
- [x] Win at timer 0:00, lose at stress 100%
- [x] Game over / victory screens with stats
- [x] Play Again and Menu buttons work
- [x] Pause/resume (P/Escape) with overlay
- [x] Diagonal speed normalized
- [x] Debug console commands on window.game
- [x] Object pool: no runtime task create/destroy

---

## Build Status

| Check | Result |
|---|---|
| `npm run build` | PASS — 0 errors, 2.36s |
| Modules transformed | 28 |
| `dist/index.html` | 0.56 KB |
| Main chunk | 1,521 KB / 352 KB gzip (mostly Phaser ~1.4MB) |
| Assistant chunk | 1.78 KB (code-split via dynamic import) |
| Chunk size warning | Advisory — Phaser is large, unavoidable |
| Asset paths in dist/ | Correct |

---

## Files Touched by This Audit

For quick reference when implementing fixes:

| File | Issues |
|---|---|
| `src/systems/StressManager.js` | C1 (stress calc), L1 (event cleanup), L4 (unnecessary off) |
| `src/systems/UpgradeManager.js` | M1 (assistant offset), M3 (Inbox Zero dept), M4 (magic string) |
| `src/entities/Assistant.js` | M1 (speed magic number) |
| `src/scenes/GameScene.js` | M4 (magic string) |
| `src/config/gameConfig.js` | M1 (add ASSISTANT_SPEED, ASSISTANT_SPAWN_OFFSET) |
| `src/systems/TaskManager.js` | L2 (hardcoded XP multiplier) |
| `src/systems/ProgressionManager.js` | L1 (event cleanup) |
| `CLAUDE.md` | M2 (add 2 undocumented events to contract table) |
