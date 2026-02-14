# Upgrade Rebalance v2 — Reference

Applied in this session. All changes are live in the codebase.

## Part 1: Base Balance Tweaks (gameConfig.js)

### Stress Rates (~30% reduction across all tiers)
| Tier | Before | After |
|---|---|---|
| Intern | 0.03 | 0.02 |
| Associate | 0.05 | 0.035 |
| Manager | 0.08 | 0.055 |
| Director | 0.11 | 0.08 |
| CEO | 0.15 | 0.10 |

### Stress Relief on Delivery (increased)
| Task Type | Before | After |
|---|---|---|
| Single-stop | 5% | 7% |
| Multi-2 | 8% | 11% |
| Multi-3 | 12% | 16% |

### Passive Stress Decay (NEW)
- Kicks in above 50% stress
- Base rate: 0.5%/sec (safety net so stress doesn't snowball)
- Stress Ball upgrade adds +1.0%/sec on top (total 1.5%/sec)
- Implemented in StressManager.update()

### Player Stats
| Stat | Before | After |
|---|---|---|
| Pickup radius | 28px | 36px |
| Stamina regen | 12/sec | 15/sec |

### Spawn Rate
| Setting | Before | After |
|---|---|---|
| TASK_SPAWN_INTERVAL_BASE | 5000ms | 6000ms |

### XP Curve (late game reduced)
| Level | Before | After | Change |
|---|---|---|---|
| 2 | 80 | 80 | — |
| 3 | 120 | 120 | — |
| 4 | 160 | 160 | — |
| 5 | 220 | 200 | -20 |
| 6 | 300 | 260 | -40 |
| 7 | 400 | 340 | -60 |
| 8 | 500 | 420 | -80 |
| 9 | 650 | 520 | -130 |

---

## Part 2: Upgrade Overhaul

### S-Tier (5 upgrades)

| Upgrade | Before | After |
|---|---|---|
| Coffee IV Drip | +20% speed (permanent) | No change |
| Extra Hands | +1 carry capacity (permanent) | No change |
| Speed Reader | +40% pickup radius | +40% pickup radius **+ 40% delivery zone size on ALL depts** |
| Stress Ball | Instant -15% stress (repeatable) | **Permanent** +1%/sec passive stress decay |
| Strategic Delegation | NPC auto-delivers every 45s | No change |

### A-Tier (9 upgrades)

| Upgrade | Before | After |
|---|---|---|
| Noise-Cancelling AirPods | 30s immunity to Chatty Colleague | **Permanent** immunity to ALL movement impairment (freeze + slow) |
| Executive Presence | 20s agent repel 120px | **Permanent** all chaos agents 30% slower |
| Reply-All Filter | Lv6+, decoys glow red | **Lv3+**, decoys glow red **+ task navigation flag** |
| Corner Office | Random dept zone 2x | **Most-delivered** dept zone 2x **+ auto-deliver within 80px proximity** |
| Meeting Blocker | 30s no dept blocks | **Permanent** halved block durations + 75% XP through blocks |
| Departmental Favorite | 2x delivery range on favorite dept | **2x XP + 2x stress relief** on most-delivered dept |
| Inbox Zero | Instant deliver all held tasks | No change |
| LinkedIn Thought Leader | 1.5x XP for 45s | **2x XP for 60s** |
| Fast Tracker | 3 charges, skip last stop | **5 charges** + **3% stress relief per skip** |

### Availability Gates Changed
| Upgrade | Before | After |
|---|---|---|
| Executive Presence | Lv4+ | Lv3+ |
| Reply-All Filter | Lv6+ | Lv3+ |
| Meeting Blocker | Lv4+ | Lv3+ |
| Fast Tracker | Lv5+ | Lv4+ |

---

## New Config Keys Added (gameConfig.js)

```
STRESS_PASSIVE_DECAY_THRESHOLD: 50
STRESS_PASSIVE_DECAY_RATE: 0.5
STRESS_BALL_DECAY_BONUS: 1.0
CORNER_OFFICE_AUTO_DELIVER_RANGE: 80
FAST_TRACKER_STRESS_RELIEF: 3
DEPT_FAVORITE_XP_MULT: 2.0
DEPT_FAVORITE_RELIEF_MULT: 2.0
MEETING_BLOCKER_DURATION_MULT: 0.5
MEETING_BLOCKER_BLOCKED_XP_MULT: 0.75
EXECUTIVE_PRESENCE_SLOW_FACTOR: 0.7
```

---

## Files Modified

1. `src/config/gameConfig.js` — all number tweaks + new config keys
2. `src/config/upgradeData.js` — all 14 upgrade definitions rewritten
3. `src/systems/StressManager.js` — passive decay in update()
4. `src/systems/UpgradeManager.js` — all apply logic for new upgrade types
5. `src/systems/TaskManager.js` — calculateXP/getStressRelief accept departmentId for Dept Favorite bonus
6. `src/scenes/GameScene.js` — Corner Office auto-deliver proximity check
7. `src/entities/Player.js` — freeze() immunity check + isImmuneToSlow() method

---

## Phase 3 Integration Notes

When chaos agents are implemented, they need to check:
- `upgradeManager.isActive('executive_presence')` → apply CONFIG.EXECUTIVE_PRESENCE_SLOW_FACTOR to agent speed
- `upgradeManager.isActive('meeting_blocker')` → apply CONFIG.MEETING_BLOCKER_DURATION_MULT to block duration, allow delivery through blocks at CONFIG.MEETING_BLOCKER_BLOCKED_XP_MULT XP
- `player.isImmuneToSlow()` → Micromanager should skip applying slow effect
- `upgradeManager.taskNavigationActive` → UIScene should draw navigation arrows to task destinations
- `upgradeManager.isActive('reply_all_filter')` → decoy tasks should glow red (same check as before, ID unchanged)
