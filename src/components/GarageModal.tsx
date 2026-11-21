/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Wrench, Lock, Palette, Check } from 'lucide-react';
import { CARS } from '../game/tracks';
import { CAR_LIVERIES } from '../game/features';
import { getCarEffectiveStats } from '../game/physics';
import { resolveCarStatsWithPaint } from '../game/storage';
import { PlayerProgress } from '../game/types';

interface GarageModalProps {
  progress: PlayerProgress;
  onSelectCar: (carId: string) => void;
  onUnlockCar: (carId: string, cost: number) => void;
  onUpgradePart: (carId: string, part: 'engine' | 'handling' | 'nitro', cost: number) => void;
  onSelectCarLivery: (carId: string, liveryId: string) => void;
  onClose: () => void;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  progress,
  onSelectCar,
  onUnlockCar,
  onUpgradePart,
  onSelectCarLivery,
  onClose,
}) => {
  const baseCar = CARS.find((c) => c.id === progress.selectedCarId) || CARS[0];
  const activeLiveryId = progress.carPaintOverrides[baseCar.id] || 'factory';
  const paintedCar = resolveCarStatsWithPaint(baseCar, activeLiveryId);
  const carUpgrades = progress.upgrades[baseCar.id] || { engine: 0, handling: 0, nitro: 0 };
  const effectiveStats = getCarEffectiveStats(paintedCar, carUpgrades);

  const upgradeCosts = {
    engine: 120 + carUpgrades.engine * 90,
    handling: 100 + carUpgrades.handling * 80,
    nitro: 90 + carUpgrades.nitro * 75,
  };

  const statMeters = [
    {
      label: 'Top Speed',
      value: Math.round((effectiveStats.baseTopSpeed / 400) * 220),
      unit: 'KM/H',
      pct: Math.min(100, Math.round((effectiveStats.baseTopSpeed / 640) * 100)),
      color: 'bg-red-500',
    },
    {
      label: 'Acceleration',
      value: Math.round(effectiveStats.baseAcceleration),
      unit: 'ACC',
      pct: Math.min(100, Math.round((effectiveStats.baseAcceleration / 400) * 100)),
      color: 'bg-amber-400',
    },
    {
      label: 'Corner Grip',
      value: Math.round(effectiveStats.baseHandling * 25),
      unit: 'GRP',
      pct: Math.min(100, Math.round((effectiveStats.baseHandling / 5.2) * 100)),
      color: 'bg-cyan-400',
    },
    {
      label: 'Nitro Surge',
      value: Math.round(effectiveStats.baseNitroMultiplier * 100),
      unit: '%',
      pct: Math.min(100, Math.round((effectiveStats.baseNitroMultiplier / 1.95) * 100)),
      color: 'bg-purple-400',
    },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 flex items-center justify-center p-3 select-none text-white">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-cyan-600/25 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0">
              <Wrench size={16} />
            </div>
            <div>
              <h2 className="text-base font-black italic tracking-wide uppercase text-white">
                Apex Garage &amp; Tuning
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Upgrade parts, customize liveries &amp; unlock supercars
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-amber-400 tabular-nums whitespace-nowrap">
              {progress.coins} CR
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Garage"
              className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Cars Grid */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CARS.map((car) => {
              const isUnlocked = progress.unlockedCarIds.includes(car.id);
              const isSelected = progress.selectedCarId === car.id;
              const liveryCar = resolveCarStatsWithPaint(car, progress.carPaintOverrides[car.id]);

              return (
                <div
                  key={car.id}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-between text-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-cyan-400 shadow-md shadow-cyan-500/20'
                      : isUnlocked
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-slate-950/80 border-slate-900 opacity-85'
                  }`}
                >
                  <div
                    className="w-12 h-6 rounded flex items-center justify-center my-0.5 relative shadow"
                    style={{ backgroundColor: liveryCar.primaryColor }}
                  >
                    <div
                      className="w-8 h-1.5 rounded"
                      style={{ backgroundColor: liveryCar.secondaryColor }}
                    />
                    {!isUnlocked && (
                      <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center rounded">
                        <Lock size={12} className="text-amber-400" />
                      </div>
                    )}
                  </div>

                  <span className="font-bold text-[11px] text-white truncate w-full">
                    {car.name}
                  </span>

                  {isSelected ? (
                    <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase py-1">
                      Active
                    </span>
                  ) : isUnlocked ? (
                    <button
                      type="button"
                      onClick={() => onSelectCar(car.id)}
                      className="w-full min-h-[32px] rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-200 hover:text-white uppercase font-bold cursor-pointer"
                    >
                      Select
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onUnlockCar(car.id, car.cost)}
                      disabled={progress.coins < car.cost}
                      className="w-full min-h-[32px] rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-[10px] font-mono font-black text-slate-950 uppercase cursor-pointer"
                    >
                      Buy {car.cost} CR
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Car Details, Live Telemetry & Tuning */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Active Car Banner + Live Stat Bars */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
                  Tier {baseCar.tier} Chassis
                </span>
                <h3 className="text-base font-black italic text-white">{paintedCar.name}</h3>
                <p className="text-xs text-slate-400 capitalize">Class: {paintedCar.shapeStyle}</p>
              </div>
              <div
                className="w-16 h-8 rounded-lg flex items-center justify-center shadow-lg relative"
                style={{ backgroundColor: paintedCar.primaryColor }}
              >
                <div
                  className="w-10 h-2 rounded"
                  style={{ backgroundColor: paintedCar.secondaryColor }}
                />
                <div
                  className="absolute right-0 w-1.5 h-6 rounded-r"
                  style={{ backgroundColor: paintedCar.accentColor }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 border-t border-slate-800/80">
              {statMeters.map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">{stat.label}</span>
                    <span className="text-slate-200 font-bold tabular-nums">
                      {stat.value} {stat.unit}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${stat.color} transition-all`} style={{ width: `${stat.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Paint Shop / Custom Livery */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-bold">
                <Palette size={13} className="text-cyan-400" /> Paint Livery
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {CAR_LIVERIES.find((l) => l.id === activeLiveryId)?.name || 'Factory'}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {CAR_LIVERIES.map((livery) => {
                const swatchPrimary = livery.primaryColor || baseCar.primaryColor;
                const swatchAccent = livery.accentColor || baseCar.accentColor;
                const selected = activeLiveryId === livery.id;

                return (
                  <button
                    key={livery.id}
                    type="button"
                    aria-label={`Select ${livery.name} livery`}
                    onClick={() => onSelectCarLivery(baseCar.id, livery.id)}
                    className={`min-h-[38px] rounded-lg border flex items-center justify-center relative cursor-pointer transition-transform active:scale-95 ${
                      selected ? 'border-white ring-2 ring-cyan-400/60 scale-105' : 'border-slate-700'
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${swatchPrimary} 65%, ${swatchAccent} 100%)`,
                    }}
                  >
                    {selected && <Check size={14} className="text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upgrades Section */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wrench size={13} className="text-cyan-400" /> Performance Upgrades (Stage 1-5)
            </h4>

            {/* Engine / Speed */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-white">Twin-Turbo Engine</span>
                  <span className="font-mono text-slate-400 tabular-nums">Lv {carUpgrades.engine}/5</span>
                </div>
                <div className="flex gap-1 h-2">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={lvl}
                      className={`flex-1 rounded-sm ${
                        lvl <= carUpgrades.engine ? 'bg-red-500' : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {carUpgrades.engine < 5 ? (
                <button
                  type="button"
                  onClick={() => onUpgradePart(baseCar.id, 'engine', upgradeCosts.engine)}
                  disabled={progress.coins < upgradeCosts.engine}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-45 text-white font-mono font-bold text-xs cursor-pointer whitespace-nowrap"
                >
                  +{upgradeCosts.engine} CR
                </button>
              ) : (
                <span className="text-xs font-mono text-emerald-400 font-bold">MAX</span>
              )}
            </div>

            {/* Handling / Tires */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-white">Racing Slicks &amp; Suspension</span>
                  <span className="font-mono text-slate-400 tabular-nums">Lv {carUpgrades.handling}/5</span>
                </div>
                <div className="flex gap-1 h-2">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={lvl}
                      className={`flex-1 rounded-sm ${
                        lvl <= carUpgrades.handling ? 'bg-cyan-500' : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {carUpgrades.handling < 5 ? (
                <button
                  type="button"
                  onClick={() => onUpgradePart(baseCar.id, 'handling', upgradeCosts.handling)}
                  disabled={progress.coins < upgradeCosts.handling}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-45 text-white font-mono font-bold text-xs cursor-pointer whitespace-nowrap"
                >
                  +{upgradeCosts.handling} CR
                </button>
              ) : (
                <span className="text-xs font-mono text-emerald-400 font-bold">MAX</span>
              )}
            </div>

            {/* Nitro Injector */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-white">Nitro Injection Core</span>
                  <span className="font-mono text-slate-400 tabular-nums">Lv {carUpgrades.nitro}/5</span>
                </div>
                <div className="flex gap-1 h-2">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <div
                      key={lvl}
                      className={`flex-1 rounded-sm ${
                        lvl <= carUpgrades.nitro ? 'bg-amber-500' : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {carUpgrades.nitro < 5 ? (
                <button
                  type="button"
                  onClick={() => onUpgradePart(baseCar.id, 'nitro', upgradeCosts.nitro)}
                  disabled={progress.coins < upgradeCosts.nitro}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-45 text-white font-mono font-bold text-xs cursor-pointer whitespace-nowrap"
                >
                  +{upgradeCosts.nitro} CR
                </button>
              ) : (
                <span className="text-xs font-mono text-emerald-400 font-bold">MAX</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
