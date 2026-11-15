/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { formatReplayTime } from '../game/replay';

export type ReplayCameraMode = 'saved' | 'follow';
export type ReplayPlaybackSpeed = 0.5 | 1 | 2;

interface ReplayHUDProps {
  trackName: string;
  currentTime: number;
  duration: number;
  isPaused: boolean;
  playbackSpeed: ReplayPlaybackSpeed;
  cameraMode: ReplayCameraMode;
  focusedCarName: string;
  focusedCarRank: number;
  focusedCarSpeed: number;
  totalCars: number;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSeek: (time: number) => void;
  onCycleSpeed: () => void;
  onToggleCameraMode: () => void;
  onPrevCar: () => void;
  onNextCar: () => void;
  onExit: () => void;
}

export const ReplayHUD: React.FC<ReplayHUDProps> = ({
  trackName,
  currentTime,
  duration,
  isPaused,
  playbackSpeed,
  cameraMode,
  focusedCarName,
  focusedCarRank,
  focusedCarSpeed,
  totalCars,
  onTogglePlay,
  onRestart,
  onSeek,
  onCycleSpeed,
  onToggleCameraMode,
  onPrevCar,
  onNextCar,
  onExit,
}) => {
  const speedKmh = Math.round((focusedCarSpeed / 400) * 220);
  const safeDuration = Math.max(0.1, duration);

  return (
    <div className="fixed inset-0 pointer-events-none z-30 flex flex-col justify-between p-3 md:p-4 select-none text-white">
      {/* Top Broadcast Bar */}
      <div className="flex items-start justify-between gap-2 w-full">
        {/* Top-Left: Replay Badge & Telemetry */}
        <div
          className="pointer-events-auto min-w-0 max-w-[235px] sm:max-w-xs rounded-2xl px-3 py-2 border border-slate-700/80 shadow-xl flex flex-col gap-0.5"
          style={{ backgroundColor: 'rgba(10, 14, 24, 0.88)' }}
        >
          <div className="flex items-center gap-1.5 whitespace-nowrap min-w-0">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="font-mono text-[11px] font-black tracking-wider uppercase text-red-400 shrink-0">
              Replay
            </span>
            <span className="text-slate-600 shrink-0" aria-hidden="true">
              ·
            </span>
            <span className="text-[11px] font-bold text-slate-200 truncate">
              {trackName}
            </span>
          </div>

          <div className="flex items-baseline gap-2 text-xs font-mono tabular-nums whitespace-nowrap">
            <span className="text-amber-400 font-black italic shrink-0">
              #{focusedCarRank}/{totalCars}
            </span>
            <span className="text-white font-bold truncate max-w-[78px]">{focusedCarName}</span>
            <span className="text-cyan-300 font-bold shrink-0">{speedKmh} KM/H</span>
          </div>
        </div>

        {/* Top-Right: Exit pinned top-right, Camera Switcher & Car Cycler cleanly stacked on mobile */}
        <div className="pointer-events-auto flex flex-col items-end gap-1.5 sm:flex-row-reverse sm:items-center shrink-0">
          <button
            type="button"
            onClick={onExit}
            aria-label="Exit Replay"
            className="min-h-[44px] px-3 rounded-xl border border-red-500/60 text-xs font-black uppercase tracking-wider text-white hover:bg-red-600/90 transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
            style={{ backgroundColor: 'rgba(127, 29, 29, 0.78)' }}
          >
            <X size={15} />
            <span>Exit</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleCameraMode}
              aria-label={
                cameraMode === 'saved'
                  ? 'Switch to Follow Car Camera'
                  : 'Switch to Saved Race Camera'
              }
              className="min-h-[44px] px-2.5 rounded-xl border border-slate-700/80 text-xs font-bold text-slate-100 hover:border-cyan-400 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              style={{ backgroundColor: 'rgba(10, 14, 24, 0.88)' }}
            >
              <Camera size={15} className="text-cyan-400 shrink-0" />
              <span>{cameraMode === 'saved' ? 'Saved Cam' : 'Follow Cam'}</span>
            </button>

            {cameraMode === 'follow' && (
              <div
                className="flex items-center rounded-xl border border-slate-700/80 overflow-hidden"
                style={{ backgroundColor: 'rgba(10, 14, 24, 0.88)' }}
              >
                <button
                  type="button"
                  onClick={onPrevCar}
                  aria-label="Focus previous car"
                  className="min-w-[38px] min-h-[44px] flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-800/80 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={onNextCar}
                  aria-label="Focus next car"
                  className="min-w-[38px] min-h-[44px] flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-800/80 cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Compact Transport Scrubber */}
      <div className="w-full max-w-xl mx-auto pointer-events-auto">
        <div
          className="rounded-2xl border border-slate-700/85 px-3 py-2.5 shadow-2xl flex flex-col gap-2"
          style={{ backgroundColor: 'rgba(10, 14, 24, 0.92)' }}
        >
          {/* Scrubber Row */}
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[11px] font-bold text-slate-300 tabular-nums w-11 shrink-0">
              {formatReplayTime(currentTime)}
            </span>
            <input
              type="range"
              aria-label="Replay timeline"
              min={0}
              max={safeDuration}
              step={0.05}
              value={Math.min(safeDuration, currentTime)}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="flex-1 accent-red-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[11px] font-bold text-slate-400 tabular-nums w-11 text-right shrink-0">
              {formatReplayTime(duration)}
            </span>
          </div>

          {/* Transport Controls Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onRestart}
                aria-label="Restart Replay"
                className="min-w-[44px] min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <RotateCcw size={16} />
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPaused ? 'Play Replay' : 'Pause Replay'}
                className="min-h-[40px] px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black italic text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isPaused ? <Play size={15} className="fill-white" /> : <Pause size={15} />}
                <span>{isPaused ? 'Play' : 'Pause'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onCycleSpeed}
              aria-label={`Playback speed ${playbackSpeed}x`}
              className="min-h-[40px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-black text-amber-400 tabular-nums transition-colors cursor-pointer"
            >
              {playbackSpeed}x Speed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
