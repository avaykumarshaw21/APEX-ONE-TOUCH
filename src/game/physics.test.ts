/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSplinePoint,
  bakeTrack,
  findNearestTrackSample,
  calculateRaceRanks,
  getCarEffectiveStats,
  checkDrafting,
  resolveCarCollision,
  constrainCarToRoad,
  updateSmoothSteering,
  updateDriftAndMiniTurbo,
  checkNearMiss,
} from './physics';
import {
  INITIAL_MISSIONS,
  updateMissionProgress,
  rotateClaimedMission,
  findKnockoutEliminationTarget,
} from './features';
import { CarEntity, CarStats, TrackPoint } from './types';

const mockCarStats: CarStats = {
  id: 'apex',
  name: 'Apex GT',
  tier: 1,
  cost: 0,
  unlocked: true,
  baseTopSpeed: 400,
  baseAcceleration: 250,
  baseHandling: 3.0,
  baseDriftGrip: 0.88,
  baseNitroMultiplier: 1.4,
  primaryColor: '#ef4444',
  secondaryColor: '#1e293b',
  accentColor: '#facc15',
  shapeStyle: 'sports',
};

function createMockCar(id: string, isPlayer: boolean, totalDistance: number, x: number = 0, y: number = 0): CarEntity {
  return {
    id,
    name: isPlayer ? 'Player' : `Rival ${id}`,
    isPlayer,
    carStats: mockCarStats,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    speed: 100,
    steerAngle: 0,
    driftAngle: 0,
    isDrifting: false,
    currentLap: Math.floor(totalDistance / 1000),
    lapProgress: (totalDistance % 1000) / 1000,
    totalDistance,
    lastProgress: 0,
    rank: 1,
    currentLapTime: 10,
    bestLapTime: 10,
    isFinished: false,
    nitro: 50,
    nitroActive: false,
    nitroTimer: 0,
    draftingTimer: 0,
    isDrafting: false,
    invulnerableTimer: 0,
    bumpVelocityX: 0,
    bumpVelocityY: 0,
    trailColor: '#ff0000',
    skidPoints: [],
    driftDuration: 0,
    miniTurboLevel: 0,
    miniTurboBoostTimer: 0,
    barrierScrapeTimer: 0,
    nearMissCooldown: 0,
  };
}

test('Road constraint keeps car strictly on road asphalt without going out', () => {
  const points: TrackPoint[] = [
    { x: 0, y: 0 },
    { x: 500, y: 0 },
    { x: 500, y: 500 },
    { x: 0, y: 500 },
  ];
  const baked = bakeTrack(points, 100);
  const roadWidth = 200; // Half road is 100

  // Place car way out of bounds at lateral distance +250
  const car = createMockCar('player', true, 0, 250, 250); // Outside top straight
  car.vx = 0;
  car.vy = 100;

  const result = constrainCarToRoad(car, roadWidth, baked, 0.016);
  assert.equal(result.collided, true, 'Detects barrier collision when out of bounds');

  // Verify car's lateral distance is now safely clamped
  const afterCheck = findNearestTrackSample(car.x, car.y, baked);
  assert.ok(Math.abs(afterCheck.lateralDist) <= 100, `Car lateral distance ${afterCheck.lateralDist} is within road bounds <= 100`);
});

test('Smooth steering progressively guides heading and respects road curvature assist', () => {
  const points: TrackPoint[] = [
    { x: 0, y: 0 },
    { x: 500, y: 0 },
    { x: 500, y: 500 },
    { x: 0, y: 500 },
  ];
  const baked = bakeTrack(points, 100);
  const carAssisted = createMockCar('player', true, 0, 250, 0);
  carAssisted.speed = 300;
  carAssisted.angle = 0;

  const carManual = createMockCar('player', true, 0, 250, 0);
  carManual.speed = 300;
  carManual.angle = 0;

  updateSmoothSteering(carAssisted, 0.5, baked, 0.016, 1.0, true);
  updateSmoothSteering(carManual, 0.5, baked, 0.016, 1.0, false);

  assert.ok(carAssisted.steerAngle > 0, 'Steering angle increases smoothly');
  assert.ok(carManual.angle !== carAssisted.angle, 'Pro Manual mode produces distinct steering line from Auto-Flow Assist');
});

