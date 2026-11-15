/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RaceMission, RaceMode, RacePerkId, TrackWeather, CarEntity } from './types';

export interface RaceModeMeta {
  id: RaceMode;
  name: string;
  tagline: string;
  bonusNote: string;
}

export const RACE_MODES: RaceModeMeta[] = [
  {
    id: 'championship',
    name: 'Championship',
    tagline: 'Multi-lap sprint to the checkered flag against automated rivals.',
    bonusNote: '1st Place +120 CR',
  },
  {
    id: 'knockout',
    name: 'Knockout',
    tagline: 'Last-place racer is eliminated every 12 seconds until 1 survivor remains.',
    bonusNote: 'Survival +160 CR',
  },
  {
    id: 'drift_fever',
    name: 'Drift Fever',
    tagline: 'Stack drift, mini-turbo, and near-miss combos for a 5x Fever payout.',
    bonusNote: 'Combo Payout x2',
  },
];

export interface RacePerkMeta {
  id: RacePerkId;
  name: string;
  cost: number;
  summary: string;
  effectShort: string;
  color: string;
}

export const RACE_PERKS: RacePerkMeta[] = [
  {
    id: 'none',
    name: 'Stock Spec',
    cost: 0,
    summary: 'Pure mechanical racing with zero track-mod assists.',
    effectShort: 'Standard setup',
    color: '#94a3b8',
  },
  {
    id: 'coin_magnet',
    name: 'Apex Magnet',
    cost: 0,
    summary: 'Pulls nearby track coins automatically and widens Near-Miss range by 35%.',
    effectShort: 'Magnet + Wide Pass',
    color: '#facc15',
  },
  {
    id: 'twin_nitro',
    name: 'Twin Nitro Tank',
    cost: 180,
    summary: 'Launch with 100% Nitro charge and refill Nitro 35% faster while drifting.',
    effectShort: '100% Start Nitro',
    color: '#06b6d4',
  },
  {
    id: 'ram_shield',
    name: 'Bumper Rammer',
    cost: 240,
    summary: 'Trade paint without losing speed—bumping rivals steals +18% Nitro!',
    effectShort: 'Impact Nitro Steal',
    color: '#f97316',
  },
  {
    id: 'slipstream_pro',
    name: 'Slipstream Pro',
    cost: 300,
    summary: 'Doubles aerodynamic drafting pocket range and boosts draft surge to +32%.',
    effectShort: '2x Draft Range',
    color: '#a855f7',
  },
];

export interface WeatherMeta {
  id: TrackWeather;
  name: string;
  effect: string;
}

export const TRACK_WEATHERS: WeatherMeta[] = [
  {
    id: 'clear',
    name: 'Clear',
    effect: 'Balanced grip & daylight visibility',
  },
  {
    id: 'night',
    name: 'Night Rush',
    effect: 'Headlight beams · +15% Drift Points',
  },
  {
    id: 'rain',
    name: 'Wet Slicks',
    effect: 'Rain streaks · +20% Faster Mini-Turbo',
  },
];

export const INITIAL_MISSIONS: RaceMission[] = [
  {
    id: 'm_near_miss',
    title: 'Close Shave',
    description: 'Land 5 Near-Miss overtakes against rivals',
    metric: 'near_misses',
    target: 5,
    progress: 0,
    reward: 150,
    claimed: false,
  },
  {
    id: 'm_mini_turbo',
    title: 'Spark Igniter',
    description: 'Unleash 4 Mini-Turbo or Ultra-Turbo boosts',
    metric: 'mini_turbos',
    target: 4,
    progress: 0,
    reward: 200,
    claimed: false,
  },
  {
    id: 'm_wins',
    title: 'Podium Hunter',
    description: 'Finish 1st Place in any track or mode',
    metric: 'wins',
    target: 1,
    progress: 0,
    reward: 280,
    claimed: false,
  },
];

const MISSION_ROTATION_POOL: Omit<RaceMission, 'progress' | 'claimed'>[] = [
  {
    id: 'm_near_miss_pro',
    title: 'Thread the Needle',
    description: 'Land 8 Near-Miss overtakes against rivals',
    metric: 'near_misses',
    target: 8,
    reward: 240,
  },
  {
    id: 'm_mini_turbo_pro',
    title: 'Sideways Master',
    description: 'Unleash 6 Mini-Turbo boosts out of corners',
    metric: 'mini_turbos',
    target: 6,
    reward: 260,
  },
  {
    id: 'm_coins_run',
    title: 'Gold Collector',
    description: 'Bank 300 CR during races from coins & combos',
    metric: 'coins',
    target: 300,
    reward: 220,
  },
  {
    id: 'm_drift_fever',
    title: 'Tire Shredder',
    description: 'Score 400 Drift Points across any tracks',
    metric: 'drift_points',
    target: 400,
    reward: 250,
  },
  {
    id: 'm_wins_double',
    title: 'Checkered Champion',
    description: 'Win 2 races in any mode',
    metric: 'wins',
    target: 2,
    reward: 360,
  },
];

export function updateMissionProgress(
  missions: RaceMission[],
  deltas: Partial<Record<RaceMission['metric'], number>>
): RaceMission[] {
  return missions.map((m) => {
    if (m.claimed) return m;
    const add = deltas[m.metric] || 0;
    if (add <= 0) return m;
    return {
      ...m,
      progress: Math.min(m.target, m.progress + add),
    };
  });
}

export function rotateClaimedMission(missions: RaceMission[], missionId: string): RaceMission[] {
  const randomTemplate =
    MISSION_ROTATION_POOL[Math.floor(Math.random() * MISSION_ROTATION_POOL.length)];
  return missions.map((m) => {
    if (m.id !== missionId) return m;
    return {
      ...randomTemplate,
      id: `${randomTemplate.id}_${Date.now()}`,
      progress: 0,
      claimed: false,
    };
  });
}

// Pure helper for Knockout elimination: returns the last-place active non-finished car
export function findKnockoutEliminationTarget(cars: CarEntity[]): CarEntity | null {
  const active = cars.filter((c) => !c.isEliminated && !c.isFinished);
  if (active.length <= 1) return null;
  // Sort ascending by totalDistance so lowest distance (last place) is first
  const sorted = [...active].sort((a, b) => a.totalDistance - b.totalDistance);
  return sorted[0];
}
