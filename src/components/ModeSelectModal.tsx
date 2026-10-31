import React, { useState } from 'react';
import { GameMode, RoundConfig } from '../types/index.ts';
import {
  ListOrdered,
  Grid,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  X,
  Zap,
} from 'lucide-react';

interface ModeSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmMode: (mode: 'SEQUENCE' | 'FREE') => Promise<void>;
  config: RoundConfig;
  isLoading: boolean;
}

export const ModeSelectModal: React.FC<ModeSelectModalProps> = ({
  isOpen,
  onClose,
  onConfirmMode,
  config,
  isLoading,
}) => {
  const [selectedMode, setSelectedMode] = useState<'SEQUENCE' | 'FREE'>('SEQUENCE');
  const [confirmStep, setConfirmStep] = useState(false);

  if (!isOpen) return null;

  const handleSelect = (mode: 'SEQUENCE' | 'FREE') => {
    setSelectedMode(mode);
  };

  const handleProceed = () => {
    setConfirmStep(true);
  };

  const handleFinalConfirm = async () => {
    await onConfirmMode(selectedMode);
    setConfirmStep(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Irreversible Decision
          </span>
          <h2 className="text-2xl font-bold text-white mt-2">Select Team Game Mode</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            The captain selects the operating mode for the entire team. Once chosen, this mode cannot be altered.
          </p>
        </div>

        {!confirmStep ? (
          <>
            {/* Mode Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* SEQUENCE MODE */}
              <div
                onClick={() => handleSelect('SEQUENCE')}
                className={`cursor-pointer p-5 rounded-xl border transition relative flex flex-col justify-between ${
                  selectedMode === 'SEQUENCE'
                    ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg'
                    : 'bg-slate-800/50 border-slate-700/80 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <ListOrdered className="w-5 h-5" />
                    </div>
                    {selectedMode === 'SEQUENCE' && (
                      <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white">SEQUENCE Mode</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Linear progression. Only the current task is unlocked and OFFERED.
                  </p>

                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300 pb-1 border-b border-slate-700/50">
                      <span className="text-slate-400">Entry Penalty:</span>
                      <strong className="text-emerald-400">0 pts (Free)</strong>
                    </div>
                    <div className="flex justify-between text-slate-300 pb-1 border-b border-slate-700/50">
                      <span className="text-slate-400">Task Swapping:</span>
                      <span className="text-amber-400">-{config.penalties.swapSeq} pts (OFFERED only)</span>
                    </div>
                    <div className="flex justify-between text-slate-300 pb-1 border-b border-slate-700/50">
                      <span className="text-slate-400">Task Hopping:</span>
                      <span className="text-amber-400">-{config.penalties.hop} pts (Allowed)</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Concurrency:</span>
                      <span>1 task at a time</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 text-[11px] text-indigo-300 bg-indigo-950/60 p-2 rounded-lg border border-indigo-900/60">
                  Ideal for steady teams who want hopping flexibility without an initial score penalty.
                </div>
              </div>

              {/* FREE MODE */}
              <div
                onClick={() => handleSelect('FREE')}
                className={`cursor-pointer p-5 rounded-xl border transition relative flex flex-col justify-between ${
                  selectedMode === 'FREE'
                    ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/40 shadow-lg'
                    : 'bg-slate-800/50 border-slate-700/80 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <Grid className="w-5 h-5" />
                    </div>
                    {selectedMode === 'FREE' && (
                      <CheckCircle2 className="w-5 h-5 text-purple-400" />
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white">FREE Mode</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Open choice. All 8 tasks are immediately OFFERED to choose from.
                  </p>

                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300 pb-1 border-b border-slate-700/50">
                      <span className="text-slate-400">Entry Penalty:</span>
                      <strong className="text-red-400">-{config.penalties.freeModeEntry} pts</strong>
                    </div>
                    <div className="flex justify-between text-slate-300 pb-1 border-b border-slate-700/50">
                      <span className="text-slate-400">Task Swapping:</span>
                      <span className="text-amber-400">-{config.penalties.swapFree} pts</span>
                    </div>
                    <div className="flex justify-between text-slate-300 pb-1 border-b border-slate-700/50">
                      <span className="text-slate-400">Task Hopping:</span>
                      <strong className="text-red-400">FORBIDDEN</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Concurrency:</span>
                      <span>1 task at a time</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 text-[11px] text-purple-300 bg-purple-950/60 p-2 rounded-lg border border-purple-900/60">
                  Ideal for specialized teams seeking high-value tasks first, accepting the -50 entry penalty.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={handleProceed}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md transition"
              >
                <span>Continue with {selectedMode} Mode</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          /* Confirmation Warning Step */
          <div className="py-4">
            <div className="p-4 rounded-xl bg-amber-950/50 border border-amber-700/60 text-amber-200 text-xs flex items-start gap-3 mb-6">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-amber-300 mb-1">
                  Final Confirmation: Lock in {selectedMode} Mode
                </h4>
                <p className="text-slate-300">
                  Are you absolutely certain? This will immediately start the competition clock for your team.
                  {selectedMode === 'FREE' && (
                    <span className="block mt-1 font-semibold text-red-300">
                      A penalty of -{config.penalties.freeModeEntry} points will be deducted to the team ledger.
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmStep(false)}
                disabled={isLoading}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition"
              >
                Back to Selection
              </button>
              <button
                type="button"
                onClick={handleFinalConfirm}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                <span>{isLoading ? 'Locking in Mode...' : `Confirm & Start Round (${selectedMode})`}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
