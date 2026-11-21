/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, RotateCcw, Home, Volume2, VolumeX, Sliders, Eye, Compass, Map } from 'lucide-react';
import { CameraZoomMode } from '../game/types';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onReturnToMenu: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  steeringSensitivity: number;
  onSetSteeringSensitivity: (val: number) => void;
  autoDriftAssist: boolean;
  onSetAutoDriftAssist: (val: boolean) => void;
  cameraZoom: CameraZoomMode;
  onSetCameraZoom: (val: CameraZoomMode) => void;
  showMinimap: boolean;
  onSetShowMinimap: (val: boolean) => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onReturnToMenu,
  isMuted,
  onToggleMute,
  steeringSensitivity,
  onSetSteeringSensitivity,
  autoDriftAssist,
  onSetAutoDriftAssist,
  cameraZoom,
  onSetCameraZoom,
  showMinimap,
  onSetShowMinimap,
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/92 flex items-center justify-center p-4 select-none text-white">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 flex flex-col gap-3.5 max-h-[92vh] overflow-y-auto">
        <div className="text-center">
          <h2 className="text-xl font-black italic tracking-wider uppercase text-white">
            Race Paused
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Tune handling, drift assist, and view on the fly
          </p>
        </div>

        {/* 1-Finger Sensitivity */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Sliders size={13} className="text-cyan-400" /> Steering Sensitivity
            </span>
            <span className="text-cyan-400 font-bold">
              {steeringSensitivity === 1 ? 'Normal' : steeringSensitivity > 1 ? 'Sharp' : 'Smooth'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {[
              { label: 'Smooth', val: 0.8 },
              { label: 'Normal', val: 1.0 },
              { label: 'Sharp', val: 1.35 },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => onSetSteeringSensitivity(opt.val)}
                className={`min-h-[38px] rounded-lg font-bold border transition-all cursor-pointer ${
                  steeringSensitivity === opt.val
                    ? 'bg-cyan-600 border-cyan-400 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cornering Assist, Camera Framing & Minimap */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onSetAutoDriftAssist(!autoDriftAssist)}
            className="min-h-[54px] p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left flex flex-col justify-between transition-all cursor-pointer"
          >
            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Compass size={11} className="text-amber-400" /> Assist
            </span>
            <span className="text-[11px] font-bold text-white whitespace-nowrap">
              {autoDriftAssist ? 'Auto-Flow' : 'Manual'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSetCameraZoom(cameraZoom === 'normal' ? 'wide' : 'normal')}
            className="min-h-[54px] p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left flex flex-col justify-between transition-all cursor-pointer"
          >
            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Eye size={11} className="text-emerald-400" /> View
            </span>
            <span className="text-[11px] font-bold text-white whitespace-nowrap">
              {cameraZoom === 'wide' ? 'Wide' : 'Close'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSetShowMinimap(!showMinimap)}
            className="min-h-[54px] p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left flex flex-col justify-between transition-all cursor-pointer"
          >
            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Map size={11} className="text-cyan-400" /> Map
            </span>
            <span className="text-[11px] font-bold text-white whitespace-nowrap">
              {showMinimap ? 'Shown' : 'Hidden'}
            </span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[46px] rounded-xl bg-red-600 hover:bg-red-500 text-white font-black italic text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all active:scale-95 cursor-pointer"
          >
            <Play size={16} className="fill-white" />
            <span>Resume Race</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full min-h-[42px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Restart Circuit</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="w-full min-h-[42px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span>{isMuted ? 'Unmute Sound' : 'Mute Sound'}</span>
          </button>

          <button
            type="button"
            onClick={onReturnToMenu}
            className="w-full min-h-[42px] rounded-xl bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Home size={14} />
            <span>Quit to Title Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
