/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CAR_LIVERIES, INITIAL_MISSIONS } from './features';
import { TRACKS } from './tracks';
import {
  CarStats,
  ChampionshipProgress,
  GameSettings,
  PlayerProgress,
  TrackGhostLap,
} from './types';

export const PROGRESS_STORAGE_KEY = 'apex_one_touch_racing_v1';
export const SETTINGS_STORAGE_KEY = 'apex_one_touch_settings_v1';
export const GHOST_STORAGE_KEY = 'apex_one_touch_ghosts_v1';

const IDB_NAME = 'apex_one_touch_offline_db';
const IDB_STORE = 'save_data';

export const TRACK_UNLOCK_COSTS: Record<string, number> = {
  sunset_coast: 0,
  neon_metropolis: 220,
  alpine_canyon: 360,
  speedway_super_ring: 520,
  inferno_caldera: 720,
};

export function getTrackUnlockCost(trackId: string): number {
  return TRACK_UNLOCK_COSTS[trackId] ?? 300;
}

export function createDefaultChampionship(): ChampionshipProgress {
  return {
    points: 0,
    trophies: 0,
    completedTrackIds: [],
    totalRaces: 0,
    totalWins: 0,
    totalPodiums: 0,
    bestDriftScore: 0,
    totalCoinsEarned: 0,
  };
}

export function createDefaultProgress(): PlayerProgress {
  return {
    coins: 150,
    selectedCarId: 'apex_gt',
    unlockedCarIds: ['apex_gt'],
    upgrades: {
      apex_gt: { engine: 0, handling: 0, nitro: 0 },
    },
    carPaintOverrides: {},
    unlockedTrackIds: ['sunset_coast'],
    unlockedPerks: ['none', 'coin_magnet'],
    equippedPerk: 'coin_magnet',
    winStreak: 0,
    lastDailyClaimDate: null,
    dailyStreak: 0,
    missions: INITIAL_MISSIONS.map((m) => ({ ...m })),
    bestLapTimes: {},
    bestRaceTimes: {},
    bestRanks: {},
    championship: createDefaultChampionship(),
  };
}

export function createDefaultSettings(): GameSettings {
  return {
    selectedTrackId: TRACKS[0].id,
    opponentCount: 4,
    raceMode: 'championship',
    weather: 'clear',
    aiDifficulty: 'pro',
    isMuted: false,
    steeringSensitivity: 1.0,
    autoDriftAssist: true,
    cameraZoom: 'normal',
    raceAgainstGhost: false,
    hapticsEnabled: true,
    showMinimap: true,
  };
}

