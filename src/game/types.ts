/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameState = 'title' | 'level_select' | 'garage' | 'features' | 'playing' | 'paused' | 'gameover' | 'replay';

export type OpponentCount = 4 | 6 | 8;

export type RaceMode = 'championship' | 'knockout' | 'drift_fever';

export type RacePerkId = 'none' | 'coin_magnet' | 'twin_nitro' | 'ram_shield' | 'slipstream_pro';

export type TrackWeather = 'clear' | 'night' | 'rain';

export type CameraZoomMode = 'normal' | 'wide';

export interface RaceMission {
  id: string;
  title: string;
  description: string;
  metric: 'near_misses' | 'mini_turbos' | 'wins' | 'coins' | 'drift_points';
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface TrackPoint extends Point {
  width?: number;
  banking?: number;
}

export interface BoostPad {
  x: number;
  y: number;
  angle: number;
  width: number;
  length: number;
}

export interface CoinPickup {
  id: number;
  x: number;
  y: number;
  collected: boolean;
  respawnTimer?: number;
}

export interface TrackHazard {
  id: number;
  x: number;
  y: number;
  type: 'oil' | 'cone' | 'barrier';
  radius: number;
}

export interface TrackTheme {
  name: string;
  groundColor: string;
  groundAccent: string;
  asphaltColor: string;
  asphaltEdgeColor: string;
  kerbColor1: string;
  kerbColor2: string;
  barrierColor: string;
  sceneryType: 'palms' | 'city_neon' | 'pines' | 'speedway_lights' | 'lava_rocks';
  skyGradient: [string, string];
}

export interface TrackDefinition {
  id: string;
  name: string;
  subtitle: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Extreme';
  defaultOpponents: OpponentCount;
  laps: number;
  roadWidth: number;
  points: TrackPoint[];
  boostPads: BoostPad[];
  hazards: TrackHazard[];
  coins: CoinPickup[];
  theme: TrackTheme;
  length: number;
  previewColor: string;
}

export interface CarStats {
  id: string;
  name: string;
  tier: number;
  cost: number;
  unlocked: boolean;
  baseTopSpeed: number; // in pixels/sec
  baseAcceleration: number;
  baseHandling: number; // steering responsiveness
  baseDriftGrip: number; // 0.8 to 0.95
  baseNitroMultiplier: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  shapeStyle: 'sports' | 'super' | 'muscle' | 'hyper';
}

export interface PlayerProgress {
  coins: number;
  selectedCarId: string;
  unlockedCarIds: string[];
  upgrades: {
    [carId: string]: {
      engine: number;    // 0 to 5
      handling: number;  // 0 to 5
      nitro: number;     // 0 to 5
    };
  };
  unlockedTrackIds: string[];
  unlockedPerks: RacePerkId[];
  equippedPerk: RacePerkId;
  winStreak: number;
  missions: RaceMission[];
  bestLapTimes: { [trackId: string]: number };
  bestRanks: { [trackId: string]: number };
}

export type AIPersonality = 'aggressive' | 'speedster' | 'drifter' | 'balanced';

export interface CarEntity {
  id: string;
  name: string;
  isPlayer: boolean;
  isGhost?: boolean;
  carStats: CarStats;

  // Dynamic physics
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // heading angle in radians
  speed: number; // scalar speed in px/s
  steerAngle: number; // visual steering wheel / front tire angle
  driftAngle: number; // difference between heading and movement velocity
  isDrifting: boolean;

  // Track progress
  currentLap: number;
  lapProgress: number; // 0 to 1 along track spline
  totalDistance: number;
  lastProgress: number;

  // Race timing & status
  rank: number;
  currentLapTime: number;
  bestLapTime: number;
  finishTime?: number;
  isFinished: boolean;
  isEliminated?: boolean;

  // Nitro, Mini-Turbo & Drift Mechanics
  nitro: number; // 0 to 100
  nitroActive: boolean;
  nitroTimer: number;
  draftingTimer: number;
  isDrafting: boolean;
  driftDuration: number;
  miniTurboLevel: 0 | 1 | 2; // 0: charging, 1: blue turbo, 2: purple ultra turbo
  miniTurboBoostTimer: number;
  barrierScrapeTimer: number;
  nearMissCooldown: number;

  // AI specific
  aiPersonality?: AIPersonality;
  aiTargetLane?: number; // -1 (left) to 1 (right)
  aiAggressionTimer?: number;
  aiEmote?: { text: string; timer: number };

  // Collision
  invulnerableTimer: number;
  bumpVelocityX: number;
  bumpVelocityY: number;

  // Visuals
  trailColor: string;
  skidPoints: { x: number; y: number; alpha: number }[];
}

export interface FloatingNotification {
  id: number;
  text: string;
  subtext?: string;
  color: string;
  x: number;
  y: number;
  alpha: number;
  scale: number;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  maxLife: number;
  life: number;
  type: 'smoke' | 'spark' | 'flame' | 'dust' | 'speedline' | 'turbo_spark';
}

export interface ReplayCameraState {
  cameraX: number;
  cameraY: number;
  zoom: number;
  screenShake: number;
}

export interface ReplayCarSnapshot {
  id: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  steerAngle: number;
  isDrifting: boolean;
  nitroActive: boolean;
  miniTurboLevel: 0 | 1 | 2;
  miniTurboBoostTimer: number;
  isEliminated: boolean;
  rank: number;
  currentLap: number;
}

export interface ReplayFrame {
  time: number;
  camera: ReplayCameraState;
  cars: ReplayCarSnapshot[];
}

export interface ReplayCarMeta {
  id: string;
  name: string;
  isPlayer: boolean;
  carStats: CarStats;
  trailColor: string;
}

export interface RaceReplayData {
  trackId: string;
  raceMode: RaceMode;
  weather: TrackWeather;
  cameraZoomMode: CameraZoomMode;
  duration: number;
  carMeta: ReplayCarMeta[];
  frames: ReplayFrame[];
}

export interface GhostLapSample {
  t: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  steerAngle: number;
}

export interface TrackGhostLap {
  trackId: string;
  lapTime: number;
  carId: string;
  recordedAt: number;
  samples: GhostLapSample[];
}
