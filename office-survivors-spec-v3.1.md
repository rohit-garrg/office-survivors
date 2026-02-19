# Office Survivors - Game Design Spec & Claude Code Handoff

**Version:** 3.1
**Date:** February 2025
**Status:** Ready for build (Desktop-first)
**What changed in v3.1:** Added explicit two-project separation strategy, deployment workflow, and moved iframe focus testing to Phase 1. All game mechanics unchanged from v3.

---

## Problem Statement

Build a satirical pixel-art browser game called "Office Survivors" for rohitgarrg.com/projects/office-survivors. It's a top-down arcade delivery game (think Overcooked meets Diner Dash in pixel art) set in a corporate office. The player starts as an intern, picks up tasks, delivers them to color-coded departments, avoids chaos agents, levels up through a career ladder where the actual work evolves, and tries to survive a 10-minute workday. It's a portfolio piece showcasing what can be built with AI tools.

## Reference Games

- **Primary:** The Librarian (https://the-librarian-game.vercel.app/) - core mechanic of pick up items, deliver to matching zones, manage chaos meter
- **Tone:** Untitled Goose Game meets Overcooked - playful, satirical, low-stakes humor
- **NOT a reference:** Vampire Survivors (auto-attack swarm defense is a different genre entirely)

---

## Success Criteria

- [ ] Game canvas loads in under 3 seconds on desktop Chrome/Firefox/Safari/Edge
- [ ] Playable start-to-finish with keyboard controls only
- [ ] A complete session lasts 8-10 minutes (win or lose)
- [ ] A first-time player can understand the core loop within 30 seconds without reading instructions
- [ ] Career progression is visible and felt (task types change, difficulty ramps, player sprite evolves)
- [ ] Reaching CEO tier is achievable (~20% of runs for a skilled player)
- [ ] Embeds in rohitgarrg.com/projects/office-survivors via iframe with no input focus issues
- [ ] "Built with AI" credit visible in-game and on the project page

---

## Technical Foundation

### Project Separation Strategy

**The game and the website are two completely separate projects.** This is a deliberate architectural decision, not a shortcut. Here's why and how:

**Why separate:**
- The game uses Vite + Phaser with game-specific build configuration. The website uses Astro with its own build pipeline. Merging them means debugging two build systems that can interfere with each other.
- A bad npm dependency update in the game could break the blog. A content change on the site could trigger a full game rebuild. You don't want that coupling.
- The game can be developed, tested, and iterated on its own dev server without touching the website at all.
- If the game breaks, the website is unaffected. If the website changes frameworks, the game doesn't care.

**How it works:**

```
YOUR MACHINE
├── rohitgarrg.com/              # Astro website (existing repo)
│   ├── src/
│   ├── public/
│   │   └── projects/
│   │       └── office-survivors/ # <-- Game's BUILT output goes here
│   │           ├── index.html
│   │           ├── assets/
│   │           └── *.js
│   └── ...
│
└── office-survivors/            # Game project (separate repo/folder)
    ├── src/                     # Game source code
    ├── public/                  # Game assets
    ├── dist/                    # Vite build output
    ├── package.json
    └── vite.config.js
```

**The two projects only connect at one point:** the game's built output (`dist/`) gets copied into the website's `public/projects/office-survivors/` directory. Astro serves everything in `public/` as static files with zero processing. The website's Astro page at `/projects/office-survivors` simply iframes that static bundle.

**Development workflow:**
1. Work on the game in `office-survivors/` with its own `npm run dev` on its own port
2. Test gameplay entirely standalone (no website needed)
3. When ready to integrate: `npm run build` in the game project
4. Copy `dist/` contents to `rohitgarrg.com/public/projects/office-survivors/`
5. Commit and deploy the Astro site to Vercel as usual

**Deploy helper script (add to game project root):**

```bash
#!/bin/bash
# deploy.sh - Build game and copy to Astro site
# Usage: ./deploy.sh /path/to/rohitgarrg.com

SITE_DIR="${1:?Usage: ./deploy.sh /path/to/rohitgarrg.com}"
GAME_DIR="$SITE_DIR/public/projects/office-survivors"

echo "Building game..."
npm run build

echo "Copying to $GAME_DIR..."
rm -rf "$GAME_DIR"
mkdir -p "$GAME_DIR"
cp -r dist/* "$GAME_DIR/"

echo "Done. Game deployed to $GAME_DIR"
echo "Now cd to $SITE_DIR, commit, and push to deploy."
```

Make it executable: `chmod +x deploy.sh`

**Vite config for the game (important):**

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/projects/office-survivors/',  // CRITICAL: matches the path in the Astro site
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
```

The `base` setting ensures all asset URLs in the built bundle are relative to `/projects/office-survivors/`, not the site root. Without this, the game will load in standalone mode but break when iframed on the Astro site.

### Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Game Engine | **Phaser 3.80.1** (pin exact version in package.json) | Full 2D game framework. Built-in Arcade Physics, input, scenes, sprites, tilemaps, camera. Massive community = Claude Code has thousands of examples. |
| Physics | **Phaser Arcade Physics** | Simple AABB collision. No rotational physics needed. Handles wall collision and overlap detection for pickup/delivery zones. |
| Language | **JavaScript** (ES modules) | Simpler toolchain. TypeScript adds compile step complexity for a game that doesn't need strict typing. |
| Build Tool | **Vite 5.x** | Fast HMR for dev. Clean production builds. |
| Hosting | Vercel (via rohitgarrg.com Astro site) | Game builds to static files. Copied into Astro's public dir. Served as-is. |
| Sprite Art | PixelLab (pixellab.ai) + itch.io asset packs as fallback | PixelLab for characters (consistency via style reference). Asset packs for tilesets if needed. |

### Canvas & Display

| Property | Value | Notes |
|----------|-------|-------|
| Canvas width | **960px** | 16:9 ratio. Fits comfortably in most desktop browsers. |
| Canvas height | **540px** | Half of 1080p. Clean pixel scaling at 2x on 1080p monitors. |
| Tile size | **32x32 px** | Standard for 16-bit pixel art. Characters are 32x32. |
| Map size | **40 x 24 tiles** (1280 x 768 px) | Larger than viewport. Camera scrolls to follow player. |
| Pixel art scale | **1x** (native) | No sub-pixel rendering. `pixelArt: true` in Phaser config for crisp scaling. |
| Background color | `#F5F0E8` | Warm off-white. Visible behind map edges if camera hits bounds. |

**Phaser config skeleton:**
```javascript
const config = {
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false // toggle true during dev
    }
  },
  scene: [BootScene, TitleScene, HowToPlayScene, GameScene, UIScene, LevelUpScene, GameOverScene]
};
```

### Iframe Embedding

The game's built output lives at `/public/projects/office-survivors/` in the Astro project. The Astro page at `/projects/office-survivors` contains:

```html
<div class="game-wrapper" style="position:relative; width:960px; height:540px; margin:0 auto;">
  <div id="click-to-play" onclick="this.style.display='none'; document.getElementById('game-frame').focus();"
       style="position:absolute; inset:0; z-index:10; display:flex; align-items:center; justify-content:center;
              background:rgba(0,0,0,0.7); cursor:pointer; color:white; font-size:24px;">
    Click to Play
  </div>
  <iframe id="game-frame" src="/projects/office-survivors/index.html"
          width="960" height="540" style="border:none;"
          allow="autoplay" tabindex="0"></iframe>
</div>
```

The iframe re-shows the "Click to Play" overlay when it loses focus (detected via `blur` event on the iframe's window).

**Important:** Iframe keyboard focus is tested in Phase 1, not Phase 6. See Phase 1 deliverables.

---

## The Office Map

### Grid Layout (40 x 24 tiles, 1280 x 768 px)

```
    0         10        20        30        40
  0 ┌─────────────────────────────────────────┐
    │ WALL  WALL  WALL  WALL  WALL  WALL  WALL│
  2 │ ┌─CEO OFFICE─┐  ┌─CONFERENCE─┐  ┌─BREAK│
    │ │  (Gold)     │  │   ROOM     │  │ ROOM │
  5 │ │  delivery   │  │ (blockable)│  │      │
    │ └─────────────┘  └────────────┘  └──────│
  7 │                                          │
    │ ┌─MARKETING─┐   OPEN FLOOR    ┌─FINANCE─│
  9 │ │ (Orange)   │   ┌──┐ ┌──┐    │ (Green) │
    │ │ delivery   │   │dk│ │dk│    │delivery │
 12 │ └────────────┘   └──┘ └──┘    └─────────│
    │              ┌──┐      ┌──┐              │
 14 │   ┌──┐       │PR│      │PR│       ┌──┐  │
    │   │dk│       └──┘      └──┘       │dk│  │
 16 │   └──┘                            └──┘  │
    │                  ★                       │
 18 │ ┌─ENGINEERING┐ START  ┌──HR──────────┐  │
    │ │  (Blue)     │ POINT │  (Purple)     │  │
 21 │ │  delivery   │       │  delivery     │  │
    │ └─────────────┘       └───────────────┘  │
 23 │                                          │
    │ ┌─MAIL ROOM──┐ ┌─ELEVATOR/─┐  ┌─KITCHEN│
 25 │ │ (task spawn │ │  LOBBY    │  │        │
    │ │  hotspot)   │ │           │  │        │
 28 │ └─────────────┘ └───────────┘  └────────│
    │ WALL  WALL  WALL  WALL  WALL  WALL  WALL│
 30 └─────────────────────────────────────────┘

  dk = desk (task spawn point + obstacle)
  PR = printer (task spawn point + obstacle)
  ★  = player start position (tile 20, 17)
```

### Collision & Zone Definitions

**Walkable:** Open floor, inside department delivery zones, corridors between rooms.

**Non-walkable (static collision bodies):** Walls (map perimeter + room walls), desks, printers, filing cabinets, conference table, water cooler. These are Arcade Physics static bodies added to a `wallsGroup`.

**Department delivery zones** are Phaser zones (non-physical overlaps, not colliders). When the player overlaps a zone, any matching task in their inventory is delivered automatically.

| Department | Zone top-left (tile) | Zone size (tiles) | Color |
|------------|---------------------|--------------------|-------|
| CEO Office | (1, 2) | 6 x 4 | `#FFD700` Gold |
| Marketing | (1, 8) | 6 x 4 | `#FF8C00` Orange |
| Engineering | (1, 18) | 6 x 4 | `#4169E1` Blue |
| Finance | (33, 8) | 6 x 4 | `#2E8B57` Green |
| HR | (33, 18) | 6 x 4 | `#8B5CF6` Purple |

**Task spawn points** are predefined tile coordinates, not random positions:

```javascript
// config/mapData.js
export const TASK_SPAWN_POINTS = [
  // Open floor between departments (y 8-11)
  { x: 10, y: 8 },  { x: 16, y: 8 },  { x: 22, y: 8 },
  { x: 28, y: 8 },  { x: 12, y: 11 }, { x: 20, y: 11 },
  { x: 27, y: 11 }, { x: 9, y: 10 },  { x: 31, y: 10 },
  // Central corridor (y 13-15)
  { x: 10, y: 15 }, { x: 17, y: 15 }, { x: 22, y: 15 },
  { x: 30, y: 15 }, { x: 12, y: 13 }, { x: 25, y: 13 },
  // South corridor between Engineering and HR (y 18-21)
  { x: 12, y: 19 }, { x: 18, y: 19 }, { x: 16, y: 21 },
];

export const PLAYER_START = { x: 20, y: 17 };
```

### Camera

- **Follow mode:** `camera.startFollow(player, true, 0.08, 0.08)` - smooth lerp, not instant snap
- **Dead zone:** 200x150 px centered on viewport (player can move within this box without the camera reacting; camera only moves when player exits the dead zone)
- **Bounds:** `camera.setBounds(0, 0, MAP_WIDTH_PX, MAP_HEIGHT_PX)` - camera stops at map edges, no void visible

---

## Career Progression & Task Evolution

### Progression Tiers

| Level Range | Title | Task Types | New Mechanic | Stress per Undelivered Task |
|-------------|-------|------------|--------------|----------------------------|
| 1-2 | **Intern** | Coffee runs, mail, photocopies, supply restocks | Baseline: single-stop delivery | 0.02%/sec |
| 3-4 | **Associate** | Reports, spreadsheets, decks, data pulls | Spawn rate increases by 30% | 0.035%/sec |
| 5-6 | **Manager** | Cross-functional briefs, escalations, roadmaps | **Multi-stop tasks unlock** (2 departments in sequence) | 0.065%/sec |
| 7-8 | **Director** | Budget approvals, partnerships, strategy docs | Multi-stop tasks become more frequent (50% of spawns) | 0.10%/sec |
| 9 | **CEO** | Board decks, M&A, IPO filings, reorgs | **Triple-stop tasks unlock** (3 departments) | 0.14%/sec |

### Leveling: Upgrades at EVERY Level, Promotions at Tier Transitions

Every level up triggers upgrade selection (pick 1 of 3). That's up to 8 upgrades in a full game.

Tier transitions (Intern->Associate, Associate->Manager, etc.) ALSO trigger a promotion popup before the upgrade screen. So at level 3, the player sees: "PROMOTED! You are now: Associate. New task types unlocked." THEN the upgrade selection.

### XP Economy (Revised - Actually Validated)

**XP per delivery:**

| Task Type | Base XP | Tier Bonus | Total at Intern | Total at Manager |
|-----------|---------|------------|-----------------|------------------|
| Single-stop | 20 | +5 per tier | 20 | 30 |
| Multi-stop (2) | - | - | N/A | 55 |
| Triple-stop (3) | - | - | N/A | N/A (Director: 90, CEO: 100) |

**Delivery rate assumptions for XP validation:**

A competent player delivers roughly 1 task every 6-8 seconds in early game (walk to task ~2s, walk to department ~4-6s). That's ~8 deliveries per minute at Intern tier.

| Level | XP to Next | Cumulative | Deliveries Needed (from prev) | Est. Time | Running Time |
|-------|-----------|------------|-------------------------------|-----------|--------------|
| 2 | 80 | 80 | 4 single-stop | 0:30 | 0:30 |
| 3 | 120 | 200 | 6 | 0:45 | 1:15 |
| 4 | 180 | 380 | 7 | 0:50 | 2:05 |
| 5 | 240 | 620 | 8-9 (some multi-stop now) | 1:00 | 3:05 |
| 6 | 340 | 960 | 6-7 multi-stop | 1:10 | 4:15 |
| 7 | 520 | 1480 | 9-10 multi-stop | 1:40 | 5:55 |
| 8 | 680 | 2160 | 11-12 multi-stop | 1:50 | 7:45 |
| 9 | 840 | 3000 | 10-11 multi + some triple | 1:50 | 9:35 |

**Validation:** A skilled player hitting 70-80% delivery efficiency reaches CEO at ~7.5-8 min, leaving 2-2.5 min for post-CEO play. An average player reaches Director (level 7-8) and survives. A struggling player dies at Manager or Director. Total XP to CEO is 3000 (steepened from earlier values to push CEO later and leave room for post-CEO milestones).

**Post-CEO Milestones:** After reaching CEO (level 9), milestones trigger "Bonus Upgrade!" popups. The first milestone costs 500 XP, and each subsequent one costs 200 more (500, 700, 900...). Each milestone grants a permanent +0.1x XP multiplier bonus (capped at +0.3x total). Milestone #3 triggers a special "IPO Bell" celebration. If the upgrade pool is empty or all options are stale, the XP multiplier bonus is granted silently. This keeps the reward loop alive for the full 10 minutes.

### Multi-Stop Task Mechanic (Precisely Defined)

**How it works:**

1. Multi-stop tasks spawn like normal tasks, but with a numbered badge showing total stops (e.g., "2" for a 2-stop task).
2. Player auto-picks up the task. It occupies ONE inventory slot.
3. The task shows its CURRENT destination color. HUD shows the full route (e.g., "Engineering -> Marketing") with the current stop highlighted.
4. Player delivers to the first department. The task **stays in the player's inventory** (no re-pickup needed). The task's color shifts to the next destination. The badge decrements ("2" becomes "1").
5. Player walks to the second department and delivers. Task complete. Full XP awarded.

**Key rule: a multi-stop task always occupies exactly 1 inventory slot through its entire journey. It never drops. It never needs re-pickup.**

**Abandonment:** There is no abandonment mechanic. Once you pick up a multi-stop task, it stays until you complete it. The only penalty for slow completion is the ongoing stress from the task remaining "undelivered" (stress ticks for each incomplete stop remaining).

**Why this is better:** Eliminating the drop/re-pickup ambiguity removes edge cases with carry capacity. It also makes multi-stop tasks feel like commitments ("you took on this project, now see it through") which fits the corporate satire.

### Task Data Structure

```javascript
// config/taskData.js

export const TASKS = {
  intern: [
    { name: "Coffee Order (Oat Milk, Extra Shot, No Foam, Lukewarm)", dept: "random", stops: 1 },
    { name: "Photocopy This (17 Copies, Stapled, Not Stapled, Actually Stapled)", dept: "random", stops: 1 },
    { name: "Mail Delivery (Marked Urgent Three Weeks Ago)", dept: "random", stops: 1 },
    { name: "Supply Run: Post-its (The Good Kind)", dept: "random", stops: 1 },
    { name: "Printer Paper Refill (Again)", dept: "random", stops: 1 },
    { name: "Lost Badge Replacement Form", dept: "HR", stops: 1 },
  ],
  associate: [
    { name: "TPS Report (Cover Sheet Missing)", dept: "random", stops: 1 },
    { name: "Q3 Revenue Spreadsheet (Formulas Broken)", dept: "FINANCE", stops: 1 },
    { name: "Competitive Analysis (Just Google It)", dept: "MARKETING", stops: 1 },
    { name: "Slide Deck for Meeting About Meetings", dept: "random", stops: 1 },
    { name: "Data Pull (Nobody Will Read This)", dept: "ENGINEERING", stops: 1 },
    { name: "Reply All Apology for Previous Reply All", dept: "random", stops: 1 },
  ],
  manager: [
    { name: "Cross-Functional Alignment Brief", route: ["ENGINEERING", "MARKETING"], stops: 2 },
    { name: "Vendor Proposal Review", route: ["FINANCE", "CEO"], stops: 2 },
    { name: "Team Escalation Report", route: ["HR", "ENGINEERING"], stops: 2 },
    { name: "Product Roadmap Update", route: ["ENGINEERING", "MARKETING"], stops: 2 },
    { name: "Budget Reallocation Request", route: ["FINANCE", "CEO"], stops: 2 },
    { name: "Quarterly Review Prep", route: ["HR", "CEO"], stops: 2 },
    // Single-stop tasks still spawn at Manager tier too
    { name: "Status Update (For the Status Update Meeting)", dept: "random", stops: 1 },
  ],
  director: [
    { name: "Partnership Agreement", route: ["CEO", "FINANCE"], stops: 2 },
    { name: "Org Restructure Plan", route: ["HR", "CEO"], stops: 2 },
    { name: "Strategic Initiative Brief", route: ["MARKETING", "FINANCE", "CEO"], stops: 3 },
    { name: "Annual Budget Defense", route: ["FINANCE", "CEO"], stops: 2 },
    { name: "Board Pre-Read Materials", route: ["CEO", "FINANCE"], stops: 2 },
    { name: "Headcount Justification", dept: "HR", stops: 1 },
  ],
  ceo: [
    { name: "M&A Term Sheet", route: ["FINANCE", "CEO", "HR"], stops: 3 },
    { name: "IPO Filing Draft", route: ["FINANCE", "CEO", "MARKETING"], stops: 3 },
    { name: "Company-Wide Reorg", route: ["HR", "ENGINEERING", "MARKETING"], stops: 3 },
    { name: "Board Deck (FINAL FINAL v3)", route: ["CEO", "FINANCE", "MARKETING"], stops: 3 },
    { name: "Strategic Vision Document (Just Vibes)", route: ["MARKETING", "ENGINEERING", "CEO"], stops: 3 },
    // Even CEOs get urgent single-stops
    { name: "Investor Call Prep (In 5 Minutes)", dept: "CEO", stops: 1 },
  ],
};
```

**Note:** `dept: "random"` means the TaskManager assigns a random department at spawn time. `route` is an ordered array for multi-stop tasks. Display name and route are completely separate. No route parsing from strings.

### Task Spawning Rules

```javascript
// How TaskManager selects which task to spawn:

1. Determine the player's current tier.
2. Roll task tier:
   - 60% chance: current tier task
   - 30% chance: one tier below (if exists) -- you still get grunt work even as CEO
   - 10% chance: one tier above (if exists) -- stretch assignment
3. Select a random task from that tier's pool.
4. If the task has stops > 1 and the player's tier is below Manager, re-roll (multi-stop tasks NEVER spawn before Manager tier, regardless of the 10% stretch rule).
5. Pick a random spawn point from TASK_SPAWN_POINTS.
6. If that spawn point already has an active task within 48px, pick another. If all spawn points are occupied, skip this spawn cycle.
```

### Task Lifecycle & Expiry

Tasks that sit on the map undelivered for **45 seconds** begin flashing red. After **60 seconds**, they expire and vanish, adding a **+2% stress penalty** on expiry. This prevents the "20 stale tasks = guaranteed death spiral" problem. It also creates interesting tension: do you grab the flashing task across the map, or let it expire and take the stress hit?

```javascript
TASK_WARNING_TIME: 45000,    // ms before task starts flashing
TASK_EXPIRY_TIME: 60000,     // ms before task despawns
TASK_EXPIRY_STRESS: 2,       // % stress added on expiry (was 3)
```

---

## Chaos Agents

### Spawn Schedule (Hybrid: Time-gated AND Level-gated)

An agent type only spawns if BOTH conditions are met: enough game time has passed AND the player has reached a minimum level. This prevents agents from overwhelming a struggling player, while still pressuring a skilled one.

| Agent | Time Gate | Level Gate | Count | Respawn |
|-------|-----------|------------|-------|---------|
| **The Micromanager** | 1:30 | Level 2 | 1 (max 2 after 6:00) | Persistent (always active) |
| **The Chatty Colleague** | 2:00 | Level 2 | 1 (max 2 after 8:00) | Persistent |
| **The Meeting Scheduler** | 4:30 | Level 4 | 1 | Persistent, cooldown between blocks |
| **The Reply-All Guy** | 4:30 | Level 4 | 1 (max 2 after 7:00) | Persistent, cooldown between bursts |
| **The Slack Pinger** | 6:00 | Level 5 | 1 | Persistent |

### Agent Behaviors (Precisely Defined)

**The Micromanager**
- Movement: Moves toward the player at `MICROMANAGER_SPEED`. Uses simple pathfinding: moves in the direction that reduces distance to player, respects wall collisions.
- Effect: When within `MICROMANAGER_RANGE` (96px), player speed is multiplied by `MICROMANAGER_SLOW_FACTOR` (0.6) and adds `MICROMANAGER_STRESS_RATE` (0.3%/sec) stress. Effect ends immediately when player moves out of range.
- Counterplay: Sprint away. The Micromanager is slower than the player's sprint speed.

**The Reply-All Guy**
- Movement: Walks to a random desk/printer spawn point. On arrival, pauses for 1 second, then "explodes": spawns `REPLYALL_TASK_BURST` (4) tasks at random spawn points **at least 5 tiles away from the player** (prevents free auto-pickup). Then walks to next random spawn point. Cooldown of `REPLYALL_COOLDOWN` (8s) between bursts.
- The spawned tasks are normal department-tagged tasks. They count toward TASK_MAX_ON_MAP.
- Visual: email notification particle burst on explosion.

**The Meeting Scheduler**
- Movement: Walks to a random department zone. On arrival, places an "In a Meeting" sign. That department cannot accept deliveries for `MEETING_BLOCK_DURATION` (12s). Then walks to another department. Cooldown of 20s between blocks.
- **Critical rule:** The Meeting Scheduler will NEVER block the same department twice in a row. If only one department remains unblocked, the Scheduler idles until its previous block expires.
- **Counterplay for soft-lock prevention:** If the player is carrying tasks ONLY for a blocked department, a small "Knock Knock" prompt appears. Pressing Space/clicking it forces delivery at 50% XP. This prevents true soft-locks while still penalizing the situation.
- Visual: "IN A MEETING" sign appears over the department. Department zone dims.

**The Chatty Colleague**
- Movement: Wanders randomly. Changes direction every 2-4 seconds.
- Effect: If the Chatty Colleague's sprite overlaps the player, the player is frozen for `CHATTY_FREEZE_DURATION` (2.5s). A speech bubble appears with a random line. The Chatty Colleague then walks away (180-degree turn) and has a 6-second cooldown before it can freeze again.
- Speech bubble texts: "So about my weekend...", "Quick question, do you have 5 minutes?", "Have you seen the new org chart?", "I'm not one to gossip, but...", "Did you see that email?", "Can I pick your brain for a sec?"
- **Important:** The freeze does NOT pause the game timer or stress accumulation. Time is ticking.

**The Slack Pinger**
- Movement: Wanders, similar to Chatty Colleague.
- Effect: Every `DECOY_SPAWN_INTERVAL` (5s), spawns 1 decoy task at a random spawn point. Decoy tasks look like real tasks but are slightly transparent (alpha 0.7) and have a subtle shimmer/pulse animation. Picking up a decoy wastes 1 carry slot for 3 seconds, then it vanishes from inventory. Also adds `STRESS_DECOY_PICKUP` (4%) stress. The Slack Pinger also has a stress aura: players within `SLACKPINGER_AURA_RANGE` (120px) take `SLACKPINGER_AURA_STRESS_RATE` (0.8%/sec) additional stress.
- Decoy tasks that aren't picked up vanish after `DECOY_LIFETIME` (6s). They do NOT count toward task stress.

### Agent Pathfinding

All agents use simple tile-based movement, NOT full A* pathfinding. Implementation:

1. Agent has a target (player position, or a specific tile).
2. Each frame, agent determines which of the 4 cardinal directions moves it closest to the target.
3. Agent attempts to move in that direction. If blocked by a wall, try the next-best direction.
4. If all directions are blocked, idle for 0.5s then re-evaluate.

This is intentionally imperfect. Agents occasionally get stuck behind furniture, which is funny and gives the player moments of relief. Do NOT implement sophisticated pathfinding.

---

## Stress System (Revised Math)

### Core Formula

Each game frame (60fps), stress changes by:

```
stressChange = (sum of stress from each undelivered task) - (recent delivery relief)
```

### Stress Sources

| Source | Rate/Amount | Notes |
|--------|------------|-------|
| Undelivered task (Intern tier) | +0.02%/sec per task | Gentle early game |
| Undelivered task (Associate tier) | +0.035%/sec per task | |
| Undelivered task (Manager tier) | +0.065%/sec per task | Multi-stop: stress ticks for EACH remaining stop |
| Undelivered task (Director tier) | +0.10%/sec per task | |
| Undelivered task (CEO tier) | +0.14%/sec per task | |
| Task expires on map | +2% instant | Penalty for letting tasks rot |
| Meeting Scheduler blocks dept | +3% instant | |
| Pick up decoy task | +4% instant | Doubled to punish decoy mistakes |

### Passive Stress Decay (Rebalance v2)

When stress exceeds 50%, a passive decay of -0.40%/sec kicks in as a safety net to prevent snowballing. The Stress Ball upgrade adds +0.25%/sec on top (total -0.65%/sec above 50%). Additionally, task expiry stress is capped at 20% within any 5-second rolling window, preventing Reply-All burst expiries from causing instant death spirals.

### Stress Relief

| Source | Amount | Notes |
|--------|--------|-------|
| Deliver single-stop task | -5% | Reverted to spec — late game needs real stress pressure |
| Deliver multi-stop (complete) | -8% | Only on final delivery |
| Deliver triple-stop (complete) | -12% | Big relief for big effort |
| Stress Ball upgrade | Permanent -0.25%/sec passive decay | Stacks with base 0.40%/sec decay above 50% (total 0.65%/sec) |

### Stress Validation

**Scenario: Competent player at minute 5, Manager tier.**

Undelivered tasks on map: ~6 average (mix of intern/associate/manager tasks).
Stress per second: (3 * 0.02) + (2 * 0.035) + (1 * 0.065) = 0.195%/sec.
Deliveries per minute: ~7 (mix of single and multi-stop).
Stress relief per minute: (4 * 5%) + (3 * 8%) = 44%.
Net stress per minute: (0.195 * 60) - 44 = 11.7 - 44 = **-32.3%** (stable — room for chaos agents).

With steepened late-game rates and reduced relief, competent players still stay below 50% stress without upgrades, but the margin is tighter. Chaos agents and late tiers (Director 0.10, CEO 0.14) now provide real pressure.

**Scenario: Struggling player at minute 5.**

Undelivered tasks: ~12. Stress per second: ~0.39%/sec. They're delivering ~4 per minute = 20% relief. Net: (0.39 * 60) - 20 = +3.4%/min (slowly rising). Passive decay above 50% adds -24%/min safety net (net -20.6%/min). They can recover if they focus. With chaos agents, this margin tightens significantly.

### Visual Feedback by Stress Level

| Stress Range | Visual |
|-------------|--------|
| 0-40% | Green bar. No effects. |
| 40-65% | Yellow bar. Subtle yellow vignette on screen edges. |
| 65-85% | Orange bar. Stronger orange vignette. HUD text "Your boss is watching..." |
| 85-100% | Red bar. Red pulsing vignette. Screen edges darken. HUD text "HR is preparing paperwork..." |

---

## Upgrades (Rebalanced & Tier-Gated)

### Tier Gating (Rebalance v2)

When the player levels up, the 3 upgrade options are drawn from a **filtered pool**. Most upgrades unlock earlier now so they're relevant when you get them. Some anti-agent upgrades also require the relevant agent type to have spawned. Target: 6 S-tier + 9 A-tier = 0 filler picks.

| Upgrade | Available From | Category | Condition |
|---------|---------------|----------|-----------|
| Coffee IV Drip | Level 1 | Always useful | — |
| Extra Hands | Level 1 | Always useful | — |
| Speed Reader | Level 2+ | Always useful | — |
| Deep Breaths | Level 2+ | Always useful | — |
| Stress Ball | Level 3+ | Always useful | — |
| Inbox Zero | Level 3+ | Delivery | — |
| LinkedIn Thought Leader | Level 3+ | XP boost | — |
| Noise-Cancelling AirPods | Level 4+ | Anti-agent | Requires Micromanager spawned |
| Executive Presence | Level 4+ | Anti-agent | Requires 2+ agent types spawned |
| Reply-All Filter | Level 4+ | Anti-agent | Requires Reply-All Guy spawned |
| Meeting Blocker | Level 4+ | Anti-agent | Requires Meeting Scheduler spawned |
| Corner Office | Level 5+ | Delivery | — |
| Departmental Favorite | Level 5+ | Delivery | — |
| Fast Tracker | Level 5+ | Advanced | — |
| Strategic Delegation | Level 6+ | Advanced | — |

### Effects (Rebalance v2 — All S/A Tier)

| Upgrade | Effect | Duration | Description |
|---------|--------|----------|-------------|
| Coffee IV Drip | +20% move speed | Permanent | "Mainlining caffeine. As one does." |
| Extra Hands | +1 carry capacity | Permanent | "You've grown a third arm. Metaphorically." |
| Speed Reader | +40% pickup radius + 40% delivery zone size on ALL depts | Permanent | "You can read a memo from across the room. And deliver from across the hall." |
| Deep Breaths | Water cooler cooldown halved: 20s → 10s | Permanent | "In through the nose, out through the mouth. You got this." |
| Stress Ball | Permanent -0.25%/sec passive stress decay (stacks with base 0.40%/sec decay) | Permanent | "Squeeze. Breathe. Repeat. Forever." |
| Noise-Cancelling AirPods | 70% freeze resistance + 50% slow resistance | Permanent | "Sorry, can't hear you. In a zone. Permanently." |
| Executive Presence | On delivery: all agents slow 40% for 8s | Permanent | "Deliver a task and everyone backs off. Temporarily." |
| Reply-All Filter | Decoy tasks glow red + navigation arrows on all tasks | Permanent | "Your spam filter leveled up. Now with navigation." |
| Meeting Blocker | Block durations halved + deliver through blocks at 75% XP | Permanent | "You declined all meetings. Power move." |
| LinkedIn Thought Leader | 2x XP | 60s | "Posted a hot take. Engagement through the roof." |
| Corner Office | Most-delivered dept zone 2x bigger + auto-deliver within 80px proximity | Permanent | "Prime real estate. Tasks practically deliver themselves." |
| Departmental Favorite | 2x XP + 2x stress relief on most-delivered dept | Permanent | "They owe you a favor. A big one." |
| Inbox Zero | Instantly deliver all currently held tasks | Instant (one-time) | "The mythical state. Achieved briefly." |
| Strategic Delegation | NPC assistant spawns, auto-delivers 1 task every 30s | Permanent | "Finally, leverage." |
| Fast Tracker | Next 5 multi-stop tasks skip their last stop + 3% stress relief each | 5 uses, then gone | "Apparently you have authority to fast-track. And it feels great." |

**Key changes in Rebalance v2 (from spec v3.1 originals):**
- Deep Breaths: NEW upgrade — halves water cooler cooldown (S-tier)
- Speed Reader: now also expands ALL delivery zones by 40% (S-tier)
- Stress Ball: changed from instant -15% to permanent -0.25%/sec passive decay (S-tier)
- Noise-Cancelling AirPods: permanent 70% freeze resistance + 50% slow resistance, requires Micromanager spawned (A-tier)
- Executive Presence: on delivery, 40% agent slowdown for 8s, requires 2+ agents spawned (A-tier)
- Reply-All Filter: requires Reply-All Guy spawned, adds task navigation (A-tier)
- Corner Office: uses most-delivered dept instead of random, adds proximity auto-deliver (A-tier)
- Meeting Blocker: permanent, halves blocks + allows 75% XP delivery through blocks, requires Meeting Scheduler spawned (A-tier)
- Departmental Favorite: now gives 2x XP + 2x stress relief instead of just range (A-tier)
- LinkedIn Thought Leader: 2x for 60s (was 1.5x for 45s)
- Fast Tracker: 5 charges (was 3) + 3% stress relief per skip

---

## Controls (Desktop)

| Input | Action | Notes |
|-------|--------|-------|
| WASD / Arrow Keys | Move | 4-directional. Diagonal movement allowed (both keys pressed). Diagonal speed normalized to prevent faster diagonal movement. |
| Shift (hold) | Sprint | 1.6x speed. Drains stamina at 20/sec. Regenerates at 15/sec when not sprinting. Cannot sprint at 0 stamina. |
| Space | Interact | "Knock Knock" on blocked departments (emergency 50% XP delivery). |
| P / Escape | Pause | Overlay with Resume / Restart / Quit. |
| 1 / 2 / 3 | Select upgrade | On level-up screen. Also clickable. |
| Task pickup | Automatic | Player walks within `PICKUP_RADIUS` (36px) of a task. |
| Task delivery | Automatic | Player overlaps a matching department zone. |

---

## UI Layout

### In-Game HUD (UIScene, parallel to GameScene)

```
┌──────────────────────────────────────────────────────┐
│  Lvl 5: Manager              STRESS █████████░░ 62%   │
│  XP ██████░░░░ 340/400       ┌──────┐                │
│  Tasks: 2/4  [Eng→Mkt] [Fin] │ 7:23 │                │
│  Stamina ████░░               └──────┘                │
│                                                       │
│                                                       │
│                    (Game World)                        │
│                                                       │
│                                                       │
│                                                       │
└──────────────────────────────────────────────────────┘
```

- **Top-left cluster:** Level + Title, XP bar with numbers, carried task indicators (colored squares with department initial, multi-stop shows route), stamina bar.
- **Top-right:** Stress meter (large, prominent, with percentage), countdown timer in a bordered box.
- **Floating text:** Task name appears above the player for 3 seconds on pickup, then fades. Keep font small, max 45 characters visible.
- **Active upgrade indicators:** Small icons below the stamina bar showing timed upgrades with remaining duration.

### Screen Flow

```
Boot (loading bar)
  -> Title Screen
    -> How to Play (overlay)
    -> Game (GameScene + UIScene)
      -> Level Up (overlay, game paused)
        -> [if tier change] Promotion Popup first, then upgrade selection
      -> Pause (overlay)
      -> Game Over (stress 100%)
      -> Victory (timer 0:00)
        -> [both end screens have] Play Again / Back to Menu
```

### Game Over Screen

**Transition:** Screen freezes. 1-second pause. "STRESS OVERLOAD" text slams onto screen with screen shake. Then cross-fade to the game over card.

**Content:**
```
╔══════════════════════════════════════╗
║      YOU'VE BEEN LET GO.            ║
║    HR will be in touch.              ║
║──────────────────────────────────────║
║  Title Reached: Manager              ║
║  Time Survived: 6:23                 ║
║  Tasks Delivered: 47                 ║
║  Peak Stress: 100% (obviously)       ║
║  Biggest Problem: The Reply-All      ║
║    Guy spawned 12 extra tasks        ║
║──────────────────────────────────────║
║    [ Try Again ]  [ Menu ]           ║
╚══════════════════════════════════════╝
```

### Victory Screen

**Transition:** Timer hits 0:00. Brief 1-second freeze. Confetti particle burst. Cross-fade to victory card.

**Content:**
```
╔══════════════════════════════════════╗
║     YOU SURVIVED CORPORATE           ║
║         AMERICA.                     ║
║   Your reward: same thing            ║
║        tomorrow.                     ║
║──────────────────────────────────────║
║  Final Title: Director               ║
║  Tasks Delivered: 83                 ║
║    Single-stop: 52                   ║
║    Multi-stop: 24                    ║
║    Triple-stop: 7                    ║
║  Peak Stress: 78%                    ║
║  Upgrades: Coffee IV, Inbox          ║
║    Zero, Speed Reader, ...           ║
║──────────────────────────────────────║
║   [ Play Again ]  [ Menu ]           ║
╚══════════════════════════════════════╝
```

---

## Visual Style

### Art Direction
- **Bright, warm office.** Think "Stardew Valley in a WeWork." Well-lit, colorful, inviting.
- **16-bit pixel art.** 32x32 character sprites. 32x32 or 16x16 tiles (depending on asset availability).
- **Satirical details in the environment:** motivational posters ("Synergy!", "There Is No I In Team But There Is A Me"), "Days Without Incident: 0" counter, passive-aggressive post-it notes on desks, a whiteboard covered in illegible "strategy."
- **Walk cycle animations:** 4 frames per direction minimum. Smooth, not jittery.
- **Character silhouettes must be distinct at 32x32.** The Micromanager looks different from the Reply-All Guy even at a glance.

### Particle Effects

| Event | Effect | Implementation |
|-------|--------|----------------|
| Task pickup | Small sparkle burst (3-5 particles) in task's department color | Phaser particle emitter, 0.3s duration |
| Task delivery | Satisfying burst (8-10 particles) + brief screen flash | Phaser particle emitter, 0.5s duration |
| Level up | Confetti burst (15-20 particles, multi-color) | Phaser particle emitter, 1s duration |
| Promotion | Larger confetti + golden flash overlay | Phaser particle emitter + tween on overlay |
| Stress > 75% | Red pulse on screen edges | Tween on a red rectangle sprite, alpha oscillating 0-0.15 |
| Chaos agent disruption | Subtle screen shake (2px, 0.3s) | `camera.shake(300, 0.003)` |
| Task expiry | Poof/smoke (5 particles, grey) | Particle emitter at task position |

### Player Sprite Variants

Given PixelLab consistency challenges, reduce to **3 visual tiers** instead of 5:

| Variant | Used for Tiers | Visual |
|---------|---------------|--------|
| Casual | Intern, Associate (Levels 1-4) | T-shirt/casual shirt, lanyard, relaxed posture |
| Business | Manager, Director (Levels 5-8) | Button-down + tie, confident stride, tablet in hand |
| Executive | CEO (Level 9) | Suit, briefcase, sunglasses, power walk |

This reduces sprite generation from 5 character variants to 3, which is much more achievable with AI tools while still providing visible progression.

### The Paper Stack Visual

**Implementation (Phase 5, not earlier):** The player sprite has a paper stack overlay sprite attached as a child. The stack sprite has 4 frames: empty (0 tasks), small (1-2 tasks), medium (3-4 tasks), tall (5+ tasks). Simple sprite swap based on current carry count. Not dynamic layering; just swapping which frame of a sprite sheet is shown.

---

## Sprite Asset List (Consolidated)

### Must-Have (Phases 1-5)

**Characters:** 3 player variants + 5 chaos agents + 1 NPC assistant = **9 animated sprite sheets.** Each sheet: idle (4 dir) + walk (4 dir, 4 frames each) = 4 + 16 = 20 frames per character. At 32x32 per frame, each sheet is ~640x64 or equivalent.

**Tasks:** 5 colored task icons (one per department color: orange, blue, green, purple, gold). Plus 1 decoy task variant (same shapes but semi-transparent). Plus multi-stop badge overlay (small "2" or "3" number sprite). = **~8 small sprites.**

**Tileset:** Floor tiles (2-3 variants), wall tiles (horizontal, vertical, corners = ~8), department zone floor highlights (5 colors), desk, printer, filing cabinet, chair, plant, water cooler, whiteboard, conference table = **~25-30 tile sprites.**

**UI:** Stress bar frame, XP bar frame, stamina bar, timer box, upgrade card frame, promotion popup frame, "In a Meeting" sign, speech bubble = **~10 UI sprites.**

**Environment decor:** Motivational posters (3-4), "Days Without Incident" sign, post-it notes = **~5-6 small sprites.**

**Total: ~60-70 unique sprites/frames.** Achievable with PixelLab in 1-2 focused sessions plus free tileset supplements from itch.io.

### Placeholder Art Specification (Phase 1-3)

Until real sprites exist, everything uses colored shapes:

| Element | Placeholder |
|---------|------------|
| Player | 24x24 white rectangle with a 4px colored border (blue) |
| Departments | Filled rectangles in department color, 30% opacity |
| Tasks | 16x16 circles in department color |
| Decoy tasks | 16x16 circles, department color, 50% opacity, pulsing |
| Chaos agents | 24x24 rectangles: red (Micromanager), yellow (Reply-All), grey (Meeting Scheduler), pink (Chatty), orange (Slack Pinger) |
| Walls | Dark grey rectangles |
| Desks/printers | Brown rectangles (impassable) |

---

## Architecture

**Reminder: This is a standalone project, separate from the Astro website. See "Project Separation Strategy" section above.**

```
office-survivors/
├── src/
│   ├── main.js                  # Phaser config, boot
│   ├── scenes/
│   │   ├── BootScene.js          # Preload assets, loading bar
│   │   ├── TitleScene.js         # Title screen, menu
│   │   ├── HowToPlayScene.js     # Controls/tutorial overlay
│   │   ├── GameScene.js          # Core gameplay loop
│   │   ├── UIScene.js            # HUD (runs parallel to GameScene)
│   │   ├── LevelUpScene.js       # Promotion popup + upgrade cards (overlay)
│   │   └── GameOverScene.js      # Win/lose screens
│   │
│   ├── entities/
│   │   ├── Player.js             # Movement, sprint, inventory, collision
│   │   ├── Task.js               # Single + multi-stop. State machine: IDLE -> CARRIED -> DELIVERING -> DONE
│   │   ├── ChaosAgent.js         # Base class: movement, target tracking, wall avoidance
│   │   ├── Micromanager.js       # extends ChaosAgent: follow player, slow aura
│   │   ├── ReplyAllGuy.js        # extends ChaosAgent: walk to desk, burst tasks
│   │   ├── MeetingScheduler.js   # extends ChaosAgent: walk to dept, block deliveries
│   │   ├── ChattyColleague.js    # extends ChaosAgent: wander, freeze player
│   │   ├── SlackPinger.js        # extends ChaosAgent: wander, spawn decoys
│   │   └── Assistant.js          # NPC helper from Strategic Delegation upgrade
│   │
│   ├── systems/
│   │   ├── TaskManager.js        # Spawn logic, tier selection, delivery handling, expiry
│   │   ├── StressManager.js      # Per-frame stress calc, visual feedback triggers
│   │   ├── UpgradeManager.js     # Pool filtering, active effects, duration tracking
│   │   ├── WaveManager.js        # Agent spawn schedule (time + level gates)
│   │   ├── ProgressionManager.js # XP, levels, tier transitions, promotion events
│   │   ├── ParticleManager.js    # Particle effects (pickup, delivery, level-up, expiry)
│   │   └── SoundManager.js       # Procedural audio, BGM, SFX, mute toggle
│   │
│   ├── config/
│   │   ├── gameConfig.js         # All tunable numbers (single source of truth)
│   │   ├── taskData.js           # Task pools per tier, routes, department assignments
│   │   ├── upgradeData.js        # Upgrade definitions, tier gates, effects
│   │   ├── agentSchedule.js      # Time + level gates per agent type
│   │   └── mapData.js            # Spawn points, department zones, player start
│   │
│   ├── ui/
│   │   ├── HUD.js                # All HUD elements: bars, timer, task indicators
│   │   ├── UpgradeCard.js        # Single upgrade card (icon + name + desc)
│   │   ├── PromotionPopup.js     # "PROMOTED!" overlay with tier info
│   │   └── FloatingText.js       # Task name popup on pickup
│   │
│   └── utils/
│       ├── helpers.js            # Color utils, math helpers, random selection
│       └── analytics.js          # GA4 event tracking
│
├── public/
│   ├── assets/
│   │   ├── sprites/              # Character sprite sheets
│   │   ├── tiles/                # Tileset images
│   │   ├── furniture/            # Office furniture sprites
│   │   ├── environment/          # Plants, vending machines, water coolers
│   │   ├── decor/                # Wall art, clocks, papers, supplies
│   │   ├── ui/                   # UI sprites
│   │   └── audio/                # Sound (Phase 4)
│   │
│   └── index.html                # Standalone entry point
│
├── deploy.sh                     # Build + copy to Astro site (see Project Separation section)
├── package.json                  # Pin: phaser@3.80.1, vite@5.x
├── vite.config.js                # MUST set base: '/projects/office-survivors/'
└── README.md
```

### Key Decisions

1. **Separate project from website.** Game has its own repo, own dependencies, own build. Connects to Astro site only via built static output copied to `public/projects/office-survivors/`. See "Project Separation Strategy" for full details.
2. **Arcade Physics only.** No Matter.js. AABB collisions for walls. Overlap checks for pickup/delivery zones.
3. **Task as state machine.** Task entity tracks its own state: `SPAWNED` (on map) -> `CARRIED` (in player inventory) -> `DELIVERING` (multi-stop, partially complete) -> `DONE`. This handles multi-stop cleanly.
4. **Object pooling for tasks.** Don't create/destroy Task objects. Maintain a pool of 30 Task entities. Activate/deactivate as needed. Prevents GC spikes.
5. **Config is the single source of truth.** No magic numbers anywhere in game logic. Every tunable value imports from `config/gameConfig.js`.
6. **UIScene is a separate Phaser scene running in parallel.** It receives events from GameScene (task delivered, stress changed, level up) and updates the HUD. This separation keeps GameScene focused on gameplay, not DOM/text rendering.

---

## Build Phases

### Phase 1: Core Loop (Target: 1 week)
**Goal:** The pickup-deliver-stress loop is playable and fun with colored rectangles. Iframe embedding validated early.

**Deliverables:**
- [ ] Vite + Phaser project scaffolded as a **standalone project** (separate from Astro site), `npm run dev` works
- [ ] `vite.config.js` sets `base: '/projects/office-survivors/'`
- [ ] Tilemap loaded: walls, open floor, 5 department zones (colored rectangles)
- [ ] Player moves with WASD/arrows, collides with walls
- [ ] Sprint (Shift) with stamina bar (include it now since controls reference it; don't defer)
- [ ] Tasks spawn at defined spawn points with department colors
- [ ] Auto-pickup within radius, carry limit of 3
- [ ] Auto-deliver on department zone overlap
- [ ] Stress meter: rises per undelivered task, drops on delivery
- [ ] Task expiry at 60s (flash at 45s, vanish at 60s, +3% stress)
- [ ] 10-minute countdown timer
- [ ] Game over at 100% stress, win at 0:00
- [ ] Basic HUD: stress bar, timer, task count, XP bar
- [ ] XP on delivery, basic leveling (no upgrades yet, just XP bar filling)
- [ ] Title screen with "Start Game" button
- [ ] Game over and win screens with basic stats
- [ ] **Iframe focus smoke test:** Build game, copy to Astro site's `public/projects/office-survivors/`, create a minimal Astro page with iframe + "Click to Play" overlay. Verify WASD works after clicking into iframe on Chrome, Safari, and Firefox. Verify overlay re-shows on blur. Fix any focus issues NOW, not in Phase 6.

**Milestone gate:** Play 3 full games. Is the loop engaging? Is stress pacing fair? Does iframe focus work cleanly? If not, tune `gameConfig.js` numbers and fix focus before proceeding.

### Phase 2: Progression + Upgrades (Target: 1 week)
**Goal:** Leveling up changes the game. Upgrades provide meaningful choices.

**Deliverables:**
- [ ] 5-tier system: task pools change per tier
- [ ] Multi-stop tasks (2-stop) spawn at Manager tier
- [ ] Triple-stop tasks spawn at CEO tier
- [ ] Multi-stop tasks stay in inventory, color shifts on partial delivery
- [ ] HUD shows multi-stop route for carried tasks
- [ ] Promotion popup at tier transitions
- [ ] Level-up screen: 3 upgrade cards, tier-gated pool
- [ ] Implement all 15 upgrade effects
- [ ] Title display updates in HUD on level-up

**Milestone gate:** Play 3 games targeting CEO. Is it achievable ~20% of the time? Does multi-stop feel like interesting logistics or annoying backtracking?

### Phase 3: Chaos Agents (Target: 1 week)
**Goal:** All 5 agents with distinct, fair behaviors.

**Deliverables:**
- [ ] Base ChaosAgent class with simple directional pathfinding
- [ ] Micromanager: follow player, slow aura
- [ ] Reply-All Guy: walk to desk, burst tasks (away from player)
- [ ] Meeting Scheduler: block department, with "Knock Knock" counterplay
- [ ] Chatty Colleague: wander, freeze player on contact
- [ ] Slack Pinger: spawn decoy tasks with visual tell
- [ ] WaveManager: hybrid time + level spawn gates
- [ ] Agent count increases in final 2 minutes
- [ ] Visual feedback for all agent effects

**Milestone gate:** Do agents add fun chaos or frustrating randomness? Can you identify and counterplay each one?

### Phase 4: Polish + Sound (Target: 3-5 days)
**Goal:** Game feels complete, even with placeholder art.

**Deliverables:**
- [ ] Particle effects for all events (pickup, delivery, level up, expiry, stress)
- [ ] Screen shake on chaos agent disruptions
- [ ] Stress visual feedback (vignette at thresholds)
- [ ] Game over transition animation
- [ ] Victory confetti animation
- [ ] Sound effects: pickup ding, delivery whoosh, level up fanfare, stress warning hum, agent disruption thud
- [ ] Background music: royalty-free chiptune office music (loop)
- [ ] Pause overlay (P/Escape)
- [ ] Camera dead zone + smooth follow + bounds
- [ ] Extensive balance tuning: play 10+ games, adjust config values

### Phase 5: Art Integration (Target: 1 week)
**Goal:** Placeholder art replaced with real sprites.

**Deliverables:**
- [ ] Player character sprite (3 variants: Casual, Business, Executive)
- [ ] 5 chaos agent sprites
- [ ] NPC Assistant sprite
- [ ] Office tileset (floor, walls, furniture)
- [ ] Department zone visual treatment (colored floor, themed furniture)
- [ ] Task icons per department
- [ ] Paper stack overlay on player
- [ ] Motivational posters and environmental humor
- [ ] Title screen pixel art logo
- [ ] UI frames for bars and cards

### Phase 6: Final Integration + Ship (Target: 2-3 days)
**Goal:** Live on rohitgarrg.com with clean deployment.

**Deliverables:**
- [ ] `npm run build` in game project produces optimized bundle in `dist/`
- [ ] Run `deploy.sh /path/to/rohitgarrg.com` to copy built game to Astro site
- [ ] Astro page at `/projects/office-survivors` with iframe embed (should already exist from Phase 1 smoke test; finalize styling, add description, screenshots)
- [ ] "Click to Play" overlay with focus handling confirmed working (validated in Phase 1; re-test with final build)
- [ ] Project card added to `/projects` page on the Astro site
- [ ] OG image + meta tags for social sharing
- [ ] "Built with AI" credit in game footer and on project page
- [ ] Cross-browser test: Chrome, Firefox, Safari, Edge (final pass; iframe focus was already tested in Phase 1)
- [ ] Performance check: <3s load, 60fps gameplay, no dropped frames with all agents active
- [ ] Verify `base` path in `vite.config.js` is correct: all assets load via `/projects/office-survivors/assets/...`
- [ ] Commit and deploy Astro site to Vercel

**Deployment checklist (run through on every deploy):**
1. `cd office-survivors && npm run build`
2. `./deploy.sh /path/to/rohitgarrg.com`
3. `cd /path/to/rohitgarrg.com && npx astro build` (verify no build errors)
4. `git add . && git commit && git push` (Vercel auto-deploys)
5. Verify on live site: game loads, keyboard works, assets render

---

## Config Defaults (Rebalance v2 — matches gameConfig.js)

**Note:** This section reflects the actual values in `src/config/gameConfig.js` after Rebalance v2. When in doubt, `gameConfig.js` is always the source of truth.

```javascript
// config/gameConfig.js

export default {
  // === DISPLAY ===
  CANVAS_WIDTH: 960,
  CANVAS_HEIGHT: 540,
  TILE_SIZE: 32,
  MAP_WIDTH_TILES: 40,
  MAP_HEIGHT_TILES: 24,

  // === GAME ===
  GAME_DURATION: 600,          // 10 minutes in seconds

  // === PLAYER ===
  PLAYER_SPEED: 160,           // px/sec
  PLAYER_SPRINT_MULTIPLIER: 1.6,
  PLAYER_STAMINA_MAX: 100,
  PLAYER_STAMINA_DRAIN: 20,   // per second while sprinting
  PLAYER_STAMINA_REGEN: 15,   // per second while not sprinting (was 12)
  PLAYER_TASK_CAPACITY: 3,
  PLAYER_PICKUP_RADIUS: 36,   // px (was 28)
  PLAYER_DELIVERY_RADIUS: 0,  // 0 = zone overlap (handled by Arcade Physics overlap)

  // === TASKS ===
  TASK_SPAWN_INTERVAL_BASE: 6000,   // ms at game start (was 5000)
  TASK_SPAWN_INTERVAL_MIN: 2500,    // ms at game end
  TASK_SPAWN_RAMP: 'linear',
  TASK_MAX_ON_MAP: 15,              // hard cap
  TASK_WARNING_TIME: 45000,         // ms before flashing
  TASK_EXPIRY_TIME: 60000,          // ms before despawn
  TASK_EXPIRY_STRESS: 2,            // % stress on expiry
  TASK_EXPIRY_STRESS_CAP: 20,      // max % stress from expiry in any rolling window
  TASK_EXPIRY_STRESS_CAP_WINDOW: 5000, // ms rolling window for expiry stress cap

  // === TASK XP ===
  TASK_XP_SINGLE_BASE: 20,         // +5 per tier
  TASK_XP_MULTI_2_BASE: 45,        // +10 per tier above Manager
  TASK_XP_MULTI_3_BASE: 80,        // +10 per tier above Director

  // === TASK STRESS RELIEF ===
  TASK_RELIEF_SINGLE: 5,           // % (reverted to spec — late game needs real stress pressure)
  TASK_RELIEF_MULTI_2: 8,            // % (reverted to spec)
  TASK_RELIEF_MULTI_3: 12,           // % (reverted to spec)

  // === STRESS ===
  STRESS_MAX: 100,
  STRESS_RATE_INTERN: 0.02,        // %/sec per undelivered task (was 0.03)
  STRESS_RATE_ASSOCIATE: 0.035,     // was 0.05
  STRESS_RATE_MANAGER: 0.065,       // was 0.055 — steeper late-game ramp
  STRESS_RATE_DIRECTOR: 0.10,       // was 0.08
  STRESS_RATE_CEO: 0.14,            // was 0.10
  STRESS_MEETING_BLOCK: 3,         // instant %
  STRESS_DECOY_PICKUP: 4,          // instant % (was 2 — doubled to punish decoy mistakes)
  STRESS_PASSIVE_DECAY_THRESHOLD: 50, // % stress above which passive decay kicks in
  STRESS_PASSIVE_DECAY_RATE: 0.40,    // %/sec base passive decay (was 0.65 — reduced so CEO stress actually threatens)
  STRESS_BALL_DECAY_BONUS: 0.25,     // extra %/sec from Stress Ball upgrade (was 0.35)
  STRESS_VISUAL_YELLOW: 40,        // threshold %
  STRESS_VISUAL_ORANGE: 65,
  STRESS_VISUAL_RED: 85,

  // === CHAOS AGENTS: SHARED ===
  AGENT_ARRIVAL_THRESHOLD: 8,           // px — distance to consider "arrived" at target
  AGENT_STUCK_THRESHOLD: 4,             // px — distance moved below which agent is "stuck" (was 2)
  AGENT_STUCK_CHECK_INTERVAL: 1000,     // ms between stuck checks (was 500)
  AGENT_STUCK_IDLE_DURATION: 500,       // ms to idle when stuck before retrying
  AGENT_PERPENDICULAR_SPEED_FACTOR: 0.5, // secondary axis speed when navigating around obstacles
  AGENT_WANDER_DIR_CHANGE_MIN: 2000,    // ms min between wander direction changes
  AGENT_WANDER_DIR_CHANGE_MAX: 4000,    // ms max between wander direction changes
  AGENT_SPEECH_INTERVAL_MIN: 12000,     // ms min between periodic speech bubbles
  AGENT_SPEECH_INTERVAL_MAX: 20000,     // ms max between periodic speech bubbles
  AGENT_STUCK_MAX_RETRIES: 3,            // nudge attempts before calling onStuck()
  AGENT_STUCK_NUDGE_DURATION: 1200,     // ms to move perpendicular when stuck (was 400)
  AGENT_SPEECH_DURATION: 3000,          // ms speech bubble stays visible
  AGENT_INFO_PANEL_DURATION: 3000,      // ms info panel stays visible on first spawn
  AGENT_WANDER_STUCK_THRESHOLD: 1.5,    // px — per-frame movement below this = stuck
  AGENT_WANDER_STUCK_TIME: 300,         // ms — force direction change after stuck this long
  AGENT_WANDER_SEEK_CHANCE: 0.35,       // probability of picking player-facing direction

  // === CHAOS AGENTS: MICROMANAGER ===
  MICROMANAGER_SPEED: 110,
  MICROMANAGER_SLOW_FACTOR: 0.6,
  MICROMANAGER_RANGE: 96,              // px (was 80 — slightly harder to dodge)
  MICROMANAGER_STRESS_RATE: 0.3,       // %/sec while player is slowed

  // === CHAOS AGENTS: REPLY-ALL GUY ===
  REPLYALL_SPEED: 65,
  REPLYALL_TASK_BURST: 4,              // was 3 — more pressure per burst
  REPLYALL_COOLDOWN: 8000,             // was 10000 — more frequent bursts
  REPLYALL_TASK_XP_MULT: 0.5,         // 50% XP for Reply-All "junk mail" tasks
  REPLYALL_TASK_EXPIRY_TIME: 20000,    // ms — shorter window to decide (was 30000)
  REPLYALL_TASK_EXPIRY_STRESS: 6,      // % stress on junk mail expiry (was 4 — 24% total if full burst ignored)
  REPLYALL_CHAIN_WINDOW: 10000,        // ms — deliver 2+ junk tasks within this window for full XP
  REPLYALL_CHAIN_XP_MULT: 1.0,        // XP multiplier for 2nd+ junk task in chain (full XP)
  REPLYALL_OVERCAP: 2,                 // tasks allowed above TASK_MAX_ON_MAP
  REPLYALL_MIN_SPAWN_DIST: 160,              // px from player (5 tiles)
  REPLYALL_PAUSE_DURATION: 1000,              // ms pause at desk before bursting
  REPLYALL_BURST_PARTICLE_COUNT: 6,           // email burst visual particles
  REPLYALL_BURST_ANIMATION_DURATION: 600,     // ms particle animation
  REPLYALL_NEAR_PLAYER_COUNT: 3,              // pick target desk from N nearest to player

  // === CHAOS AGENTS: MEETING SCHEDULER ===
  MEETING_SCHEDULER_SPEED: 75,
  MEETING_BLOCK_DURATION: 12000,
  MEETING_COOLDOWN: 20000,
  MEETING_IDLE_CHECK_INTERVAL: 2000,          // ms to wait before re-checking departments

  // === CHAOS AGENTS: CHATTY COLLEAGUE ===
  CHATTY_SPEED: 75,
  CHATTY_FREEZE_DURATION: 2500,
  CHATTY_COOLDOWN: 6000,
  CHATTY_FREEZE_IMMUNITY_WINDOW: 2000,        // ms — immunity after any freeze ends (prevents chain-freezing)
  CHATTY_FREEZE_OVERLAP_DIST: 24,             // px — overlap distance to trigger freeze
  CHATTY_WALK_AWAY_DURATION: 2000,            // ms to walk away after freezing

  // === CHAOS AGENTS: SLACK PINGER ===
  SLACKPINGER_SPEED: 80,
  DECOY_SPAWN_INTERVAL: 5000,          // was 8000 — more decoys on map
  DECOY_LIFETIME: 6000,
  DECOY_CARRY_DURATION: 3000,
  SLACKPINGER_AURA_RANGE: 120,         // px — stress aura radius
  SLACKPINGER_AURA_STRESS_RATE: 0.8,   // %/sec stress while player in aura

  // === CHAOS AGENTS: ENRAGE ===
  // After enrageTime minutes since spawn, agents escalate once
  ENRAGE_MICROMANAGER_TIME: 180000,       // 3 min after spawn
  ENRAGE_MICROMANAGER_RANGE: 128,         // px (was 96)
  ENRAGE_MICROMANAGER_STRESS_RATE: 0.5,   // %/sec (was 0.3)
  ENRAGE_REPLYALL_TIME: 120000,           // 2 min after spawn
  ENRAGE_REPLYALL_BURST: 6,              // tasks per burst (was 4)
  ENRAGE_MEETING_TIME: 120000,            // 2 min after spawn
  ENRAGE_MEETING_MAX_BLOCKS: 2,           // can block 2 depts simultaneously
  ENRAGE_CHATTY_TIME: 90000,              // 90s after spawn
  ENRAGE_CHATTY_FREEZE_DURATION: 3500,    // ms (was 2500)
  ENRAGE_CHATTY_COOLDOWN: 4000,           // ms (was 6000)
  ENRAGE_SLACKPINGER_TIME: 120000,        // 2 min after spawn
  ENRAGE_SLACKPINGER_DECOY_INTERVAL: 3000, // ms (was 5000)
  ENRAGE_SLACKPINGER_AURA_RANGE: 160,     // px (was 120)

  // === PRESSURE BONUS ===
  PRESSURE_AGENT_RANGE: 128,          // px — agent within this range during delivery
  PRESSURE_AGENT_XP_BONUS: 0.5,       // +50% XP
  PRESSURE_STRESS_THRESHOLD: 65,       // % stress above which bonus applies
  PRESSURE_STRESS_XP_BONUS: 0.25,     // +25% XP
  PRESSURE_HOT_ZONE_XP_BONUS: 0.75,   // +75% XP for recently-unblocked dept
  PRESSURE_HOT_ZONE_DURATION: 30000,   // ms duration of hot zone after dept unblock
  PRESSURE_MAX_MULTIPLIER: 3.0,        // cap total pressure multiplier

  // === UPGRADE TUNING ===
  CORNER_OFFICE_AUTO_DELIVER_RANGE: 80,  // px
  FAST_TRACKER_STRESS_RELIEF: 3,         // % stress relief per skip
  DEPT_FAVORITE_XP_MULT: 2.0,
  DEPT_FAVORITE_RELIEF_MULT: 2.0,
  MEETING_BLOCKER_DURATION_MULT: 0.5,
  MEETING_BLOCKER_BLOCKED_XP_MULT: 0.75,
  EXECUTIVE_PRESENCE_SLOW_FACTOR: 0.6,  // agents at 60% speed when EP active (delivery-triggered)
  EXECUTIVE_PRESENCE_DURATION: 8000,    // ms duration of delivery-triggered agent slow

  // === ASSISTANT ===
  ASSISTANT_SPEED: 80,
  ASSISTANT_SPAWN_OFFSET: 40,
  ASSISTANT_PICKUP_RANGE: 28,              // px — how close to pick up a task
  ASSISTANT_WAYPOINT_RANGE: 20,            // px — how close to a waypoint to advance
  ASSISTANT_WANDER_ARRIVAL_RANGE: 16,      // px — how close to wander target before picking new one
  ASSISTANT_FETCH_TIMEOUT: 15000,          // ms before giving up on fetch
  ASSISTANT_DELIVER_TIMEOUT: 20000,        // ms before force-completing delivery
  ASSISTANT_SEEK_DELAY: 5000,              // ms between task seek attempts
  ASSISTANT_DELIVERY_INTERVAL: 30000,      // ms between delivery cycles (was 45000 — 45s too slow to feel useful)
  ASSISTANT_STUCK_CHECK_INTERVAL: 2000,    // ms between stuck checks
  ASSISTANT_STUCK_MOVE_THRESHOLD: 8,       // px — distance below which assistant is "stuck"

  // === PROGRESSION ===
  XP_PER_LEVEL: [80, 120, 180, 240, 340, 520, 680, 840],  // steepened: total 3000 XP to CEO, ~7.5-8 min
  TIER_THRESHOLDS: {
    INTERN:    { minLevel: 1, maxLevel: 2 },
    ASSOCIATE: { minLevel: 3, maxLevel: 4 },
    MANAGER:   { minLevel: 5, maxLevel: 6 },
    DIRECTOR:  { minLevel: 7, maxLevel: 8 },
    CEO:       { minLevel: 9, maxLevel: 9 },
  },
  TIER_ORDER: ['INTERN', 'ASSOCIATE', 'MANAGER', 'DIRECTOR', 'CEO'],
  POST_CEO_MILESTONE_XP_BASE: 500,           // first post-CEO milestone cost (was 300 — slow the flood)
  POST_CEO_MILESTONE_XP_INCREMENT: 200,       // each subsequent costs this much more (was 100)
  MILESTONE_XP_MULTIPLIER_BONUS: 0.1,         // +0.1x XP multiplier per milestone (was 0.5 — kills feedback loop)
  MILESTONE_XP_MULTIPLIER_CAP: 0.3,           // max cumulative bonus from milestones (caps at 1.3x)
  MILESTONE_IPO_BELL: 3,                       // milestone number that triggers IPO Bell celebration

  // === TIMER ===
  TIMER_WARNING_ORANGE: 120,   // seconds remaining
  TIMER_WARNING_RED: 60,       // seconds remaining

  // === TASK VISUALS ===
  TASK_FLASH_INTERVAL: 300,            // ms between flash toggles
  TASK_FLASH_ALPHA: 0.3,               // alpha when flashing "off"
  TASK_BOB_AMPLITUDE: 3,               // px vertical bob distance
  TASK_BOB_DURATION: 600,              // ms half-cycle for bob tween
  TASK_PULSE_SCALE: 1.15,              // max scale during pulse
  TASK_PULSE_DURATION: 800,            // ms half-cycle for pulse tween
  TASK_GLOW_ALPHA: 0.25,              // opacity of glow halo behind task icon
  FLOATING_TEXT_MAX_LENGTH: 45,        // truncate floating text beyond this
  FLOATING_TEXT_DURATION: 3000,        // ms before fade-out (was 2500)
  FLOATING_TEXT_FONT_SIZE: '12px',     // pickup popup size
  TASK_STRIP_MAX_NAME_LENGTH: 70,      // chars before truncation in bottom strip

  // === HUD ===
  HUD_MAX_TASK_SLOTS: 4,              // max task info lines (matches max carry capacity with Extra Hands)
  HUD_BADGE_WIDTH: 34,                // px — task badge width in top bar
  HUD_BADGE_HEIGHT: 12,               // px — task badge height in top bar
  HUD_BADGE_GAP: 3,                   // px — gap between task badges
  STAMINA_LOW_THRESHOLD: 0.2,          // ratio — stamina bar turns red
  STAMINA_WARN_THRESHOLD: 0.4,         // ratio — stamina bar turns yellow

  // === TOASTS ===
  TOAST_DURATION: 4000,                // ms hold time
  TOAST_FADE_IN: 300,                  // ms
  TOAST_FADE_OUT: 500,                 // ms
  SPRINT_HINT_STRESS_THRESHOLD: 50,    // % stress to trigger sprint hint
  TUTORIAL_IDLE_DELAY: 3000,           // ms before showing move hint for idle players

  // === SOUND PROMPT ===
  SOUND_PROMPT_DELAY: 5000,            // ms after game start before sound prompt

  // === WATER COOLER ===
  WATER_COOLER_STRESS_RELIEF: 8,       // % stress reduced on use
  WATER_COOLER_STAMINA_RESTORE: 20,    // stamina points restored on use
  WATER_COOLER_COOLDOWN: 20000,        // ms before it can be used again
  WATER_COOLER_POSITIONS: [
    { x: 37, y: 4 },   // Break Room area (upper-right)
    { x: 20, y: 7 },   // Center-top corridor (high visibility)
    { x: 20, y: 19 },  // Center-south corridor (covers bottom half of map)
  ],

  // === SHARE ===
  SHARE_CARD_WIDTH: 1200,
  SHARE_CARD_HEIGHT: 630,
  SHARE_URL: 'https://rohitgarrg.com/projects/office-survivors',

  // === LEVEL UP ===
  PROMOTION_POPUP_DURATION: 2000,              // ms to show "PROMOTED!" text
  LEVELUP_NO_UPGRADES_CLOSE_DELAY: 1500,      // ms before auto-closing when no upgrades available
  LEVELUP_SELECTION_CLOSE_DELAY: 400,          // ms after selecting an upgrade before closing

  // === GAME OVER ===
  GAME_OVER_DELAY: 1500,              // ms before showing game over screen

  // === CAMERA ===
  CAMERA_ZOOM: 0.703125,              // 540/768 — fits 40x24 tile map in viewport
  CAMERA_LERP: 0.08,
  CAMERA_DEADZONE_WIDTH: 200,
  CAMERA_DEADZONE_HEIGHT: 150,

  // === MOBILE ===
  MOBILE_TAP_MARKER_DURATION: 500,     // ms tap destination marker visible
  MOBILE_SPRINT_HOLD_THRESHOLD: 200,   // ms before long-press triggers sprint
  MOBILE_PAUSE_BUTTON_SIZE: 32,        // game px
  MOBILE_PAUSE_HIT_SIZE: 48,           // game px (larger touch target)

  // Mobile camera
  MOBILE_CAMERA_ZOOM: 1.6,            // ~1/4.5 of map visible
  MOBILE_CAMERA_LERP: 0.1,
  MOBILE_CAMERA_DEADZONE_WIDTH: 80,
  MOBILE_CAMERA_DEADZONE_HEIGHT: 60,

  // Virtual joystick (bottom-left)
  MOBILE_JOYSTICK_X: 100,
  MOBILE_JOYSTICK_Y_OFFSET: -90,      // from canvas bottom
  MOBILE_JOYSTICK_BASE_RADIUS: 50,
  MOBILE_JOYSTICK_THUMB_RADIUS: 22,
  MOBILE_JOYSTICK_BASE_ALPHA: 0.2,
  MOBILE_JOYSTICK_THUMB_ALPHA: 0.5,
  MOBILE_JOYSTICK_MAX_DISTANCE: 45,

  // Sprint button (bottom-right)
  MOBILE_SPRINT_BTN_X_OFFSET: -100,   // from canvas right
  MOBILE_SPRINT_BTN_Y_OFFSET: -90,
  MOBILE_SPRINT_BTN_RADIUS: 30,
  MOBILE_SPRINT_BTN_ALPHA: 0.4,
  MOBILE_SPRINT_BTN_ACTIVE_ALPHA: 0.7,

  // Off-screen department indicators
  MOBILE_DEPT_INDICATOR_SIZE: 14,
  MOBILE_DEPT_INDICATOR_MARGIN: 40,
  MOBILE_DEPT_INDICATOR_PULSE_MS: 800,

  // === TASK TIER SELECTION WEIGHTS ===
  TASK_TIER_WEIGHT_CURRENT: 0.6,
  TASK_TIER_WEIGHT_BELOW: 0.3,
  TASK_TIER_WEIGHT_ABOVE: 0.1,

  // === EFFECTS ===
  // See gameConfig.js EFFECTS object for full list:
  // particle counts, lifetimes, screen flash, camera shake, vignette, victory confetti,
  // game over freeze timing. All under CONFIG.EFFECTS.* namespace.

  // === SOUND ===
  // See gameConfig.js SOUND object:
  // ENABLED: true, MASTER_VOLUME: 0.3, BGM_VOLUME: 0.12, BGM_TEMPO: 120

  // === DEBUG ===
  // See gameConfig.js DEBUG object:
  // SHOW_COLLISION_BODIES, GOD_MODE, START_LEVEL, INFINITE_STAMINA,
  // STRESS_FREEZE, FAST_SPAWN, SKIP_TITLE
};
```

---

## Known Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Multi-stop tasks feel like busywork | High | Playtest in Phase 2. Fallback: make multi-stop tasks just higher-value single-stops with bonus XP, no routing. |
| Sprite inconsistency across AI-generated assets | Medium | Reduce to 3 player variants. Use first sprite as style reference for all others. Fallback to itch.io asset packs. |
| XP curve too easy/hard to reach CEO | Medium | All XP values in config. Play 10+ games in Phase 2 and tune. Target: 20% of runs reach CEO. |
| Iframe keyboard focus loss | Medium | Tested in Phase 1 (not deferred to Phase 6). "Click to play" overlay on load. Re-show on iframe blur event. If issues persist across browsers, fallback: embed game directly in Astro page instead of iframe (more coupling but guaranteed focus). |
| Vite base path misconfiguration | Medium | `base: '/projects/office-survivors/'` in `vite.config.js` is critical. Without it, assets load standalone but break in iframe. Verified in Phase 1 smoke test. |
| Game changes break website (or vice versa) | Low | Eliminated by design. Separate projects with no shared dependencies. Only connection is static files copied to `public/`. |
| Game feels same every run (no replay value) | Low | Randomized task spawns, random upgrade offerings (3 of 14), random agent targeting. Future: seed-based daily challenges. |
| Asset loading > 3 seconds | Low | Use texture atlases. Compress PNGs. BootScene loading bar. Total asset budget: <2MB. |

---

## MVP Scope

**In scope (this build):**
- Core delivery loop with 5 departments
- 5-tier career progression with evolving tasks
- Multi-stop (2 and 3) task mechanic
- 5 chaos agents with distinct behaviors
- 15 upgrades, tier-gated
- Task expiry mechanic
- Desktop keyboard controls
- Mobile/touch controls (joystick, sprint button, zoomed camera, department indicators)
- Stress system with visual feedback
- AI-generated or asset-pack pixel art
- Sound effects + background music
- Iframe embed on rohitgarrg.com (validated in Phase 1)
- Win/lose screens with stats and satirical copy

**Out of scope (future):**
- High score persistence/leaderboard
- Multiple office maps
- Boss fight finale
- Unlockable characters
- Daily challenges
- Social sharing
- Achievements

---

## Credits & Attribution

- Game: Built by Rohit Garg
- Engine: Phaser 3.80.1
- Art: AI-generated via PixelLab + [asset sources TBD]
- Built with Claude Code

---

*End of spec v3.1.*
