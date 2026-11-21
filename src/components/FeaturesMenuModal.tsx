/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
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
  Trophy,
  Download,
  Upload,
  RotateCcw,
  HardDrive,
  Smartphone,
  Monitor,
  Gift,
  Gauge,
} from 'lucide-react';
import {
  AIDifficulty,
  CameraZoomMode,
  PlayerProgress,
  RaceMode,
  RacePerkId,
  TrackGhostLap,
  TrackWeather,
} from '../game/types';
import { AI_DIFFICULTIES, RACE_MODES, RACE_PERKS, TRACK_WEATHERS } from '../game/features';
import { TRACKS } from '../game/tracks';
import { PWAInstallButton } from './PWAControls';

export type FeaturesTabId = 'modes' | 'missions' | 'controls' | 'career';

interface FeaturesMenuModalProps {
  initialTab?: FeaturesTabId;
  progress: PlayerProgress;
  ghostLaps: { [trackId: string]: TrackGhostLap };
  raceMode: RaceMode;
  onSetRaceMode: (mode: RaceMode) => void;
  aiDifficulty: AIDifficulty;
  onSetAiDifficulty: (diff: AIDifficulty) => void;
  weather: TrackWeather;
  onSetWeather: (w: TrackWeather) => void;
  onEquipPerk: (perkId: RacePerkId) => void;
  onUnlockPerk: (perkId: RacePerkId, cost: number) => void;
  onClaimMission: (missionId: string) => void;
  canClaimDaily: boolean;
  dailyRewardAmount: number;
  onClaimDaily: () => void;
  steeringSensitivity: number;
  onSetSteeringSensitivity: (val: number) => void;
  autoDriftAssist: boolean;
  onSetAutoDriftAssist: (val: boolean) => void;
  cameraZoom: CameraZoomMode;
  onSetCameraZoom: (val: CameraZoomMode) => void;
  hapticsEnabled: boolean;
  onSetHapticsEnabled: (val: boolean) => void;
  showMinimap: boolean;
  onSetShowMinimap: (val: boolean) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onExportSave: () => void;
  onImportSave: (jsonText: string) => boolean;
  onResetSave: () => void;
  onStartRace: () => void;
  onClose: () => void;
}

