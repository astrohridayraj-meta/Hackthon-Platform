import React, { useEffect, useState } from 'react';
import { LeaderboardEntry } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { Trophy, X, Clock, Award, ShieldAlert, RefreshCw } from 'lucide-react';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTeamId?: string;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentTeamId,
}) => {
  const [standings, setStandings] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStandings = async () => {
    setLoading(true);
    try {
      const res = await api.getLeaderboard();
      setStandings(res.leaderboard);
    } catch (e) {
      console.error('Failed to load leaderboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStandings();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl p-6 sm:p-7">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Hackathon Standings</h3>
              <p className="text-xs text-slate-400">
                Sorted by net score. Tie-break determined by lowest active task duration.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStandings}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
              title="Refresh Leaderboard"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto mt-4 pr-1">
          {standings.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              No teams on the leaderboard yet. Teams will appear once registered.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-3 px-3">Rank</th>
                  <th className="py-3 px-3">Team Name</th>
                  <th className="py-3 px-3 text-center">Tasks Done</th>
                  <th className="py-3 px-3 text-right">Active Time</th>
                  <th className="py-3 px-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {standings.map((team, idx) => {
                  const isCurrent = team.teamId === currentTeamId;
                  const rank = idx + 1;
                  return (
                    <tr
                      key={team.teamId}
                      className={`transition ${
                        isCurrent ? 'bg-indigo-950/40 font-semibold' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-3">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                            rank === 1
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : rank === 2
                              ? 'bg-slate-300/20 text-slate-200 border border-slate-400/30'
                              : rank === 3
                              ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30'
                              : 'text-slate-400'
                          }`}
                        >
                          {rank}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{team.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300">
                              Your Team
                            </span>
                          )}
                          {team.isFlagged && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-semibold"
                              title="Flagged for admin review"
                            >
                              Review
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          State: {team.state} {team.strikes > 0 ? `• ${team.strikes} strikes` : ''}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-center text-slate-300 font-mono">
                        {team.tasksCompleted} / 8
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono text-slate-400">
                        {formatDuration(team.totalActiveTimeMs)}
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-bold text-sm text-amber-400">
                        {team.score > 0 ? `+${team.score}` : team.score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