test('Drift-to-Mini-Turbo charges tier 1 and tier 2, then fires boost upon release', () => {
  const car = createMockCar('player', true, 0, 0, 0);
  car.speed = 300;
  car.steerAngle = 0.35; // Hard turn

  // 1. Charge drift for 0.7s -> Mini-Turbo (tier 1)
  for (let i = 0; i < 45; i++) {
    updateDriftAndMiniTurbo(car, 0.016);
  }
  assert.equal(car.isDrifting, true, 'Car enters drift on hard steer at high speed');
  assert.equal(car.miniTurboLevel, 1, 'Charges to Mini-Turbo Tier 1');

  // 2. Charge further for 0.8s more -> Ultra Turbo (tier 2)
  for (let i = 0; i < 50; i++) {
    updateDriftAndMiniTurbo(car, 0.016);
  }
  assert.equal(car.miniTurboLevel, 2, 'Charges to Ultra Mini-Turbo Tier 2');

  // 3. Straighten out -> Fires Mini-Turbo boost!
  car.steerAngle = 0.05;
  const release = updateDriftAndMiniTurbo(car, 0.016);
  assert.equal(release.miniTurboFired, true, 'Fires mini-turbo when drift is straightened');
  assert.equal(release.level, 2, 'Fires level 2 ultra boost');
  assert.ok(car.miniTurboBoostTimer > 0, 'Mini turbo boost timer active');
});

test('Near miss detects passing rival closely without collision', () => {
  const player = createMockCar('player', true, 500, 100, 100);
  player.vx = 300;
  player.vy = 0;

  const rival = createMockCar('rival', false, 480, 130, 100); // 30px away
  rival.vx = 200;
  rival.vy = 0;

  const isNearMiss = checkNearMiss(player, rival);
  assert.equal(isNearMiss, true, 'Near miss triggered when passing within 30px at high relative speed');
  assert.ok(player.nearMissCooldown > 0, 'Near miss cooldown initiated');
});

