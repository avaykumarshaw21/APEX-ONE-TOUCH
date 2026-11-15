/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CameraZoomMode,
  CarEntity,
  RaceMode,
  RaceReplayData,
  ReplayCameraState,
  ReplayCarSnapshot,
  ReplayFrame,
  TrackDefinition,
  TrackWeather,
} from './types';

export const MAX_REPLAY_FRAMES = 6000;
export const DEFAULT_REPLAY_SAMPLE_INTERVAL = 1 / 30;

export function createReplayRecorder(
  track: TrackDefinition,
  raceMode: RaceMode,
  weather: TrackWeather,
  cameraZoomMode: CameraZoomMode,
  cars: CarEntity[]
): RaceReplayData {
  return {
    trackId: track.id,
    raceMode,
    weather,
    cameraZoomMode,
    duration: 0,
    carMeta: cars.map((car) => ({
      id: car.id,
      name: car.name,
      isPlayer: car.isPlayer,
      carStats: car.carStats,
      trailColor: car.trailColor,
    })),
    frames: [],
  };
}

export function captureCarSnapshot(car: CarEntity): ReplayCarSnapshot {
  return {
    id: car.id,
    x: Math.round(car.x * 100) / 100,
    y: Math.round(car.y * 100) / 100,
    angle: Math.round(car.angle * 10000) / 10000,
    speed: Math.round(car.speed * 10) / 10,
    steerAngle: Math.round(car.steerAngle * 1000) / 1000,
    isDrifting: car.isDrifting,
    nitroActive: car.nitroActive,
    miniTurboLevel: car.miniTurboLevel,
    miniTurboBoostTimer: Math.round(car.miniTurboBoostTimer * 100) / 100,
    isEliminated: !!car.isEliminated,
    rank: car.rank,
    currentLap: car.currentLap,
  };
}

export function recordReplayFrame(
  replay: RaceReplayData,
  time: number,
  cars: CarEntity[],
  camera: ReplayCameraState,
  options?: { minInterval?: number; force?: boolean; maxFrames?: number }
): boolean {
  const minInterval = options?.minInterval ?? DEFAULT_REPLAY_SAMPLE_INTERVAL;
  const force = options?.force ?? false;
  const maxFrames = options?.maxFrames ?? MAX_REPLAY_FRAMES;

  const clampedTime = Math.max(0, time);
  const lastFrame = replay.frames[replay.frames.length - 1];

  if (!force && lastFrame && clampedTime - lastFrame.time < minInterval) {
    return false;
  }

  const frame: ReplayFrame = {
    time: clampedTime,
    camera: {
      cameraX: Math.round(camera.cameraX * 100) / 100,
      cameraY: Math.round(camera.cameraY * 100) / 100,
      zoom: Math.round(camera.zoom * 1000) / 1000,
      screenShake: Math.round(camera.screenShake * 1000) / 1000,
    },
    cars: cars.map(captureCarSnapshot),
  };

  if (replay.frames.length >= maxFrames) {
    // Keep initial frame and compact earliest window if race exceeds cap
    replay.frames.splice(1, 1);
  }

  replay.frames.push(frame);
  replay.duration = Math.max(replay.duration, clampedTime);
  return true;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpAngle(a: number, b: number, t: number): number {
  const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + diff * t;
}

export interface SampledReplayState {
  time: number;
  camera: ReplayCameraState;
  cars: CarEntity[];
}

export function sampleReplayAtTime(
  replay: RaceReplayData,
  targetTime: number
): SampledReplayState | null {
  const { frames, carMeta } = replay;
  if (!frames.length) return null;

  const clampedTime = Math.max(0, Math.min(replay.duration, targetTime));

  let frameA = frames[0];
  let frameB = frames[0];
  let alpha = 0;

  if (clampedTime <= frames[0].time) {
    frameA = frames[0];
    frameB = frames[0];
    alpha = 0;
  } else if (clampedTime >= frames[frames.length - 1].time) {
    frameA = frames[frames.length - 1];
    frameB = frames[frames.length - 1];
    alpha = 0;
  } else {
    // Binary search for largest index with frames[i].time <= clampedTime
    let low = 0;
    let high = frames.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (frames[mid].time <= clampedTime) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    frameA = frames[low];
    frameB = frames[Math.min(frames.length - 1, low + 1)];
    const span = frameB.time - frameA.time;
    alpha = span > 0.0001 ? Math.max(0, Math.min(1, (clampedTime - frameA.time) / span)) : 0;
  }

  const camera: ReplayCameraState = {
    cameraX: lerp(frameA.camera.cameraX, frameB.camera.cameraX, alpha),
    cameraY: lerp(frameA.camera.cameraY, frameB.camera.cameraY, alpha),
    zoom: lerp(frameA.camera.zoom, frameB.camera.zoom, alpha),
    screenShake: lerp(frameA.camera.screenShake, frameB.camera.screenShake, alpha),
  };

  const snapBMap = new Map<string, ReplayCarSnapshot>();
  for (const s of frameB.cars) {
    snapBMap.set(s.id, s);
  }

  const snapAMap = new Map<string, ReplayCarSnapshot>();
  for (const s of frameA.cars) {
    snapAMap.set(s.id, s);
  }

  const discreteSnapFromB = alpha >= 0.5;
  const cars: CarEntity[] = carMeta.map((meta) => {
    const snapA = snapAMap.get(meta.id) || snapBMap.get(meta.id);
    const snapB = snapBMap.get(meta.id) || snapA;

    if (!snapA || !snapB) {
      return {
        id: meta.id,
        name: meta.name,
        isPlayer: meta.isPlayer,
        carStats: meta.carStats,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        angle: 0,
        speed: 0,
        steerAngle: 0,
        driftAngle: 0,
        isDrifting: false,
        currentLap: 0,
        lapProgress: 0,
        totalDistance: 0,
        lastProgress: 0,
        rank: 1,
        currentLapTime: 0,
        bestLapTime: 999,
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
        trailColor: meta.trailColor,
        skidPoints: [],
      };
    }

    const discrete = discreteSnapFromB ? snapB : snapA;
    const angle = lerpAngle(snapA.angle, snapB.angle, alpha);
    const speed = lerp(snapA.speed, snapB.speed, alpha);

    return {
      id: meta.id,
      name: meta.name,
      isPlayer: meta.isPlayer,
      carStats: meta.carStats,
      x: lerp(snapA.x, snapB.x, alpha),
      y: lerp(snapA.y, snapB.y, alpha),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      speed,
      steerAngle: lerp(snapA.steerAngle, snapB.steerAngle, alpha),
      driftAngle: 0,
      isDrifting: discrete.isDrifting,
      currentLap: discrete.currentLap,
      lapProgress: 0,
      totalDistance: 0,
      lastProgress: 0,
      rank: discrete.rank,
      currentLapTime: clampedTime,
      bestLapTime: 999,
      isFinished: false,
      isEliminated: discrete.isEliminated,
      nitro: discrete.nitroActive ? 50 : 0,
      nitroActive: discrete.nitroActive,
      nitroTimer: 0,
      draftingTimer: 0,
      isDrafting: false,
      driftDuration: 0,
      miniTurboLevel: discrete.miniTurboLevel,
      miniTurboBoostTimer: discrete.miniTurboBoostTimer,
      barrierScrapeTimer: 0,
      nearMissCooldown: 0,
      invulnerableTimer: 0,
      bumpVelocityX: 0,
      bumpVelocityY: 0,
      trailColor: meta.trailColor,
      skidPoints: [],
    };
  });

  return {
    time: clampedTime,
    camera,
    cars,
  };
}

export function formatReplayTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
