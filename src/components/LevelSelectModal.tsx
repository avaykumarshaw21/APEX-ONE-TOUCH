/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Play, Shield, Flag, Award, Ghost, Lock, Trophy } from 'lucide-react';
import { TRACKS } from '../game/tracks';
import { getTrackUnlockCost } from '../game/storage';
import {
  ChampionshipProgress,
  OpponentCount,
  TrackDefinition,
  TrackGhostLap,
} from '../game/types';

interface LevelSelectModalProps {
  currentTrackId: string;
  onSelectTrack: (track: TrackDefinition) => void;
  unlockedTrackIds: string[];
  coins: number;
  onUnlockTrack: (trackId: string, cost: number) => void;
  opponentCount: OpponentCount;
  onSetOpponentCount: (count: OpponentCount) => void;
  raceAgainstGhost: boolean;
  onToggleRaceAgainstGhost: (enabled: boolean) => void;
  onLaunchGhostRace: (track?: TrackDefinition) => void;
  onClose: () => void;
  onStartRace: () => void;
  bestLapTimes: { [trackId: string]: number };
  bestRaceTimes: { [trackId: string]: number };
  bestRanks: { [trackId: string]: number };
  championship: ChampionshipProgress;
  ghostLaps: { [trackId: string]: TrackGhostLap };
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  currentTrackId,
  onSelectTrack,
  unlockedTrackIds,
  coins,
  onUnlockTrack,
  opponentCount,
  onSetOpponentCount,
  raceAgainstGhost,
  onToggleRaceAgainstGhost,
  onLaunchGhostRace,
  onClose,
  onStartRace,
  bestLapTimes,
  bestRaceTimes,
  bestRanks,
  championship,
  ghostLaps,
}) => {
  const selectedTrack = TRACKS.find((t) => t.id === currentTrackId) || TRACKS[0];
  const selectedGhost = ghostLaps[currentTrackId];
  const selectedBestTime = bestLapTimes[currentTrackId];

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 flex items-center justify-center p-3 select-none text-white">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="min-w-0">
            <h2 className="text-lg font-black italic tracking-wide uppercase text-white flex items-center gap-2">
              <Flag size={18} className="text-red-500 shrink-0" />
              <span>Championship Tracks</span>
            </h2>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-400 font-mono mt-0.5 tabular-nums">
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Trophy size={11} /> {championship.points} Pts
              </span>
              <span aria-hidden="true">·</span>
              <span>{unlockedTrackIds.length}/{TRACKS.length} Circuits</span>
              <span aria-hidden="true">·</span>
              <span>{coins} CR</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close track selection"
            className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Global AI Competitor Grid & Race Against Ghost Settings */}
        <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800/80 flex flex-col gap-3">
          {/* Race Against Ghost Option */}
          <button
            type="button"
            aria-pressed={raceAgainstGhost}
            onClick={() => onToggleRaceAgainstGhost(!raceAgainstGhost)}
            className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-left cursor-pointer ${
              raceAgainstGhost
                ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10'
                : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  raceAgainstGhost ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-cyan-400'
                }`}
              >
                <Ghost size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-wide flex items-center gap-2">
                  <span>Race against Ghost</span>
                </div>
                <p className="text-[11px] font-mono text-slate-400">
                  {selectedGhost
                    ? `Target: ${selectedGhost.lapTime.toFixed(2)}s Best Lap · 1v1`
                    : selectedBestTime && selectedBestTime < 999
                    ? `Finish 1 lap to record Ghost (Best: ${selectedBestTime.toFixed(2)}s)`
                    : `Finish 1 lap on ${selectedTrack.name} to record Ghost`}
                </p>
              </div>
            </div>

            <span
              className={`text-[11px] font-mono font-black uppercase px-2.5 py-1 rounded-lg shrink-0 ${
                raceAgainstGhost
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {raceAgainstGhost ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* AI Grid Size Override */}
          <div className={`flex flex-col gap-2 transition-opacity ${raceAgainstGhost ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Shield size={13} className="text-amber-400" /> Grid Size Override
              </span>
              <span className="text-xs font-bold text-amber-300">
                {raceAgainstGhost
                  ? '1v1 Ghost Duel (AI Traffic Off)'
                  : `${opponentCount} Automated AI Cars (${opponentCount + 1} Racers)`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {([4, 6, 8] as OpponentCount[]).map((count) => {
                const active = !raceAgainstGhost && opponentCount === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      if (raceAgainstGhost) onToggleRaceAgainstGhost(false);
                      onSetOpponentCount(count);
                    }}
                    className={`min-h-[40px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
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
        </div>

        {/* Tracks List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {TRACKS.map((track, idx) => {
            const isUnlocked = unlockedTrackIds.includes(track.id);
            const unlockCost = getTrackUnlockCost(track.id);
            const isSelected = track.id === currentTrackId && isUnlocked;
            const trackGhost = ghostLaps[track.id];
            const bestLap = trackGhost?.lapTime ?? bestLapTimes[track.id];
            const bestRace = bestRaceTimes[track.id];
            const bestRank = bestRanks[track.id];
            const prevTrackName = idx > 0 ? TRACKS[idx - 1].name : '';

            return (
              <div
                key={track.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isSelected
                    ? raceAgainstGhost
                      ? 'bg-slate-800/90 border-cyan-400 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-800/90 border-red-500 shadow-lg shadow-red-500/10'
                    : isUnlocked
                    ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/40 border-slate-800/60 opacity-85'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Difficulty Badge */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm italic shadow-inner shrink-0"
                    style={{
                      backgroundColor: `${track.previewColor}22`,
                      color: track.previewColor,
                      border: `1px solid ${track.previewColor}66`,
                    }}
                  >
                    {isUnlocked ? track.difficulty.slice(0, 3).toUpperCase() : <Lock size={17} />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black italic text-sm text-white">{track.name}</h3>
                      <span className="text-[11px] font-mono text-slate-400">
                        {track.laps} Laps
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isUnlocked
                        ? track.subtitle
                        : `Finish Top 3 on ${prevTrackName} or unlock early`}
                    </p>

                    {isUnlocked && ((bestLap && bestLap < 999) || (bestRank && bestRank < 99)) && (
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] font-mono text-emerald-400 tabular-nums">
                        {bestLap && bestLap < 999 && (
                          <span className="flex items-center gap-1">
                            <Award size={11} className="shrink-0" />
                            Best Lap: {bestLap.toFixed(2)}s
                          </span>
                        )}
                        {bestRace && bestRace < 9999 && (
                          <>
                            <span className="text-slate-600" aria-hidden="true">·</span>
                            <span className="text-slate-300">Race: {bestRace.toFixed(1)}s</span>
                          </>
                        )}
                        {bestRank && bestRank < 99 && (
                          <>
                            <span className="text-slate-600" aria-hidden="true">·</span>
                            <span className="text-amber-400">Best #{bestRank}</span>
                          </>
                        )}
                        {trackGhost && (
                          <>
                            <span className="text-slate-600" aria-hidden="true">·</span>
                            <span className="text-cyan-300 font-bold">Ghost Ready</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                  {!isUnlocked ? (
                    <button
                      type="button"
                      disabled={coins < unlockCost}
                      onClick={() => onUnlockTrack(track.id, unlockCost)}
                      className="min-h-[40px] px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 font-mono font-black text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Lock size={12} />
                      <span>Unlock {unlockCost} CR</span>
                    </button>
                  ) : isSelected ? (
                    <>
                      {trackGhost && !raceAgainstGhost && (
                        <button
                          type="button"
                          onClick={() => onLaunchGhostRace(track)}
                          className="min-h-[40px] px-3 py-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/70 text-cyan-300 font-bold text-xs uppercase italic flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Ghost size={14} />
                          <span>Race Ghost</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onStartRace}
                        data-start="true"
                        className={`flex-1 sm:flex-initial min-h-[40px] px-4 py-2 rounded-lg text-white font-bold text-xs uppercase italic flex items-center justify-center gap-1.5 shadow-md cursor-pointer whitespace-nowrap ${
                          raceAgainstGhost
                            ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/30'
                            : 'bg-red-600 hover:bg-red-500 shadow-red-600/30'
                        }`}
                      >
                        {raceAgainstGhost ? <Ghost size={14} /> : <Play size={14} className="fill-white" />}
                        <span>{raceAgainstGhost ? 'Race Ghost' : 'Race Here'}</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectTrack(track)}
                      className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase cursor-pointer whitespace-nowrap"
                    >
                      Select
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
          >
            Back to Title
          </button>
          <button
            type="button"
            onClick={onStartRace}
            data-start="true"
            className={`min-h-[44px] px-6 py-2.5 rounded-xl text-white font-black italic text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg cursor-pointer ${
              raceAgainstGhost
                ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/30'
                : 'bg-red-600 hover:bg-red-500 shadow-red-600/30'
            }`}
          >
            {raceAgainstGhost ? <Ghost size={15} /> : <Play size={15} className="fill-white" />}
            <span>{raceAgainstGhost ? 'Launch Ghost Race' : 'Launch Race'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
