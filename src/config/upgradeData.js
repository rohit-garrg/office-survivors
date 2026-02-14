/**
 * All 14 upgrades with tier gates, effects, and descriptions.
 *
 * availableFrom: minimum player level to appear in upgrade pool.
 * category: grouping for filtering logic.
 * duration: 'permanent', 'instant', or number in ms.
 * uses: number of uses (for limited-use upgrades like Fast Tracker), or null.
 *
 * === REBALANCE v2 ===
 * Target: 5 S-tier + 9 A-tier = 0 filler picks.
 * Every level-up should feel like a real power spike.
 */
export const UPGRADES = [
  // ─── S-TIER ─────────────────────────────────────────
  {
    id: 'coffee_iv_drip',
    name: 'Coffee IV Drip',
    description: 'Mainlining caffeine. As one does.',
    effect: '+20% move speed (permanent)',
    availableFrom: 1,
    category: 'always_useful',
    duration: 'permanent',
    uses: null,
    apply: {
      type: 'speed_boost',
      value: 0.2,
    },
  },
  {
    id: 'extra_hands',
    name: 'Extra Hands',
    description: "You've grown a third arm. Metaphorically.",
    effect: '+1 carry capacity (permanent)',
    availableFrom: 1,
    category: 'always_useful',
    duration: 'permanent',
    uses: null,
    apply: {
      type: 'carry_capacity',
      value: 1,
    },
  },
  {
    id: 'speed_reader',
    name: 'Speed Reader',
    description: 'You can read a memo from across the room. And deliver from across the hall.',
    effect: '+40% pickup radius + 40% delivery zone size (permanent)',
    availableFrom: 1,
    category: 'always_useful',
    duration: 'permanent',
    uses: null,
    apply: {
      type: 'speed_reader',
      pickupBoost: 0.4,
      deliveryZoneBoost: 1.4, // multiply all dept zone sizes by 1.4x
    },
  },
  {
    id: 'stress_ball',
    name: 'Stress Ball',
    description: 'Squeeze. Breathe. Repeat. Forever.',
    effect: 'Permanent -1%/sec passive stress decay',
    availableFrom: 1,
    category: 'always_useful',
    duration: 'permanent',
    uses: null,
    apply: {
      type: 'stress_decay',
    },
  },
  {
    id: 'strategic_delegation',
    name: 'Strategic Delegation',
    description: 'Finally, leverage.',
    effect: 'NPC assistant auto-delivers 1 task every 45s (permanent)',
    availableFrom: 5,
    category: 'advanced',
    duration: 'permanent',
    uses: null,
    apply: {
      type: 'spawn_assistant',
      interval: 45000,
    },
  },

  // ─── A-TIER ─────────────────────────────────────────
  {
    id: 'noise_cancelling_airpods',
    name: 'Noise-Cancelling AirPods',
    description: "Sorry, can't hear you. In a zone. Permanently.",
    effect: 'Immune to ALL movement impairment (freeze + slow) (permanent)',
    availableFrom: 2,
    category: 'anti_agent',
    duration: 'permanent',
    uses: null,
    apply: {
      type: 'movement_immunity',
    },
  },
  {
    id: 'executive_presence',
    name: 'Executive Presence',
    description: "Something about your aura says 'don't bother me.' Permanently.",
    effect: 'All chaos agents move 30% slower (permanent)',
    availableFrom: 3,
    category: 'anti_agent',
    duration: 'permanent',
    uses: null,
    apply: {
      type: 'agent_slow',
      factor: 0.7, // agents move at 70% speed
    },
  },
  {
    id: 'reply_all_filter',
    name: 'Reply-All Filter',
    description: 'Your spam filter leveled up. Now with navigation.',
    effect: 'Decoy tasks glow red + navigation arrows on all tasks (permanent)',
    availableFrom: 3,
    category: 'anti_agent',
    duration: 'permanent',
    uses: null,
    apply: {
      type: 'task_navigation',
    },
  },
  {
    id: 'corner_office',
    name: 'Corner Office',
    description: 'Prime real estate. Tasks practically deliver themselves.',
    effect: 'Best dept zone 2x bigger + auto-deliver within proximity (permanent)',
    availableFrom: 3,
    category: 'delivery',
    duration: 'permanent',
    uses: null,
    apply: {
      type: 'corner_office',
      zoneMultiplier: 2,
    },
  },
  {
    id: 'meeting_blocker',
    name: 'Meeting Blocker',
    description: 'You declined all meetings. Power move.',
    effect: 'Block durations halved + deliver through blocks at 75% XP (permanent)',
    availableFrom: 3,
    category: 'anti_agent',
    duration: 'permanent',
    uses: null,
    apply: {
      type: 'meeting_blocker',
    },
  },
  {
    id: 'departmental_favorite',
    name: 'Departmental Favorite',
    description: 'They owe you a favor. A big one.',
    effect: '2x XP + 2x stress relief on your most-delivered dept (permanent)',
    availableFrom: 3,
    category: 'delivery',
    duration: 'permanent',
    uses: null,
    apply: {
      type: 'favorite_dept',
    },
  },
  {
    id: 'inbox_zero',
    name: 'Inbox Zero',
    description: 'The mythical state. Achieved briefly.',
    effect: 'Instantly deliver all currently held tasks',
    availableFrom: 3,
    category: 'delivery',
    duration: 'instant',
    uses: null,
    apply: {
      type: 'instant_deliver_all',
    },
  },
  {
    id: 'linkedin_thought_leader',
    name: 'LinkedIn Thought Leader',
    description: 'Posted a hot take. Engagement through the roof.',
    effect: '2x XP for 60 seconds',
    availableFrom: 3,
    category: 'xp_boost',
    duration: 60000,
    uses: null,
    apply: {
      type: 'xp_multiplier',
      value: 2.0,
    },
  },
  {
    id: 'fast_tracker',
    name: 'Fast Tracker',
    description: 'Apparently you have authority to fast-track. And it feels great.',
    effect: 'Next 5 multi-stop tasks skip their last stop + 3% stress relief each',
    availableFrom: 4,
    category: 'advanced',
    duration: 'permanent',
    uses: 5,
    apply: {
      type: 'skip_last_stop',
      charges: 5,
    },
  },
];
