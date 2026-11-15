/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Trophy, Award, RotateCcw, ArrowRight, Zap, Coins } from 'lucide-react';
import { CarEntity, RaceMode, TrackDefinition } from '../game/types';

interface RaceResultModalProps {
  playerCar: CarEntity;
  cars: CarEntity[];
  track: TrackDefinition;
  raceMode: RaceMode;
  coinsEarned: number;
  onRestartRace: () => void;
  onNextTrack: () => void;
  onReturnToMenu: () => void;
}

export const RaceResultModal: React.FC<RaceResultModalProps> = ({
  playerCar,
  cars,
  track,
  raceMode,
  coinsEarned,
  onRestartRace,
  onNextTrack,
  onReturnToMenu,
}) => {
  const isWinner = playerCar.rank === 1;
  const isPodium = playerCar.rank <= 3;

  // Sort all cars by final rank
  const sortedCars = [...cars].sort((a, b) => a.rank - b.rank);

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/92 backdrop-blur-md flex items-center justify-center p-3 select-none text-white">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Banner */}
        <div
          className={`p-5 text-center relative overflow-hidden ${
            isWinner
              ? 'bg-gradient-to-b from-amber-500/20 via-yellow-600/10 to-transparent'
              : isPodium
              ? 'bg-gradient-to-b from-cyan-500/20 via-blue-600/10 to-transparent'
              : 'bg-gradient-to-b from-slate-700/20 to-transparent'
          }`}
        >
          {/* Trophy Icon */}
          <div className="flex justify-center mb-2">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl ${
                isWinner
                  ? 'bg-amber-400 text-slate-950 shadow-amber-400/40 animate-bounce'
                  : isPodium
                  ? 'bg-cyan-400 text-slate-950 shadow-cyan-400/40'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Trophy size={28} />
            </div>
          </div>

          <h2 className="text-2xl font-black italic tracking-wide uppercase text-white">
            {playerCar.isEliminated
              ? 'Knocked Out!'
              : isWinner
              ? raceMode === 'knockout'
                ? 'Last Car Standing!'
                : 'Victory! 1st Place'
              : isPodium
              ? 'Podium Finish!'
              : 'Race Finished'}
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {track.name} · {cars.length} Racers Grid
          </p>

          {/* Player Result Summary Cards */}
          <div className="grid grid-cols-3 gap-2 mt-4 max-w-sm mx-auto">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 text-center">
              <span className="text-[9px] font-mono text-slate-400 uppercase">Position</span>
              <p
                className={`text-lg font-black italic font-mono ${
                  isWinner ? 'text-amber-400' : isPodium ? 'text-cyan-400' : 'text-slate-300'
                }`}
              >
                {playerCar.rank === 1 ? '1st' : playerCar.rank === 2 ? '2nd' : playerCar.rank === 3 ? '3rd' : `${playerCar.rank}th`}
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 text-center">
              <span className="text-[9px] font-mono text-slate-400 uppercase">Best Lap</span>
              <p className="text-lg font-black italic font-mono text-white">
                {playerCar.bestLapTime < 999 ? `${playerCar.bestLapTime.toFixed(1)}s` : '--'}
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 text-center">
              <span className="text-[9px] font-mono text-slate-400 uppercase">Prize</span>
              <p className="text-lg font-black italic font-mono text-amber-400 flex items-center justify-center gap-1">
                +{coinsEarned}
              </p>
            </div>
          </div>
        </div>

        {/* Full Grid Leaderboard */}
        <div className="p-4 overflow-y-auto space-y-1.5 flex-1 bg-slate-950/40">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Official Grid Standings ({sortedCars.length} Cars)
          </span>

          {sortedCars.map((car) => {
            const isSelf = car.isPlayer;
            return (
              <div
                key={car.id}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-mono ${
                  isSelf
                    ? 'bg-red-950/40 border-red-500/80 text-white font-bold shadow-md'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-5 font-black text-center ${
                      car.rank === 1
                        ? 'text-amber-400'
                        : car.rank === 2
                        ? 'text-slate-300'
                        : car.rank === 3
                        ? 'text-amber-600'
                        : 'text-slate-500'
                    }`}
                  >
                    #{car.rank}
                  </span>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: car.carStats.primaryColor }}
                  />
                  <span className={isSelf ? 'text-amber-300 font-black' : 'text-slate-200'}>
                    {car.name} {isSelf && '(YOU)'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  {car.bestLapTime < 999 && (
                    <span>Lap: {car.bestLapTime.toFixed(1)}s</span>
                  )}
                  <span className="font-bold text-white">
                    {car.isEliminated ? 'KO' : car.isFinished ? 'FINISHED' : 'RACING'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-slate-800 flex items-center gap-2 bg-slate-950/80">
          <button
            onClick={onReturnToMenu}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-all flex items-center justify-center gap-1.5"
          >
            Menu
          </button>
          <button
            onClick={onRestartRace}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-all flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={14} />
            <span>Retry</span>
          </button>
          <button
            data-start="true"
            onClick={onNextTrack}
            className="flex-2 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black italic text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2"
          >
            <span>Next Race</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
