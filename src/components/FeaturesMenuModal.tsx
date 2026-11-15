/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Play,
  Flame,
  Target,
  Sliders,
  Shield,
  Zap,
  Magnet,
  CloudRain,
  Moon,
  Sun,
  Check,
  Lock,
  Award,
} from 'lucide-react';
import {
  CameraZoomMode,
  PlayerProgress,
  RaceMode,
  RacePerkId,
  TrackWeather,
} from '../game/types';
import { RACE_MODES, RACE_PERKS, TRACK_WEATHERS } from '../game/features';

interface FeaturesMenuModalProps {
  initialTab?: 'modes' | 'missions' | 'controls';
  progress: PlayerProgress;
  raceMode: RaceMode;
  onSetRaceMode: (mode: RaceMode) => void;
  weather: TrackWeather;
  onSetWeather: (w: TrackWeather) => void;
  onEquipPerk: (perkId: RacePerkId) => void;
  onUnlockPerk: (perkId: RacePerkId, cost: number) => void;
  onClaimMission: (missionId: string) => void;
  steeringSensitivity: number;
  onSetSteeringSensitivity: (val: number) => void;
  autoDriftAssist: boolean;
  onSetAutoDriftAssist: (val: boolean) => void;
  cameraZoom: CameraZoomMode;
  onSetCameraZoom: (val: CameraZoomMode) => void;
  onStartRace: () => void;
  onClose: () => void;
}