export function normalizeProgress(raw: unknown): PlayerProgress {
  const defaults = createDefaultProgress();
  if (!raw || typeof raw !== 'object') return defaults;
  const parsed = raw as Partial<PlayerProgress>;

  const unlockedTracks =
    Array.isArray(parsed.unlockedTrackIds) && parsed.unlockedTrackIds.length > 0
      ? Array.from(new Set(['sunset_coast', ...parsed.unlockedTrackIds]))
      : defaults.unlockedTrackIds;

  const unlockedCars =
    Array.isArray(parsed.unlockedCarIds) && parsed.unlockedCarIds.length > 0
      ? Array.from(new Set(['apex_gt', ...parsed.unlockedCarIds]))
      : defaults.unlockedCarIds;

  const rawChamp: Partial<ChampionshipProgress> = parsed.championship || {};
  const championship: ChampionshipProgress = {
    points: typeof rawChamp.points === 'number' ? rawChamp.points : 0,
    trophies: typeof rawChamp.trophies === 'number' ? rawChamp.trophies : 0,
    completedTrackIds: Array.isArray(rawChamp.completedTrackIds) ? rawChamp.completedTrackIds : [],
    totalRaces: typeof rawChamp.totalRaces === 'number' ? rawChamp.totalRaces : 0,
    totalWins: typeof rawChamp.totalWins === 'number' ? rawChamp.totalWins : 0,
    totalPodiums: typeof rawChamp.totalPodiums === 'number' ? rawChamp.totalPodiums : 0,
    bestDriftScore: typeof rawChamp.bestDriftScore === 'number' ? rawChamp.bestDriftScore : 0,
    totalCoinsEarned: typeof rawChamp.totalCoinsEarned === 'number' ? rawChamp.totalCoinsEarned : 0,
  };

  return {
    ...defaults,
    ...parsed,
    coins: typeof parsed.coins === 'number' && parsed.coins >= 0 ? Math.floor(parsed.coins) : defaults.coins,
    selectedCarId:
      typeof parsed.selectedCarId === 'string' && unlockedCars.includes(parsed.selectedCarId)
        ? parsed.selectedCarId
        : defaults.selectedCarId,
    unlockedCarIds: unlockedCars,
    upgrades: parsed.upgrades && typeof parsed.upgrades === 'object' ? parsed.upgrades : defaults.upgrades,
    carPaintOverrides:
      parsed.carPaintOverrides && typeof parsed.carPaintOverrides === 'object'
        ? parsed.carPaintOverrides
        : {},
    unlockedTrackIds: unlockedTracks,
    unlockedPerks:
      Array.isArray(parsed.unlockedPerks) && parsed.unlockedPerks.length > 0
        ? Array.from(new Set(['none', 'coin_magnet', ...parsed.unlockedPerks]))
        : defaults.unlockedPerks,
    equippedPerk: parsed.equippedPerk || defaults.equippedPerk,
    winStreak: typeof parsed.winStreak === 'number' && parsed.winStreak >= 0 ? parsed.winStreak : 0,
    lastDailyClaimDate: typeof parsed.lastDailyClaimDate === 'string' ? parsed.lastDailyClaimDate : null,
    dailyStreak: typeof parsed.dailyStreak === 'number' && parsed.dailyStreak >= 0 ? parsed.dailyStreak : 0,
    missions:
      Array.isArray(parsed.missions) && parsed.missions.length > 0
        ? parsed.missions
        : defaults.missions,
    bestLapTimes:
      parsed.bestLapTimes && typeof parsed.bestLapTimes === 'object' ? parsed.bestLapTimes : {},
    bestRaceTimes:
      parsed.bestRaceTimes && typeof parsed.bestRaceTimes === 'object' ? parsed.bestRaceTimes : {},
    bestRanks: parsed.bestRanks && typeof parsed.bestRanks === 'object' ? parsed.bestRanks : {},
    championship,
  };
}

export function normalizeSettings(raw: unknown): GameSettings {
  const defaults = createDefaultSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  const parsed = raw as Partial<GameSettings>;

  const validTrack = TRACKS.some((t) => t.id === parsed.selectedTrackId)
    ? (parsed.selectedTrackId as string)
    : defaults.selectedTrackId;

  const validOpponentCount =
    parsed.opponentCount === 4 || parsed.opponentCount === 6 || parsed.opponentCount === 8
      ? parsed.opponentCount
      : defaults.opponentCount;

  const validMode =
    parsed.raceMode === 'championship' ||
    parsed.raceMode === 'knockout' ||
    parsed.raceMode === 'drift_fever'
      ? parsed.raceMode
      : defaults.raceMode;

  const validWeather =
    parsed.weather === 'clear' || parsed.weather === 'night' || parsed.weather === 'rain'
      ? parsed.weather
      : defaults.weather;

  const validDifficulty =
    parsed.aiDifficulty === 'amateur' ||
    parsed.aiDifficulty === 'pro' ||
    parsed.aiDifficulty === 'ace'
      ? parsed.aiDifficulty
      : defaults.aiDifficulty;

  const validSensitivity =
    typeof parsed.steeringSensitivity === 'number' &&
    parsed.steeringSensitivity >= 0.5 &&
    parsed.steeringSensitivity <= 2.0
      ? parsed.steeringSensitivity
      : defaults.steeringSensitivity;

  return {
    selectedTrackId: validTrack,
    opponentCount: validOpponentCount,
    raceMode: validMode,
    weather: validWeather,
    aiDifficulty: validDifficulty,
    isMuted: typeof parsed.isMuted === 'boolean' ? parsed.isMuted : defaults.isMuted,
    steeringSensitivity: validSensitivity,
    autoDriftAssist:
      typeof parsed.autoDriftAssist === 'boolean'
        ? parsed.autoDriftAssist
        : defaults.autoDriftAssist,
    cameraZoom:
      parsed.cameraZoom === 'wide' || parsed.cameraZoom === 'normal'
        ? parsed.cameraZoom
        : defaults.cameraZoom,
    raceAgainstGhost:
      typeof parsed.raceAgainstGhost === 'boolean'
        ? parsed.raceAgainstGhost
        : defaults.raceAgainstGhost,
    hapticsEnabled:
      typeof parsed.hapticsEnabled === 'boolean'
        ? parsed.hapticsEnabled
        : defaults.hapticsEnabled,
    showMinimap:
      typeof parsed.showMinimap === 'boolean' ? parsed.showMinimap : defaults.showMinimap,
  };
}

