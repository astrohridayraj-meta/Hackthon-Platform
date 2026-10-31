import React, { useState, useEffect } from 'react';
import { CurrentUser, api } from '../lib/api.ts';
import { Team, TeamTask, RoundConfig, LedgerEntry } from '../types/index.ts';
import {
  Shield,
  Play,
  Pause,
  StopCircle,
  Plus,
  Award,
  Sliders,
  Clock,
  Users,
  Flag,
  FileText,
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle,
  ChevronRight,
  BookOpen,
} from 'lucide-react';

interface AdminDashboardProps {
  user: CurrentUser;
  config: RoundConfig | null;
  onRefreshConfig: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  config,
  onRefreshConfig,
}) => {
  const [teams, setTeams] = useState<(Team & { tasks: TeamTask[]; ledger: LedgerEntry[] })[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<(Team & { tasks: TeamTask[]; ledger: LedgerEntry[] }) | null>(null);

  // Grading Modal State
  const [gradingTaskId, setGradingTaskId] = useState<string | null>(null);
  const [gradePoints, setGradePoints] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState<string>('');

  // Adjustment Modal State
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Rubric Modal State
  const [viewingRubricTaskId, setViewingRubricTaskId] = useState<string | null>(null);
  const [rubricData, setRubricData] = useState<any | null>(null);

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminTeams(user);
      setTeams(res.teams);
      if (selectedTeam) {
        const updated = res.teams.find(t => t.id === selectedTeam.id);
        if (updated) setSelectedTeam(updated);
      }
    } catch (e: any) {
      console.error('Failed to load admin teams:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
    const interval = setInterval(fetchTeams, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRoundControl = async (action: string, minutesValue?: number) => {
    try {
      await api.adminRoundControl(action, minutesValue, user);
      onRefreshConfig();
      setActionMessage(`Round control: ${action} applied successfully.`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !gradingTaskId) return;
    try {
      await api.adminGradeTask(selectedTeam.id, gradingTaskId, gradePoints, gradeFeedback, user);
      setGradingTaskId(null);
      setGradeFeedback('');
      fetchTeams();
      setActionMessage(`Graded ${gradingTaskId}: awarded ${gradePoints} points.`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert(`Grading failed: ${err.message}`);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    try {
      await api.adminManualAdjust(selectedTeam.id, adjustPoints, adjustReason, user);
      setIsAdjustOpen(false);
      setAdjustReason('');
      setAdjustPoints(0);
      fetchTeams();
      setActionMessage(`Adjusted score for ${selectedTeam.name} by ${adjustPoints} pts.`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert(`Adjustment failed: ${err.message}`);
    }
  };

  const handleViewRubric = async (taskId: string) => {
    try {
      setViewingRubricTaskId(taskId);
      const res = await api.getAdminRubric(taskId, user);
      setRubricData(res.rubric);
    } catch (err: any) {
      alert(`Failed to load rubric: ${err.message}`);
    }
  };

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Admin Controls & Status */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Admin Operations Console</h2>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Live Control
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time team oversight, manual grading, score audit adjustments, and round lifecycle controls.
          </p>
        </div>

        {/* Round Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {config?.isPaused ? (
            <button
              onClick={() => handleRoundControl('RESUME')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume Round</span>
            </button>
          ) : (
            <button
              onClick={() => handleRoundControl('PAUSE')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-sm"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Round</span>
            </button>
          )}

          <button
            onClick={() => handleRoundControl('EXTEND_MINUTES', 15)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
          >
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>+15 Mins</span>
          </button>

          <button
            onClick={() => {
              if (window.confirm('End round immediately for all teams?')) {
                handleRoundControl('END_NOW');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 text-xs font-medium transition"
          >
            <StopCircle className="w-3.5 h-3.5" />
            <span>End Round</span>
          </button>

          <button
            onClick={fetchTeams}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh Teams"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Main Grid: Teams Table & Selected Team Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams Table (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Registered Teams ({teams.length})</span>
            </h3>
            <span className="text-[11px] text-slate-500">Click a team to inspect timeline and grade</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-2.5 px-3">Team</th>
                  <th className="py-2.5 px-2">State / Mode</th>
                  <th className="py-2.5 px-2">Current Task</th>
                  <th className="py-2.5 px-2 text-center">Strikes</th>
                  <th className="py-2.5 px-2 text-right">Active Time</th>
                  <th className="py-2.5 px-3 text-right">Score</th>
                  <th className="py-2.5 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {teams.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      No teams registered yet.
                    </td>
                  </tr>
                ) : (
                  teams.map(t => {
                    const isSelected = selectedTeam?.id === t.id;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTeam(t)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-indigo-950/60 font-medium' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold">{t.name}</span>
                            {t.isFlagged && (
                              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                                Flagged
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">Code: {t.joinCode}</span>
                        </td>

                        <td className="py-3 px-2">
                          <span className="text-slate-300 block">{t.state}</span>
                          <span className="text-[10px] text-indigo-400 font-semibold">{t.mode}</span>
                        </td>

                        <td className="py-3 px-2 font-mono">
                          {t.currentTaskId ? (
                            <span className="text-emerald-400 font-semibold">{t.currentTaskId}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        <td className="py-3 px-2 text-center">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded-full ${
                              t.strikes >= 6
                                ? 'bg-red-500/20 text-red-400'
                                : t.strikes > 2
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {t.strikes}
                          </span>
                        </td>

                        <td className="py-3 px-2 text-right font-mono text-slate-400">
                          {formatDuration(t.totalActiveTimeMs)}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                          {t.score > 0 ? `+${t.score}` : t.score}
                        </td>

                        <td className="py-3 px-2 text-right">
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Team Details & Action Panel (1 col) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          {selectedTeam ? (
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white">{selectedTeam.name}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedTeam.members.length} members • Score: {selectedTeam.score} pts
                  </p>
                </div>
                <button
                  onClick={() => setIsAdjustOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Adjust Score</span>
                </button>
              </div>

              {/* Tasks Quick Grading List */}
              <div className="mt-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Tasks Grading Status
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedTeam.tasks.map(t => {
                    const taskDef = config?.tasks.find(d => d.id === t.taskId);
                    return (
                      <div
                        key={t.taskId}
                        className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-200">{t.taskId.toUpperCase()}</span>
                            <span className="text-[10px] px-1.5 rounded bg-slate-700 text-slate-300">
                              {t.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                            {t.swapsUsed > 0 ? `Swapped (${t.variantId})` : `Variant: ${t.variantId}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-amber-400 font-bold">
                            {t.awardedPoints}/{taskDef?.basePoints || 100}
                          </span>
                          <button
                            onClick={() => {
                              setGradingTaskId(t.taskId);
                              setGradePoints(t.awardedPoints);
                              setGradeFeedback(t.feedback || '');
                            }}
                            className="p-1 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition"
                          >
                            Grade
                          </button>
                          <button
                            onClick={() => handleViewRubric(t.taskId)}
                            className="p-1 text-slate-400 hover:text-indigo-400"
                            title="View Grading Rubric"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team Ledger Audit Summary */}
              <div className="mt-5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Audit Ledger ({selectedTeam.ledger.length} events)</span>
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-[11px]">
                  {[...selectedTeam.ledger].reverse().slice(0, 10).map(entry => (
                    <div
                      key={entry.id}
                      className="p-2 rounded-lg bg-slate-800/30 border border-slate-800 flex items-start justify-between gap-2"
                    >
                      <div>
                        <span className="font-semibold text-slate-300">{entry.type}</span>
                        <p className="text-slate-400 leading-tight text-[10px]">{entry.reason}</p>
                      </div>
                      <span
                        className={`font-mono font-bold shrink-0 ${
                          entry.deltaPoints > 0
                            ? 'text-emerald-400'
                            : entry.deltaPoints < 0
                            ? 'text-red-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {entry.deltaPoints > 0 ? `+${entry.deltaPoints}` : entry.deltaPoints}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-20 text-center text-slate-500 text-xs">
              <Users className="w-8 h-8 text-slate-600 mb-2" />
              <span>Select a team from the table to inspect details, grade solutions, or add score adjustments.</span>
            </div>
          )}
        </div>
      </div>

      {/* Manual Grading Modal */}
      {gradingTaskId && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              Grade {gradingTaskId.toUpperCase()} for {selectedTeam.name}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Base points: {config?.tasks.find(t => t.id === gradingTaskId)?.basePoints || 100}
            </p>

            <form onSubmit={handleGradeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Awarded Points (0 .. {config?.tasks.find(t => t.id === gradingTaskId)?.basePoints})
                </label>
                <input
                  type="number"
                  min={0}
                  max={config?.tasks.find(t => t.id === gradingTaskId)?.basePoints || 200}
                  value={gradePoints}
                  onChange={e => setGradePoints(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Feedback Commentary
                </label>
                <textarea
                  value={gradeFeedback}
                  onChange={e => setGradeFeedback(e.target.value)}
                  placeholder="Feedback on correctness, edge cases, and design..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setGradingTaskId(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Save Grade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Score Adjustment Modal */}
      {isAdjustOpen && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              Manual Score Adjustment: {selectedTeam.name}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Logged to the immutable append-only ledger with your admin email ({user.email}).
            </p>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Delta Points (Positive or Negative)
                </label>
                <input
                  type="number"
                  value={adjustPoints}
                  onChange={e => setAdjustPoints(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Audit Reason (Required)
                </label>
                <textarea
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="e.g. Compensation for platform maintenance downtime or bonus for innovation..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Record Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confidential Rubric Viewer Modal */}
      {viewingRubricTaskId && rubricData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs uppercase font-bold text-amber-400">
                Confidential Admin Rubric: {viewingRubricTaskId.toUpperCase()}
              </span>
              <button
                onClick={() => setViewingRubricTaskId(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-slate-300">
              <div>
                <strong className="text-slate-200 block mb-1">Grading Rubric:</strong>
                <p className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60 leading-relaxed">
                  {rubricData.rubric}
                </p>
              </div>
              <div>
                <strong className="text-slate-200 block mb-1">Reference Solution Spec:</strong>
                <p className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60 leading-relaxed font-mono text-[11px]">
                  {rubricData.solutionKey}
                </p>
              </div>
              <div>
                <strong className="text-slate-200 block mb-1">Grading Criteria:</strong>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  {rubricData.gradingCriteria?.map((c: string, i: number) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
