/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Point, TrackPoint, CarEntity, CarStats, OpponentCount } from './types';

// Catmull-Rom spline point calculation for closed loop
export function getSplinePoint(points: TrackPoint[], t: number): Point {
  const n = points.length;
  // Normalize t into [0, 1)
  const normalizedT = ((t % 1) + 1) % 1;
  const p = normalizedT * n;
  const i = Math.floor(p);
  const u = p - i;

  const p0 = points[(i - 1 + n) % n];
  const p1 = points[i % n];
  const p2 = points[(i + 1) % n];
  const p3 = points[(i + 2) % n];

  const u2 = u * u;
  const u3 = u2 * u;

  const f0 = -0.5 * u3 + u2 - 0.5 * u;
  const f1 = 1.5 * u3 - 2.5 * u2 + 1.0;
  const f2 = -1.5 * u3 + 2.0 * u2 + 0.5 * u;
  const f3 = 0.5 * u3 - 0.5 * u2;

  return {
    x: p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3,
    y: p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3,
  };
}

// Spline tangent vector and angle
export function getSplineTangent(points: TrackPoint[], t: number): { angle: number; nx: number; ny: number } {
  const dt = 0.002;
  const pA = getSplinePoint(points, t - dt);
  const pB = getSplinePoint(points, t + dt);
  const dx = pB.x - pA.x;
  const dy = pB.y - pA.y;
  const len = Math.hypot(dx, dy) || 1;
  const angle = Math.atan2(dy, dx);
  // Normal pointing perpendicular to track direction (right side)
  const nx = -dy / len;
  const ny = dx / len;
  return { angle, nx, ny };
}

// Pre-sampled track data structure for fast O(1) lookups
export interface BakedTrack {
  samples: { x: number; y: number; angle: number; nx: number; ny: number; t: number }[];
  totalLength: number;
}

export function bakeTrack(points: TrackPoint[], sampleCount: number = 600): BakedTrack {
  const samples = [];
  let totalLength = 0;
  let prevPoint = getSplinePoint(points, 0);

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleCount;
    const pt = getSplinePoint(points, t);
    const { angle, nx, ny } = getSplineTangent(points, t);
    if (i > 0) {
      totalLength += Math.hypot(pt.x - prevPoint.x, pt.y - prevPoint.y);
    }
    samples.push({ x: pt.x, y: pt.y, angle, nx, ny, t });
    prevPoint = pt;
  }
  // Connect last back to first
  const firstPt = samples[0];
  totalLength += Math.hypot(firstPt.x - prevPoint.x, firstPt.y - prevPoint.y);

  return { samples, totalLength };
}