export const FeaturesMenuModal: React.FC<FeaturesMenuModalProps> = ({
  initialTab = 'modes',
  progress,
  ghostLaps,
  raceMode,
  onSetRaceMode,
  aiDifficulty,
  onSetAiDifficulty,
  weather,
  onSetWeather,
  onEquipPerk,
  onUnlockPerk,
  onClaimMission,
  canClaimDaily,
  dailyRewardAmount,
  onClaimDaily,
  steeringSensitivity,
  onSetSteeringSensitivity,
  autoDriftAssist,
  onSetAutoDriftAssist,
  cameraZoom,
  onSetCameraZoom,
  hapticsEnabled,
  onSetHapticsEnabled,
  showMinimap,
  onSetShowMinimap,
  isMuted,
  onToggleMute,
  onExportSave,
  onImportSave,
  onResetSave,
  onStartRace,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<FeaturesTabId>(initialTab);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const claimableCount = progress.missions.filter(
    (m) => !m.claimed && m.progress >= m.target
  ).length;

  const streakMultiplier = Math.min(2.0, 1 + progress.winStreak * 0.25);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = onImportSave(String(reader.result || ''));
      setSaveNotice(ok ? 'Device save restored successfully.' : 'Invalid save backup file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 flex items-center justify-center p-3 select-none text-white">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-black italic tracking-wide uppercase text-white">
              Race Playbook &amp; Career
            </h2>
            <p className="text-xs text-slate-400">
              Modes, AI difficulty, driving settings &amp; permanent offline save
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-amber-400 tabular-nums whitespace-nowrap">
              {progress.coins} CR
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close features menu"
              className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-transform cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Segmented Tab Navigation */}
        <div className="px-4 pt-3 pb-2 bg-slate-950/60 border-b border-slate-800">
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('modes')}
              className={`min-h-[42px] px-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'modes'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame size={14} className="shrink-0" />
              <span>Modes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('missions')}
              className={`min-h-[42px] px-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'missions'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Target size={14} className="shrink-0" />
              <span>
                Missions{claimableCount > 0 ? ` (${claimableCount})` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('controls')}
              className={`min-h-[42px] px-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'controls'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders size={14} className="shrink-0" />
              <span>Driving</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('career')}
              className={`min-h-[42px] px-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'career'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy size={14} className="shrink-0" />
              <span>Career</span>
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
                        type="button"
                        onClick={() => onSetRaceMode(m.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 min-h-[104px] cursor-pointer ${
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

              {/* AI Rival Difficulty */}
              <section className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Gauge size={14} className="text-cyan-400" /> AI Rival Pace
                  </h3>
                  <span className="text-xs text-slate-400">Saved automatically</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {AI_DIFFICULTIES.map((diff) => {
                    const active = aiDifficulty === diff.id;
                    return (
                      <button
                        key={diff.id}
                        type="button"
                        onClick={() => onSetAiDifficulty(diff.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-slate-800 border-cyan-400 text-white'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-black uppercase italic">{diff.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{diff.summary}</div>
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
                        className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                          isEquipped
                            ? 'bg-slate-800 border-cyan-400 shadow-md shadow-cyan-500/10'
                            : 'bg-slate-950/70 border-slate-800'
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
                              type="button"
                              onClick={() => onEquipPerk(perk.id)}
                              className="min-h-[36px] px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 whitespace-nowrap cursor-pointer"
                            >
                              Equip
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onUnlockPerk(perk.id, perk.cost)}
                              disabled={progress.coins < perk.cost}
                              className="min-h-[36px] px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 font-mono font-black text-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
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
                        type="button"
                        onClick={() => onSetWeather(w.id)}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 min-h-[60px] transition-all cursor-pointer ${
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
            <div className="space-y-4">
              {/* Daily Offline Bonus Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Gift size={22} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Daily Offline Check-In</div>
                    <div className="text-xs text-slate-400">
                      Streak: {progress.dailyStreak} day(s) · Stored locally on device
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canClaimDaily}
                  onClick={onClaimDaily}
                  className={`min-h-[44px] px-4 rounded-xl text-xs font-black uppercase tracking-wide whitespace-nowrap shrink-0 transition-all ${
                    canClaimDaily
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {canClaimDaily ? `Claim +${dailyRewardAmount}` : 'Claimed Today'}
                </button>
              </div>

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
                        type="button"
                        onClick={() => onClaimMission(mission.id)}
                        disabled={!isReady}
                        className={`min-h-[44px] px-4 rounded-xl text-xs font-black uppercase tracking-wide whitespace-nowrap shrink-0 transition-all ${
                          isReady
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer'
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
            <div className="space-y-4">
              {/* Steering Sensitivity */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-white">One-Finger Steering Sensitivity</h3>
                  <p className="text-xs text-slate-400">
                    Adjust how quickly thumb swipe reaches full steering lock
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Smooth', val: 0.8 },
                    { label: 'Normal', val: 1.0 },
                    { label: 'Sharp', val: 1.35 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => onSetSteeringSensitivity(opt.val)}
                      className={`min-h-[44px] rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
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
                    type="button"
                    onClick={() => onSetAutoDriftAssist(true)}
                    className={`min-h-[56px] p-3 rounded-xl border text-left transition-all cursor-pointer ${
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
                    type="button"
                    onClick={() => onSetAutoDriftAssist(false)}
                    className={`min-h-[56px] p-3 rounded-xl border text-left transition-all cursor-pointer ${
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
                    type="button"
                    onClick={() => onSetCameraZoom('normal')}
                    className={`min-h-[44px] rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
                      cameraZoom === 'normal'
                        ? 'bg-cyan-600 border-cyan-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Close Action View
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetCameraZoom('wide')}
                    className={`min-h-[44px] rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
                      cameraZoom === 'wide'
                        ? 'bg-cyan-600 border-cyan-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Wide Tactical View
                  </button>
                </div>
              </div>

              {/* Device Preferences: Audio, Haptics & Minimap */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Audio, Haptics &amp; HUD</h3>
                  <p className="text-xs text-slate-400">
                    All preferences save permanently on this device
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className={`min-h-[44px] rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      !isMuted
                        ? 'bg-slate-800 border-emerald-400 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Sound: {isMuted ? 'Muted' : 'On'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetHapticsEnabled(!hapticsEnabled)}
                    className={`min-h-[44px] rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      hapticsEnabled
                        ? 'bg-slate-800 border-cyan-400 text-cyan-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Haptics: {hapticsEnabled ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetShowMinimap(!showMinimap)}
                    className={`min-h-[44px] rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      showMinimap
                        ? 'bg-slate-800 border-amber-400 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Minimap: {showMinimap ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'career' && (
            <div className="space-y-4">
              {/* Career Summary Stats */}
              <section className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Trophy size={15} className="text-amber-400" /> Career &amp; Championship
                  </h3>
                  <span className="font-mono text-xs text-amber-400 font-bold tabular-nums">
                    {progress.championship.points} Season Pts
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">Races / Wins</div>
                    <div className="text-sm font-black font-mono text-white tabular-nums mt-0.5">
                      {progress.championship.totalRaces} / {progress.championship.totalWins}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">Podiums</div>
                    <div className="text-sm font-black font-mono text-cyan-300 tabular-nums mt-0.5">
                      {progress.championship.totalPodiums}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">Best Drift</div>
                    <div className="text-sm font-black font-mono text-amber-400 tabular-nums mt-0.5">
                      {progress.championship.bestDriftScore}
                    </div>
                  </div>
                </div>
              </section>

              {/* Track Records Table */}
              <section className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <h3 className="text-sm font-bold text-white">Track Lap &amp; Ghost Records</h3>
                <div className="space-y-1.5">
                  {TRACKS.map((track) => {
                    const lap = progress.bestLapTimes[track.id];
                    const race = progress.bestRaceTimes[track.id];
                    const rank = progress.bestRanks[track.id];
                    const ghost = ghostLaps[track.id];
                    return (
                      <div
                        key={track.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-800/80 text-xs font-mono tabular-nums"
                      >
                        <span className="font-sans font-bold text-slate-200 truncate">
                          {track.name}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                          <span>{lap && lap < 999 ? `Lap ${lap.toFixed(2)}s` : 'No Lap'}</span>
                          {race && race < 9999 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Race {race.toFixed(1)}s</span>
                            </>
                          )}
                          {rank && rank < 99 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-400">#{rank}</span>
                            </>
                          )}
                          {ghost && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-cyan-400">Ghost</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Offline Audit & Device Storage Backup */}
              <section className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <HardDrive size={15} className="text-emerald-400" /> Device Save &amp; Offline Audit
                  </h3>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">
                    100% Local
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tracks, procedural Web Audio SFX, AI opponents, ghost trajectories, upgrades, and
                  settings run strictly on-device with zero external APIs or cloud dependencies.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onExportSave();
                      setSaveNotice('Offline save backup downloaded.');
                    }}
                    className="min-h-[40px] px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-100 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={14} className="text-cyan-400" />
                    <span>Export Save</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[40px] px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-100 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload size={14} className="text-amber-400" />
                    <span>Import Save</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    onChange={handleImportFile}
                    className="hidden"
                  />

                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="min-h-[40px] px-3.5 rounded-lg bg-slate-900 hover:bg-red-950/60 border border-slate-800 hover:border-red-500/50 text-xs font-bold text-rose-400 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw size={14} />
                      <span>Reset Data</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onResetSave();
                        setConfirmReset(false);
                        setSaveNotice('Device save reset to factory defaults.');
                      }}
                      className="min-h-[40px] px-3.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-black text-white cursor-pointer"
                    >
                      Confirm Reset
                    </button>
                  )}
                </div>

                {saveNotice && (
                  <p className="text-xs font-mono text-cyan-300" role="status">
                    {saveNotice}
                  </p>
                )}
              </section>

              {/* Multi-Platform Build Readiness */}
              <section className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Smartphone size={15} className="text-cyan-400" /> Native &amp; Desktop Targets
                  </h3>
                  <PWAInstallButton />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-emerald-500/40 flex flex-col justify-between gap-2">
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Smartphone size={13} className="text-emerald-400" /> Android APK
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        Signed v1.0.0 · 4.5 MB Offline
                      </div>
                    </div>
                    {typeof window !== 'undefined' &&
                      window.location.protocol !== 'file:' &&
                      window.location.protocol !== 'capacitor:' && (
                        <a
                          href="/downloads/Apex-One-Touch-Racing-v1.0.0-offline.apk"
                          download="Apex-One-Touch-Racing-v1.0.0-offline.apk"
                          className="min-h-[34px] px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-black text-[11px] flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
                        >
                          <Download size={13} />
                          <span>Download APK</span>
                        </a>
                      )}
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Monitor size={13} className="text-cyan-400" /> Windows EXE
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                      Electron NSIS installer target
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Smartphone size={13} className="text-amber-400" /> iPhone Xcode
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                      Capacitor iOS App project synced
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-950/80">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 whitespace-nowrap cursor-pointer"
          >
            Back to Menu
          </button>
          <button
            type="button"
            data-start="true"
            onClick={onStartRace}
            className="min-h-[44px] px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black italic text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-red-600/30 whitespace-nowrap active:scale-95 transition-transform cursor-pointer"
          >
            <Play size={15} className="fill-white" />
            <span>Launch Race</span>
          </button>
        </div>
      </div>
    </div>
  );
};
