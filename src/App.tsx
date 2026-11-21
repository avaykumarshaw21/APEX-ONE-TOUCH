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
import { FeaturesMenuModal, FeaturesTabId } from './components/FeaturesMenuModal';
import { OfflineIndicator } from './components/PWAControls';
import { ReplayHUD, ReplayCameraMode, ReplayPlaybackSpeed } from './components/ReplayHUD';
import { TRACKS, CARS, AI_RIVALS_POOL } from './game/tracks';
import {
  AIDifficulty,
  GameState,
  GameSettings,
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
  RaceReplayData,
  GhostLapSample,
  TrackGhostLap,
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
  AI_DIFFICULTIES,
  updateMissionProgress,
  rotateClaimedMission,
  findKnockoutEliminationTarget,
} from './game/features';
import {
  applyRaceCompletionToProgress,
  canClaimDailyBonus,
  claimDailyBonus,
  createDefaultProgress,
  createDefaultSettings,
  createOfflineSaveBundle,
  getChampionshipPointsForRank,
  getNextDailyBonusReward,
  loadGhostsFromDevice,
  loadProgressFromDevice,
  loadSettingsFromDevice,
  parseOfflineSaveBundle,
  resolveCarStatsWithPaint,
  saveGhostsToDevice,
  saveProgressToDevice,
  saveSettingsToDevice,
} from './game/storage';
import {
  createReplayRecorder,
  recordReplayFrame,
  sampleReplayAtTime,
} from './game/replay';
import {
  buildGhostCarEntity,
  computeGhostSplit,
  recordGhostSample,
  sampleGhostAtTime,
  shouldUpdateGhostRecord,
} from './game/ghost';
import { GameRenderer } from './game/renderer';
import { sound } from './game/audio';

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
  const [featuresTab, setFeaturesTab] = useState<FeaturesTabId>('modes');
  const [settings, setSettings] = useState<GameSettings>(() => loadSettingsFromDevice());
  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgressFromDevice());
  const [ghostLaps, setGhostLaps] = useState<{ [trackId: string]: TrackGhostLap }>(() =>
    loadGhostsFromDevice()
  );
  const ghostLapsRef = useRef<{ [trackId: string]: TrackGhostLap }>(ghostLaps);

  const [lastRacePrize, setLastRacePrize] = useState<number>(0);
  const [lastChampPoints, setLastChampPoints] = useState<number>(0);
  const [newlyUnlockedTrackName, setNewlyUnlockedTrackName] = useState<string | null>(null);

  const selectedTrack =
    TRACKS.find((t) => t.id === settings.selectedTrackId) || TRACKS[0];
  const opponentCount = settings.opponentCount;
  const raceMode = settings.raceMode;
  const weather = settings.weather;
  const aiDifficulty = settings.aiDifficulty;
  const isMuted = settings.isMuted;
  const steeringSensitivity = settings.steeringSensitivity;
  const autoDriftAssist = settings.autoDriftAssist;
  const cameraZoom = settings.cameraZoom;
  const raceAgainstGhost = settings.raceAgainstGhost;
  const hapticsEnabled = settings.hapticsEnabled;
  const showMinimap = settings.showMinimap;

  const updateSettings = (patch: Partial<GameSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  // Sync audio mute state from saved device settings on mount & updates
  useEffect(() => {
    sound.setMuted(settings.isMuted);
    saveSettingsToDevice(settings);
  }, [settings]);

  // Permanently save progress on device (localStorage + IndexedDB mirror)
  useEffect(() => {
    saveProgressToDevice(progress);
  }, [progress]);

  // Keep ghostLaps ref synced and persisted
  useEffect(() => {
    ghostLapsRef.current = ghostLaps;
    saveGhostsToDevice(ghostLaps);
  }, [ghostLaps]);

  // Sync document body state
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Canvas and simulation references
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const bakedTrackRef = useRef<BakedTrack>(bakeTrack(selectedTrack.points));

  // Race Replay Recording & Playback State
  const replayDataRef = useRef<RaceReplayData | null>(null);
  const [savedReplay, setSavedReplay] = useState<RaceReplayData | null>(null);
  const kickReplayLoopRef = useRef<(() => void) | null>(null);
  const replayPlaybackRef = useRef<{
    time: number;
    paused: boolean;
    speed: ReplayPlaybackSpeed;
    cameraMode: ReplayCameraMode;
    focusCarIndex: number;
    dirty: boolean;
  }>({
    time: 0,
    paused: false,
    speed: 1,
    cameraMode: 'saved',
    focusCarIndex: 0,
    dirty: true,
  });
  const [replayHud, setReplayHud] = useState<{
    currentTime: number;
    duration: number;
    isPaused: boolean;
    playbackSpeed: ReplayPlaybackSpeed;
    cameraMode: ReplayCameraMode;
    focusedCarName: string;
    focusedCarRank: number;
    focusedCarSpeed: number;
    totalCars: number;
  }>({
    currentTime: 0,
    duration: 0,
    isPaused: false,
    playbackSpeed: 1,
    cameraMode: 'saved',
    focusedCarName: 'YOU',
    focusedCarRank: 1,
    focusedCarSpeed: 0,
    totalCars: 5,
  });

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
    touchMoved: boolean;
    touchStartX: number;
    touchX: number;
    touchY: number;
    countdownTimer: number;
    lastPipCount: number;
    comboCount: number;
    comboTimer: number;
    knockoutTimer: number;
    nextNotifId: number;
    isGhostDuel: boolean;
    activeGhostLap: TrackGhostLap | null;
    ghostCar: CarEntity | null;
    lapGhostSamples: GhostLapSample[];
    ghostElapsed: number;
    ghostDeltaSeconds: number | null;
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
    touchMoved: false,
    touchStartX: 0,
    touchX: 0,
    touchY: 0,
    countdownTimer: 3.4,
    lastPipCount: 4,
    comboCount: 0,
    comboTimer: 0,
    knockoutTimer: 12.0,
    nextNotifId: 1,
    isGhostDuel: false,
    activeGhostLap: null,
    ghostCar: null,
    lapGhostSamples: [],
    ghostElapsed: 0,
    ghostDeltaSeconds: null,
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
    ghostDeltaSeconds: number | null;
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
    ghostDeltaSeconds: null,
  });

  const baseActiveCar = CARS.find((c) => c.id === progress.selectedCarId) || CARS[0];
  const activeCarStats = resolveCarStatsWithPaint(
    baseActiveCar,
    progress.carPaintOverrides[baseActiveCar.id]
  );

  // Helper to initialize car entities on the starting grid
  const initializeGrid = (
    track: TrackDefinition,
    rivalsCount: OpponentCount,
    ghostModeOverride?: boolean
  ) => {
    const isGhostDuel = ghostModeOverride ?? raceAgainstGhost;
    const actualRivalsCount = isGhostDuel ? 0 : rivalsCount;
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
      x: isGhostDuel ? startSample.x : startSample.x - startSample.nx * (roadHalf * 0.4),
      y: isGhostDuel ? startSample.y : startSample.y - startSample.ny * (roadHalf * 0.4),
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
      trackSampleIndex: 0,
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
      hazardCooldown: 0,
      stuckTimer: 0,
      bumpVelocityX: 0,
      bumpVelocityY: 0,
      trailColor: effectivePlayerStats.primaryColor,
      skidPoints: [],
    };
    createdCars.push(playerEntity);

    const diffMeta = AI_DIFFICULTIES.find((d) => d.id === aiDifficulty) || AI_DIFFICULTIES[1];

    for (let i = 0; i < actualRivalsCount; i++) {
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
        baseTopSpeed:
          effectivePlayerStats.baseTopSpeed *
          diffMeta.speedScale *
          (0.92 + Math.random() * 0.12),
        baseAcceleration:
          effectivePlayerStats.baseAcceleration *
          diffMeta.accelScale *
          (0.9 + Math.random() * 0.15),
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
        trackSampleIndex: gridSampleIdx,
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
        hazardCooldown: 0,
        stuckTimer: 0,
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

    const savedGhost = isGhostDuel ? ghostLapsRef.current[track.id] || null : null;
    simState.current.isGhostDuel = isGhostDuel;
    simState.current.activeGhostLap = savedGhost;
    simState.current.lapGhostSamples = [];
    simState.current.ghostElapsed = 0;
    simState.current.ghostDeltaSeconds = savedGhost ? 0 : null;
    if (savedGhost) {
      const firstGhostSample =
        sampleGhostAtTime(savedGhost, 0, { loop: false }) || savedGhost.samples[0];
      const ghostCarStats = CARS.find((c) => c.id === savedGhost.carId) || activeCarStats;
      simState.current.ghostCar = buildGhostCarEntity(savedGhost, firstGhostSample, ghostCarStats, 2, 0, 0);
    } else {
      simState.current.ghostCar = null;
    }

    if (rendererRef.current) {
      rendererRef.current.cameraX = playerEntity.x;
      rendererRef.current.cameraY = playerEntity.y;
      rendererRef.current.screenShake = 0;
    }

    const recorder = createReplayRecorder(track, raceMode, weather, cameraZoom, createdCars);
    recordReplayFrame(
      recorder,
      0,
      createdCars,
      rendererRef.current
        ? rendererRef.current.getCameraState()
        : {
            cameraX: playerEntity.x,
            cameraY: playerEntity.y,
            zoom: cameraZoom === 'wide' ? 0.8 : 1.0,
            screenShake: 0,
          },
      { force: true }
    );
    replayDataRef.current = recorder;
  };

  // Start Race
  const startRace = (trackOverride?: TrackDefinition) => {
    const trackToUse = trackOverride || selectedTrack;
    sound.resume();
    sound.startEngine();
    setSavedReplay(null);
    initializeGrid(trackToUse, opponentCount, raceAgainstGhost);
    setGameState('playing');
  };

  // Start 1v1 Ghost Duel directly for a chosen track
  const startGhostRace = (targetTrack?: TrackDefinition) => {
    const trackToUse = targetTrack || selectedTrack;
    updateSettings({ selectedTrackId: trackToUse.id, raceAgainstGhost: true });
    sound.resume();
    sound.startEngine();
    setSavedReplay(null);
    initializeGrid(trackToUse, opponentCount, true);
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
        else if (gameState === 'replay' && e.code === 'Escape') setGameState('gameover');
        return;
      }

      if (e.code === 'KeyM') {
        const nextMute = sound.toggleMute();
        updateSettings({ isMuted: nextMute });
        return;
      }

      if (gameState === 'replay') {
        if (e.code === 'Space') {
          e.preventDefault();
          toggleReplayPlay();
          return;
        }
        if (e.code === 'ArrowLeft') {
          seekReplay(replayPlaybackRef.current.time - 2);
          return;
        }
        if (e.code === 'ArrowRight') {
          seekReplay(replayPlaybackRef.current.time + 2);
          return;
        }
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
      simState.current.touchMoved = false;
      simState.current.steerInput = 0;
    };

    const handleGlobalPointerUp = () => {
      simState.current.touchActive = false;
      simState.current.touchMoved = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [gameState, selectedTrack, opponentCount, progress.equippedPerk, savedReplay]);

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

  // Main 60 FPS Game Loop (active only during live racing or unpaused replay)
  useEffect(() => {
    let animId = 0;
    let isScheduled = false;
    let lastTime = performance.now();
    let hudThrottleTimer = 0;
    let staticNeedsRender = true;

    const requestFrame = () => {
      if (!isScheduled) {
        isScheduled = true;
        animId = requestAnimationFrame(gameLoop);
      }
    };

    const handleResize = () => {
      staticNeedsRender = true;
      requestFrame();
    };
    window.addEventListener('resize', handleResize);

    kickReplayLoopRef.current = () => {
      lastTime = performance.now();
      staticNeedsRender = true;
      requestFrame();
    };

    const gameLoop = (now: number) => {
      isScheduled = false;

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

      if (gameState === 'replay' && savedReplay) {
        const pb = replayPlaybackRef.current;
        if (!pb.paused) {
          pb.time += dt * pb.speed;
          if (pb.time >= savedReplay.duration) {
            pb.time = savedReplay.duration;
            pb.paused = true;
          }
          pb.dirty = true;
        }

        if (pb.dirty || staticNeedsRender) {
          pb.dirty = false;
          staticNeedsRender = false;
          const sampled = sampleReplayAtTime(savedReplay, pb.time);
          if (sampled && sampled.cars.length > 0) {
            const safeIdx = Math.max(0, Math.min(sampled.cars.length - 1, pb.focusCarIndex));
            const focusCar = sampled.cars[safeIdx];
            const replayTrack = TRACKS.find((t) => t.id === savedReplay.trackId) || selectedTrack;
            const baked = bakedTrackRef.current;

            rendererRef.current.render(
              replayTrack,
              baked,
              sampled.cars,
              focusCar,
              [],
              [],
              width,
              height,
              sampled.time,
              savedReplay.weather,
              savedReplay.cameraZoomMode,
              pb.cameraMode === 'saved' ? sampled.camera : undefined
            );

            hudThrottleTimer += dt;
            if (hudThrottleTimer >= 0.05 || pb.paused) {
              hudThrottleTimer = 0;
              setReplayHud({
                currentTime: sampled.time,
                duration: savedReplay.duration,
                isPaused: pb.paused,
                playbackSpeed: pb.speed,
                cameraMode: pb.cameraMode,
                focusedCarName: focusCar.name,
                focusedCarRank: focusCar.rank,
                focusedCarSpeed: focusCar.speed,
                totalCars: sampled.cars.length,
              });
            }
          }
        }

        if (!pb.paused) {
          requestFrame();
        }
        return;
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
        cameraZoom,
        undefined,
        gameState === 'playing' || gameState === 'paused' || gameState === 'gameover'
          ? simState.current.ghostCar
          : null
      );

      if (gameState === 'playing' && replayDataRef.current && !simState.current.isRaceFinished) {
        const elapsed = Math.max(0, (now - simState.current.raceStartTime) / 1000);
        recordReplayFrame(
          replayDataRef.current,
          elapsed,
          simState.current.cars,
          rendererRef.current.getCameraState()
        );
      }

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
          ghostDeltaSeconds: simState.current.ghostDeltaSeconds,
        });
      }

      if (gameState === 'playing') {
        requestFrame();
      }
    };

    requestFrame();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      kickReplayLoopRef.current = null;
    };
  }, [gameState, selectedTrack, weather, cameraZoom, raceMode, autoDriftAssist, steeringSensitivity, progress.equippedPerk, savedReplay]);

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
        if (hapticsEnabled && navigator.vibrate) navigator.vibrate([30, 20, 30]);
      }
    }

    const isRacing = simState.current.countdownTimer <= 0.4;

    // 0.5 Knockout Elimination Timer (disabled in 1v1 Ghost Duel)
    if (isRacing && raceMode === 'knockout' && !simState.current.isGhostDuel) {
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

    // 1. Process 1-Finger Steering (Adaptive Sliding Anchor + Left/Right Hold) & Keyboard inputs
    let targetSteer = 0;
    if (simState.current.keyLeft) targetSteer -= 1;
    if (simState.current.keyRight) targetSteer += 1;

    if (simState.current.touchActive) {
      const maxDragDistance = 75 / steeringSensitivity;
      if (simState.current.touchMoved) {
        // Adaptive sliding anchor: reversing direction only takes a short flick back
        const rawDelta = simState.current.touchX - simState.current.touchStartX;
        if (rawDelta > maxDragDistance) {
          simState.current.touchStartX = simState.current.touchX - maxDragDistance;
        } else if (rawDelta < -maxDragDistance) {
          simState.current.touchStartX = simState.current.touchX + maxDragDistance;
        }
        const deltaX = simState.current.touchX - simState.current.touchStartX;
        targetSteer = Math.max(-1, Math.min(1, deltaX / maxDragDistance));
      } else {
        // Hold left or right side of the screen without dragging for effortless thumb control
        const screenW = window.innerWidth || 1;
        const normX = simState.current.touchX / screenW;
        if (normX < 0.36) targetSteer = -0.75;
        else if (normX > 0.64) targetSteer = 0.75;
      }
    }

    simState.current.steerInput += (targetSteer - simState.current.steerInput) * Math.min(1, 18 * dt);

    if (isRacing) {
      updateSmoothSteering(
        playerCar,
        simState.current.steerInput,
        baked,
        dt,
        steeringSensitivity,
        autoDriftAssist,
        track.roadWidth
      );
    }

    // 2. Update Drift & Mini-Turbo
    if (isRacing) {
      const weatherChargeBonus = weather === 'rain' ? 1.2 : 1.0;
      const turboResult = updateDriftAndMiniTurbo(playerCar, dt, weatherChargeBonus);
      if (turboResult.miniTurboFired) {
        if (equippedPerk === 'apex_overdrive') {
          playerCar.miniTurboBoostTimer *= 1.45;
        }
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
        if (hapticsEnabled && navigator.vibrate) navigator.vibrate([20, 10, 20]);
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
      if ((car.hazardCooldown ?? 0) > 0) car.hazardCooldown = Math.max(0, (car.hazardCooldown ?? 0) - dt);
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
        if (hapticsEnabled && navigator.vibrate) navigator.vibrate(15);

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

      const trackLoc = findNearestTrackSample(car.x, car.y, baked, car.trackSampleIndex);
      car.trackSampleIndex = trackLoc.index;
      const currentTrackIndex = trackLoc.index;
      const progressT = currentTrackIndex / baked.samples.length;

      // Auto-recovery stuck guard: guarantees neither player nor AI can stall on barriers or pileups
      if (isRacing) {
        if (car.speed < car.carStats.baseTopSpeed * 0.35) {
          car.stuckTimer = (car.stuckTimer ?? 0) + dt;
          if (car.stuckTimer > 0.35) {
            const fixDiff = Math.atan2(
              Math.sin(trackLoc.sample.angle - car.angle),
              Math.cos(trackLoc.sample.angle - car.angle)
            );
            car.angle += fixDiff * 0.85;
            const recenteredLateral = trackLoc.lateralDist * 0.85;
            car.x = trackLoc.sample.x + trackLoc.sample.nx * recenteredLateral;
            car.y = trackLoc.sample.y + trackLoc.sample.ny * recenteredLateral;
            car.bumpVelocityX = 0;
            car.bumpVelocityY = 0;
            car.speed = Math.max(car.speed, car.carStats.baseTopSpeed * 0.58);
            car.stuckTimer = 0;
          }
        } else {
          car.stuckTimer = 0;
        }
      }

      if (car.lastProgress > 0.85 && progressT < 0.15) {
        const completedLapTime = car.currentLapTime;
        car.currentLap += 1;
        if (completedLapTime < car.bestLapTime) {
          car.bestLapTime = completedLapTime;
        }
        car.currentLapTime = 0;

        if (car.isPlayer) {
          sound.playLapChime();

          recordGhostSample(simState.current.lapGhostSamples, completedLapTime, car, {
            force: true,
          });
          const completedGhostSamples = [...simState.current.lapGhostSamples];
          simState.current.lapGhostSamples = [];
          recordGhostSample(simState.current.lapGhostSamples, 0, car, { force: true });

          const existingGhost = ghostLapsRef.current[track.id];
          if (shouldUpdateGhostRecord(existingGhost, completedLapTime, completedGhostSamples.length)) {
            const newGhost: TrackGhostLap = {
              trackId: track.id,
              lapTime: completedLapTime,
              carId: progress.selectedCarId,
              recordedAt: Date.now(),
              samples: completedGhostSamples,
            };
            const updatedGhosts = {
              ...ghostLapsRef.current,
              [track.id]: newGhost,
            };
            ghostLapsRef.current = updatedGhosts;
            setGhostLaps(updatedGhosts);

            if (simState.current.isGhostDuel && !simState.current.activeGhostLap && car.currentLap < track.laps) {
              simState.current.activeGhostLap = newGhost;
              simState.current.ghostElapsed = 0;
            }

            spawnNotification(
              'NEW GHOST RECORD!',
              car.x,
              car.y - 45,
              '#38bdf8',
              `${completedLapTime.toFixed(2)}s BEST LAP`
            );
          } else {
            spawnNotification(`LAP ${car.currentLap} COMPLETED!`, car.x, car.y - 45, '#22c55e');
          }
        }

        if (
          (raceMode !== 'knockout' || simState.current.isGhostDuel) &&
          car.currentLap >= track.laps &&
          !car.isFinished
        ) {
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

    // 3.5 Record player's live lap trajectory & update Ghost car opponent
    if (isRacing && !playerCar.isFinished) {
      if (simState.current.lapGhostSamples.length === 0) {
        recordGhostSample(simState.current.lapGhostSamples, 0, playerCar, { force: true });
      } else {
        recordGhostSample(simState.current.lapGhostSamples, playerCar.currentLapTime, playerCar);
      }

      const activeGhost = simState.current.activeGhostLap;
      if (activeGhost) {
        simState.current.ghostElapsed += dt;
        const gSample = sampleGhostAtTime(activeGhost, simState.current.ghostElapsed, { loop: true });
        if (gSample) {
          const split = computeGhostSplit(
            playerCar.totalDistance,
            activeGhost,
            simState.current.ghostElapsed,
            gSample,
            baked
          );
          const ghostCarStats = CARS.find((c) => c.id === activeGhost.carId) || activeCarStats;
          const ghostCar = buildGhostCarEntity(
            activeGhost,
            gSample,
            ghostCarStats,
            split.isAhead ? 2 : 1,
            split.ghostLap,
            split.ghostTotalDistance
          );
          ghostCar.isFinished = split.ghostLap >= track.laps;
          simState.current.ghostCar = ghostCar;
          simState.current.ghostDeltaSeconds = split.deltaSeconds;
        }
      }
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
          if (hapticsEnabled && navigator.vibrate) navigator.vibrate(15);
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
            if (hapticsEnabled && navigator.vibrate) navigator.vibrate(20);

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

    // Hazards (Oil slicks, cones, barriers — single cooldown-guarded impulse so car never gets stuck)
    if ((playerCar.hazardCooldown ?? 0) <= 0) {
      for (const hazard of track.hazards) {
        const dx = playerCar.x - hazard.x;
        const dy = playerCar.y - hazard.y;
        const dist = Math.hypot(dx, dy);
        if (dist < hazard.radius) {
          playerCar.hazardCooldown = 1.1;
          if (hazard.type === 'oil') {
            playerCar.steerAngle += (Math.random() < 0.5 ? -1 : 1) * 0.22;
            playerCar.speed = Math.max(
              playerCar.carStats.baseTopSpeed * 0.65,
              playerCar.speed * 0.88
            );
          } else {
            // Deflect cleanly around cones & track barriers instead of trapping inside them
            const nx = dist > 0.01 ? dx / dist : Math.cos(playerCar.angle + Math.PI * 0.5);
            const ny = dist > 0.01 ? dy / dist : Math.sin(playerCar.angle + Math.PI * 0.5);
            playerCar.x = hazard.x + nx * (hazard.radius + 6);
            playerCar.y = hazard.y + ny * (hazard.radius + 6);
            playerCar.bumpVelocityX += nx * 85;
            playerCar.bumpVelocityY += ny * 85;
            playerCar.speed = Math.max(
              playerCar.carStats.baseTopSpeed * 0.6,
              playerCar.speed * 0.85
            );
          }
          sound.playDriftScreech();
          break;
        }
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

    if (simState.current.isGhostDuel && simState.current.ghostCar && simState.current.activeGhostLap) {
      const ghostAhead = simState.current.ghostCar.totalDistance > playerCar.totalDistance;
      playerCar.rank = ghostAhead ? 2 : 1;
      simState.current.ghostCar.rank = ghostAhead ? 1 : 2;
    } else {
      calculateRaceRanks(cars);
    }
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

    const diffMeta = AI_DIFFICULTIES.find((d) => d.id === aiDifficulty) || AI_DIFFICULTIES[1];
    const streakMultiplier = Math.min(2.0, 1 + progress.winStreak * 0.25);
    const totalPrize = Math.round(
      (coinsCollected + driftBonus + winBonus) * streakMultiplier * diffMeta.prizeMultiplier
    );
    setLastRacePrize(totalPrize);

    const earnedChampPts = getChampionshipPointsForRank(player.rank, player.isEliminated);
    setLastChampPoints(earnedChampPts);

    const nearMissesDelta = simState.current.nearMissesThisRace;
    const miniTurbosDelta = simState.current.miniTurbosThisRace;
    const driftDelta = simState.current.driftPointsThisRace;
    const winDelta = player.rank === 1 && !player.isEliminated ? 1 : 0;

    // Preview newly unlocked track cleanly for the modal
    const prevUnlocked = progress.unlockedTrackIds;
    const isPodium = !player.isEliminated && player.rank <= 3;
    const trackIdx = TRACKS.findIndex((t) => t.id === selectedTrack.id);
    const candidateNextTrack =
      trackIdx >= 0 && trackIdx + 1 < TRACKS.length ? TRACKS[trackIdx + 1] : null;
    const willUnlockNext =
      isPodium &&
      (!simState.current.isGhostDuel || player.rank === 1) &&
      candidateNextTrack &&
      !prevUnlocked.includes(candidateNextTrack.id);
    setNewlyUnlockedTrackName(willUnlockNext ? candidateNextTrack.name : null);

    setProgress((prev) => {
      const updatedMissions = updateMissionProgress(prev.missions, {
        near_misses: nearMissesDelta,
        mini_turbos: miniTurbosDelta,
        wins: winDelta,
        coins: totalPrize,
        drift_points: driftDelta,
      });

      const { nextProgress } = applyRaceCompletionToProgress(
        { ...prev, missions: updatedMissions },
        {
          trackId: selectedTrack.id,
          rank: player.rank,
          isEliminated: !!player.isEliminated,
          bestLapTime: player.bestLapTime,
          finishTime: player.finishTime,
          totalPrize,
          driftPoints: driftDelta,
          isGhostDuel: simState.current.isGhostDuel,
        }
      );
      return nextProgress;
    });

    if (replayDataRef.current) {
      const elapsed = Math.max(0, (performance.now() - simState.current.raceStartTime) / 1000);
      const camState = rendererRef.current
        ? rendererRef.current.getCameraState()
        : {
            cameraX: player.x,
            cameraY: player.y,
            zoom: cameraZoom === 'wide' ? 0.8 : 1.0,
            screenShake: 0,
          };
      recordReplayFrame(replayDataRef.current, elapsed, simState.current.cars, camState, {
        force: true,
      });
      setSavedReplay({
        ...replayDataRef.current,
        frames: [...replayDataRef.current.frames],
      });
    }

    setGameState('gameover');
  };

  // Replay Transport Handlers
  const handleWatchReplay = () => {
    if (!savedReplay || savedReplay.frames.length === 0) return;
    const firstSample = sampleReplayAtTime(savedReplay, 0);
    const firstCar = firstSample?.cars[0];
    replayPlaybackRef.current = {
      time: 0,
      paused: false,
      speed: 1,
      cameraMode: 'saved',
      focusCarIndex: 0,
      dirty: true,
    };
    setReplayHud({
      currentTime: 0,
      duration: savedReplay.duration,
      isPaused: false,
      playbackSpeed: 1,
      cameraMode: 'saved',
      focusedCarName: firstCar?.name || 'YOU',
      focusedCarRank: firstCar?.rank || 1,
      focusedCarSpeed: firstCar?.speed || 0,
      totalCars: savedReplay.carMeta.length,
    });
    setGameState('replay');
  };

  const toggleReplayPlay = () => {
    if (!savedReplay) return;
    const pb = replayPlaybackRef.current;
    if (pb.paused && pb.time >= savedReplay.duration - 0.05) {
      pb.time = 0;
    }
    pb.paused = !pb.paused;
    pb.dirty = true;
    setReplayHud((prev) => ({ ...prev, isPaused: pb.paused, currentTime: pb.time }));
    kickReplayLoopRef.current?.();
  };

  const restartReplay = () => {
    replayPlaybackRef.current.time = 0;
    replayPlaybackRef.current.paused = false;
    replayPlaybackRef.current.dirty = true;
    setReplayHud((prev) => ({ ...prev, currentTime: 0, isPaused: false }));
    kickReplayLoopRef.current?.();
  };

  const seekReplay = (nextTime: number) => {
    if (!savedReplay) return;
    const clamped = Math.max(0, Math.min(savedReplay.duration, nextTime));
    replayPlaybackRef.current.time = clamped;
    replayPlaybackRef.current.dirty = true;
    const sampled = sampleReplayAtTime(savedReplay, clamped);
    const focusCar = sampled?.cars[replayPlaybackRef.current.focusCarIndex];
    if (
      focusCar &&
      rendererRef.current &&
      replayPlaybackRef.current.cameraMode === 'follow' &&
      replayPlaybackRef.current.paused
    ) {
      rendererRef.current.cameraX = focusCar.x;
      rendererRef.current.cameraY = focusCar.y;
    }
    setReplayHud((prev) => ({
      ...prev,
      currentTime: clamped,
      focusedCarRank: focusCar?.rank ?? prev.focusedCarRank,
      focusedCarSpeed: focusCar?.speed ?? prev.focusedCarSpeed,
    }));
    kickReplayLoopRef.current?.();
  };

  const cycleReplaySpeed = () => {
    const speeds: ReplayPlaybackSpeed[] = [0.5, 1, 2];
    const currentIdx = speeds.indexOf(replayPlaybackRef.current.speed);
    const nextSpeed = speeds[(currentIdx + 1) % speeds.length];
    replayPlaybackRef.current.speed = nextSpeed;
    replayPlaybackRef.current.dirty = true;
    setReplayHud((prev) => ({ ...prev, playbackSpeed: nextSpeed }));
    kickReplayLoopRef.current?.();
  };

  const toggleReplayCameraMode = () => {
    const nextMode: ReplayCameraMode =
      replayPlaybackRef.current.cameraMode === 'saved' ? 'follow' : 'saved';
    replayPlaybackRef.current.cameraMode = nextMode;
    replayPlaybackRef.current.dirty = true;
    setReplayHud((prev) => ({ ...prev, cameraMode: nextMode }));
    kickReplayLoopRef.current?.();
  };

  const cycleReplayCar = (delta: number) => {
    if (!savedReplay || savedReplay.carMeta.length === 0) return;
    const count = savedReplay.carMeta.length;
    const nextIndex = (replayPlaybackRef.current.focusCarIndex + delta + count) % count;
    replayPlaybackRef.current.focusCarIndex = nextIndex;
    replayPlaybackRef.current.cameraMode = 'follow';
    replayPlaybackRef.current.dirty = true;
    const sampled = sampleReplayAtTime(savedReplay, replayPlaybackRef.current.time);
    const focusCar = sampled?.cars[nextIndex];
    if (focusCar && rendererRef.current && replayPlaybackRef.current.paused) {
      rendererRef.current.cameraX = focusCar.x;
      rendererRef.current.cameraY = focusCar.y;
    }
    setReplayHud((prev) => ({
      ...prev,
      cameraMode: 'follow',
      focusedCarName: focusCar?.name || savedReplay.carMeta[nextIndex].name,
      focusedCarRank: focusCar?.rank || 1,
      focusedCarSpeed: focusCar?.speed || 0,
    }));
    kickReplayLoopRef.current?.();
  };

  // 1-Finger Touch and Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (gameState !== 'playing') return;
    simState.current.touchActive = true;
    simState.current.touchMoved = false;
    simState.current.touchStartX = e.clientX;
    simState.current.touchX = e.clientX;
    simState.current.touchY = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!simState.current.touchActive) return;
    simState.current.touchX = e.clientX;
    simState.current.touchY = e.clientY;
    if (Math.abs(e.clientX - simState.current.touchStartX) > 6) {
      simState.current.touchMoved = true;
    }
  };

  const handlePointerUp = () => {
    simState.current.touchActive = false;
    simState.current.touchMoved = false;
  };

  const handleNextTrack = () => {
    const unlockedTracks = TRACKS.filter((t) => progress.unlockedTrackIds.includes(t.id));
    const pool = unlockedTracks.length > 0 ? unlockedTracks : [TRACKS[0]];
    const currentIndex = pool.findIndex((t) => t.id === selectedTrack.id);
    const nextTrack = pool[(currentIndex + 1) % pool.length];
    updateSettings({ selectedTrackId: nextTrack.id });
    startRace(nextTrack);
  };

  const handleClaimDailyBonus = () => {
    const result = claimDailyBonus(progress);
    if (result.claimed) {
      setProgress(result.progress);
      sound.playLapChime();
    }
  };

  const handleExportSave = () => {
    const bundle = createOfflineSaveBundle(progress, settings, ghostLaps);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `apex-one-touch-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImportSave = (jsonText: string): boolean => {
    const bundle = parseOfflineSaveBundle(jsonText);
    if (!bundle) return false;
    setProgress(bundle.progress);
    setSettings(bundle.settings);
    setGhostLaps(bundle.ghostLaps);
    return true;
  };

  const handleResetSave = () => {
    setProgress(createDefaultProgress());
    setSettings(createDefaultSettings());
    setGhostLaps({});
  };

  const claimableMissionsCount = progress.missions.filter(
    (m) => !m.claimed && m.progress >= m.target
  ).length;
  const dailyBonusAvailable = canClaimDailyBonus(progress);
  const dailyBonusAmount = getNextDailyBonusReward(progress);

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
          onStartRace={() => startRace()}
          onOpenLevelSelect={() => setGameState('level_select')}
          onOpenGarage={() => setGameState('garage')}
          onOpenFeatures={(tab = 'modes') => {
            setFeaturesTab(tab);
            setGameState('features');
          }}
          opponentCount={opponentCount}
          onSetOpponentCount={(c) => updateSettings({ opponentCount: c })}
          raceMode={raceMode}
          onSetRaceMode={(m) => updateSettings({ raceMode: m })}
          aiDifficulty={aiDifficulty}
          equippedPerk={progress.equippedPerk}
          weather={weather}
          winStreak={progress.winStreak}
          trophies={progress.championship.trophies}
          claimableMissionsCount={claimableMissionsCount}
          canClaimDaily={dailyBonusAvailable}
          dailyRewardAmount={dailyBonusAmount}
          onClaimDaily={handleClaimDailyBonus}
          selectedTrack={selectedTrack}
          selectedCar={activeCarStats}
          coins={progress.coins}
          isMuted={isMuted}
          onToggleMute={() => {
            const m = sound.toggleMute();
            updateSettings({ isMuted: m });
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
            updateSettings({ isMuted: m });
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
          ghostCar={simState.current.ghostCar}
          ghostDeltaSeconds={hudState.ghostDeltaSeconds}
          ghostBestLapTime={simState.current.activeGhostLap?.lapTime ?? null}
          isGhostDuel={simState.current.isGhostDuel}
          showMinimap={showMinimap}
        />
      )}

      {/* Features & Improv Menu Modal */}
      {gameState === 'features' && (
        <FeaturesMenuModal
          initialTab={featuresTab}
          progress={progress}
          ghostLaps={ghostLaps}
          raceMode={raceMode}
          onSetRaceMode={(m) => updateSettings({ raceMode: m })}
          aiDifficulty={aiDifficulty}
          onSetAiDifficulty={(d: AIDifficulty) => updateSettings({ aiDifficulty: d })}
          weather={weather}
          onSetWeather={(w) => updateSettings({ weather: w })}
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
              championship: {
                ...prev.championship,
                totalCoinsEarned: prev.championship.totalCoinsEarned + targetMission.reward,
              },
            }));
            sound.playLapChime();
          }}
          canClaimDaily={dailyBonusAvailable}
          dailyRewardAmount={dailyBonusAmount}
          onClaimDaily={handleClaimDailyBonus}
          steeringSensitivity={steeringSensitivity}
          onSetSteeringSensitivity={(val) => updateSettings({ steeringSensitivity: val })}
          autoDriftAssist={autoDriftAssist}
          onSetAutoDriftAssist={(val) => updateSettings({ autoDriftAssist: val })}
          cameraZoom={cameraZoom}
          onSetCameraZoom={(val) => updateSettings({ cameraZoom: val })}
          hapticsEnabled={hapticsEnabled}
          onSetHapticsEnabled={(val) => updateSettings({ hapticsEnabled: val })}
          showMinimap={showMinimap}
          onSetShowMinimap={(val) => updateSettings({ showMinimap: val })}
          isMuted={isMuted}
          onToggleMute={() => {
            const m = sound.toggleMute();
            updateSettings({ isMuted: m });
          }}
          onExportSave={handleExportSave}
          onImportSave={handleImportSave}
          onResetSave={handleResetSave}
          onStartRace={() => startRace()}
          onClose={() => setGameState('title')}
        />
      )}

      {/* Level Select Modal */}
      {gameState === 'level_select' && (
        <LevelSelectModal
          currentTrackId={selectedTrack.id}
          onSelectTrack={(t) => updateSettings({ selectedTrackId: t.id })}
          unlockedTrackIds={progress.unlockedTrackIds}
          coins={progress.coins}
          onUnlockTrack={(trackId, cost) => {
            if (progress.coins >= cost && !progress.unlockedTrackIds.includes(trackId)) {
              setProgress((prev) => ({
                ...prev,
                coins: prev.coins - cost,
                unlockedTrackIds: [...prev.unlockedTrackIds, trackId],
              }));
              updateSettings({ selectedTrackId: trackId });
              sound.playCoin();
            }
          }}
          opponentCount={opponentCount}
          onSetOpponentCount={(c) => updateSettings({ opponentCount: c })}
          raceAgainstGhost={raceAgainstGhost}
          onToggleRaceAgainstGhost={(enabled) => updateSettings({ raceAgainstGhost: enabled })}
          onLaunchGhostRace={(t) => startGhostRace(t)}
          onClose={() => setGameState('title')}
          onStartRace={() => startRace()}
          bestLapTimes={progress.bestLapTimes}
          bestRaceTimes={progress.bestRaceTimes}
          bestRanks={progress.bestRanks}
          championship={progress.championship}
          ghostLaps={ghostLaps}
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
          onSelectCarLivery={(carId, liveryId) => {
            setProgress((prev) => ({
              ...prev,
              carPaintOverrides: {
                ...prev.carPaintOverrides,
                [carId]: liveryId,
              },
            }));
          }}
          onClose={() => setGameState('title')}
        />
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          onResume={() => setGameState('playing')}
          onRestart={() => startRace()}
          onReturnToMenu={() => {
            sound.stopEngine();
            setGameState('title');
          }}
          isMuted={isMuted}
          onToggleMute={() => {
            const m = sound.toggleMute();
            updateSettings({ isMuted: m });
          }}
          steeringSensitivity={steeringSensitivity}
          onSetSteeringSensitivity={(s) => updateSettings({ steeringSensitivity: s })}
          autoDriftAssist={autoDriftAssist}
          onSetAutoDriftAssist={(val) => updateSettings({ autoDriftAssist: val })}
          cameraZoom={cameraZoom}
          onSetCameraZoom={(val) => updateSettings({ cameraZoom: val })}
          showMinimap={showMinimap}
          onSetShowMinimap={(val) => updateSettings({ showMinimap: val })}
        />
      )}

      {/* Race Result / Podium Modal */}
      {gameState === 'gameover' && simState.current.playerCar && (
        <RaceResultModal
          playerCar={simState.current.playerCar}
          cars={
            simState.current.isGhostDuel && simState.current.ghostCar
              ? [...simState.current.cars, simState.current.ghostCar]
              : simState.current.cars
          }
          track={selectedTrack}
          raceMode={raceMode}
          coinsEarned={lastRacePrize}
          championshipPointsEarned={lastChampPoints}
          newlyUnlockedTrackName={newlyUnlockedTrackName}
          hasReplay={!!savedReplay && savedReplay.frames.length > 1}
          onWatchReplay={handleWatchReplay}
          onRestartRace={() => startRace()}
          onNextTrack={handleNextTrack}
          onReturnToMenu={() => setGameState('title')}
        />
      )}

      {/* Race Replay Playback HUD */}
      {gameState === 'replay' && savedReplay && (
        <ReplayHUD
          trackName={TRACKS.find((t) => t.id === savedReplay.trackId)?.name || selectedTrack.name}
          currentTime={replayHud.currentTime}
          duration={replayHud.duration}
          isPaused={replayHud.isPaused}
          playbackSpeed={replayHud.playbackSpeed}
          cameraMode={replayHud.cameraMode}
          focusedCarName={replayHud.focusedCarName}
          focusedCarRank={replayHud.focusedCarRank}
          focusedCarSpeed={replayHud.focusedCarSpeed}
          totalCars={replayHud.totalCars}
          onTogglePlay={toggleReplayPlay}
          onRestart={restartReplay}
          onSeek={seekReplay}
          onCycleSpeed={cycleReplaySpeed}
          onToggleCameraMode={toggleReplayCameraMode}
          onPrevCar={() => cycleReplayCar(-1)}
          onNextCar={() => cycleReplayCar(1)}
          onExit={() => setGameState('gameover')}
        />
      )}

      {/* Offline Connectivity Indicator (hidden when online) */}
      <OfflineIndicator isPlaying={gameState === 'playing' || gameState === 'replay'} />
    </div>
  );
}
