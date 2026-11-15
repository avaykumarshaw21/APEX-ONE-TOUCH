/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createReplayRecorder,
  recordReplayFrame,
  sampleReplayAtTime,
  lerpAngle,
  formatReplayTime,
} from './replay';
import { TRACKS, CARS } from './tracks';
import { CarEntity } from './types';

function makeCar(id: string, isPlayer: boolean, x: number, y: number, angle = 0): CarEntity {
  const stats = CARS[0];
  return {
    id,
    name: isPlayer ? 'YOU' : `Rival ${id}`,
    isPlayer,
    carStats: stats,
    x,
    y,
    vx: 200,
    vy: 0,
    angle,
    speed: 200,
    steerAngle: 0.1,
    driftAngle: 0,
    isDrifting: false,
    currentLap: 0,
    lapProgress: 0,
    totalDistance: 0,
    lastProgress: 0,
    rank: isPlayer ? 1 : 2,
    currentLapTime: 0,
    bestLapTime: 999,
    isFinished: false,
    isEliminated: false,
    nitro: 50,
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
    trailColor: stats.primaryColor,
    skidPoints: [],
  };
}

test('Replay recorder saves car coordinates and camera state respecting sample interval', () => {
  const player = makeCar('player', true, 100, 200, 0);
  const rival = makeCar('ai_0', false, 80, 240, 0.2);
  const cars = [player, rival];

  const replay = createReplayRecorder(TRACKS[0], 'championship', 'clear', 'normal', cars);

  // Frame 0 always records
  const r0 = recordReplayFrame(replay, 0, cars, {
    cameraX: 120,
    cameraY: 200,
    zoom: 1,
    screenShake: 0,
  });
  assert.equal(r0, true);

  // Frame too close in time is skipped unless forced
  const rSkip = recordReplayFrame(replay, 0.01, cars, {
    cameraX: 121,
    cameraY: 200,
    zoom: 1,
    screenShake: 0,
  });
  assert.equal(rSkip, false);

  // Move cars & camera at t = 1.0s
  player.x = 400;
  player.y = 300;
  player.nitroActive = true;
  rival.x = 360;
  rival.y = 320;
  const r1 = recordReplayFrame(replay, 1.0, cars, {
    cameraX: 440,
    cameraY: 310,
    zoom: 0.85,
    screenShake: 0.3,
  });
  assert.equal(r1, true);
  assert.equal(replay.frames.length, 2);
  assert.equal(replay.duration, 1.0);
  assert.equal(replay.frames[1].camera.cameraX, 440);
  assert.equal(replay.frames[1].camera.zoom, 0.85);
});

test('Replay sampler interpolates car coordinates, camera state, and wraparound angles', () => {
  const player = makeCar('player', true, 0, 100, Math.PI - 0.1);
  const rival = makeCar('ai_0', false, 50, 200, 0);
  const cars = [player, rival];

  const replay = createReplayRecorder(TRACKS[0], 'championship', 'night', 'wide', cars);
  recordReplayFrame(replay, 0, cars, { cameraX: 0, cameraY: 100, zoom: 0.8, screenShake: 0 });

  // Cross +pi -> -pi boundary cleanly
  player.x = 200;
  player.y = 300;
  player.angle = -Math.PI + 0.1;
  player.isDrifting = true;
  rival.x = 150;
  rival.y = 400;
  recordReplayFrame(replay, 2.0, cars, { cameraX: 240, cameraY: 320, zoom: 0.9, screenShake: 0.4 });

  const mid = sampleReplayAtTime(replay, 1.0);
  assert.ok(mid, 'Returns valid interpolated snapshot at midpoint');
  assert.equal(mid.camera.cameraX, 120);
  assert.equal(mid.camera.cameraY, 210);
  assert.ok(Math.abs(mid.camera.zoom - 0.85) < 0.001);

  const sampledPlayer = mid.cars.find((c) => c.id === 'player')!;
  assert.equal(sampledPlayer.x, 100);
  assert.equal(sampledPlayer.y, 200);
  // Midpoint between (pi - 0.1) and (-pi + 0.1) wraps cleanly near +/- pi, NOT 0!
  assert.ok(Math.abs(Math.abs(sampledPlayer.angle) - Math.PI) < 0.02, `Angle wraps smoothly across pi: ${sampledPlayer.angle}`);
  assert.equal(sampledPlayer.isDrifting, true);
});

test('lerpAngle chooses shortest angular arc and formatReplayTime formats mm:ss', () => {
  const wrapped = lerpAngle(Math.PI * 0.95, -Math.PI * 0.95, 0.5);
  assert.ok(Math.abs(Math.abs(wrapped) - Math.PI) < 0.01);

  assert.equal(formatReplayTime(0), '00:00');
  assert.equal(formatReplayTime(9.8), '00:09');
  assert.equal(formatReplayTime(75), '01:15');
});