export function getLocalDateKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function canClaimDailyBonus(progress: PlayerProgress, now: Date = new Date()): boolean {
  return progress.lastDailyClaimDate !== getLocalDateKey(now);
}

export function getNextDailyBonusReward(progress: PlayerProgress): number {
  const nextStreak = Math.min(7, progress.dailyStreak + 1);
  return 100 + (nextStreak - 1) * 25;
}

export function claimDailyBonus(
  progress: PlayerProgress,
  now: Date = new Date()
): { progress: PlayerProgress; reward: number; claimed: boolean } {
  const today = getLocalDateKey(now);
  if (progress.lastDailyClaimDate === today) {
    return { progress, reward: 0, claimed: false };
  }

  let nextStreak = 1;
  if (progress.lastDailyClaimDate) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (progress.lastDailyClaimDate === getLocalDateKey(yesterday)) {
      nextStreak = Math.min(7, progress.dailyStreak + 1);
    }
  }

  const reward = 100 + (nextStreak - 1) * 25;
  return {
    claimed: true,
    reward,
    progress: {
      ...progress,
      coins: progress.coins + reward,
      lastDailyClaimDate: today,
      dailyStreak: nextStreak,
      championship: {
        ...progress.championship,
        totalCoinsEarned: progress.championship.totalCoinsEarned + reward,
      },
    },
  };
}

export function getChampionshipPointsForRank(rank: number, isEliminated?: boolean): number {
  if (isEliminated) return 1;
  switch (rank) {
    case 1:
      return 25;
    case 2:
      return 18;
    case 3:
      return 15;
    case 4:
      return 10;
    case 5:
      return 8;
    case 6:
      return 6;
    default:
      return 4;
  }
}

export function applyRaceCompletionToProgress(
  prev: PlayerProgress,
  params: {
    trackId: string;
    rank: number;
    isEliminated: boolean;
    bestLapTime: number;
    finishTime?: number;
    totalPrize: number;
    driftPoints: number;
    isGhostDuel: boolean;
  }
): { nextProgress: PlayerProgress; newlyUnlockedTrackId: string | null } {
  const { trackId, rank, isEliminated, bestLapTime, finishTime, totalPrize, driftPoints, isGhostDuel } =
    params;

  const prevBestLap = prev.bestLapTimes[trackId] ?? 999;
  const updatedBestLap = bestLapTime < prevBestLap ? bestLapTime : prevBestLap;

  const prevBestRace = prev.bestRaceTimes[trackId] ?? 9999;
  const updatedBestRace =
    typeof finishTime === 'number' && finishTime > 0 && finishTime < prevBestRace
      ? finishTime
      : prevBestRace;

  const prevBestRank = prev.bestRanks[trackId] ?? 99;
  const updatedRank = !isEliminated && rank < prevBestRank ? rank : prevBestRank;

  const isPodium = !isEliminated && rank <= 3;
  const isWin = !isEliminated && rank === 1;
  const nextStreak = isPodium ? prev.winStreak + 1 : 0;

  // Unlock next track in championship sequence on podium finish (or completing ghost duel cleanly in 1st)
  let newlyUnlockedTrackId: string | null = null;
  let unlockedTrackIds = prev.unlockedTrackIds;
  if (isPodium && (!isGhostDuel || isWin)) {
    const idx = TRACKS.findIndex((t) => t.id === trackId);
    if (idx >= 0 && idx + 1 < TRACKS.length) {
      const candidateId = TRACKS[idx + 1].id;
      if (!unlockedTrackIds.includes(candidateId)) {
        unlockedTrackIds = [...unlockedTrackIds, candidateId];
        newlyUnlockedTrackId = candidateId;
      }
    }
  }

  const earnedChampPoints = getChampionshipPointsForRank(rank, isEliminated);
  const completedTrackIds =
    isPodium && !prev.championship.completedTrackIds.includes(trackId)
      ? [...prev.championship.completedTrackIds, trackId]
      : prev.championship.completedTrackIds;

  const nextBestRaceTimes = { ...prev.bestRaceTimes };
  if (updatedBestRace < 9999) {
    nextBestRaceTimes[trackId] = updatedBestRace;
  }

  const nextBestRanks = { ...prev.bestRanks };
  if (updatedRank < 99) {
    nextBestRanks[trackId] = updatedRank;
  }

  return {
    newlyUnlockedTrackId,
    nextProgress: {
      ...prev,
      coins: prev.coins + totalPrize,
      winStreak: nextStreak,
      unlockedTrackIds,
      bestLapTimes: {
        ...prev.bestLapTimes,
        [trackId]: updatedBestLap,
      },
      bestRaceTimes: nextBestRaceTimes,
      bestRanks: nextBestRanks,
      championship: {
        points: prev.championship.points + earnedChampPoints,
        trophies: prev.championship.trophies + (isWin ? 1 : 0),
        completedTrackIds,
        totalRaces: prev.championship.totalRaces + 1,
        totalWins: prev.championship.totalWins + (isWin ? 1 : 0),
        totalPodiums: prev.championship.totalPodiums + (isPodium ? 1 : 0),
        bestDriftScore: Math.max(prev.championship.bestDriftScore, driftPoints),
        totalCoinsEarned: prev.championship.totalCoinsEarned + totalPrize,
      },
    },
  };
}

