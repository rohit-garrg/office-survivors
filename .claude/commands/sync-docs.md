---
description: Sync CLAUDE.md and spec with current codebase. Use when asked to "update the spec file", "update CLAUDE.md", "sync docs", "check documentation", "refresh docs", or "check docs for drift".
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(ls:*), Bash(wc:*)
---

# Sync Documentation with Codebase

You are a documentation sync tool for the Office Survivors game project. Your job is to detect drift between the codebase (source of truth) and the two documentation files, then surgically update only the drifted sections.

**Source of truth:** The code is ALWAYS right. Docs get updated to match code, never the other way around.

**Never modify:** `upgrade-rebalance-v2.md` (read-only changelog reference).

**Hard constraint:** CLAUDE.md must stay under 250 lines. If an update would push it over, trim redundant content (content duplicated in source files) to make room. Prefer keeping architectural rules, constraints, and gotchas over reproducible details.

---

## Phase 1: Gather Codebase State

Read all source-of-truth files in parallel:

**Config files:**
- `src/config/gameConfig.js` — all tunable numbers
- `src/config/taskData.js` — task pools per tier
- `src/config/upgradeData.js` — upgrade definitions
- `src/config/agentSchedule.js` — agent spawn schedule
- `src/config/mapData.js` — department colors, spawn points

**Scene files:**
- `src/scenes/GameScene.js` — event emissions

**Build config:**
- `vite.config.js` — base path

**Event discovery (Grep across entire src/):**
- Pattern: `events\.emit\(` — find all event emissions with names and payloads
- Pattern: `events\.on\(` — find all event listeners

**File tree:**
- Run `ls -R src/` and `ls -R public/` (via Bash) to get actual directory structure
- Ignore `.DS_Store` files

---

## Phase 2: Read Documentation Files

Read these two files:
- `CLAUDE.md` (project root)
- `office-survivors-spec-v3.1.md` (project root)

Also read `upgrade-rebalance-v2.md` for reference (do NOT modify it).

Run `wc -l CLAUDE.md` to get the current line count.

---

## Phase 3: Run Sync Checks

Compare codebase state against documentation. For each check, determine: CLEAN (no drift) or DRIFTED (needs update).

### CLAUDE.md Checks

#### Check 1: Project Structure Summary
- **Source:** Actual `ls -R src/` output
- **Doc section:** The bullet list under "Project Structure" in CLAUDE.md (compact folder summaries)
- **Compare:** Folder names and their one-line descriptions
- **Drift types:** New folders in code not mentioned, folders listed that don't exist, new major files not mentioned
- **Update rule:** Update the bullet list. Keep it compact — one line per folder with a brief description. Do NOT expand into a full file tree. Only mention individual files if they are new top-level folders or significantly change a folder's purpose.

#### Check 2: Event Contract Summary
- **Source:** All `events.emit(` calls found via Grep across `src/**/*.js`
- **Doc section:** The "Event Contract" summary in CLAUDE.md (compact list of event naming patterns + key events)
- **Compare:** Event naming patterns and key events listed
- **Drift types:** New event pattern groups not mentioned, key events listed that no longer exist, missing critical events
- **Update rule:** Update the compact summary. Do NOT expand into a full table — that's what the source code is for. Only list naming patterns and a few key events with non-obvious payloads (like `game-over` being a scene launch param).

#### Check 3: Department Colors Table
- **Source:** `DEPARTMENT_COLORS` or equivalent export in `src/config/mapData.js`
- **Doc section:** "Department Colors" table in CLAUDE.md
- **Compare:** Department names, color names, hex values
- **Drift types:** Changed hex values, added/removed departments
- **Update rule:** Update table rows to match code.

