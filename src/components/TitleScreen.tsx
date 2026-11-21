/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Play,
  Trophy,
  Wrench,
  Volume2,
  VolumeX,
  Shield,
  Sliders,
  Target,
  Flame,
  Gift,
} from 'lucide-react';
import {
  AIDifficulty,
  OpponentCount,
  TrackDefinition,
  CarStats,
  RaceMode,
  RacePerkId,
  TrackWeather,
} from '../game/types';
import { AI_DIFFICULTIES, RACE_MODES, RACE_PERKS } from '../game/features';
import { PWAInstallButton } from './PWAControls';

interface TitleScreenProps {
  onStartRace: () => void;
  onOpenLevelSelect: () => void;
  onOpenGarage: () => void;
  onOpenFeatures: (tab?: 'modes' | 'missions' | 'controls' | 'career') => void;
  opponentCount: OpponentCount;
  onSetOpponentCount: (count: OpponentCount) => void;
  raceMode: RaceMode;
  onSetRaceMode: (mode: RaceMode) => void;
  aiDifficulty: AIDifficulty;
  equippedPerk: RacePerkId;
  weather: TrackWeather;
  winStreak: number;
  trophies: number;
  claimableMissionsCount: number;
  canClaimDaily: boolean;
  dailyRewardAmount: number;
  onClaimDaily: () => void;
  selectedTrack: TrackDefinition;
  selectedCar: CarStats;
  coins: number;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartRace,
  onOpenLevelSelect,
  onOpenGarage,
  onOpenFeatures,
  opponentCount,
  onSetOpponentCount,
  raceMode,
  onSetRaceMode,
  aiDifficulty,
  equippedPerk,
  weather,
  winStreak,
  trophies,
  claimableMissionsCount,
  canClaimDaily,
  dailyRewardAmount,
  onClaimDaily,
  selectedTrack,
  selectedCar,
  coins,
  isMuted,
  onToggleMute,
}) => {
  const activePerkMeta = RACE_PERKS.find((p) => p.id === equippedPerk) || RACE_PERKS[0];
  const activeDiffMeta = AI_DIFFICULTIES.find((d) => d.id === aiDifficulty) || AI_DIFFICULTIES[1];

  return (
    <div className="fixed inset-0 flex flex-col justify-between p-4 md:p-6 z-30 select-none bg-gradient-to-b from-[#090a0f]/94 via-[#0c101d]/92 to-[#090a0f]/96 text-white overflow-y-auto">
      {/* Top Bar (Clean 3-zone header) */}
      <header className="flex items-center justify-between gap-4 w-full max-w-4xl mx-auto shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center font-black text-xl italic tracking-tighter shadow-lg shadow-red-500/30 shrink-0">
            A
          </div>
          <h1 className="text-xl md:text-2xl font-black italic tracking-wider uppercase text-white whitespace-nowrap shrink-0">
            Apex <span className="text-red-500">1-Touch</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenFeatures('career')}
            aria-label="Open Career Records and Offline Backup"
            className="min-h-[40px] px-2.5 rounded-xl hover:bg-slate-900/90 flex items-center gap-2 text-xs font-mono font-bold text-amber-400 tabular-nums whitespace-nowrap cursor-pointer transition-colors"
          >
            <span>{coins} CR</span>
            {trophies > 0 && (
              <>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="text-cyan-300">{trophies} Cups</span>
              </>
            )}
            {winStreak > 0 && (
              <>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="text-emerald-400">{winStreak} Streak</span>
              </>
            )}
          </button>

          <PWAInstallButton />

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-900/90 border border-slate-700/70 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-500 active:scale-95 transition-all cursor-pointer"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </header>

      {/* Center Interactive Race Setup */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-md w-full mx-auto my-auto text-center gap-3 py-3">
        {/* Daily Offline Bonus Banner (shown when available today) */}
        {canClaimDaily && (
          <button
            type="button"
            onClick={onClaimDaily}
            className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/60 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 transition-all active:scale-[0.99] cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Gift size={15} className="text-emerald-400 shrink-0" />
              <span>Daily Offline Garage Bonus Ready</span>
            </span>
            <span className="font-mono font-black text-amber-300 whitespace-nowrap">
              Claim +{dailyRewardAmount} CR
            </span>
          </button>
        )}

        {/* Car Showcase Button */}
        <button
          type="button"
          onClick={onOpenGarage}
          className="w-56 rounded-2xl p-3.5 flex flex-col justify-between items-center relative overflow-hidden border shadow-2xl transition-transform hover:scale-[1.02] active:scale-95 text-left cursor-pointer"
          style={{
            backgroundColor: '#131826',
            borderColor: selectedCar.primaryColor,
            boxShadow: `0 12px 30px -10px ${selectedCar.primaryColor}55`,
          }}
        >
          <div
            className="absolute -top-12 -left-12 w-32 h-32 rounded-full blur-2xl opacity-35 pointer-events-none"
            style={{ backgroundColor: selectedCar.primaryColor }}
          />

          <div className="flex items-center justify-between w-full z-10 text-[11px] font-mono text-slate-400">
            <span>Active Ride</span>
            <span className="capitalize text-slate-300">{selectedCar.shapeStyle}</span>
          </div>

          <div className="relative z-10 flex items-center justify-center py-2.5">
            <div
              className="w-24 h-11 rounded-lg flex items-center justify-center relative shadow-lg"
              style={{ backgroundColor: selectedCar.primaryColor }}
            >
              <div
                className="w-16 h-3 rounded"
                style={{ backgroundColor: selectedCar.secondaryColor }}
              />
              <div className="absolute w-8 h-6 bg-slate-900/90 rounded-sm" />
              <div
                className="absolute right-0 w-2 h-9 rounded-sm"
                style={{ backgroundColor: selectedCar.accentColor }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between w-full z-10">
            <span className="font-black italic text-sm text-white tracking-wide">
              {selectedCar.name}
            </span>
            <span className="text-xs text-cyan-400 flex items-center gap-1 font-mono">
              Tune <Wrench size={11} />
            </span>
          </div>
        </button>

        {/* Track Picker & Active Loadout Summary */}
        <div className="w-full flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenLevelSelect}
            className="min-h-[44px] w-full flex items-center justify-between gap-2 px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-slate-500 text-xs text-slate-200 transition-all active:scale-[0.99] cursor-pointer"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedTrack.previewColor }}
              />
              <span className="font-bold text-white truncate">{selectedTrack.name}</span>
            </span>
            <span className="text-red-400 text-[11px] font-mono whitespace-nowrap shrink-0">
              {selectedTrack.difficulty} · Change &rarr;
            </span>
          </button>

          {/* Clean unboxed active loadout metadata */}
          <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-400 font-mono">
            <span>{activePerkMeta.name}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{weather}</span>
            <span aria-hidden="true">·</span>
            <span>{activeDiffMeta.name} AI</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onOpenFeatures('modes')}
              className="text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline font-bold cursor-pointer"
            >
              Customize
            </button>
          </div>
        </div>

        {/* Race Mode Quick Segmented Switcher */}
        <div className="w-full bg-slate-900/85 border border-slate-800 rounded-xl p-2 space-y-2">
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
              <Flame size={12} className="text-amber-400" /> Race Mode
            </span>
            <span className="text-[11px] text-slate-300">
              {RACE_MODES.find((m) => m.id === raceMode)?.bonusNote}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {RACE_MODES.map((m) => {
              const active = raceMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSetRaceMode(m.id)}
                  className={`min-h-[40px] px-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-slate-950 font-black italic shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/70'
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* AI Competitor Grid Selector (4, 6, 8 Rivals) */}
        <div className="w-full bg-slate-900/85 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
              <Shield size={12} className="text-red-400" /> Rival AI Grid
            </span>
            <span className="text-[11px] font-bold text-slate-300 tabular-nums">
              {opponentCount} Automated Rivals ({opponentCount + 1} Total)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([4, 6, 8] as OpponentCount[]).map((count) => {
              const isSelected = opponentCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => onSetOpponentCount(count)}
                  className={`min-h-[46px] py-1.5 px-1 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    isSelected
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 border border-red-400'
                      : 'bg-slate-800/80 text-slate-300 border border-slate-700/60 hover:bg-slate-700/70'
                  }`}
                >
                  <span className="text-sm font-black italic whitespace-nowrap">{count} CARS</span>
                  <span className="text-[10px] font-mono opacity-80 whitespace-nowrap">
                    {count === 4 ? 'Sprint Grid' : count === 6 ? 'Pro Grid' : 'Mayhem Grid'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Start Race CTA */}
        <button
          type="button"
          data-start="true"
          onClick={onStartRace}
          className="w-full min-h-[54px] py-3.5 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-black italic text-lg tracking-wider uppercase shadow-xl shadow-red-600/40 active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer group"
        >
          <Play size={22} className="fill-white group-hover:scale-110 transition-transform" />
          <span>Tap to Race</span>
        </button>
      </main>

      {/* Bottom Menu Bar: Features & Improvisation Dock */}
      <footer className="w-full max-w-md mx-auto flex flex-col items-center gap-2 text-center shrink-0">
        <p className="text-[11px] text-slate-400 font-mono">
          1-Finger Control: Slide or hold left/right · 100% Offline
        </p>

        <div className="grid grid-cols-4 gap-2 w-full">
          <button
            type="button"
            onClick={() => onOpenFeatures('modes')}
            className="min-h-[48px] px-1 rounded-xl bg-slate-800/85 border border-slate-700 hover:border-cyan-400 text-[11px] font-bold text-slate-100 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Sliders size={15} className="text-cyan-400" />
            <span>Features</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenFeatures('missions')}
            className="min-h-[48px] px-1 rounded-xl bg-slate-800/85 border border-slate-700 hover:border-emerald-400 text-[11px] font-bold text-slate-100 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Target size={15} className="text-emerald-400" />
            <span>
              Missions{claimableMissionsCount > 0 ? ` (${claimableMissionsCount})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenLevelSelect}
            className="min-h-[48px] px-1 rounded-xl bg-slate-800/85 border border-slate-700 hover:border-amber-400 text-[11px] font-bold text-slate-100 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Trophy size={15} className="text-amber-400" />
            <span>Tracks</span>
          </button>

          <button
            type="button"
            onClick={onOpenGarage}
            className="min-h-[48px] px-1 rounded-xl bg-slate-800/85 border border-slate-700 hover:border-rose-400 text-[11px] font-bold text-slate-100 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Wrench size={15} className="text-rose-400" />
            <span>Garage</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
