import React, { useState, useEffect } from 'react';
import { TeamTask, TaskDefinition, GameMode } from '../types/index.ts';
import {
  Lock,
  Play,
  RefreshCw,
  FastForward,
  CheckCircle,
  HelpCircle,
  Clock,
  Award,
  Sparkles,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';

interface TaskCardProps {
  task: TeamTask;
  definition: TaskDefinition;
  teamMode: GameMode;
  isTeamActiveTask: boolean;
  canStartAnyTask: boolean;
  swapPenaltyCost: number;
  hopPenaltyCost: number;
  onStart: (taskId: string) => void;
  onSwap: (taskId: string) => void;
  onHop: (taskId: string) => void;
  onSubmitOpen: (taskId: string) => void;
  disabledActions: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  definition,
  teamMode,
  isTeamActiveTask,
  canStartAnyTask,
  swapPenaltyCost,
  hopPenaltyCost,
  onStart,
  onSwap,
  onHop,
  onSubmitOpen,
  disabledActions,
}) => {
  const [showHints, setShowHints] = useState(false);
  const [activeElapsedSec, setActiveElapsedSec] = useState<number>(0);

  // Active task live stopwatch
  useEffect(() => {
    if (task.status !== 'STARTED' || !task.startedAt) {
      return;
    }

    const interval = setInterval(() => {
      const started = new Date(task.startedAt!).getTime();
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setActiveElapsedSec(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [task.status, task.startedAt]);

  const currentVariant = definition.variantPool[task.currentVariantIndex] || definition.variantPool[0];

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Status Colors & Badge
  const getStatusBadge = () => {
    switch (task.status) {
      case 'LOCKED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            <Lock className="w-3 h-3" /> Locked
          </span>
        );
      case 'OFFERED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse">
            <Sparkles className="w-3 h-3" /> Offered
          </span>
        );
      case 'STARTED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <Clock className="w-3 h-3 animate-spin" /> In Progress
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" /> Submitted
          </span>
        );
      case 'HOPPED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <FastForward className="w-3 h-3" /> Hopped
          </span>
        );
    }
  };

  const isLocked = task.status === 'LOCKED';
  const isStarted = task.status === 'STARTED';
  const isOffered = task.status === 'OFFERED';
  const isTerminal = task.status === 'SUBMITTED' || task.status === 'HOPPED';

  return (
    <div
      className={`rounded-2xl border transition flex flex-col justify-between overflow-hidden shadow-sm ${
        isStarted
          ? 'bg-slate-900 border-emerald-500/60 ring-2 ring-emerald-500/30'
          : isOffered
          ? 'bg-slate-900 border-slate-700 hover:border-slate-600'
          : isLocked
          ? 'bg-slate-950/70 border-slate-800/80 opacity-70'
          : 'bg-slate-900/60 border-slate-800'
      }`}
    >
      {/* Top Banner / Status */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          {getStatusBadge()}
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
            <Award className="w-3.5 h-3.5" />
            <span>{definition.basePoints} pts</span>
          </div>
        </div>

        <h3 className="text-base font-bold text-white tracking-tight leading-snug">{definition.title}</h3>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{definition.description}</p>
      </div>

      {/* Middle Content: Variant Prompt & Live Clock if active */}
      <div className="px-5 py-3 border-t border-b border-slate-800/80 bg-slate-900/40">
        {isStarted && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-mono font-bold mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Active Duration:</span>
            </div>
            <span className="text-base tracking-wider">{formatTimer(activeElapsedSec)}</span>
          </div>
        )}

        {!isLocked ? (
          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
              <span className="text-indigo-400">Assigned Variant:</span>
              <span className="text-[10px] text-slate-500">
                Swaps used: {task.swapsUsed}/1
              </span>
            </div>
            <p className="text-xs text-slate-200 bg-slate-800/70 p-3 rounded-xl border border-slate-700/60 leading-relaxed font-sans">
              {currentVariant.prompt}
            </p>

            {currentVariant.hints && currentVariant.hints.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowHints(!showHints)}
                  className="text-[11px] text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>{showHints ? 'Hide Architectural Hints' : 'View Architectural Hints'}</span>
                </button>
                {showHints && (
                  <ul className="mt-1.5 p-2 rounded-lg bg-slate-800/40 border border-slate-700/40 text-[11px] text-slate-300 list-disc list-inside space-y-0.5">
                    {currentVariant.hints.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
            <Lock className="w-5 h-5 text-slate-600" />
            <span>Task locked in sequence. Progress through earlier tasks to unlock.</span>
          </div>
        )}

        {/* Admin Grade / Feedback Display if graded */}
        {task.awardedPoints > 0 && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs">
            <div className="flex items-center justify-between font-bold text-amber-400 mb-1">
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> Graded by Admin:
              </span>
              <span>
                {task.awardedPoints} / {definition.basePoints} pts
              </span>
            </div>
            {task.feedback && (
              <p className="text-[11px] text-slate-300 italic flex items-start gap-1">
                <MessageSquare className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                <span>"{task.feedback}"</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="p-4 bg-slate-900/80 flex flex-wrap items-center justify-between gap-2">
        {/* If OFFERED: Start Task or Swap */}
        {isOffered && (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onStart(task.taskId)}
                disabled={disabledActions || !canStartAnyTask}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-40 disabled:pointer-events-none"
                title={canStartAnyTask ? 'Start task (requires fullscreen)' : 'Another task is already in progress'}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Task</span>
              </button>

              <button
                type="button"
                onClick={() => onSwap(task.taskId)}
                disabled={disabledActions || task.swapsUsed >= 1}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition disabled:opacity-40 disabled:pointer-events-none"
                title={`Swap to an unseen variant (-${swapPenaltyCost} pts)`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Swap (-{swapPenaltyCost} pts)</span>
              </button>
            </div>

            {/* Hopping: allowed only in SEQUENCE mode */}
            {teamMode === 'SEQUENCE' && (
              <button
                type="button"
                onClick={() => onHop(task.taskId)}
                disabled={disabledActions}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition disabled:opacity-40"
                title={`Skip this task (-${hopPenaltyCost} pts)`}
              >
                <FastForward className="w-3 h-3" />
                <span>Hop (-{hopPenaltyCost} pts)</span>
              </button>
            )}
          </>
        )}

        {/* If STARTED: Submit Task or Hop (if in sequence) */}
        {isStarted && (
          <div className="flex items-center justify-between w-full gap-2">
            <button
              type="button"
              onClick={() => onSubmitOpen(task.taskId)}
              disabled={disabledActions}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Submit Task Solution</span>
            </button>

            {teamMode === 'SEQUENCE' && (
              <button
                type="button"
                onClick={() => onHop(task.taskId)}
                disabled={disabledActions}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition"
                title={`Abandon in-progress task (-${hopPenaltyCost} pts)`}
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Hop (-{hopPenaltyCost} pts)</span>
              </button>
            )}
          </div>
        )}

        {/* If Terminal: SUBMITTED or HOPPED */}
        {isTerminal && (
          <div className="w-full text-right text-xs text-slate-500 font-medium">
            {task.status === 'SUBMITTED' ? (
              <span className="text-emerald-400 flex items-center justify-end gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Solution recorded
              </span>
            ) : (
              <span className="text-amber-500 flex items-center justify-end gap-1">
                <FastForward className="w-3.5 h-3.5" /> Skipped via Hop
              </span>
            )}
          </div>
        )}

        {/* If Locked */}
        {isLocked && (
          <div className="w-full text-right text-xs text-slate-600 font-medium">
            Sequential Lock Active
          </div>
        )}
      </div>
    </div>
  );
};