#### Check 4: Vite Base Path
- **Source:** `base` value in `vite.config.js`
- **Doc section:** References in CLAUDE.md (Architecture Rule #6, Common Pitfalls #6, Astro Integration section)
- **Compare:** Ensure all path references match the actual base path value
- **Drift types:** Mismatched path values
- **Update rule:** Update any stale path references.

#### Check 5: Tech Stack Versions
- **Source:** `package.json` dependencies
- **Doc section:** "Tech Stack" in CLAUDE.md
- **Compare:** Phaser version, Vite major version
- **Drift types:** Version pinned in doc doesn't match package.json
- **Update rule:** Update version references.

### Spec File Checks (office-survivors-spec-v3.1.md)

#### Check 6: Config Defaults
- **Source:** `src/config/gameConfig.js` (every exported constant)
- **Doc section:** Config defaults / tunable numbers section in spec
- **Compare:** Key names, values. gameConfig.js is ALWAYS the source of truth.
- **Drift types:** Values differ, keys in code not in spec, keys in spec not in code, renamed keys
- **Update rule:** Update values to match code. Add missing keys grouped logically. Remove keys that no longer exist. Note: only update the spec's config section — don't change gameConfig.js.

#### Check 7: Task Pool Definitions
- **Source:** `src/config/taskData.js`
- **Doc section:** Task definitions per tier in spec
- **Compare:** Task names, departments, XP values, stop counts, tier assignments
- **Drift types:** Tasks added/removed/modified, tier reassignment
- **Update rule:** Update spec tables to match taskData.js.

#### Check 8: Upgrade Definitions
- **Source:** `src/config/upgradeData.js`
- **Doc section:** Upgrade list/table in spec
- **Compare:** Upgrade ids, names, tier gates, effects, durations
- **Drift types:** Upgrades added/removed/modified, tier gate changes, effect changes
- **Update rule:** Update spec to match upgradeData.js. Cross-reference upgrade-rebalance-v2.md for context on intentional changes.

#### Check 9: Agent Spawn Schedule
- **Source:** `src/config/agentSchedule.js`
- **Doc section:** Agent schedule / wave system in spec
- **Compare:** Agent types, time gates, level gates, max counts
- **Drift types:** Schedule changes, new agents, removed agents
- **Update rule:** Update spec to match agentSchedule.js.

#### Check 10: Stress Math
- **Source:** `src/config/gameConfig.js` (STRESS_* constants) + `src/systems/StressManager.js` (formulas)
- **Doc section:** Stress system section in spec
- **Compare:** Rates, thresholds, relief values, decay mechanics, formulas
- **Drift types:** Changed values, new mechanics, formula changes
- **Update rule:** Update spec values and formulas to match code.

#### Check 11: XP Economy
- **Source:** `src/config/gameConfig.js` (XP_PER_LEVEL, TASK_XP_*, TIER_*, POST_CEO_*, MILESTONE_*)
- **Doc section:** Progression / XP section in spec
- **Compare:** XP per level array, task XP values, tier thresholds, milestone rewards
- **Drift types:** Changed values, new progression keys, renamed keys
- **Update rule:** Update spec to match gameConfig.js.

---

## Phase 4: Apply Updates

For each DRIFTED check:
1. Use the Edit tool to surgically update ONLY the drifted section
2. Preserve surrounding content exactly as-is
3. Match the existing formatting style (table alignment, indentation, etc.)
4. Don't rewrite clean sections

If a section in the spec doesn't exist yet for new config keys, add a new subsection in the appropriate location.

---

## Phase 5: Enforce 250-Line Cap on CLAUDE.md

After all edits, run `wc -l CLAUDE.md`.

If the file exceeds 250 lines, trim it back under by applying these rules in priority order:

1. **Remove content duplicated in source files.** If a detail can be found by reading a specific source file, remove it from CLAUDE.md and add a one-line pointer to the file instead (e.g., "See `BootScene.js` for fallback texture details").
2. **Condense verbose sections.** Replace full tables/code blocks with compact summaries (e.g., a 20-row event table becomes 4 bullet points of naming patterns).
3. **Remove operational checklists.** Deploy steps, verification checklists, and step-by-step guides belong in separate reference docs or scripts, not in CLAUDE.md.
4. **Never cut:** Critical Architecture Rules, Common Pitfalls, Tech Stack constraints, or spec/rebalance references.

After trimming, run `wc -l CLAUDE.md` again to confirm it's under 250 lines.

---

## Phase 6: Report

After all checks, output a summary report in this exact format:

```
## Documentation Sync Report

### CLAUDE.md (N lines)
- [x] Project Structure — CLEAN
- [ ] Event Contract — UPDATED (added: upgrade-capacity-changed pattern)
- [x] Department Colors — CLEAN
- [x] Vite Base Path — CLEAN
- [x] Tech Stack Versions — CLEAN
- Line budget: N/250

### office-survivors-spec-v3.1.md
- [ ] Config Defaults — UPDATED (added 12 keys, changed 3 values)
- [x] Task Pools — CLEAN
...

Legend: [x] = no changes needed, [ ] = updated
```

If ALL checks are clean: output "All checks passed. No changes made."

---

## Important Rules

1. **gameConfig.js is ALWAYS right.** If spec says one value and gameConfig.js says another, update the spec.
2. **Only update drifted sections.** Don't rewrite clean content.
3. **Preserve formatting.** Match existing markdown style (table alignment, heading levels, code block style).
4. **Add missing items, remove stale items.** Don't leave ghost entries for deleted code.
5. **Never modify upgrade-rebalance-v2.md.** It's a read-only changelog.
6. **No git operations.** This skill syncs docs only. Committing is a separate step.
7. **Be thorough but surgical.** Read everything needed, but only edit what's actually wrong.
8. **CLAUDE.md must stay under 250 lines.** If an update pushes it over, trim redundant content before finishing. Architectural rules and gotchas always survive; reproducible details get cut first.
