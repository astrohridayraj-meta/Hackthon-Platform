import React, { useState } from 'react';
import { CurrentUser } from '../lib/api.ts';
import { Team, RoundConfig } from '../types/index.ts';
import {
  Users,
  Copy,
  Check,
  PlusCircle,
  LogIn,
  Crown,
  ShieldCheck,
  ArrowRight,
  Info,
  Clock,
} from 'lucide-react';

interface TeamLobbyProps {
  user: CurrentUser;
  team: Team | null;
  config: RoundConfig;
  onCreateTeam: (name: string) => Promise<void>;
  onJoinTeam: (joinCode: string) => Promise<void>;
  onProceedToModeSelect: () => Promise<void>;
  isCaptain: boolean;
  isLoading: boolean;
}

export const TeamLobby: React.FC<TeamLobbyProps> = ({
  user,
  team,
  config,
  onCreateTeam,
  onJoinTeam,
  onProceedToModeSelect,
  isCaptain,
  isLoading,
}) => {
  const [teamNameInput, setTeamNameInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [actionTab, setActionTab] = useState<'create' | 'join'>('create');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!teamNameInput.trim() || teamNameInput.trim().length < 2) {
      setErrorMessage('Team name must be at least 2 characters.');
      return;
    }
    try {
      await onCreateTeam(teamNameInput.trim());
      setTeamNameInput('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create team');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (joinCodeInput.trim().length !== 6) {
      setErrorMessage('Join code must be exactly 6 characters.');
      return;
    }
    try {
      await onJoinTeam(joinCodeInput.trim().toUpperCase());
      setJoinCodeInput('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to join team');
    }
  };

  // If user is not yet in a team: Show Create or Join
  if (!team) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Team Registration</h2>
          <p className="text-sm text-slate-400 mt-1">
            Form a team of up to {config.penalties.maxMembersPerTeam} members or join an existing team.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-800/80 p-1 rounded-xl mb-6 border border-slate-700/60">
          <button
            onClick={() => {
              setActionTab('create');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
              actionTab === 'create'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create New Team
          </button>
          <button
            onClick={() => {
              setActionTab('join');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
              actionTab === 'join'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Join Existing Team
          </button>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {actionTab === 'create' ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Team Name
              </label>
              <input
                type="text"
                value={teamNameInput}
                onChange={e => setTeamNameInput(e.target.value)}
                placeholder="e.g. Distributed Titans"
                maxLength={40}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                You will be assigned as Captain and receive a 6-character code for your teammates.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md transition disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isLoading ? 'Creating Team...' : 'Create Team & Generate Code'}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                6-Character Join Code
              </label>
              <input
                type="text"
                value={joinCodeInput}
                onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. AB4X9Z"
                maxLength={6}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm tracking-widest font-mono uppercase focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-lg font-bold"
              />
              <p className="text-[11px] text-slate-500 mt-1 text-center">
                Ask your team captain for the 6-character alphanumeric code.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md transition disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoading ? 'Joining Team...' : 'Join Team'}</span>
            </button>
          </form>
        )}
      </div>
    );
  }

  // User is already in a team and state is LOBBY
  return (
    <div className="max-w-2xl mx-auto my-8 p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            Team Lobby
          </span>
          <h2 className="text-2xl font-bold text-white mt-1 tracking-tight">{team.name}</h2>
          <p className="text-xs text-slate-400">Waiting for captain to start mode selection.</p>
        </div>

        {/* 6-Char Join Code Display */}
        <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3.5 py-2 rounded-xl">
          <div className="text-right">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Join Code</span>
            <span className="text-lg font-mono font-black text-indigo-400 tracking-widest">{team.joinCode}</span>
          </div>
          <button
            onClick={() => handleCopyCode(team.joinCode)}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
            title="Copy join code"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Member Roster */}
      <div className="my-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>
              Team Members ({team.members.length} / {config.penalties.maxMembersPerTeam})
            </span>
          </h3>
          <span className="text-[11px] text-slate-500">Real-time sync active</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {team.members.map(member => (
            <div
              key={member.uid}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300">
                  {member.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-slate-200 truncate max-w-[130px]">
                      {member.displayName}
                    </p>
                    {member.uid === team.captainId && (
                      <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Captain" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 truncate max-w-[130px]">{member.email}</p>
                </div>
              </div>

              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Ready
              </span>
            </div>
          ))}

          {/* Empty member slots */}
          {Array.from({ length: config.penalties.maxMembersPerTeam - team.members.length }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="flex items-center justify-center p-3 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 text-slate-600 text-xs font-medium"
            >
              Slot Open ({team.joinCode})
            </div>
          ))}
        </div>
      </div>

      {/* Rules & Warnings */}
      <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-900/50 mb-6">
        <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 mb-1.5">
          <ShieldCheck className="w-4 h-4" /> Hackathon Round Instructions
        </h4>
        <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
          <li>Once the captain selects a game mode, the choice is <strong>strictly irreversible</strong>.</li>
          <li>All members will share live task status, variants, timer, and score in real time.</li>
          <li>Anti-cheat monitoring begins when tasks start. Away time &gt; 3s triggers strikes.</li>
        </ul>
      </div>

      {/* Captain Action */}
      {isCaptain ? (
        <div className="text-right">
          <button
            onClick={onProceedToModeSelect}
            disabled={isLoading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
          >
            <span>Proceed to Mode Selection</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-center text-xs text-slate-400">
          Waiting for team captain to initiate mode selection...
        </div>
      )}
    </div>
  );
};