// Fast nearest track point lookup
export function findNearestTrackSample(
  x: number,
  y: number,
  baked: BakedTrack,
  hintIndex?: number
): { index: number; sample: BakedTrack['samples'][0]; distSq: number; lateralDist: number } {
  const samples = baked.samples;
  const count = samples.length;
  let bestIdx = 0;
  let bestDistSq = Infinity;

  // If hint index is given, search in local neighborhood first for 60fps performance and hairpin safety
  if (hintIndex !== undefined && hintIndex >= 0) {
    const window = 45;
    for (let offset = -window; offset <= window; offset++) {
      const idx = (hintIndex + offset + count) % count;
      const s = samples[idx];
      const dSq = (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = idx;
      }
    }
    // Stay locked to the local spline branch within 300px so hairpins/crossings cannot snap erratically
    if (bestDistSq < 90000) {
      const bestSample = samples[bestIdx];
      const lateralDist = (x - bestSample.x) * bestSample.nx + (y - bestSample.y) * bestSample.ny;
      return { index: bestIdx, sample: bestSample, distSq: bestDistSq, lateralDist };
    }
  }

  // Full scan fallback
  for (let i = 0; i < count; i++) {
    const s = samples[i];
    const dSq = (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }

  const bestSample = samples[bestIdx];
  const lateralDist = (x - bestSample.x) * bestSample.nx + (y - bestSample.y) * bestSample.ny;
  return { index: bestIdx, sample: bestSample, distSq: bestDistSq, lateralDist };
}

// Rank cars by race completion (Laps + Track Progress, eliminated cars ranked behind active racers)
export function calculateRaceRanks(cars: CarEntity[]): void {
  const sorted = [...cars].sort((a, b) => {
    if (a.isEliminated && !b.isEliminated) return 1;
    if (!a.isEliminated && b.isEliminated) return -1;

    // If finished, rank by finish time
    if (a.isFinished && b.isFinished) {
      return (a.finishTime || 0) - (b.finishTime || 0);
    }
    if (a.isFinished) return -1;
    if (b.isFinished) return 1;

    // By total distance completed
    return b.totalDistance - a.totalDistance;
  });

  sorted.forEach((car, idx) => {
    car.rank = idx + 1;
  });
}

// Compute effective stats for player car given upgrades
export function getCarEffectiveStats(
  base: CarStats,
  upgrades?: { engine: number; handling: number; nitro: number }
): CarStats {
  const u = upgrades || { engine: 0, handling: 0, nitro: 0 };
  return {
    ...base,
    baseTopSpeed: base.baseTopSpeed * (1 + u.engine * 0.06), // +6% per engine level
    baseAcceleration: base.baseAcceleration * (1 + u.engine * 0.08), // +8% accel
    baseHandling: base.baseHandling * (1 + u.handling * 0.07), // +7% handling
    baseDriftGrip: Math.min(0.96, base.baseDriftGrip + u.handling * 0.015),
    baseNitroMultiplier: base.baseNitroMultiplier * (1 + u.nitro * 0.08),
  };
}

// Drafting / Slipstream calculation
export function checkDrafting(
  follower: CarEntity,
  leader: CarEntity,
  maxDist: number = 160,
  maxAngleSpread: number = 0.45
): boolean {
  if (follower.id === leader.id) return false;
  const dx = leader.x - follower.x;
  const dy = leader.y - follower.y;
  const dist = Math.hypot(dx, dy);

  if (dist > maxDist || dist < 30) return false;

  // Angle from follower to leader
  const angleToLeader = Math.atan2(dy, dx);
  let angleDiff = angleToLeader - follower.angle;
  // Normalize angle difference to [-PI, PI]
  angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

  // Must be directly in front within spread
  return Math.abs(angleDiff) < maxAngleSpread;
}

// Collision resolution between two cars (smooth separation without velocity lock or stalls)
export function resolveCarCollision(
  carA: CarEntity,
  carB: CarEntity,
  hitRadius: number = 22
): boolean {
  const dx = carB.x - carA.x;
  const dy = carB.y - carA.y;
  const dist = Math.hypot(dx, dy);
  const minDist = hitRadius * 2;

  if (dist >= minDist) return false;

  // Fallback separation direction if centers match exactly
  const nx = dist > 0.001 ? dx / dist : Math.cos(carA.angle + Math.PI * 0.5);
  const ny = dist > 0.001 ? dy / dist : Math.sin(carA.angle + Math.PI * 0.5);

  // Push cleanly apart so cars never stay wedged together
  const overlap = minDist - dist;
  carA.x -= nx * overlap * 0.55;
  carA.y -= ny * overlap * 0.55;
  carB.x += nx * overlap * 0.55;
  carB.y += ny * overlap * 0.55;

  // Apply gentle lateral bump separation through persistent bumpVelocity (never stalling forward momentum)
  const rvx = carB.vx - carA.vx;
  const rvy = carB.vy - carA.vy;
  const velAlongNormal = rvx * nx + rvy * ny;

  if (velAlongNormal < 0) {
    const impulseMag = Math.min(110, Math.max(28, -velAlongNormal * 0.45));
    carA.bumpVelocityX = Math.max(-140, Math.min(140, carA.bumpVelocityX - nx * impulseMag));
    carA.bumpVelocityY = Math.max(-140, Math.min(140, carA.bumpVelocityY - ny * impulseMag));
    carB.bumpVelocityX = Math.max(-140, Math.min(140, carB.bumpVelocityX + nx * impulseMag));
    carB.bumpVelocityY = Math.max(-140, Math.min(140, carB.bumpVelocityY + ny * impulseMag));

    // Gentle speed rub that preserves racing momentum (never grinds down to a stop)
    const minRubSpeedA = carA.carStats.baseTopSpeed * 0.55;
    const minRubSpeedB = carB.carStats.baseTopSpeed * 0.55;
    carA.speed = Math.max(carA.speed * 0.96, Math.min(carA.speed, minRubSpeedA));
    carB.speed = Math.max(carB.speed * 0.96, Math.min(carB.speed, minRubSpeedB));

    return true;
  }

  return false;
}

// Road Constraint: Ensures cars (player and AI) CAN NEVER leave the asphalt road and glide smoothly off walls
export interface RoadConstraintResult {
  collided: boolean;
  side: 'left' | 'right' | null;
  scrapeX: number;
  scrapeY: number;
  nx: number;
  ny: number;
}

export function constrainCarToRoad(
  car: CarEntity,
  roadWidth: number,
  baked: BakedTrack,
  dt: number
): RoadConstraintResult {
  const loc = findNearestTrackSample(car.x, car.y, baked, car.trackSampleIndex);
  car.trackSampleIndex = loc.index;
  const halfRoad = roadWidth * 0.5;
  const carHalf = 13;
  const maxLateral = Math.max(15, halfRoad - carHalf);

  if (loc.lateralDist > maxLateral) {
    // Hit right barrier: pull slightly inside so car glides cleanly off the rail
    const clampedLateral = maxLateral - 0.5;
    car.x = loc.sample.x + loc.sample.nx * clampedLateral;
    car.y = loc.sample.y + loc.sample.ny * clampedLateral;

    // Cancel any outward bump velocity pushing into the wall
    const bumpOut = car.bumpVelocityX * loc.sample.nx + car.bumpVelocityY * loc.sample.ny;
    if (bumpOut > 0) {
      car.bumpVelocityX -= loc.sample.nx * bumpOut * 1.3;
      car.bumpVelocityY -= loc.sample.ny * bumpOut * 1.3;
    }

    // Check heading relative to track tangent: relAngle > 0 means pointing into right barrier
    const relAngle = Math.atan2(
      Math.sin(car.angle - loc.sample.angle),
      Math.cos(car.angle - loc.sample.angle)
    );
    if (relAngle > -0.05) {
      // Immediately align heading parallel/slightly inward so car glides off the rail on contact
      car.angle = loc.sample.angle - 0.05;
    }

    // Mild scrape friction with high minimum glide speed so car never stalls against barriers
    const wallMinSpeed = car.carStats.baseTopSpeed * 0.65;
    if (car.speed > wallMinSpeed) {
      car.speed = Math.max(wallMinSpeed, car.speed * Math.max(0.95, 1 - 0.12 * dt));
    }
    car.barrierScrapeTimer = 0.2;

    return {
      collided: true,
      side: 'right',
      scrapeX: car.x + loc.sample.nx * 10,
      scrapeY: car.y + loc.sample.ny * 10,
      nx: loc.sample.nx,
      ny: loc.sample.ny,
    };
  } else if (loc.lateralDist < -maxLateral) {
    // Hit left barrier: pull slightly inside
    const clampedLateral = -(maxLateral - 0.5);
    car.x = loc.sample.x + loc.sample.nx * clampedLateral;
    car.y = loc.sample.y + loc.sample.ny * clampedLateral;

    const bumpOut = car.bumpVelocityX * loc.sample.nx + car.bumpVelocityY * loc.sample.ny;
    if (bumpOut < 0) {
      car.bumpVelocityX -= loc.sample.nx * bumpOut * 1.3;
      car.bumpVelocityY -= loc.sample.ny * bumpOut * 1.3;
    }

    // relAngle < 0 means pointing into left barrier
    const relAngle = Math.atan2(
      Math.sin(car.angle - loc.sample.angle),
      Math.cos(car.angle - loc.sample.angle)
    );
    if (relAngle < 0.05) {
      car.angle = loc.sample.angle + 0.05;
    }

    const wallMinSpeed = car.carStats.baseTopSpeed * 0.65;
    if (car.speed > wallMinSpeed) {
      car.speed = Math.max(wallMinSpeed, car.speed * Math.max(0.95, 1 - 0.12 * dt));
    }
    car.barrierScrapeTimer = 0.2;

    return {
      collided: true,
      side: 'left',
      scrapeX: car.x - loc.sample.nx * 10,
      scrapeY: car.y - loc.sample.ny * 10,
      nx: -loc.sample.nx,
      ny: -loc.sample.ny,
    };
  }

  return {
    collided: false,
    side: null,
    scrapeX: car.x,
    scrapeY: car.y,
    nx: 0,
    ny: 0,
  };
}

// Buttery smooth steering with progressive sensitivity, road-flow assist, and edge cushion
export function updateSmoothSteering(
  car: CarEntity,
  steerInput: number,
  baked: BakedTrack,
  dt: number,
  sensitivity: number = 1.0,
  autoDriftAssist: boolean = true,
  roadWidth: number = 250
): void {
  // Progressive curve: gentle touches carve smoothly, full swipe initiates clean drift
  const sign = Math.sign(steerInput);
  const curved = sign * Math.pow(Math.abs(steerInput), 1.1);
  const targetSteerAngle = curved * 0.46 * sensitivity;

  // Responsive exponential damping
  car.steerAngle += (targetSteerAngle - car.steerAngle) * Math.min(1, 18 * dt);

  // Track-local sample lookup using hintIndex for stable flow around hairpins
  const sample = findNearestTrackSample(car.x, car.y, baked, car.trackSampleIndex);
  car.trackSampleIndex = sample.index;

  const trackTangentDiff = Math.atan2(
    Math.sin(sample.sample.angle - car.angle),
    Math.cos(sample.sample.angle - car.angle)
  );
  const assistFactor = autoDriftAssist ? 1.0 : 0.35;
  const roadAssistRate = Math.min(3.4, 1.45 + (car.speed / 400) * 1.7) * assistFactor;
  car.angle += trackTangentDiff * roadAssistRate * dt;

  // Soft boundary cushion in Assist mode: gently steers away from walls before touching kerbs
  if (autoDriftAssist) {
    const safeHalf = Math.max(30, roadWidth * 0.5 - 16);
    const edgeRatio = Math.abs(sample.lateralDist) / safeHalf;
    if (edgeRatio > 0.68) {
      const cushionStrength = Math.min(1, (edgeRatio - 0.68) / 0.32);
      const inwardSign = sample.lateralDist > 0 ? -1 : 1;
      car.angle += inwardSign * cushionStrength * 1.45 * dt;
    }
  }

  // Smooth steering authority across low and high speeds
  const manualTurnBoost = autoDriftAssist ? 1.0 : 1.2;
  const turnRate =
    (car.steerAngle * car.carStats.baseHandling * 2.25 * manualTurnBoost) /
    (1 + car.speed * 0.00075);
  car.angle += turnRate * dt;
}

// Addictive Drift-to-Mini-Turbo mechanic
export function updateDriftAndMiniTurbo(
  car: CarEntity,
  dt: number,
  chargeRateMultiplier: number = 1.0
): { miniTurboFired: boolean; level: 0 | 1 | 2 } {
  const isHardTurn = Math.abs(car.steerAngle) > 0.15 && car.speed > 175;

  if (isHardTurn) {
    car.isDrifting = true;
    car.driftAngle += (car.steerAngle * 0.42 - car.driftAngle) * 8 * dt;
    car.driftDuration += dt * chargeRateMultiplier;

    if (car.driftDuration >= 1.3) {
      car.miniTurboLevel = 2; // Purple Ultra Mini-Turbo
    } else if (car.driftDuration >= 0.6) {
      car.miniTurboLevel = 1; // Cyan Mini-Turbo
    }
    return { miniTurboFired: false, level: 0 };
  } else {
    let fired = false;
    const releasedLevel = car.miniTurboLevel;

    if (car.isDrifting && releasedLevel > 0) {
      fired = true;
      car.miniTurboBoostTimer = releasedLevel === 2 ? 1.5 : 0.85;
    }

    car.isDrifting = false;
    car.driftAngle *= Math.exp(-9 * dt);
    car.driftDuration = 0;
    car.miniTurboLevel = 0;

    return { miniTurboFired: fired, level: releasedLevel };
  }
}

// Addictive Near Miss Detection: Passing rival with centimeters to spare
export function checkNearMiss(
  player: CarEntity,
  rival: CarEntity,
  maxDist: number = 44
): boolean {
  if (player.nearMissCooldown > 0 || rival.isEliminated) return false;
  const dx = rival.x - player.x;
  const dy = rival.y - player.y;
  const dist = Math.hypot(dx, dy);

  if (dist >= 24 && dist <= maxDist) {
    const relVx = player.vx - rival.vx;
    const relVy = player.vy - rival.vy;
    const relSpeed = Math.hypot(relVx, relVy);
    if (relSpeed > 25) {
      player.nearMissCooldown = 0.8;
      return true;
    }
  }
  return false;
}

// AI steering and throttle logic
export function updateAICar(
  ai: CarEntity,
  allCars: CarEntity[],
  baked: BakedTrack,
  roadWidth: number,
  dt: number
): { steerInput: number; useNitro: boolean } {
  const currentSample = findNearestTrackSample(ai.x, ai.y, baked, ai.trackSampleIndex);
  ai.trackSampleIndex = currentSample.index;
  const sampleCount = baked.samples.length;

  // Lookahead distance scales with speed (anticipation)
  const lookaheadSamples = Math.floor(18 + (ai.speed / 400) * 16);
  const targetIdx = (currentSample.index + lookaheadSamples) % sampleCount;
  const targetSample = baked.samples[targetIdx];

  // AI lane target offset: range within -0.6 to 0.6 of half road width
  const halfRoad = roadWidth * 0.4;
  let targetLateral = (ai.aiTargetLane ?? 0) * halfRoad;

  // Dynamic overtaking: check if another car is blocking in front
  let carAheadInLane = false;
  for (const other of allCars) {
    if (other.id === ai.id) continue;
    const dx = other.x - ai.x;
    const dy = other.y - ai.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 140) {
      const angleToOther = Math.atan2(dy, dx);
      let angleDiff = Math.atan2(Math.sin(angleToOther - ai.angle), Math.cos(angleToOther - ai.angle));
      if (Math.abs(angleDiff) < 0.35) {
        carAheadInLane = true;
        break;
      }
    }
  }

  if (carAheadInLane) {
    // Steer to opposite lane to overtake
    ai.aiTargetLane = (ai.aiTargetLane ?? 0) > 0 ? -0.7 : 0.7;
    targetLateral = ai.aiTargetLane * halfRoad;
  }

  // Desired world target point
  const targetX = targetSample.x + targetSample.nx * targetLateral;
  const targetY = targetSample.y + targetSample.ny * targetLateral;

  // Angle to target
  const desiredAngle = Math.atan2(targetY - ai.y, targetX - ai.x);
  let steerDiff = Math.atan2(Math.sin(desiredAngle - ai.angle), Math.cos(desiredAngle - ai.angle));

  // Steering sensitivity clamped to [-1, 1]
  const steerInput = Math.max(-1, Math.min(1, steerDiff * 3.5));

  // Nitro decision: on straights when far behind or aggressive
  const nextNextSample = baked.samples[(targetIdx + 20) % sampleCount];
  const curvature = Math.abs(Math.atan2(Math.sin(nextNextSample.angle - targetSample.angle), Math.cos(nextNextSample.angle - targetSample.angle)));
  const isStraight = curvature < 0.15;
  const useNitro = isStraight && ai.nitro > 30 && (ai.rank > 2 || ai.aiPersonality === 'aggressive');

  return { steerInput, useNitro };
}
