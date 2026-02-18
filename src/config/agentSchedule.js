/**
 * Chaos agent spawn schedule.
 *
 * An agent type only spawns if BOTH conditions are met:
 * enough game time has passed AND the player has reached a minimum level.
 *
 * timeGate: seconds of game time before agent can spawn.
 * levelGate: minimum player level required.
 * initialCount: how many spawn when gates are first met.
 * maxCount: maximum simultaneous agents of this type.
 * maxCountTime: game time (seconds) when maxCount becomes active (if > initialCount).
 * persistent: whether agent stays active permanently (vs. despawning).
 */
export const AGENT_SCHEDULE = [
  {
    type: 'micromanager',
    name: 'The Micromanager',
    timeGate: 90, // 1:30
    levelGate: 2,
    initialCount: 1,
    maxCount: 2,
    maxCountTime: 360, // 6:00
    persistent: true,
  },
  {
    type: 'chatty_colleague',
    name: 'The Chatty Colleague',
    timeGate: 120, // 2:00 (swapped: was 5:30 — early "oh no" moment)
    levelGate: 2,
    initialCount: 1,
    maxCount: 2,
    maxCountTime: 480, // 8:00
    persistent: true,
  },
  {
    type: 'meeting_scheduler',
    name: 'The Meeting Scheduler',
    timeGate: 270, // 4:30
    levelGate: 4,
    initialCount: 1,
    maxCount: 1,
    maxCountTime: null,
    persistent: true,
  },
  {
    type: 'reply_all_guy',
    name: 'The Reply-All Guy',
    timeGate: 270, // 4:30 (swapped: was 3:00 — burst-spawn is harder to grasp)
    levelGate: 4,
    initialCount: 1,
    maxCount: 2,
    maxCountTime: 420, // 7:00
    persistent: true,
  },
  {
    type: 'slack_pinger',
    name: 'The Slack Pinger',
    timeGate: 360, // 6:00 (was 7:00 — 4 min of presence instead of 3)
    levelGate: 5, // was 6
    initialCount: 1,
    maxCount: 1,
    maxCountTime: null,
    persistent: true,
  },
];
