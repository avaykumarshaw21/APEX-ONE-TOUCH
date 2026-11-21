/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRaceCompletionToProgress,
  canClaimDailyBonus,
  claimDailyBonus,
  createDefaultProgress,
  createDefaultSettings,
  createOfflineSaveBundle,
  getTrackUnlockCost,
  normalizeProgress,
  normalizeSettings,
  parseOfflineSaveBundle,
  resolveCarStatsWithPaint,
} from './storage';
import { CARS } from './tracks';

test('normalizeProgress safely migrates legacy v1 save payloads', () => {
  const migrated = normalizeProgress({
    coins: 420,
    selectedCarId: 'phantom_rx',
    unlockedCarIds: ['apex_gt', 'phantom_rx'],
    upgrades: { phantom_rx: { engine: 2, handling: 1, nitro: 0 } },
    bestLapTimes: { sunset_coast: 11.45 },
  });

  assert.equal(migrated.coins, 420);
  assert.equal(migrated.selectedCarId, 'phantom_rx');
  assert.deepEqual(migrated.unlockedTrackIds, ['sunset_coast']);
  assert.equal(migrated.championship.totalRaces, 0);
  assert.equal(migrated.bestLapTimes.sunset_coast, 11.45);
  assert.deepEqual(migrated.bestRaceTimes, {});
});

test('normalizeSettings preserves valid values and falls back on invalid fields', () => {
  const settings = normalizeSettings({
    selectedTrackId: 'neon_metropolis',
    opponentCount: 8,
    raceMode: 'knockout',
    weather: 'rain',
    aiDifficulty: 'ace',
    isMuted: true,
    steeringSensitivity: 1.35,
    autoDriftAssist: false,
    cameraZoom: 'wide',
    raceAgainstGhost: true,
    hapticsEnabled: false,
    showMinimap: false,
  });

  assert.equal(settings.selectedTrackId, 'neon_metropolis');
  assert.equal(settings.opponentCount, 8);
  assert.equal(settings.raceMode, 'knockout');
  assert.equal(settings.weather, 'rain');
  assert.equal(settings.aiDifficulty, 'ace');
  assert.equal(settings.isMuted, true);
  assert.equal(settings.steeringSensitivity, 1.35);
  assert.equal(settings.autoDriftAssist, false);
  assert.equal(settings.cameraZoom, 'wide');
  assert.equal(settings.raceAgainstGhost, true);
  assert.equal(settings.hapticsEnabled, false);
  assert.equal(settings.showMinimap, false);

  const invalidFallback = normalizeSettings({
    selectedTrackId: 'nonexistent',
    opponentCount: 99,
    steeringSensitivity: 99,
  });
  const defaults = createDefaultSettings();
  assert.equal(invalidFallback.selectedTrackId, defaults.selectedTrackId);
  assert.equal(invalidFallback.opponentCount, defaults.opponentCount);
  assert.equal(invalidFallback.steeringSensitivity, defaults.steeringSensitivity);
});

test('applyRaceCompletionToProgress updates championship, records, and unlocks next track on podium', () => {
  const base = createDefaultProgress();
  const { nextProgress, newlyUnlockedTrackId } = applyRaceCompletionToProgress(base, {
    trackId: 'sunset_coast',
    rank: 1,
    isEliminated: false,
    bestLapTime: 10.82,
    finishTime: 22.14,
    totalPrize: 240,
    driftPoints: 185,
    isGhostDuel: false,
  });

  assert.equal(newlyUnlockedTrackId, 'neon_metropolis');
  assert.ok(nextProgress.unlockedTrackIds.includes('neon_metropolis'));
  assert.equal(nextProgress.coins, base.coins + 240);
  assert.equal(nextProgress.winStreak, 1);
  assert.equal(nextProgress.bestLapTimes.sunset_coast, 10.82);
  assert.equal(nextProgress.bestRaceTimes.sunset_coast, 22.14);
  assert.equal(nextProgress.bestRanks.sunset_coast, 1);
  assert.equal(nextProgress.championship.points, 25);
  assert.equal(nextProgress.championship.trophies, 1);
  assert.equal(nextProgress.championship.totalWins, 1);
  assert.equal(nextProgress.championship.totalPodiums, 1);
  assert.equal(nextProgress.championship.bestDriftScore, 185);
});

test('daily offline check-in awards once per local day and advances consecutive streak', () => {
  const day1 = new Date('2026-11-16T09:00:00');
  const day2 = new Date('2026-11-17T10:30:00');

  const initial = createDefaultProgress();
  assert.equal(canClaimDailyBonus(initial, day1), true);

  const first = claimDailyBonus(initial, day1);
  assert.equal(first.claimed, true);
  assert.equal(first.reward, 100);
  assert.equal(first.progress.dailyStreak, 1);
  assert.equal(canClaimDailyBonus(first.progress, day1), false);

  const duplicate = claimDailyBonus(first.progress, day1);
  assert.equal(duplicate.claimed, false);
  assert.equal(duplicate.reward, 0);

  const second = claimDailyBonus(first.progress, day2);
  assert.equal(second.claimed, true);
  assert.equal(second.reward, 125);
  assert.equal(second.progress.dailyStreak, 2);
});

test('offline save bundle export/import and car livery resolution work deterministically', () => {
  const progress = createDefaultProgress();
  const settings = createDefaultSettings();
  settings.isMuted = true;
  settings.aiDifficulty = 'ace';

  const bundle = createOfflineSaveBundle(progress, settings, {});
  const json = JSON.stringify(bundle);
  const restored = parseOfflineSaveBundle(json);

  assert.ok(restored);
  assert.equal(restored?.settings.isMuted, true);
  assert.equal(restored?.settings.aiDifficulty, 'ace');
  assert.equal(parseOfflineSaveBundle('{bad json'), null);

  const painted = resolveCarStatsWithPaint(CARS[0], 'cyber_cyan');
  assert.equal(painted.primaryColor, '#06b6d4');
  assert.equal(getTrackUnlockCost('sunset_coast'), 0);
  assert.ok(getTrackUnlockCost('inferno_caldera') > 0);
});
