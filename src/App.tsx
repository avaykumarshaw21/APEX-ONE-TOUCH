/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { TitleScreen } from './components/TitleScreen';
import { RaceHUD } from './components/RaceHUD';
import { LevelSelectModal } from './components/LevelSelectModal';
import { GarageModal } from './components/GarageModal';
import { RaceResultModal } from './components/RaceResultModal';
import { PauseModal } from './components/PauseModal';
import { FeaturesMenuModal } from './components/FeaturesMenuModal';
import { OfflineIndicator } from './components/PWAControls';
import { TRACKS, CARS, AI_RIVALS_POOL } from './game/tracks';
import {
  GameState,
  OpponentCount,
  CarEntity,
  Particle,
  PlayerProgress,
  TrackDefinition,
  AIPersonality,
  FloatingNotification,
  RaceMode,
  RacePerkId,
  TrackWeather,
  CameraZoomMode,
} from './game/types';
import {
  bakeTrack,
  BakedTrack,
  findNearestTrackSample,
  calculateRaceRanks,
  getCarEffectiveStats,
  checkDrafting,
  resolveCarCollision,
  updateAICar,
  constrainCarToRoad,
  updateSmoothSteering,
  updateDriftAndMiniTurbo,
  checkNearMiss,
} from './game/physics';
import {
  INITIAL_MISSIONS,
  updateMissionProgress,
  rotateClaimedMission,
  findKnockoutEliminationTarget,
} from './game/features';
import { GameRenderer } from './game/renderer';
import { sound } from './game/audio';

const STORAGE_KEY = 'apex_one_touch_racing_v1';

function getCountdownDisplay(timer: number): number {
  if (timer > 2.4) return 3;
  if (timer > 1.4) return 2;
  if (timer > 0.4) return 1;
  if (timer > -0.35) return 0; // "GO!" shown ONLY at start time for ~0.75s
  return -1; // Hidden for the rest of the race
}

