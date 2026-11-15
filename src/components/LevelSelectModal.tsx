/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Play, Shield, Flag, Award, Sparkles } from 'lucide-react';
import { TRACKS } from '../game/tracks';
import { TrackDefinition, OpponentCount } from '../game/types';

interface LevelSelectModalProps {
  currentTrackId: string;
  onSelectTrack: (track: TrackDefinition) => void;
  opponentCount: OpponentCount;
  onSetOpponentCount: (count: OpponentCount) => void;
  onClose: () => void;
  onStartRace: () => void;
  bestLapTimes: { [trackId: string]: number };
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  currentTrackId,
  onSelectTrack,
  opponentCount,
  onSetOpponentCount,
  onClose,
  onStartRace,
  bestLapTimes,
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-3 select-none text-white">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-black italic tracking-wide uppercase text-white flex items-center gap-2">
              <Flag size={18} className="text-red-500" />
              Championship Tracks
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Pick your circuit and configure rival AI field
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close track selection"
            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Global AI Competitor Grid Setting */}
        <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800/80 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono uppercase text-[10px] tracking-wider flex items-center gap-1.5">
              <Shield size={13} className="text-amber-400" /> Grid Size Override
            </span>
            <span className="text-xs font-bold text-amber-300">
              {opponentCount} Automated AI Cars ({opponentCount + 1} Racers)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([4, 6, 8] as OpponentCount[]).map((count) => {
              const active = opponentCount === count;
              return (
                <button
                  key={count}
                  onClick={() => onSetOpponentCount(count)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                    active
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black italic'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {count} AI Cars
                </button>
              );
            })}
          </div>
        </div>

        {/* Tracks List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {TRACKS.map((track) => {
            const isSelected = track.id === currentTrackId;
            const bestTime = bestLapTimes[track.id];

            return (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-slate-800/90 border-red-500 shadow-lg shadow-red-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Track Color Pill */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm italic shadow-inner"
                    style={{ backgroundColor: `${track.previewColor}22`, color: track.previewColor, border: `1px solid ${track.previewColor}66` }}
                  >
                    {track.difficulty.slice(0, 3).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black italic text-sm text-white">{track.name}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {track.laps} Laps
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{track.subtitle}</p>

                    {bestTime && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-400 font-mono">
                        <Award size={11} />
                        <span>Best Lap: {bestTime.toFixed(2)}s</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {isSelected ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartRace();
                      }}
                      data-start="true"
                      className="w-full sm:w-auto px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase italic flex items-center justify-center gap-1.5 shadow-md shadow-red-600/30"
                    >
                      <Play size={14} className="fill-white" />
                      <span>Race Here</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 font-mono">Select</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
          >
            Back to Title
          </button>
          <button
            onClick={onStartRace}
            data-start="true"
            className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black italic text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-red-600/30"
          >
            <Play size={15} className="fill-white" />
            <span>Launch Race</span>
          </button>
        </div>
      </div>
    </div>
  );
};
