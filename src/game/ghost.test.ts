/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGhostCarEntity,
  computeGhostSplit,
  recordGhostSample,
  sampleGhostAtTime,
  shouldUpdateGhostRecord,
} from './ghost';
import { bakeTrack } from './physics';
import { CARS, TRACKS } from './tracks';
import { GhostLapSample, TrackGhostLap } from './types';

test('Ghost recorder respects sample interval unless forced and validates faster lap replacement', () => {
  const samples: GhostLapSample[] = [];
  const car = { x: 100, y: 200, angle: 0, speed: 300, steerAngle: 0.1 };

  assert.equal(recordGhostSample(samples, 0, car, { force: true }), true);
  assert.equal(recordGhostSample(samples, 0.02, { ...car, x: 110 }), false);
  assert.equal(recordGhostSample(samples, 0.06, { ...car, x: 125 }), true);
  assert.equal(samples.length, 2);

  const existing: TrackGhostLap = {
    trackId: 'sunset_coast',
    lapTime: 14.5,
    carId: 'apex_gt',
    recordedAt: 1000,
    samples,
  };

  assert.equal(shouldUpdateGhostRecord(undefined, 15.2, 2), true);
  assert.equal(shouldUpdateGhostRecord(existing, 15.0, 10), false);
  assert.equal(shouldUpdateGhostRecord(existing, 13.8, 10), true);
  assert.equal(shouldUpdateGhostRecord(existing, 12.0, 1), false);
});

test('Ghost sampler interpolates coordinates, wraparound angles, and loops seamlessly across laps', () => {
  const ghost: TrackGhostLap = {
    trackId: 'sunset_coast',
    lapTime: 10,
    carId: 'apex_gt',
    recordedAt: 1000,
    samples: [
      { t: 0, x: 0, y: 0, angle: Math.PI - 0.1, speed: 200, steerAngle: 0 },
      { t: 10, x: 100, y: 200, angle: -Math.PI + 0.1, speed: 400, steerAngle: 0.4 },
    ],
  };

  const mid = sampleGhostAtTime(ghost, 5, { loop: false });
  assert.ok(mid);
  assert.ok(Math.abs(mid.x - 50) < 0.01);
  assert.ok(Math.abs(mid.y - 100) < 0.01);
  assert.ok(Math.abs(mid.speed - 300) < 0.01);
  // Shortest arc across +-PI passes through PI (|sin| ~ 0, cos ~ -1)
  assert.ok(Math.abs(Math.cos(mid.angle) + 1) < 0.01);

  const looped = sampleGhostAtTime(ghost, 15, { loop: true });
  assert.ok(looped);
  assert.ok(Math.abs(looped.x - 50) < 0.01);
});

test('computeGhostSplit identifies player lead/deficit and buildGhostCarEntity sets phantom flags', () => {
  const track = TRACKS[0];
  const baked = bakeTrack(track.points);
  const sample0 = baked.samples[0];
  const sampleAhead = baked.samples[40];

  const ghost: TrackGhostLap = {
    trackId: track.id,
    lapTime: 15,
    carId: CARS[0].id,
    recordedAt: 1000,
    samples: [
      { t: 0, x: sample0.x, y: sample0.y, angle: sample0.angle, speed: 300, steerAngle: 0 },
      { t: 15, x: sampleAhead.x, y: sampleAhead.y, angle: sampleAhead.angle, speed: 300, steerAngle: 0 },
    ],
  };

  const ghostEntity = buildGhostCarEntity(ghost, ghost.samples[0], CARS[0]);
  assert.equal(ghostEntity.isGhost, true);
  assert.equal(ghostEntity.isPlayer, false);

  const playerDist = (40 / baked.samples.length) * baked.totalLength;
  const split = computeGhostSplit(playerDist, ghost, 0.5, ghost.samples[0], baked);
  assert.equal(split.isAhead, true);
  assert.ok(split.deltaSeconds < 0);
});