export const FeaturesMenuModal: React.FC<FeaturesMenuModalProps> = ({
  initialTab = 'modes',
  progress,
  raceMode,
  onSetRaceMode,
  weather,
  onSetWeather,
  onEquipPerk,
  onUnlockPerk,
  onClaimMission,
  steeringSensitivity,
  onSetSteeringSensitivity,
  autoDriftAssist,
  onSetAutoDriftAssist,
  cameraZoom,
  onSetCameraZoom,
  onStartRace,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'modes' | 'missions' | 'controls'>(initialTab);

  const claimableCount = progress.missions.filter(
    (m) => !m.claimed && m.progress >= m.target
  ).length;

  const streakMultiplier = Math.min(2.0, 1 + progress.winStreak * 0.25);

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/92 backdrop-blur-md flex items-center justify-center p-3 select-none text-white">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-black italic tracking-wide uppercase text-white">
              Race Playbook &amp; Features
            </h2>
            <p className="text-xs text-slate-400">
              Customize modes, perks, and handling to improvise your winning strategy
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-amber-400 tabular-nums">
              {progress.coins} CR
            </span>
            <button
              onClick={onClose}
              aria-label="Close features menu"
              className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-transform"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Segmented Tab Navigation */}
        <div className="px-4 pt-3 pb-2 bg-slate-950/60 border-b border-slate-800">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('modes')}
              className={`min-h-[44px] px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'modes'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame size={15} />
              <span>Modes &amp; Perks</span>
            </button>

            <button
              onClick={() => setActiveTab('missions')}
              className={`min-h-[44px] px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors relative ${
                activeTab === 'missions'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Target size={15} />
              <span>Missions</span>
              {claimableCount > 0 && (
                <span className="ml-0.5 font-mono text-[11px] font-black text-amber-300">
                  ({claimableCount})
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('controls')}
              className={`min-h-[44px] px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'controls'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders size={15} />
              <span>Driving Lab</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'modes' && (
            <>
              {/* Race Mode Selector */}
              <section className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-bold text-white">Game Mode</h3>
                  <span className="text-xs text-slate-400">Pick your race format</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {RACE_MODES.map((m) => {
                    const selected = raceMode === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => onSetRaceMode(m.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 min-h-[104px] ${
                          selected
                            ? 'bg-slate-800 border-red-500 shadow-md shadow-red-500/10'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="font-black italic text-sm text-white whitespace-nowrap">
                            {m.name}
                          </span>
                          {selected && <Check size={15} className="text-red-400 shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-400 leading-snug">{m.tagline}</p>
                        <span className="text-[11px] font-mono text-amber-400 font-bold">
                          {m.bonusNote}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Improv Perks / Loadout Mods */}
              <section className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-bold text-white">Track Tech Perks</h3>
                  <span className="text-xs text-slate-400">Equip 1 active perk per race</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {RACE_PERKS.map((perk) => {
                    const isUnlocked =
                      perk.cost === 0 || progress.unlockedPerks.includes(perk.id);
                    const isEquipped = progress.equippedPerk === perk.id;

                    return (
                      <div
                        key={perk.id}
                        onClick={() => {
                          if (isUnlocked) onEquipPerk(perk.id);
                        }}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                          isUnlocked ? 'cursor-pointer' : ''
                        } ${
                          isEquipped
                            ? 'bg-slate-800 border-cyan-400 shadow-md shadow-cyan-500/10'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${perk.color}22`, color: perk.color }}
                            >
                              {perk.id === 'coin_magnet' ? (
                                <Magnet size={15} />
                              ) : perk.id === 'twin_nitro' ? (
                                <Zap size={15} />
                              ) : perk.id === 'ram_shield' ? (
                                <Shield size={15} />
                              ) : (
                                <Flame size={15} />
                              )}
                            </span>
                            <span className="font-bold text-sm text-white">{perk.name}</span>
                          </div>

                          {isEquipped ? (
                            <span className="text-xs font-mono font-bold text-cyan-400 whitespace-nowrap">
                              Equipped
                            </span>
                          ) : isUnlocked ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEquipPerk(perk.id);
                              }}
                              className="min-h-[36px] px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 whitespace-nowrap"
                            >
                              Equip
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUnlockPerk(perk.id, perk.cost);
                              }}
                              disabled={progress.coins < perk.cost}
                              className="min-h-[36px] px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 font-mono font-black text-xs flex items-center gap-1 whitespace-nowrap"
                            >
                              <Lock size={12} />
                              <span>{perk.cost} CR</span>
                            </button>
                          )}
                        </div>

                        <p className="text-xs text-slate-400 leading-snug">{perk.summary}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Weather / Track Atmosphere */}
              <section className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-bold text-white">Conditions &amp; Lighting</h3>
                  <span className="text-xs text-slate-400">Alters handling &amp; bonuses</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {TRACK_WEATHERS.map((w) => {
                    const active = weather === w.id;
                    return (
                      <button
                        key={w.id}
                        onClick={() => onSetWeather(w.id)}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 min-h-[60px] transition-all ${
                          active
                            ? 'bg-slate-800 border-amber-400'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-amber-400 shrink-0">
                          {w.id === 'clear' ? (
                            <Sun size={18} />
                          ) : w.id === 'night' ? (
                            <Moon size={18} className="text-indigo-400" />
                          ) : (
                            <CloudRain size={18} className="text-cyan-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-white">{w.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">{w.effect}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {activeTab === 'missions' && (
            <div className="space-y-5">
              {/* Win Streak Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Award size={22} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Podium Win Streak</div>
                    <div className="text-xs text-slate-400">
                      Finish top 3 to grow your credit multiplier up to 2.0x
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-xl font-black text-amber-400 tabular-nums">
                    {progress.winStreak} Wins
                  </div>
                  <div className="font-mono text-xs text-emerald-400 font-bold tabular-nums">
                    {streakMultiplier.toFixed(2)}x Payout
                  </div>
                </div>
              </div>

              {/* Active Challenges */}
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-bold text-white">Live Race Challenges</h3>
                  <span className="text-xs text-slate-400">
                    Claim completed rewards for fresh targets
                  </span>
                </div>

                {progress.missions.map((mission) => {
                  const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
                  const isReady = mission.progress >= mission.target && !mission.claimed;

                  return (
                    <div
                      key={mission.id}
                      className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-white">{mission.title}</span>
                          <span className="font-mono text-xs text-amber-400 font-bold tabular-nums">
                            +{mission.reward} CR
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{mission.description}</p>

                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                isReady ? 'bg-emerald-400' : 'bg-cyan-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-slate-300 tabular-nums shrink-0">
                            {mission.progress} / {mission.target}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => onClaimMission(mission.id)}
                        disabled={!isReady}
                        className={`min-h-[44px] px-4 rounded-xl text-xs font-black uppercase tracking-wide whitespace-nowrap shrink-0 transition-all ${
                          isReady
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isReady ? `Claim +${mission.reward}` : 'In Progress'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="space-y-5">
              {/* Steering Sensitivity */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">One-Finger Steering Sensitivity</h3>
                    <p className="text-xs text-slate-400">
                      Adjust how quickly thumb swipe reaches full steering lock
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Smooth', val: 0.8 },
                    { label: 'Normal', val: 1.0 },
                    { label: 'Sharp', val: 1.35 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => onSetSteeringSensitivity(opt.val)}
                      className={`min-h-[44px] rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
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

              {/* Cornering / Drift Style */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Cornering &amp; Drift Style</h3>
                  <p className="text-xs text-slate-400">
                    Switch between effortless road-flow assist or sharper manual drift lines
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onSetAutoDriftAssist(true)}
                    className={`min-h-[56px] p-3 rounded-xl border text-left transition-all ${
                      autoDriftAssist
                        ? 'bg-slate-800 border-cyan-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold">Auto-Flow Assist</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Guided cornering · Smooth arcs
                    </div>
                  </button>

                  <button
                    onClick={() => onSetAutoDriftAssist(false)}
                    className={`min-h-[56px] p-3 rounded-xl border text-left transition-all ${
                      !autoDriftAssist
                        ? 'bg-slate-800 border-red-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold">Pro Manual Lines</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Sharper turn-in · Custom apexes
                    </div>
                  </button>
                </div>
              </div>

              {/* Camera Framing */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Camera Framing</h3>
                  <p className="text-xs text-slate-400">
                    Zoom out to spot upcoming chicanes and rival packs earlier
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onSetCameraZoom('normal')}
                    className={`min-h-[44px] rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
                      cameraZoom === 'normal'
                        ? 'bg-cyan-600 border-cyan-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Close Action View
                  </button>
                  <button
                    onClick={() => onSetCameraZoom('wide')}
                    className={`min-h-[44px] rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
                      cameraZoom === 'wide'
                        ? 'bg-cyan-600 border-cyan-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Wide Tactical View
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-950/80">
          <button
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 whitespace-nowrap"
          >
            Back to Menu
          </button>
          <button
            data-start="true"
            onClick={onStartRace}
            className="min-h-[44px] px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black italic text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-red-600/30 whitespace-nowrap active:scale-95 transition-transform"
          >
            <Play size={15} className="fill-white" />
            <span>Launch Race</span>
          </button>
        </div>
      </div>
    </div>
  );
};
