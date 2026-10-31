import React, { useState, useEffect } from 'react';
import { CurrentUser } from '../lib/api.ts';
import { Team, RoundConfig } from '../types/index.ts';
import {
  Trophy,
  Clock,
  ShieldAlert,
  LogOut,
  Users,
  Maximize2,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
} from 'lucide-react';

interface HeaderProps {
  user: CurrentUser;
  team: Team | null;
  config: RoundConfig | null;
  onLogout: () => void;
  onOpenLeaderboard: () => void;
  onOpenLedger: () => void;
  onRequestFullscreen?: () => void;
  isFullscreen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  team,
  config,
  onLogout,
  onOpenLeaderboard,
  onOpenLedger,
  onRequestFullscreen,
  isFullscreen,
}) => {
  const [timeLeftStr, setTimeLeftStr] = useState<string>('--:--:--');
  const [isRoundEnded, setIsRoundEnded] = useState(false);

  useEffect(() => {
    if (!config?.roundEnd) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const end = new Date(config.roundEnd).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeftStr('00:00:00');
        setIsRoundEnded(true);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeftStr(
          `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
        setIsRoundEnded(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [config?.roundEnd]);

  // Format total active working time
  const formatActiveTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black tracking-wider shadow-inner">
            HA
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base tracking-tight">HackArena</span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Phase 1
              </span>
            </div>
            {team ? (
              <p className="text-xs text-slate-400 truncate max-w-[180px] sm:max-w-xs">
                Team: <strong className="text-slate-200">{team.name}</strong> ({team.joinCode})
              </p>
            ) : (
              <p className="text-xs text-slate-400">Competitive Hackathon Round</p>
            )}
          </div>
        </div>

        {/* Center: Live Round Timer & Status */}
        {config && (
          <div className="hidden md:flex items-center gap-4 bg-slate-800/80 px-4 py-1.5 rounded-lg border border-slate-700/60">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400 animate-pulse" />
              <div className="text-left">
                <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  {config.isPaused ? 'Round Paused' : isRoundEnded ? 'Round Concluded' : 'Round Countdown'}
                </p>
                <p className={`font-mono font-bold text-sm ${config.isPaused ? 'text-amber-400' : isRoundEnded ? 'text-red-400' : 'text-slate-100'}`}>
                  {timeLeftStr}
                </p>
              </div>
            </div>

            {config.isPaused && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <PauseCircle className="w-3.5 h-3.5" /> Paused
              </span>
            )}
          </div>
        )}

        {/* Right Action Bar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {team && (
            <>
              {/* Score Badge */}
              <div
                onClick={onOpenLedger}
                className="cursor-pointer group flex items-center gap-2 bg-indigo-950/70 hover:bg-indigo-900/80 px-3 py-1.5 rounded-lg border border-indigo-700/50 transition-colors"
                title="View Team Transaction Ledger"
              >
                <Trophy className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="text-[10px] uppercase font-semibold text-indigo-300">Score</p>
                  <p className="font-bold text-sm text-amber-400 font-mono">
                    {team.score > 0 ? `+${team.score}` : team.score}
                  </p>
                </div>
              </div>

              {/* Strikes Warning Badge */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
                  team.isFlagged
                    ? 'bg-red-950/80 text-red-300 border-red-700 animate-pulse'
                    : team.strikes > 2
                    ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700'
                }`}
                title={team.isFlagged ? 'Flagged for admin review' : `${team.strikes} away strikes recorded`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{team.strikes} Strikes</span>
              </div>
            </>
          )}

          {/* Leaderboard Button */}
          <button
            onClick={onOpenLeaderboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Rankings</span>
          </button>

          {/* Fullscreen Button */}
          {onRequestFullscreen && !isFullscreen && team?.state === 'RUNNING' && (
            <button
              onClick={onRequestFullscreen}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-medium transition"
              title="Fullscreen required during task work"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Fullscreen</span>
            </button>
          )}

          {/* User Profile & Sign Out */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-medium text-slate-200 truncate max-w-[120px]">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                {user.isAdmin ? (
                  <span className="text-indigo-400 font-semibold">Admin</span>
                ) : (
                  <span>Participant</span>
                )}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