export function resolveCarStatsWithPaint(
  car: CarStats,
  liveryId?: string
): CarStats {
  if (!liveryId || liveryId === 'factory') return car;
  const livery = CAR_LIVERIES.find((l) => l.id === liveryId);
  if (!livery || !livery.primaryColor) return car;
  return {
    ...car,
    primaryColor: livery.primaryColor,
    secondaryColor: livery.secondaryColor,
    accentColor: livery.accentColor,
  };
}

export interface OfflineSaveBundle {
  version: 2;
  exportedAt: string;
  progress: PlayerProgress;
  settings: GameSettings;
  ghostLaps: { [trackId: string]: TrackGhostLap };
}

export function createOfflineSaveBundle(
  progress: PlayerProgress,
  settings: GameSettings,
  ghostLaps: { [trackId: string]: TrackGhostLap }
): OfflineSaveBundle {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    progress,
    settings,
    ghostLaps,
  };
}

export function parseOfflineSaveBundle(jsonText: string): OfflineSaveBundle | null {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.progress || typeof parsed.progress !== 'object') return null;
    return {
      version: 2,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
      progress: normalizeProgress(parsed.progress),
      settings: normalizeSettings(parsed.settings),
      ghostLaps:
        parsed.ghostLaps && typeof parsed.ghostLaps === 'object' ? parsed.ghostLaps : {},
    };
  } catch {
    return null;
  }
}

export function loadProgressFromDevice(): PlayerProgress {
  try {
    const saved = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (saved) return normalizeProgress(JSON.parse(saved));
  } catch {
    // Ignore storage read error
  }
  return createDefaultProgress();
}

export function loadSettingsFromDevice(): GameSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) return normalizeSettings(JSON.parse(saved));
  } catch {
    // Ignore storage read error
  }
  return createDefaultSettings();
}

export function loadGhostsFromDevice(): { [trackId: string]: TrackGhostLap } {
  try {
    const saved = localStorage.getItem(GHOST_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // Ignore
  }
  return {};
}

export function mirrorKeyToIndexedDB(key: string, value: unknown): void {
  if (typeof indexedDB === 'undefined') return;
  try {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => {
      try {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, key);
      } catch {
        // Ignore IDB write error
      }
    };
  } catch {
    // Ignore IDB open error
  }
}

export function saveProgressToDevice(progress: PlayerProgress): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore quota error
  }
  mirrorKeyToIndexedDB(PROGRESS_STORAGE_KEY, progress);
}

export function saveSettingsToDevice(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota error
  }
  mirrorKeyToIndexedDB(SETTINGS_STORAGE_KEY, settings);
}

export function saveGhostsToDevice(ghostLaps: { [trackId: string]: TrackGhostLap }): void {
  try {
    localStorage.setItem(GHOST_STORAGE_KEY, JSON.stringify(ghostLaps));
  } catch {
    // Ignore quota error
  }
  mirrorKeyToIndexedDB(GHOST_STORAGE_KEY, ghostLaps);
}
