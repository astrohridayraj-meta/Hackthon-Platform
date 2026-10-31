import React, { useState } from 'react';
import { TaskDefinition } from '../types/index.ts';
import { CheckCircle, X, Clock, AlertCircle } from 'lucide-react';

interface TaskSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => Promise<void>;
  definition: TaskDefinition | null;
  isLoading: boolean;
}

export const TaskSubmitModal: React.FC<TaskSubmitModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  definition,
  isLoading,
}) => {
  const [submissionNotes, setSubmissionNotes] = useState('');

  if (!isOpen || !definition) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(submissionNotes);
    setSubmissionNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Submit Task Solution
            </span>
            <h3 className="text-lg font-bold text-white mt-1">{definition.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
            <p>
              In Phase 1, code execution is offline. Summarize your solution architecture, algorithmic invariants, or link
              to repository code for admin manual grading.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Solution Description & Technical Notes
            </label>
            <textarea
              value={submissionNotes}
              onChange={e => setSubmissionNotes(e.target.value)}
              placeholder="Describe your design decisions, throughput benchmarks, edge-case mitigation, and verification results..."
              rows={5}
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isLoading ? 'Submitting...' : 'Confirm Submission'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
