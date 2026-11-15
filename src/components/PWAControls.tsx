/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, WifiOff, Share, X } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWA';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        aria-label="Install Offline App"
        className="min-h-[44px] px-3 rounded-xl bg-cyan-500/15 border border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/25 hover:text-white active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
      >
        <Download size={15} />
        <span>Install</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Install on iOS"
          className="min-h-[44px] px-3 rounded-xl bg-slate-900/80 border border-slate-700/70 text-slate-200 hover:border-cyan-400/60 hover:text-white active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
        >
          <Download size={15} className="text-cyan-400" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-2xl bg-[#111624] border border-slate-700/80 p-5 shadow-2xl text-left text-white">
              <div className="flex items-center justify-between gap-3">
                <h3 id="ios-install-title" className="text-base font-black italic uppercase tracking-wide">
                  Play Offline on iOS
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-300 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-xs text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-cyan-400">1.</span>
                  <span>
                    Tap the <Share size={13} className="inline mx-0.5 text-cyan-400" />{' '}
                    <strong className="text-white">Share</strong> button in Safari&apos;s toolbar.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-cyan-400">2.</span>
                  <span>
                    Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full min-h-[44px] rounded-xl bg-cyan-500 text-slate-950 font-black italic text-xs uppercase tracking-wider hover:bg-cyan-400 transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC<{ isPlaying?: boolean }> = ({ isPlaying = false }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed z-50 pointer-events-none flex items-center gap-2 rounded-lg bg-amber-500/95 px-3 py-1.5 text-[11px] font-bold text-slate-950 shadow-lg whitespace-nowrap ${
        isPlaying ? 'bottom-24 left-3' : 'top-16 left-1/2 -translate-x-1/2'
      }`}
    >
      <WifiOff size={13} className="shrink-0" />
      <span>Offline Mode — Local Cache</span>
    </div>
  );
};
