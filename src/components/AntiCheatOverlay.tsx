import React from 'react';
import { ShieldAlert, Maximize2, AlertTriangle, X, Clock } from 'lucide-react';
import { AntiCheatState } from '../hooks/useAntiCheat.ts';

interface AntiCheatOverlayProps {
  antiCheat: AntiCheatState;
  activeTaskId: string | null;
}

export const AntiCheatOverlay: React.FC<AntiCheatOverlayProps> = ({
  antiCheat,
  activeTaskId,
}) => {
  const {
    isFullscreen,
    isAway,
    awaySeconds,
    strikes,
    isFlagged,
    warningMessage,
    requestFullscreen,
    dismissWarning,
  } = antiCheat;

  const showFullscreenModal = !!activeTaskId && !isFullscreen;

  return (
    <>
      {/* 1. Mandatory Fullscreen Modal when Task is In Progress */}
      {showFullscreenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Maximize2 className="w-7 h-7" />
            </div>

            <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 tracking-wider">
              Anti-Cheat Policy
            </span>

            <h3 className="text-xl font-bold text-white mt-2">Fullscreen Required</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Task <strong>{activeTaskId.toUpperCase()}</strong> is currently in progress. Competitive rules mandate active
              fullscreen mode. Exiting fullscreen or navigating to other windows will trigger away strikes.
            </p>

            <button
              onClick={requestFullscreen}
              className="w-full mt-6 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-lg transition"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Return to Fullscreen Mode</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Away Window Alert Ticker (appears when window loses focus) */}
      {isAway && activeTaskId && (
        <div className="fixed bottom-4 left-4 z-50 p-3.5 rounded-xl bg-red-950/95 border border-red-700 text-red-200 text-xs font-semibold shadow-2xl flex items-center gap-3 animate-pulse">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <span className="font-bold block">Window Focus Lost!</span>
            <span>Away timer: {awaySeconds}s (Strikes trigger if &gt; 3s)</span>
          </div>
        </div>
      )}

      {/* 3. Persistent Notification Warning Banner */}
      {warningMessage && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md p-4 rounded-xl bg-slate-900 border-2 border-amber-500/80 text-white shadow-2xl flex items-start gap-3 animate-in slide-in-from-bottom-2">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-bold text-amber-300 block mb-0.5">Anti-Cheat Alert</span>
            <p className="text-slate-200 leading-relaxed">{warningMessage}</p>
          </div>
          <button
            onClick={dismissWarning}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
};
