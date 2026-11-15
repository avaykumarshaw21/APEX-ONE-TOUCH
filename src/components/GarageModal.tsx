/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Wrench, Zap, Check, Lock, ChevronRight } from 'lucide-react';
import { CARS } from '../game/tracks';
import { CarStats, PlayerProgress } from '../game/types';

interface GarageModalProps {
  progress: PlayerProgress;
  onSelectCar: (carId: string) => void;
  onUnlockCar: (carId: string, cost: number) => void;
  onUpgradePart: (carId: string, part: 'engine' | 'handling' | 'nitro', cost: number) => void;
  onClose: () => void;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  progress,
  onSelectCar,
  onUnlockCar,
  onUpgradePart,
  onClose,
}) => {
  const selectedCar = CARS.find((c) => c.id === progress.selectedCarId) || CARS[0];
  const carUpgrades = progress.upgrades[selectedCar.id] || { engine: 0, handling: 0, nitro: 0 };

  const upgradeCosts = {
    engine: 120 + carUpgrades.engine * 90,
    handling: 100 + carUpgrades.handling * 80,
    nitro: 90 + carUpgrades.nitro * 75,
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-3 select-none text-white">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/30 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
              <Wrench size={16} />
            </div>
            <div>
              <h2 className="text-base font-black italic tracking-wide uppercase text-white">
                Apex Garage & Tuning
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Upgrade performance parts & unlock supercars
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-slate-950 border border-amber-500/40 text-amber-400 font-mono text-xs font-bold">
              {progress.coins} <span className="text-[10px] text-amber-500 font-normal">CR</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close Garage"
              className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Cars Carousel */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CARS.map((car) => {
              const isUnlocked = progress.unlockedCarIds.includes(car.id);
              const isSelected = progress.selectedCarId === car.id;

              return (
                <div
                  key={car.id}
                  onClick={() => {
                    if (isUnlocked) onSelectCar(car.id);
                  }}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-between text-center relative transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 border-cyan-400 shadow-md shadow-cyan-500/20 scale-102'
                      : isUnlocked
                      ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/80 border-slate-900 opacity-75'
                  }`}
                >
                  <div
                    className="w-12 h-6 rounded flex items-center justify-center my-1 relative shadow"
                    style={{ backgroundColor: car.primaryColor }}
                  >
                    <div
                      className="w-8 h-1.5 rounded"
                      style={{ backgroundColor: car.secondaryColor }}
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
                    <span className="text-[9px] font-mono text-cyan-400 font-bold uppercase mt-1">
                      Active
                    </span>
                  ) : isUnlocked ? (
                    <button
                      onClick={() => onSelectCar(car.id)}
                      className="text-[9px] font-mono text-slate-400 hover:text-white uppercase mt-1"
                    >
                      Drive
                    </button>
                  ) : (
                    <button
                      onClick={() => onUnlockCar(car.id, car.cost)}
                      disabled={progress.coins < car.cost}
                      className="text-[9px] font-mono font-bold text-amber-400 hover:underline uppercase mt-1"
                    >
                      {car.cost} CR
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Car Details & Tuning Upgrades */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Active Car Banner */}
          <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
                Selected Chassis
              </span>
              <h3 className="text-base font-black italic text-white">{selectedCar.name}</h3>
              <p className="text-xs text-slate-400 capitalize">Class: {selectedCar.shapeStyle}</p>
            </div>
            <div
              className="w-16 h-8 rounded-lg flex items-center justify-center shadow-lg"
              style={{ backgroundColor: selectedCar.primaryColor }}
            >
              <div
                className="w-10 h-2 rounded"
                style={{ backgroundColor: selectedCar.secondaryColor }}
              />
            </div>
          </div>

          {/* Upgrades Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wrench size={13} className="text-cyan-400" /> Performance Upgrades (Stage 1-5)
            </h4>

            {/* Engine / Speed */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-white">Twin-Turbo Engine</span>
                  <span className="font-mono text-slate-400">Lv {carUpgrades.engine}/5</span>
                </div>
                {/* Level Pips */}
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
                  onClick={() => onUpgradePart(selectedCar.id, 'engine', upgradeCosts.engine)}
                  disabled={progress.coins < upgradeCosts.engine}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-mono font-bold text-xs"
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
                  <span className="font-bold text-white">Racing Slicks & Suspension</span>
                  <span className="font-mono text-slate-400">Lv {carUpgrades.handling}/5</span>
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
                  onClick={() => onUpgradePart(selectedCar.id, 'handling', upgradeCosts.handling)}
                  disabled={progress.coins < upgradeCosts.handling}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-mono font-bold text-xs"
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
                  <span className="font-mono text-slate-400">Lv {carUpgrades.nitro}/5</span>
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
                  onClick={() => onUpgradePart(selectedCar.id, 'nitro', upgradeCosts.nitro)}
                  disabled={progress.coins < upgradeCosts.nitro}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-mono font-bold text-xs"
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
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
