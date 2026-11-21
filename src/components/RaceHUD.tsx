/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { Pause, Volume2, VolumeX, Zap } from 'lucide-react';
import { CarEntity, RaceMode, TrackDefinition } from '../game/types';
import { BakedTrack } from '../game/physics';

interface RaceHUDProps {
  playerCar: CarEntity;
  cars: CarEntity[];
  track: TrackDefinition;
  baked: BakedTrack;
  totalLaps: number;
  coinsCollected: number;
  driftPoints: number;
  onPause: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onTriggerNitro: () => void;
  steerInput: number;
  touchActive: boolean;
  touchX: number;
  touchY: number;
  touchStartX: number;
  countdown: number; // 3, 2, 1, 0 (GO!), or -1 (hidden after start)
  miniTurboLevel: 0 | 1 | 2;
  comboCount: number;
  raceMode: RaceMode;
  knockoutTimer: number;
  activeRacersCount: number;
  ghostCar?: CarEntity | null;
  ghostDeltaSeconds?: number | null;
  ghostBestLapTime?: number | null;
  isGhostDuel?: boolean;
  showMinimap?: boolean;
}

export const RaceHUD: React.FC<RaceHUDProps> = ({
  playerCar,
  cars,
  track,
  baked,
  totalLaps,
  coinsCollected,
  driftPoints,
  onPause,
  isMuted,
  onToggleMute,
  onTriggerNitro,
  touchActive,
  touchX,
  touchY,
  touchStartX,
  countdown,
  miniTurboLevel,
  comboCount,
  raceMode,
  knockoutTimer,
  activeRacersCount,
  ghostCar = null,
  ghostDeltaSeconds = null,
  ghostBestLapTime = null,
  isGhostDuel = false,
  showMinimap = true,
}) => {
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render Minimap with circuit and real-time car blips
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of track.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = 12;
    const trackW = (maxX - minX) || 1;
    const trackH = (maxY - minY) || 1;
    const scale = Math.min((width - pad * 2) / trackW, (height - pad * 2) / trackH);
    const offsetX = (width - trackW * scale) * 0.5;
    const offsetY = (height - trackH * scale) * 0.5;

    const mapX = (x: number) => offsetX + (x - minX) * scale;
    const mapY = (y: number) => offsetY + (y - minY) * scale;

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#334155';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < baked.samples.length; i += 4) {
      const s = baked.samples[i];
      const mx = mapX(s.x);
      const my = mapY(s.y);
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    }
    ctx.closePath();
    ctx.stroke();

    const startS = baked.samples[0];
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mapX(startS.x), mapY(startS.y), 3.5, 0, Math.PI * 2);
    ctx.fill();

    for (const car of cars) {
      if (car.isPlayer || car.isEliminated) continue;
      ctx.fillStyle = car.carStats.primaryColor;
      ctx.beginPath();
      ctx.arc(mapX(car.x), mapY(car.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (ghostCar) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.beginPath();
      ctx.arc(mapX(ghostCar.x), mapY(ghostCar.y), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(mapX(ghostCar.x), mapY(ghostCar.y), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(mapX(playerCar.x), mapY(playerCar.y), 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [playerCar.x, playerCar.y, cars, ghostCar, track, baked]);

  const speedKmh = Math.round((playerCar.speed / 400) * 220);
  const positionOrdinal =
    playerCar.rank === 1
      ? '1st'
      : playerCar.rank === 2
      ? '2nd'
      : playerCar.rank === 3
      ? '3rd'
      : `${playerCar.rank}th`;

  const totalRacers = isGhostDuel
    ? ghostCar
      ? 2
      : 1
    : raceMode === 'knockout'
    ? activeRacersCount
    : cars.length;
  const isDangerLast =
    !isGhostDuel && raceMode === 'knockout' && playerCar.rank >= activeRacersCount && activeRacersCount > 1;

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 select-none text-white">
      {/* 3-2-1-GO Countdown Overlay — Shows ONLY at start time, disappears when countdown < 0 */}
      {countdown >= 0 && (
        <div className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-30">
          <div className="flex flex-col items-center">
            <span
              className={`font-black italic text-8xl tracking-tight drop-shadow-2xl transition-transform duration-150 ${
                countdown === 0 ? 'text-emerald-400 scale-125' : 'text-amber-400'
              }`}
            >
              {countdown === 0 ? 'GO!' : countdown}
            </span>
            <span className="text-xs font-mono font-bold tracking-widest uppercase bg-slate-950/85 px-4 py-1.5 rounded-xl border border-slate-700 mt-3 text-slate-200">
              {countdown === 0 ? 'ROCKET START WINDOW!' : 'Slide or tap on GO for Rocket Boost'}
            </span>
          </div>
        </div>
      )}

      {/* Top Header Stats */}
      <div className="flex items-start justify-between gap-1.5 w-full">
        {/* Left: Position & Lap Readout */}
        <div className="flex flex-col gap-1 pointer-events-auto shrink-0">
          <div className="flex items-baseline gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl px-3 py-1.5 shadow-xl whitespace-nowrap">
            <span className="font-mono text-2xl sm:text-3xl font-black italic tracking-tighter text-amber-400 tabular-nums">
              {positionOrdinal}
            </span>
            <span className="font-mono text-xs text-slate-400 font-bold uppercase tabular-nums">
              / {totalRacers}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 border border-slate-800 rounded-xl text-[11px] font-mono font-bold text-slate-200 tabular-nums whitespace-nowrap">
            <span className="text-slate-400">
              {raceMode === 'knockout' && !isGhostDuel
                ? 'Survivor'
                : `Lap ${Math.min(playerCar.currentLap + 1, totalLaps)}/${totalLaps}`}
            </span>
            {coinsCollected > 0 && (
              <>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="text-amber-400">+{coinsCollected} CR</span>
              </>
            )}
          </div>
        </div>

        {/* Center: Live Race Mode & Action Alerts */}
        <div className="flex flex-col items-center gap-1.5 min-w-0 max-w-[165px] text-center">
          {/* Knockout Timer Banner (only during active Knockout racing) */}
          {countdown < 0 && !isGhostDuel && raceMode === 'knockout' && activeRacersCount > 1 && (
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black tracking-wide shadow-lg border tabular-nums ${
                isDangerLast
                  ? 'bg-red-600/95 border-red-300 text-white animate-pulse'
                  : 'bg-slate-900/85 border-slate-700 text-amber-300'
              }`}
            >
              {isDangerLast ? `LAST! KO IN ${knockoutTimer.toFixed(1)}s` : `KO IN ${knockoutTimer.toFixed(1)}s`}
            </div>
          )}

          {/* Ghost Split Banner */}
          {isGhostDuel && (
            <div className="px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold shadow-lg border border-cyan-500/50 bg-slate-900/90 text-cyan-200 tabular-nums whitespace-nowrap flex flex-col sm:flex-row sm:items-center sm:gap-1.5 leading-tight">
              {ghostBestLapTime ? (
                <>
                  <span>Ghost {ghostBestLapTime.toFixed(2)}s</span>
                  {ghostDeltaSeconds !== null && countdown < 0 && (
                    <span
                      className={`text-xs font-black ${
                        ghostDeltaSeconds <= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {ghostDeltaSeconds <= 0
                        ? `${ghostDeltaSeconds.toFixed(2)}s`
                        : `+${ghostDeltaSeconds.toFixed(2)}s`}
                    </span>
                  )}
                </>
              ) : (
                <span>Recording Ghost</span>
              )}
            </div>
          )}

          {/* Mini-Turbo Charge Indicator */}
          {playerCar.isDrifting && (
            <div
              className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 transition-transform ${
                miniTurboLevel === 2
                  ? 'bg-purple-600 text-white shadow-purple-500/50 scale-105'
                  : miniTurboLevel === 1
                  ? 'bg-cyan-500 text-slate-950 shadow-cyan-500/50'
                  : 'bg-slate-900/90 text-yellow-300 border border-yellow-500/50'
              }`}
            >
              <Zap size={14} className={miniTurboLevel > 0 ? 'fill-current' : ''} />
              <span className="whitespace-nowrap">
                {miniTurboLevel === 2
                  ? 'Ultra Turbo!'
                  : miniTurboLevel === 1
                  ? 'Mini-Turbo!'
                  : 'Drift Charging'}
              </span>
            </div>
          )}

          {/* Combo Streak */}
          {comboCount > 1 && (
            <div className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-0.5 rounded-xl uppercase tracking-wider shadow-lg tabular-nums">
              {comboCount}x Pass Combo
            </div>
          )}

          {playerCar.isDrafting && (
            <div className="bg-cyan-500 text-slate-950 font-black text-xs px-3 py-1 rounded-xl uppercase tracking-wider shadow-lg flex items-center gap-1">
              <Zap size={13} className="fill-slate-950" />
              <span>Slipstream</span>
            </div>
          )}

          {(driftPoints > 0 || raceMode === 'drift_fever') && (
            <div className="bg-slate-900/85 border border-red-500/60 text-white font-mono font-bold text-xs px-3 py-0.5 rounded-xl shadow-lg tabular-nums">
              Drift <span className="text-yellow-300">+{driftPoints}</span>
            </div>
          )}
        </div>

        {/* Right: Minimap & Utilities */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
              className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-900/85 border border-slate-700/60 flex items-center justify-center text-slate-200 active:scale-95 transition-transform"
            >
              {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <button
              onClick={onPause}
              aria-label="Pause game"
              className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-900/85 border border-slate-700/60 flex items-center justify-center text-slate-200 active:scale-95 transition-transform"
            >
              <Pause size={17} />
            </button>
          </div>

          {showMinimap && (
            <div className="w-24 h-24 rounded-2xl bg-slate-950/90 border border-slate-800 p-1 shadow-2xl relative overflow-hidden">
              <canvas ref={minimapCanvasRef} width={96} height={96} className="w-full h-full block" />
              <div className="absolute bottom-1 right-1.5 text-[9px] font-mono text-slate-500 uppercase">
                MAP
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic 1-Finger Touch Steering Visualizer */}
      {touchActive && (
        <div
          className="fixed pointer-events-none"
          style={{
            left: touchStartX,
            top: touchY,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="w-14 h-14 rounded-full border-2 border-cyan-400/60 bg-cyan-950/30 flex items-center justify-center">
            <div
              className="w-6 h-6 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/80"
              style={{
                transform: `translateX(${(touchX - touchStartX) * 0.8}px)`,
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom Area: Speedometer, Nitro Trigger & Steering Prompt */}
      <div className="flex items-end justify-between w-full max-w-lg mx-auto pb-2">
        <div className="flex flex-col bg-slate-900/90 border border-slate-700/80 rounded-2xl px-4 py-2 pointer-events-auto shadow-xl">
          <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-bold">
            Speed
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-3xl font-black italic tracking-tight text-white tabular-nums">
              {speedKmh}
            </span>
            <span className="font-mono text-xs text-red-500 font-bold uppercase">KM/H</span>
          </div>
        </div>

        {!touchActive && countdown < 0 && (
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/75 border border-slate-800 text-[11px] font-mono text-slate-300 text-center">
            Drag finger anywhere to steer
          </div>
        )}

        <button
          onClick={onTriggerNitro}
          disabled={playerCar.nitro < 15}
          className={`pointer-events-auto w-16 h-16 rounded-2xl flex flex-col items-center justify-center gap-0.5 border shadow-2xl transition-all active:scale-90 ${
            playerCar.nitroActive
              ? 'bg-cyan-500 border-cyan-300 text-slate-950 shadow-cyan-500/70'
              : playerCar.nitro >= 15
              ? 'bg-gradient-to-t from-red-600 to-rose-500 border-red-400 text-white shadow-red-500/50 hover:scale-105'
              : 'bg-slate-900/80 border-slate-800 text-slate-500 opacity-60'
          }`}
          aria-label="Activate Nitro Boost"
        >
          <Zap size={22} className={playerCar.nitroActive ? 'fill-slate-950' : 'fill-current'} />
          <span className="text-[9px] font-black italic tracking-widest uppercase tabular-nums">
            {playerCar.nitroActive ? 'BOOST!' : `${Math.round(playerCar.nitro)}%`}
          </span>
        </button>
      </div>
    </div>
  );
};
