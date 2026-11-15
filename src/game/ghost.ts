/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BakedTrack, findNearestTrackSample } from './physics';
import { lerp, lerpAngle } from './replay';
import { CarEntity, CarStats, GhostLapSample, TrackGhostLap } from './types';

export const DEFAULT_GHOST_SAMPLE_INTERVAL = 0.05;
export const MAX_GHOST_SAMPLES = 2400;

export function recordGhostSample(
  samples: GhostLapSample[],
  lapTime: number,
  car: Pick<CarEntity, 'x' | 'y' | 'angle' | 'speed' | 'steerAngle'>,
  options?: { minInterval?: number; force?: boolean; maxSamples?: number }
): boolean {
  const minInterval = options?.minInterval ?? DEFAULT_GHOST_SAMPLE_INTERVAL;
  const force = options?.force ?? false;
  const maxSamples = options?.maxSamples ?? MAX_GHOST_SAMPLES;

  const clampedTime = Math.max(0, Math.round(lapTime * 1000) / 1000);
  const last = samples[samples.length - 1];

  if (!force && last && clampedTime - last.t < minInterval) {
    return false;
  }

  if (samples.length >= maxSamples) {
    samples.splice(1, 1);
  }

  samples.push({
    t: clampedTime,
    x: Math.round(car.x * 100) / 100,
    y: Math.round(car.y * 100) / 100,
    angle: Math.round(car.angle * 10000) / 10000,
    speed: Math.round(car.speed * 10) / 10,
    steerAngle: Math.round(car.steerAngle * 1000) / 1000,
  });
  return true;
}

export function shouldUpdateGhostRecord(
  existing: TrackGhostLap | undefined,
  newLapTime: number,
  samplesCount: number
): boolean {
  if (samplesCount < 2 || !Number.isFinite(newLapTime) || newLapTime <= 0.5) {
    return false;
  }
  return !existing || newLapTime < existing.lapTime;
}

export function sampleGhostAtTime(
  ghost: TrackGhostLap,
  elapsedSeconds: number,
  options?: { loop?: boolean }
): GhostLapSample | null {
  const { samples, lapTime } = ghost;
  if (!samples.length) return null;
  if (samples.length === 1 || lapTime <= 0) {
    return { ...samples[0] };
  }

  const loop = options?.loop ?? true;
  const duration = Math.max(lapTime, samples[samples.length - 1].t);
  let targetTime = Math.max(0, elapsedSeconds);
  if (loop && duration > 0) {
    targetTime = targetTime % duration;
  } else {
    targetTime = Math.min(duration, targetTime);
  }

  if (targetTime <= samples[0].t) {
    return { ...samples[0], t: targetTime };
  }
  const last = samples[samples.length - 1];
  if (targetTime >= last.t) {
    return { ...last, t: targetTime };
  }

  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (samples[mid].t <= targetTime) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  const a = samples[low];
  const b = samples[Math.min(samples.length - 1, low + 1)];
  const span = b.t - a.t;
  const alpha = span > 0.0001 ? Math.max(0, Math.min(1, (targetTime - a.t) / span)) : 0;

  return {
    t: targetTime,
    x: lerp(a.x, b.x, alpha),
    y: lerp(a.y, b.y, alpha),
    angle: lerpAngle(a.angle, b.angle, alpha),
    speed: lerp(a.speed, b.speed, alpha),
    steerAngle: lerp(a.steerAngle, b.steerAngle, alpha),
  };
}

export function buildGhostCarEntity(
  ghost: TrackGhostLap,
  sample: GhostLapSample,
  carStats: CarStats,
  rank: number = 2,
  currentLap: number = 0,
  totalDistance: number = 0
): CarEntity {
  return {
    id: 'ghost',
    name: `Ghost (${ghost.lapTime.toFixed(2)}s)`,
    isPlayer: false,
    isGhost: true,
    carStats: {
      ...carStats,
      primaryColor: '#38bdf8',
      secondaryColor: '#c084fc',
      accentColor: '#e0f2fe',
    },
    x: sample.x,
    y: sample.y,
    vx: Math.cos(sample.angle) * sample.speed,
    vy: Math.sin(sample.angle) * sample.speed,
    angle: sample.angle,
    speed: sample.speed,
    steerAngle: sample.steerAngle,
    driftAngle: 0,
    isDrifting: false,
    currentLap,
    lapProgress: 0,
    totalDistance,
    lastProgress: 0,
    rank,
    currentLapTime: sample.t,
    bestLapTime: ghost.lapTime,
    isFinished: false,
    isEliminated: false,
    nitro: 0,
    nitroActive: false,
    nitroTimer: 0,
    draftingTimer: 0,
    isDrafting: false,
    driftDuration: 0,
    miniTurboLevel: 0,
    miniTurboBoostTimer: 0,
    barrierScrapeTimer: 0,
    nearMissCooldown: 0,
    invulnerableTimer: 0,
    bumpVelocityX: 0,
    bumpVelocityY: 0,
    trailColor: '#38bdf8',
    skidPoints: [],
  };
}

export function computeGhostSplit(
  playerTotalDistance: number,
  ghost: TrackGhostLap,
  ghostElapsedSeconds: number,
  currentSample: GhostLapSample,
  baked: BakedTrack
): {
  ghostLap: number;
  ghostTotalDistance: number;
  deltaSeconds: number;
  isAhead: boolean;
} {
  const safeLapTime = Math.max(1, ghost.lapTime);
  const completedGhostLaps = Math.max(0, Math.floor(ghostElapsedSeconds / safeLapTime));
  const loc = findNearestTrackSample(currentSample.x, currentSample.y, baked);
  const ghostLapProgress = baked.samples.length > 0 ? loc.index / baked.samples.length : 0;
  const ghostTotalDistance = (completedGhostLaps + ghostLapProgress) * baked.totalLength;

  const avgSpeed = Math.max(120, baked.totalLength / safeLapTime);
  const distanceLead = playerTotalDistance - ghostTotalDistance;
  const deltaSeconds = -distanceLead / avgSpeed;

  return {
    ghostLap: completedGhostLaps,
    ghostTotalDistance,
    deltaSeconds,
    isAhead: distanceLead >= 0,
  };
}