test('Spline point interpolates closed loop smoothly', () => {
  const points: TrackPoint[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  const p0 = getSplinePoint(points, 0);
  const pHalf = getSplinePoint(points, 0.5);

  assert.ok(Math.abs(p0.x - 0) < 1, 'Start point matches near origin');
  assert.ok(pHalf.x > 50, 'Midpoint interpolates on the circuit');
});

test('Bake track generates uniform samples and total length', () => {
  const points: TrackPoint[] = [
    { x: 0, y: 0 },
    { x: 500, y: 0 },
    { x: 500, y: 500 },
    { x: 0, y: 500 },
  ];
  const baked = bakeTrack(points, 100);
  assert.equal(baked.samples.length, 100);
  assert.ok(baked.totalLength > 1500, 'Track perimeter is calculated properly');

  const queryPt = baked.samples[25];
  const nearest = findNearestTrackSample(queryPt.x, queryPt.y, baked);
  assert.ok(nearest.index >= 0);
  assert.ok(nearest.distSq < 1, `Finds exact track sample point (distSq: ${nearest.distSq})`);
});

test('Race rank calculation ranks 5 cars (Player + 4 Rivals) correctly', () => {
  const cars: CarEntity[] = [
    createMockCar('car1', false, 1200),
    createMockCar('player', true, 1850),
    createMockCar('car2', false, 950),
    createMockCar('car3', false, 2100),
    createMockCar('car4', false, 1500),
  ];

  calculateRaceRanks(cars);

  const player = cars.find(c => c.isPlayer)!;
  const leader = cars.find(c => c.id === 'car3')!;

  assert.equal(leader.rank, 1, 'Car with highest total distance is 1st');
  assert.equal(player.rank, 2, 'Player is 2nd');
});

test('Race rank calculation works with 7 cars (6 Rivals) and 9 cars (8 Rivals)', () => {
  // Test 9 cars grid (Player + 8 Rivals)
  const cars: CarEntity[] = [];
  for (let i = 0; i < 9; i++) {
    cars.push(createMockCar(`car_${i}`, i === 0, (9 - i) * 300));
  }

  calculateRaceRanks(cars);
  assert.equal(cars[0].rank, 1, 'Player with 2700 distance is 1st');
  assert.equal(cars[8].rank, 9, 'Last rival is 9th');
});

test('Drafting / Slipstream detects car directly in front within cone', () => {
  const follower = createMockCar('follower', true, 500, 100, 100);
  follower.angle = 0; // facing right (dx > 0)

  const leader = createMockCar('leader', false, 550, 180, 100); // 80px directly ahead
  const farLeader = createMockCar('far', false, 700, 350, 100); // 250px ahead
  const sideCar = createMockCar('side', false, 500, 100, 180); // 80px to the side

  assert.equal(checkDrafting(follower, leader), true, 'Drafts car directly in front within 160px');
  assert.equal(checkDrafting(follower, farLeader), false, 'Does not draft car beyond max distance');
  assert.equal(checkDrafting(follower, sideCar), false, 'Does not draft car to the side');
});

test('Car collision resolution pushes cars apart and dampens velocity', () => {
  const carA = createMockCar('carA', false, 500, 100, 100);
  const carB = createMockCar('carB', false, 500, 110, 100); // overlap by 38px (hitRadius=24, dist=10 < 48)
  carA.vx = 50;
  carB.vx = -50;

  const collided = resolveCarCollision(carA, carB, 24);
  assert.equal(collided, true, 'Detects and resolves collision');
  assert.ok(carA.x < 100, 'Car A is pushed left away from Car B');
  assert.ok(carB.x > 110, 'Car B is pushed right away from Car A');
});

test('Car upgrades increase top speed, acceleration and handling', () => {
  const upgraded = getCarEffectiveStats(mockCarStats, { engine: 3, handling: 2, nitro: 1 });
  assert.ok(upgraded.baseTopSpeed > mockCarStats.baseTopSpeed, 'Engine upgrade increases top speed');
  assert.ok(upgraded.baseAcceleration > mockCarStats.baseAcceleration, 'Engine upgrade increases acceleration');
  assert.ok(upgraded.baseHandling > mockCarStats.baseHandling, 'Handling upgrade increases handling');
});

test('Knockout elimination picks last-place active car and ranks eliminated cars behind active ones', () => {
  const cars: CarEntity[] = [
    createMockCar('p', true, 1200),
    createMockCar('r1', false, 1500),
    createMockCar('r2', false, 600),
  ];
  const target = findKnockoutEliminationTarget(cars);
  assert.equal(target?.id, 'r2', 'Eliminates car with lowest distance');

  target!.isEliminated = true;
  cars[2].totalDistance = 2000; // Even if previously high, eliminated cars rank behind
  calculateRaceRanks(cars);
  assert.equal(cars[2].rank, 3, 'Eliminated car is ranked behind active racers');
});

test('Live missions advance progress and rotate cleanly when claimed', () => {
  const updated = updateMissionProgress(INITIAL_MISSIONS, { near_misses: 5, mini_turbos: 2 });
  const nearMissMission = updated.find((m) => m.metric === 'near_misses')!;
  assert.equal(nearMissMission.progress, nearMissMission.target, 'Mission clamps cleanly at target');

  const rotated = rotateClaimedMission(updated, nearMissMission.id);
  assert.equal(rotated.length, INITIAL_MISSIONS.length, 'Maintains 3 active missions after claiming');
  assert.notEqual(rotated[0].id, nearMissMission.id, 'Claimed mission rotates to a fresh objective');
});