export default function App() {
  // Game State
  const [gameState, setGameState] = useState<GameState>('title');
  const [featuresTab, setFeaturesTab] = useState<'modes' | 'missions' | 'controls'>('modes');
  const [selectedTrack, setSelectedTrack] = useState<TrackDefinition>(TRACKS[0]);
  const [opponentCount, setOpponentCount] = useState<OpponentCount>(4);
  const [raceMode, setRaceMode] = useState<RaceMode>('championship');
  const [weather, setWeather] = useState<TrackWeather>('clear');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [steeringSensitivity, setSteeringSensitivity] = useState<number>(1.0);
  const [autoDriftAssist, setAutoDriftAssist] = useState<boolean>(true);
  const [cameraZoom, setCameraZoom] = useState<CameraZoomMode>('normal');
  const [lastRacePrize, setLastRacePrize] = useState<number>(0);

  // Player persistent progress (with safe defaults for migrating saved v1 state)
  const [progress, setProgress] = useState<PlayerProgress>(() => {
    const defaults: PlayerProgress = {
      coins: 150,
      selectedCarId: 'apex_gt',
      unlockedCarIds: ['apex_gt'],
      upgrades: {
        apex_gt: { engine: 0, handling: 0, nitro: 0 },
      },
      unlockedTrackIds: ['sunset_coast'],
      unlockedPerks: ['none', 'coin_magnet'],
      equippedPerk: 'coin_magnet',
      winStreak: 0,
      missions: INITIAL_MISSIONS,
      bestLapTimes: {},
      bestRanks: {},
    };
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaults,
          ...parsed,
          unlockedPerks: parsed.unlockedPerks || defaults.unlockedPerks,
          equippedPerk: parsed.equippedPerk || defaults.equippedPerk,
          winStreak: typeof parsed.winStreak === 'number' ? parsed.winStreak : 0,
          missions: Array.isArray(parsed.missions) && parsed.missions.length > 0 ? parsed.missions : defaults.missions,
        };
      }
    } catch {
      // Ignore
    }
    return defaults;
  });

  // Save progress
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Ignore
    }
  }, [progress]);

  // Sync document body state
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Canvas and simulation references
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const bakedTrackRef = useRef<BakedTrack>(bakeTrack(TRACKS[0].points));

  // Mutable Game Simulation State (Runs at 60 FPS without triggering React re-renders)
  const simState = useRef<{
    cars: CarEntity[];
    playerCar: CarEntity | null;
    particles: Particle[];
    floatingNotifications: FloatingNotification[];
    coinsCollectedThisRace: number;
    driftPointsThisRace: number;
    nearMissesThisRace: number;
    miniTurbosThisRace: number;
    raceStartTime: number;
    isRaceFinished: boolean;
    steerInput: number;
    keyLeft: boolean;
    keyRight: boolean;
    touchActive: boolean;
    touchStartX: number;
    touchX: number;
    touchY: number;
    countdownTimer: number;
    lastPipCount: number;
    comboCount: number;
    comboTimer: number;
    knockoutTimer: number;
    nextNotifId: number;
  }>({
    cars: [],
    playerCar: null,
    particles: [],
    floatingNotifications: [],
    coinsCollectedThisRace: 0,
    driftPointsThisRace: 0,
    nearMissesThisRace: 0,
    miniTurbosThisRace: 0,
    raceStartTime: 0,
    isRaceFinished: false,
    steerInput: 0,
    keyLeft: false,
    keyRight: false,
    touchActive: false,
    touchStartX: 0,
    touchX: 0,
    touchY: 0,
    countdownTimer: 3.4,
    lastPipCount: 4,
    comboCount: 0,
    comboTimer: 0,
    knockoutTimer: 12.0,
    nextNotifId: 1,
  });

  // Throttled React state for HUD updates
  const [hudState, setHudState] = useState<{
    rank: number;
    speed: number;
    currentLap: number;
    nitro: number;
    nitroActive: boolean;
    isDrafting: boolean;
    coins: number;
    driftPoints: number;
    steerInput: number;
    touchActive: boolean;
    touchX: number;
    touchY: number;
    touchStartX: number;
    countdown: number;
    miniTurboLevel: 0 | 1 | 2;
    comboCount: number;
    knockoutTimer: number;
    activeRacersCount: number;
  }>({
    rank: 1,
    speed: 0,
    currentLap: 0,
    nitro: 50,
    nitroActive: false,
    isDrafting: false,
    coins: 0,
    driftPoints: 0,
    steerInput: 0,
    touchActive: false,
    touchX: 0,
    touchY: 0,
    touchStartX: 0,
    countdown: 3,
    miniTurboLevel: 0,
    comboCount: 0,
    knockoutTimer: 12,
    activeRacersCount: 5,
  });

  const activeCarStats = CARS.find((c) => c.id === progress.selectedCarId) || CARS[0];

  // Helper to initialize car entities on the starting grid
  const initializeGrid = (track: TrackDefinition, rivalsCount: OpponentCount) => {
    const baked = bakeTrack(track.points);
    bakedTrackRef.current = baked;

    track.coins.forEach((c) => (c.collected = false));

    const createdCars: CarEntity[] = [];
    const effectivePlayerStats = getCarEffectiveStats(
      activeCarStats,
      progress.upgrades[activeCarStats.id]
    );

    const startSample = baked.samples[0];
    const roadHalf = track.roadWidth * 0.35;
    const startingNitro = progress.equippedPerk === 'twin_nitro' ? 100 : 50;

    const playerEntity: CarEntity = {
      id: 'player',
      name: 'YOU',
      isPlayer: true,
      carStats: effectivePlayerStats,
      x: startSample.x - startSample.nx * (roadHalf * 0.4),
      y: startSample.y - startSample.ny * (roadHalf * 0.4),
      vx: 0,
      vy: 0,
      angle: startSample.angle,
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
      nitro: startingNitro,
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
      trailColor: effectivePlayerStats.primaryColor,
      skidPoints: [],
    };
    createdCars.push(playerEntity);

    for (let i = 0; i < rivalsCount; i++) {
      const rivalConfig = AI_RIVALS_POOL[i % AI_RIVALS_POOL.length];
      const gridRow = Math.floor((i + 1) / 2);
      const gridCol = (i + 1) % 2 === 0 ? 1 : -1;

      const sampleCount = baked.samples.length;
      const staggerOffset = Math.floor((gridRow * 45) / (baked.totalLength / sampleCount));
      const gridSampleIdx = (sampleCount - staggerOffset) % sampleCount;
      const gridSample = baked.samples[gridSampleIdx];

      const aiCarStats: typeof activeCarStats = {
        id: `ai_${i}`,
        name: rivalConfig.name,
        tier: 1,
        cost: 0,
        unlocked: true,
        baseTopSpeed: effectivePlayerStats.baseTopSpeed * (0.92 + Math.random() * 0.12),
        baseAcceleration: effectivePlayerStats.baseAcceleration * (0.9 + Math.random() * 0.15),
        baseHandling: 3.1,
        baseDriftGrip: 0.88,
        baseNitroMultiplier: 1.4,
        primaryColor: rivalConfig.primary,
        secondaryColor: rivalConfig.secondary,
        accentColor: '#ffffff',
        shapeStyle: 'sports',
      };

      const aiEntity: CarEntity = {
        id: `ai_${i}`,
        name: rivalConfig.name,
        isPlayer: false,
        carStats: aiCarStats,
        x: gridSample.x + gridSample.nx * (gridCol * roadHalf * 0.6),
        y: gridSample.y + gridSample.ny * (gridCol * roadHalf * 0.6),
        vx: 0,
        vy: 0,
        angle: gridSample.angle,
        speed: 0,
        steerAngle: 0,
        driftAngle: 0,
        isDrifting: false,
        currentLap: 0,
        lapProgress: 0,
        totalDistance: -gridRow * 40,
        lastProgress: 0,
        rank: i + 2,
        currentLapTime: 0,
        bestLapTime: 999,
        isFinished: false,
        isEliminated: false,
        nitro: 40 + Math.random() * 30,
        nitroActive: false,
        nitroTimer: 0,
        draftingTimer: 0,
        isDrafting: false,
        driftDuration: 0,
        miniTurboLevel: 0,
        miniTurboBoostTimer: 0,
        barrierScrapeTimer: 0,
        nearMissCooldown: 0,
        aiPersonality: rivalConfig.personality as AIPersonality,
        aiTargetLane: gridCol * 0.5,
        invulnerableTimer: 0,
        bumpVelocityX: 0,
        bumpVelocityY: 0,
        trailColor: aiCarStats.primaryColor,
        skidPoints: [],
      };
      createdCars.push(aiEntity);
    }

    simState.current.cars = createdCars;
    simState.current.playerCar = playerEntity;
    simState.current.particles = [];
    simState.current.floatingNotifications = [];
    simState.current.coinsCollectedThisRace = 0;
    simState.current.driftPointsThisRace = 0;
    simState.current.nearMissesThisRace = 0;
    simState.current.miniTurbosThisRace = 0;
    simState.current.raceStartTime = performance.now();
    simState.current.isRaceFinished = false;
    simState.current.steerInput = 0;
    simState.current.countdownTimer = 3.4;
    simState.current.lastPipCount = 4;
    simState.current.comboCount = 0;
    simState.current.comboTimer = 0;
    simState.current.knockoutTimer = 12.0;

    if (rendererRef.current) {
      rendererRef.current.cameraX = playerEntity.x;
      rendererRef.current.cameraY = playerEntity.y;
    }
  };

  // Start Race
  const startRace = () => {
    sound.resume();
    sound.startEngine();
    initializeGrid(selectedTrack, opponentCount);
    setGameState('playing');
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startRace();
    }
  }, []);

  // Keyboard navigation & controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
        startRace();
        return;
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === 'playing') setGameState('paused');
        else if (gameState === 'paused') setGameState('playing');
        return;
      }

      if (e.code === 'KeyM') {
        const nextMute = sound.toggleMute();
        setIsMuted(nextMute);
        return;
      }

      if (gameState === 'playing') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          simState.current.keyLeft = true;
        }
        if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          simState.current.keyRight = true;
        }
        if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
          triggerNitro();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        simState.current.keyLeft = false;
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        simState.current.keyRight = false;
      }
    };

    const handleBlur = () => {
      simState.current.keyLeft = false;
      simState.current.keyRight = false;
      simState.current.touchActive = false;
      simState.current.steerInput = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [gameState, selectedTrack, opponentCount, progress.equippedPerk]);

  // Nitro Trigger
  const triggerNitro = () => {
    const player = simState.current.playerCar;
    if (!player || player.nitro < 15 || player.nitroActive) return;
    player.nitroActive = true;
    player.nitroTimer = 2.2;
    sound.playNitroBoost();
    if (rendererRef.current) {
      rendererRef.current.screenShake = 0.4;
    }
  };

  // Main 60 FPS Game Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let hudThrottleTimer = 0;
    let staticNeedsRender = true;

    const gameLoop = (now: number) => {
      animId = requestAnimationFrame(gameLoop);

      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        staticNeedsRender = true;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (!rendererRef.current) {
        rendererRef.current = new GameRenderer(ctx);
        staticNeedsRender = true;
      }

      if (gameState === 'playing') {
        updateSimulation(dt, now);
      } else if (!staticNeedsRender) {
        return;
      }

      staticNeedsRender = false;
      const currentTrack = selectedTrack;
      const baked = bakedTrackRef.current;
      const player = simState.current.playerCar || ({
        x: 0,
        y: 0,
        angle: 0,
        speed: 0,
      } as CarEntity);

      rendererRef.current.render(
        currentTrack,
        baked,
        simState.current.cars,
        player,
        simState.current.particles,
        simState.current.floatingNotifications,
        width,
        height,
        now / 1000,
        weather,
        cameraZoom
      );

      hudThrottleTimer += dt;
      if (gameState === 'playing' && hudThrottleTimer >= 0.06 && simState.current.playerCar) {
        hudThrottleTimer = 0;
        const p = simState.current.playerCar;
        const activeRacersCount = simState.current.cars.filter((c) => !c.isEliminated).length;

        setHudState({
          rank: p.rank,
          speed: p.speed,
          currentLap: p.currentLap,
          nitro: p.nitro,
          nitroActive: p.nitroActive,
          isDrafting: p.isDrafting,
          coins: simState.current.coinsCollectedThisRace,
          driftPoints: simState.current.driftPointsThisRace,
          steerInput: simState.current.steerInput,
          touchActive: simState.current.touchActive,
          touchX: simState.current.touchX,
          touchY: simState.current.touchY,
          touchStartX: simState.current.touchStartX,
          countdown: getCountdownDisplay(simState.current.countdownTimer),
          miniTurboLevel: p.miniTurboLevel,
          comboCount: simState.current.comboCount,
          knockoutTimer: Math.max(0, simState.current.knockoutTimer),
          activeRacersCount,
        });
      }
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, selectedTrack, weather, cameraZoom, raceMode, autoDriftAssist, steeringSensitivity, progress.equippedPerk]);

  // Helper to spawn floating world notification text
  const spawnNotification = (text: string, x: number, y: number, color: string, subtext?: string) => {
    simState.current.floatingNotifications.push({
      id: simState.current.nextNotifId++,
      text,
      subtext,
      color,
      x,
      y,
      alpha: 1.0,
      scale: 1.0,
      life: 1.3,
      maxLife: 1.3,
    });
  };

  // Physics Simulation Step
  const updateSimulation = (dt: number, timeMs: number) => {
    const { cars, playerCar, particles } = simState.current;
    if (!playerCar || simState.current.isRaceFinished) return;

    const track = selectedTrack;
    const baked = bakedTrackRef.current;
    const equippedPerk = progress.equippedPerk;

    // 0. Handle Race Countdown (3... 2... 1... GO! -> then hidden!)
    if (simState.current.countdownTimer > -0.8) {
      simState.current.countdownTimer -= dt;
      const displaySecond = getCountdownDisplay(simState.current.countdownTimer);
      if (displaySecond >= 0 && displaySecond < simState.current.lastPipCount) {
        simState.current.lastPipCount = displaySecond;
        sound.playCountdownPip(displaySecond === 0);
      }

      // Fast-forward 3-2-1 to GO! window on first touch/key if impatient
      if (
        simState.current.countdownTimer > 0.42 &&
        (simState.current.touchActive || simState.current.keyLeft || simState.current.keyRight)
      ) {
        simState.current.countdownTimer = 0.4;
        simState.current.lastPipCount = 0;
        sound.playCountdownPip(true);
      }

      // Rocket Start check (Right when GO! is active: 0.4 >= timer >= -0.35)
      const inRocketWindow =
        simState.current.countdownTimer <= 0.4 && simState.current.countdownTimer >= -0.35;
      const isTryingToAccelerate =
        simState.current.touchActive || simState.current.keyLeft || simState.current.keyRight;
      if (inRocketWindow && isTryingToAccelerate && playerCar.speed < 100) {
        playerCar.speed = Math.max(playerCar.speed, playerCar.carStats.baseTopSpeed * 1.38);
        playerCar.miniTurboBoostTimer = 2.0;
        sound.playRocketStart();
        if (rendererRef.current) rendererRef.current.screenShake = 0.4;
        spawnNotification('ROCKET START!', playerCar.x, playerCar.y - 40, '#38bdf8', '+100 CR BONUS');
        simState.current.coinsCollectedThisRace += 100;
        if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
      }
    }

    const isRacing = simState.current.countdownTimer <= 0.4;

    // 0.5 Knockout Elimination Timer
    if (isRacing && raceMode === 'knockout') {
      simState.current.knockoutTimer -= dt;
      if (simState.current.knockoutTimer <= 0) {
        simState.current.knockoutTimer = 12.0;
        const target = findKnockoutEliminationTarget(cars);
        if (target) {
          target.isEliminated = true;
          target.speed = 0;
          sound.playBump();
          spawnNotification(
            target.isPlayer ? 'KNOCKED OUT!' : `${target.name} ELIMINATED!`,
            target.x,
            target.y - 40,
            '#ef4444'
          );

          if (target.isPlayer) {
            calculateRaceRanks(cars);
            handleRaceFinish();
            return;
          }

          const remainingActive = cars.filter((c) => !c.isEliminated && !c.isFinished);
          if (remainingActive.length === 1 && remainingActive[0].isPlayer) {
            calculateRaceRanks(cars);
            handleRaceFinish();
            return;
          }
        }
      }
    }

    // 1. Process 1-Finger Steering and Keyboard inputs for player
    let targetSteer = 0;
    if (simState.current.keyLeft) targetSteer -= 1;
    if (simState.current.keyRight) targetSteer += 1;

    if (simState.current.touchActive) {
      const deltaX = simState.current.touchX - simState.current.touchStartX;
      const maxDragDistance = 90 / steeringSensitivity;
      targetSteer = Math.max(-1, Math.min(1, deltaX / maxDragDistance));
    }

    simState.current.steerInput += (targetSteer - simState.current.steerInput) * 16 * dt;

    if (isRacing) {
      updateSmoothSteering(
        playerCar,
        simState.current.steerInput,
        baked,
        dt,
        steeringSensitivity,
        autoDriftAssist
      );
    }

    // 2. Update Drift & Mini-Turbo
    if (isRacing) {
      const weatherChargeBonus = weather === 'rain' ? 1.2 : 1.0;
      const turboResult = updateDriftAndMiniTurbo(playerCar, dt, weatherChargeBonus);
      if (turboResult.miniTurboFired) {
        simState.current.miniTurbosThisRace += 1;
        sound.playMiniTurbo(turboResult.level === 2 ? 2 : 1);
        if (rendererRef.current) rendererRef.current.screenShake = 0.3;
        const prize = turboResult.level === 2 ? 35 : 15;
        simState.current.coinsCollectedThisRace += prize;
        spawnNotification(
          turboResult.level === 2 ? 'ULTRA TURBO!' : 'MINI-TURBO!',
          playerCar.x,
          playerCar.y - 35,
          turboResult.level === 2 ? '#d946ef' : '#06b6d4',
          `+${prize} CR`
        );
        if (navigator.vibrate) navigator.vibrate([20, 10, 20]);
      }
    }

    // 3. Update all cars (Player + AI)
    for (const car of cars) {
      if (car.isEliminated) {
        car.speed = Math.max(0, car.speed - 240 * dt);
        continue;
      }

      if (car.isFinished) {
        car.speed = Math.max(0, car.speed - 160 * dt);
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        continue;
      }

      if (isRacing) {
        car.currentLapTime += dt;
      }

      if (!car.isPlayer && isRacing) {
        const { steerInput: aiSteer, useNitro: aiNitro } = updateAICar(
          car,
          cars,
          baked,
          track.roadWidth,
          dt
        );
        car.steerAngle = aiSteer * 0.45;
        const turnSpeed = (car.steerAngle * car.carStats.baseHandling * 1.9) / (1 + car.speed * 0.001);
        car.angle += turnSpeed * dt;

        if (aiNitro && !car.nitroActive && car.nitro >= 25) {
          car.nitroActive = true;
          car.nitroTimer = 2.0;
        }
      }

      if (car.miniTurboBoostTimer > 0) car.miniTurboBoostTimer -= dt;
      if (car.barrierScrapeTimer > 0) car.barrierScrapeTimer -= dt;
      if (car.nearMissCooldown > 0) car.nearMissCooldown -= dt;
      if (car.aiEmote && car.aiEmote.timer > 0) car.aiEmote.timer -= dt;

      if (car.nitroActive) {
        car.nitroTimer -= dt;
        car.nitro = Math.max(0, car.nitro - 25 * dt);
        if (car.nitroTimer <= 0 || car.nitro <= 0) {
          car.nitroActive = false;
        }
      } else {
        car.nitro = Math.min(100, car.nitro + 3.5 * dt);
      }

      let maxSpeed = car.carStats.baseTopSpeed;
      if (car.nitroActive) maxSpeed *= car.carStats.baseNitroMultiplier;
      if (car.miniTurboBoostTimer > 0) maxSpeed *= 1.3;
      if (car.isDrafting) {
        maxSpeed *= car.isPlayer && equippedPerk === 'slipstream_pro' ? 1.32 : 1.22;
      }

      const accel = car.carStats.baseAcceleration;

      if (isRacing) {
        if (car.speed < maxSpeed) {
          car.speed = Math.min(maxSpeed, car.speed + accel * dt);
        } else {
          car.speed = Math.max(maxSpeed, car.speed - 120 * dt);
        }
      }

      const headingVx = Math.cos(car.angle) * car.speed;
      const headingVy = Math.sin(car.angle) * car.speed;

      if (car.isDrifting && car.isPlayer) {
        sound.playDriftScreech();
        const nightBonus = weather === 'night' ? 1.15 : 1.0;
        const feverMult = raceMode === 'drift_fever' ? 1.5 : 1.0;
        simState.current.driftPointsThisRace += Math.round(50 * nightBonus * feverMult * dt);

        const nitroDriftRate = equippedPerk === 'twin_nitro' ? 16.2 : 12;
        car.nitro = Math.min(100, car.nitro + nitroDriftRate * dt);

        if (Math.random() < 0.45) {
          car.skidPoints.push({ x: car.x, y: car.y, alpha: 1.0 });
          if (car.skidPoints.length > 50) car.skidPoints.shift();
        }

        if (particles.length < 80 && Math.random() < 0.6) {
          particles.push({
            x: car.x - Math.cos(car.angle) * 16 + (Math.random() - 0.5) * 8,
            y: car.y - Math.sin(car.angle) * 16 + (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 30,
            vy: (Math.random() - 0.5) * 30,
            radius: 3 + Math.random() * 4,
            color: '#e2e8f0',
            alpha: 0.6,
            maxLife: 0.4,
            life: 0.4,
            type: 'smoke',
          });
        }
      }

      car.vx = headingVx + car.bumpVelocityX;
      car.vy = headingVy + car.bumpVelocityY;
      car.x += car.vx * dt;
      car.y += car.vy * dt;

      car.bumpVelocityX *= 0.88;
      car.bumpVelocityY *= 0.88;

      // HARD ROAD CONSTRAINT: PLAYER AND AI CAN NEVER GO OUT OF THE ROAD!
      const barrierResult = constrainCarToRoad(car, track.roadWidth, baked, dt);
      if (barrierResult.collided && car.isPlayer) {
        sound.playBarrierScrape();
        if (rendererRef.current) rendererRef.current.screenShake = 0.2;
        if (navigator.vibrate) navigator.vibrate(15);

        for (let s = 0; s < 3; s++) {
          particles.push({
            x: barrierResult.scrapeX,
            y: barrierResult.scrapeY,
            vx: -barrierResult.nx * 75 + (Math.random() - 0.5) * 45,
            vy: -barrierResult.ny * 75 + (Math.random() - 0.5) * 45,
            radius: 2.2,
            color: Math.random() < 0.5 ? '#facc15' : '#ffffff',
            alpha: 0.95,
            maxLife: 0.22,
            life: 0.22,
            type: 'spark',
          });
        }
      }

      const isBoosting = car.nitroActive || car.miniTurboBoostTimer > 0;
      if (isBoosting && particles.length < 100) {
        particles.push({
          x: car.x - Math.cos(car.angle) * 24,
          y: car.y - Math.sin(car.angle) * 24,
          vx: -Math.cos(car.angle) * 100 + (Math.random() - 0.5) * 20,
          vy: -Math.sin(car.angle) * 100 + (Math.random() - 0.5) * 20,
          radius: 4 + Math.random() * 3,
          color: car.miniTurboBoostTimer > 0 ? '#c084fc' : '#00f0ff',
          alpha: 0.85,
          maxLife: 0.25,
          life: 0.25,
          type: 'flame',
        });
      }

      const trackLoc = findNearestTrackSample(car.x, car.y, baked);
      const currentTrackIndex = trackLoc.index;
      const progressT = currentTrackIndex / baked.samples.length;

      if (car.lastProgress > 0.85 && progressT < 0.15) {
        car.currentLap += 1;
        if (car.currentLapTime < car.bestLapTime) {
          car.bestLapTime = car.currentLapTime;
        }
        car.currentLapTime = 0;

        if (car.isPlayer) {
          sound.playLapChime();
          spawnNotification(`LAP ${car.currentLap} COMPLETED!`, car.x, car.y - 45, '#22c55e');
        }

        if (raceMode !== 'knockout' && car.currentLap >= track.laps && !car.isFinished) {
          car.isFinished = true;
          car.finishTime = (timeMs - simState.current.raceStartTime) / 1000;

          if (car.isPlayer) {
            handleRaceFinish();
          }
        }
      }
      car.lastProgress = progressT;
      car.lapProgress = progressT;
      car.totalDistance = car.currentLap * baked.totalLength + progressT * baked.totalLength;
    }

    // 5. Near-Miss Overtake Detection for Player
    if (isRacing) {
      const nearMissRange = equippedPerk === 'coin_magnet' ? 60 : 44;
      for (const rival of cars) {
        if (rival.isPlayer) continue;
        if (checkNearMiss(playerCar, rival, nearMissRange)) {
          sound.playNearMiss();
          const reward = equippedPerk === 'coin_magnet' ? 65 : 50;
          simState.current.coinsCollectedThisRace += reward;
          simState.current.nearMissesThisRace += 1;
          simState.current.comboCount += 1;
          simState.current.comboTimer = 2.6;

          if (raceMode === 'drift_fever') {
            simState.current.driftPointsThisRace += 40 * simState.current.comboCount;
          }

          const rivalEmotes = ['Whoa!', 'Watch out!', 'Hey!', 'Too fast!', 'No way!'];
          rival.aiEmote = {
            text: rivalEmotes[Math.floor(Math.random() * rivalEmotes.length)],
            timer: 1.6,
          };

          const text =
            simState.current.comboCount > 1
              ? `NEAR MISS! x${simState.current.comboCount} COMBO`
              : `NEAR MISS! +${reward} CR`;
          spawnNotification(text, playerCar.x, playerCar.y - 30, '#facc15');
          if (navigator.vibrate) navigator.vibrate(15);
        }
      }
    }

    if (simState.current.comboCount > 0) {
      simState.current.comboTimer -= dt;
      if (simState.current.comboTimer <= 0) {
        simState.current.comboCount = 0;
      }
    }

    sound.updateEngine(playerCar.speed / playerCar.carStats.baseTopSpeed, playerCar.nitroActive);

    // 7. Slipstream / Drafting detection for Player
    let playerIsDrafting = false;
    const draftRange = equippedPerk === 'slipstream_pro' ? 280 : 160;
    const draftCone = equippedPerk === 'slipstream_pro' ? 0.72 : 0.45;
    for (const other of cars) {
      if (other.isPlayer || other.isEliminated) continue;
      if (checkDrafting(playerCar, other, draftRange, draftCone)) {
        playerIsDrafting = true;
        break;
      }
    }
    playerCar.isDrafting = playerIsDrafting;

    // 8. Car-to-Car Collisions (with Ram Shield perk support)
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const carA = cars[i];
        const carB = cars[j];
        if (carA.isEliminated || carB.isEliminated) continue;
        const prevPlayerSpeed = playerCar.speed;
        const collided = resolveCarCollision(carA, carB, 22);
        if (collided) {
          if (carA.isPlayer || carB.isPlayer) {
            sound.playBump();
            if (rendererRef.current) rendererRef.current.screenShake = 0.25;
            if (navigator.vibrate) navigator.vibrate(20);

            if (equippedPerk === 'ram_shield') {
              playerCar.speed = Math.max(prevPlayerSpeed, playerCar.carStats.baseTopSpeed * 1.1);
              playerCar.nitro = Math.min(100, playerCar.nitro + 18);
              spawnNotification('RAM STEAL! +18% NITRO', playerCar.x, playerCar.y - 34, '#f97316');
            }
          }
          for (let s = 0; s < 4; s++) {
            particles.push({
              x: (carA.x + carB.x) / 2,
              y: (carA.y + carB.y) / 2,
              vx: (Math.random() - 0.5) * 160,
              vy: (Math.random() - 0.5) * 160,
              radius: 2.5,
              color: '#facc15',
              alpha: 0.9,
              maxLife: 0.2,
              life: 0.2,
              type: 'spark',
            });
          }
        }
      }
    }

    // 9. Track Pickups & Boost Pads
    for (const pad of track.boostPads) {
      const dx = playerCar.x - pad.x;
      const dy = playerCar.y - pad.y;
      if (Math.hypot(dx, dy) < 45) {
        playerCar.speed = Math.max(playerCar.speed, playerCar.carStats.baseTopSpeed * 1.35);
        playerCar.nitro = Math.min(100, playerCar.nitro + 30);
        sound.playNitroBoost();
        spawnNotification('TURBO BOOST!', playerCar.x, playerCar.y - 35, '#00f0ff');
        if (rendererRef.current) rendererRef.current.screenShake = 0.35;
      }
    }

    // Coins (with Coin Magnet attraction!)
    const coinCollectDist = equippedPerk === 'coin_magnet' ? 120 : 32;
    for (const coin of track.coins) {
      if (coin.collected) continue;
      const dist = Math.hypot(playerCar.x - coin.x, playerCar.y - coin.y);
      if (dist < coinCollectDist) {
        coin.collected = true;
        simState.current.coinsCollectedThisRace += 10;
        sound.playCoin();
      }
    }

    // Hazards (Oil slicks)
    for (const hazard of track.hazards) {
      const dist = Math.hypot(playerCar.x - hazard.x, playerCar.y - hazard.y);
      if (dist < hazard.radius) {
        playerCar.steerAngle += (Math.random() - 0.5) * 0.8;
        playerCar.speed = Math.max(80, playerCar.speed * 0.92);
        sound.playDriftScreech();
      }
    }

    // 10. Update Floating Notifications
    for (let i = simState.current.floatingNotifications.length - 1; i >= 0; i--) {
      const notif = simState.current.floatingNotifications[i];
      notif.life -= dt;
      notif.y -= 26 * dt;
      notif.alpha = Math.max(0, notif.life / notif.maxLife);
      if (notif.life <= 0) {
        simState.current.floatingNotifications.splice(i, 1);
      }
    }

    // 11. Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    // 12. Fade skid points
    for (const car of cars) {
      for (let i = car.skidPoints.length - 1; i >= 0; i--) {
        car.skidPoints[i].alpha -= dt * 0.08;
        if (car.skidPoints[i].alpha <= 0) {
          car.skidPoints.splice(i, 1);
        }
      }
    }

    calculateRaceRanks(cars);
  };

  // Race Finish handler
  const handleRaceFinish = () => {
    if (simState.current.isRaceFinished) return;
    simState.current.isRaceFinished = true;
    sound.stopEngine();
    sound.playVictory();

    const player = simState.current.playerCar!;
    const coinsCollected = simState.current.coinsCollectedThisRace;
    const driftDivisor = raceMode === 'drift_fever' ? 10 : 20;
    const driftBonus = Math.floor(simState.current.driftPointsThisRace / driftDivisor);
    const winBonus =
      raceMode === 'knockout' && player.rank === 1
        ? 160
        : player.rank === 1
        ? 120
        : player.rank <= 3
        ? 60
        : 25;

    const streakMultiplier = Math.min(2.0, 1 + progress.winStreak * 0.25);
    const totalPrize = Math.round((coinsCollected + driftBonus + winBonus) * streakMultiplier);
    setLastRacePrize(totalPrize);

    const nearMissesDelta = simState.current.nearMissesThisRace;
    const miniTurbosDelta = simState.current.miniTurbosThisRace;
    const driftDelta = simState.current.driftPointsThisRace;
    const winDelta = player.rank === 1 ? 1 : 0;

    setProgress((prev) => {
      const updatedBestLap = Math.min(
        player.bestLapTime,
        prev.bestLapTimes[selectedTrack.id] || 999
      );
      const updatedRank = Math.min(
        player.rank,
        prev.bestRanks[selectedTrack.id] || 99
      );

      const nextStreak = player.rank <= 3 && !player.isEliminated ? prev.winStreak + 1 : 0;

      const updatedMissions = updateMissionProgress(prev.missions, {
        near_misses: nearMissesDelta,
        mini_turbos: miniTurbosDelta,
        wins: winDelta,
        coins: totalPrize,
        drift_points: driftDelta,
      });

      return {
        ...prev,
        coins: prev.coins + totalPrize,
        winStreak: nextStreak,
        missions: updatedMissions,
        bestLapTimes: {
          ...prev.bestLapTimes,
          [selectedTrack.id]: updatedBestLap,
        },
        bestRanks: {
          ...prev.bestRanks,
          [selectedTrack.id]: updatedRank,
        },
      };
    });

    setGameState('gameover');
  };

  // 1-Finger Touch and Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (gameState !== 'playing') return;
    simState.current.touchActive = true;
    simState.current.touchStartX = e.clientX;
    simState.current.touchX = e.clientX;
    simState.current.touchY = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!simState.current.touchActive) return;
    simState.current.touchX = e.clientX;
    simState.current.touchY = e.clientY;
  };

  const handlePointerUp = () => {
    simState.current.touchActive = false;
    simState.current.steerInput = 0;
  };

  const handleNextTrack = () => {
    const currentIndex = TRACKS.findIndex((t) => t.id === selectedTrack.id);
    const nextTrack = TRACKS[(currentIndex + 1) % TRACKS.length];
    setSelectedTrack(nextTrack);
    startRace();
  };

  const claimableMissionsCount = progress.missions.filter(
    (m) => !m.claimed && m.progress >= m.target
  ).length;

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none touch-none bg-[#090a0f]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 60 FPS Game Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block game-canvas" />

      {/* Title Screen */}
      {gameState === 'title' && (
        <TitleScreen
          onStartRace={startRace}
          onOpenLevelSelect={() => setGameState('level_select')}
          onOpenGarage={() => setGameState('garage')}
          onOpenFeatures={(tab = 'modes') => {
            setFeaturesTab(tab);
            setGameState('features');
          }}
          opponentCount={opponentCount}
          onSetOpponentCount={(c) => setOpponentCount(c)}
          raceMode={raceMode}
          onSetRaceMode={(m) => setRaceMode(m)}
          equippedPerk={progress.equippedPerk}
          weather={weather}
          winStreak={progress.winStreak}
          claimableMissionsCount={claimableMissionsCount}
          selectedTrack={selectedTrack}
          selectedCar={activeCarStats}
          coins={progress.coins}
          isMuted={isMuted}
          onToggleMute={() => {
            const m = sound.toggleMute();
            setIsMuted(m);
          }}
        />
      )}

      {/* Race In-Game HUD */}
      {gameState === 'playing' && simState.current.playerCar && (
        <RaceHUD
          playerCar={simState.current.playerCar}
          cars={simState.current.cars}
          track={selectedTrack}
          baked={bakedTrackRef.current}
          totalLaps={selectedTrack.laps}
          coinsCollected={hudState.coins}
          driftPoints={hudState.driftPoints}
          onPause={() => setGameState('paused')}
          isMuted={isMuted}
          onToggleMute={() => {
            const m = sound.toggleMute();
            setIsMuted(m);
          }}
          onTriggerNitro={triggerNitro}
          steerInput={hudState.steerInput}
          touchActive={hudState.touchActive}
          touchX={hudState.touchX}
          touchY={hudState.touchY}
          touchStartX={hudState.touchStartX}
          countdown={hudState.countdown}
          miniTurboLevel={hudState.miniTurboLevel}
          comboCount={hudState.comboCount}
          raceMode={raceMode}
          knockoutTimer={hudState.knockoutTimer}
          activeRacersCount={hudState.activeRacersCount}
        />
      )}

      {/* Features & Improv Menu Modal */}
      {gameState === 'features' && (
        <FeaturesMenuModal
          initialTab={featuresTab}
          progress={progress}
          raceMode={raceMode}
          onSetRaceMode={(m) => setRaceMode(m)}
          weather={weather}
          onSetWeather={(w) => setWeather(w)}
          onEquipPerk={(perkId: RacePerkId) => {
            setProgress((prev) => ({ ...prev, equippedPerk: perkId }));
          }}
          onUnlockPerk={(perkId: RacePerkId, cost: number) => {
            if (progress.coins >= cost) {
              setProgress((prev) => ({
                ...prev,
                coins: prev.coins - cost,
                unlockedPerks: [...prev.unlockedPerks, perkId],
                equippedPerk: perkId,
              }));
              sound.playCoin();
            }
          }}
          onClaimMission={(missionId: string) => {
            const targetMission = progress.missions.find((m) => m.id === missionId);
            if (!targetMission || targetMission.progress < targetMission.target) return;
            setProgress((prev) => ({
              ...prev,
              coins: prev.coins + targetMission.reward,
              missions: rotateClaimedMission(prev.missions, missionId),
            }));
            sound.playLapChime();
          }}
          steeringSensitivity={steeringSensitivity}
          onSetSteeringSensitivity={(val) => setSteeringSensitivity(val)}
          autoDriftAssist={autoDriftAssist}
          onSetAutoDriftAssist={(val) => setAutoDriftAssist(val)}
          cameraZoom={cameraZoom}
          onSetCameraZoom={(val) => setCameraZoom(val)}
          onStartRace={startRace}
          onClose={() => setGameState('title')}
        />
      )}

      {/* Level Select Modal */}
      {gameState === 'level_select' && (
        <LevelSelectModal
          currentTrackId={selectedTrack.id}
          onSelectTrack={(t) => setSelectedTrack(t)}
          opponentCount={opponentCount}
          onSetOpponentCount={(c) => setOpponentCount(c)}
          onClose={() => setGameState('title')}
          onStartRace={startRace}
          bestLapTimes={progress.bestLapTimes}
        />
      )}

      {/* Garage / Car Tuning Modal */}
      {gameState === 'garage' && (
        <GarageModal
          progress={progress}
          onSelectCar={(carId) => {
            setProgress((prev) => ({ ...prev, selectedCarId: carId }));
          }}
          onUnlockCar={(carId, cost) => {
            if (progress.coins >= cost) {
              setProgress((prev) => ({
                ...prev,
                coins: prev.coins - cost,
                unlockedCarIds: [...prev.unlockedCarIds, carId],
                selectedCarId: carId,
              }));
              sound.playCoin();
            }
          }}
          onUpgradePart={(carId, part, cost) => {
            if (progress.coins >= cost) {
              setProgress((prev) => {
                const currentCarUpgrades = prev.upgrades[carId] || {
                  engine: 0,
                  handling: 0,
                  nitro: 0,
                };
                return {
                  ...prev,
                  coins: prev.coins - cost,
                  upgrades: {
                    ...prev.upgrades,
                    [carId]: {
                      ...currentCarUpgrades,
                      [part]: Math.min(5, currentCarUpgrades[part] + 1),
                    },
                  },
                };
              });
              sound.playCoin();
            }
          }}
          onClose={() => setGameState('title')}
        />
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          onResume={() => setGameState('playing')}
          onRestart={startRace}
          onReturnToMenu={() => {
            sound.stopEngine();
            setGameState('title');
          }}
          isMuted={isMuted}
          onToggleMute={() => {
            const m = sound.toggleMute();
            setIsMuted(m);
          }}
          steeringSensitivity={steeringSensitivity}
          onSetSteeringSensitivity={(s) => setSteeringSensitivity(s)}
          autoDriftAssist={autoDriftAssist}
          onSetAutoDriftAssist={(val) => setAutoDriftAssist(val)}
          cameraZoom={cameraZoom}
          onSetCameraZoom={(val) => setCameraZoom(val)}
        />
      )}

      {/* Race Result / Podium Modal */}
      {gameState === 'gameover' && simState.current.playerCar && (
        <RaceResultModal
          playerCar={simState.current.playerCar}
          cars={simState.current.cars}
          track={selectedTrack}
          raceMode={raceMode}
          coinsEarned={lastRacePrize}
          onRestartRace={startRace}
          onNextTrack={handleNextTrack}
          onReturnToMenu={() => setGameState('title')}
        />
      )}

      {/* Offline Connectivity Indicator (hidden when online) */}
      <OfflineIndicator isPlaying={gameState === 'playing'} />
    </div>
  );
}
