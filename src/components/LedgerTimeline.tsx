import React from 'react';
import { LedgerEntry } from '../types/index.ts';
import {
  FileText,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  ShieldAlert,
  Award,
  Zap,
} from 'lucide-react';

interface LedgerTimelineProps {
  isOpen: boolean;
  onClose: () => void;
  ledger: LedgerEntry[];
  teamScore: number;
}

export const LedgerTimeline: React.FC<LedgerTimelineProps> = ({
  isOpen,
  onClose,
  ledger,
  teamScore,
}) => {
  if (!isOpen) return null;

  // Format timestamp
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  const getEntryIcon = (type: string, delta: number) => {
    if (delta > 0) return <ArrowUpCircle className="w-4 h-4 text-emerald-400" />;
    if (delta < 0) return <ArrowDownCircle className="w-4 h-4 text-red-400" />;
    if (type.includes('STRIKE')) return <ShieldAlert className="w-4 h-4 text-amber-400" />;
    if (type.includes('GRADE') || type.includes('POINTS')) return <Award className="w-4 h-4 text-indigo-400" />;
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Append-Only Ledger</h3>
              <p className="text-[11px] text-slate-400">Immutable server audit trail</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Net Score Header */}
        <div className="my-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Calculated Score</span>
            <p className="text-xl font-bold font-mono text-amber-400">
              {teamScore > 0 ? `+${teamScore}` : teamScore} pts
            </p>
          </div>
          <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
            {ledger.length} Transactions
          </span>
        </div>

        {/* Timeline Entries List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {ledger.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No transactions recorded in the ledger yet.
            </div>
          ) : (
            [...ledger].reverse().map(item => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:border-slate-600/60 transition"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    {getEntryIcon(item.type, item.deltaPoints)}
                    <span className="text-xs font-bold text-slate-200">{item.type.replace(/_/g, ' ')}</span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                      item.deltaPoints > 0
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : item.deltaPoints < 0
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.deltaPoints > 0 ? `+${item.deltaPoints}` : item.deltaPoints} pts
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.reason}</p>

                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-800">
                  <span>{item.actorEmail || item.actorId}</span>
                  <span>{formatTime(item.timestamp)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
