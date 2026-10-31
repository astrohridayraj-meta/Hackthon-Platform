import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, loginWithGoogle, logoutUser } from './lib/firebase.ts';
import { api, CurrentUser } from './lib/api.ts';
import { Team, TeamTask, RoundConfig, LedgerEntry } from './types/index.ts';
import { Header } from './components/Header.tsx';
import { TeamLobby } from './components/TeamLobby.tsx';
import { ModeSelectModal } from './components/ModeSelectModal.tsx';
import { TaskCard } from './components/TaskCard.tsx';
import { TaskSubmitModal } from './components/TaskSubmitModal.tsx';
import { LedgerTimeline } from './components/LedgerTimeline.tsx';
import { LeaderboardModal } from './components/LeaderboardModal.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AntiCheatOverlay } from './components/AntiCheatOverlay.tsx';
import { useAntiCheat } from './hooks/useAntiCheat.ts';
import {
  LogIn,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Shield,
  Layers,
  Flag,
  ListOrdered,
  Grid,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [config, setConfig] = useState<RoundConfig | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  // Navigation tab for Admins: 'participant' or 'admin'
  const [activeTab, setActiveTab] = useState<'participant' | 'admin'>('participant');

  // UI Modals
  const [isModeSelectOpen, setIsModeSelectOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);

  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Monitor Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        const email = fbUser.email || 'participant@hackarena.io';
        const userObj: CurrentUser = {
          uid: fbUser.uid,
          email,
          displayName: fbUser.displayName || email.split('@')[0],
          isAdmin: email.toLowerCase() === 'astrohridayraj@gmail.com' || email.toLowerCase().includes('admin'),
        };
        setCurrentUser(userObj);
      } else {
        // Fallback default user for immediate test access
        const defaultUser: CurrentUser = {
          uid: 'demo_user_1',
          email: 'astrohridayraj@gmail.com', // Admin by default
          displayName: 'Astro Hriday',
          isAdmin: true,
        };
        setCurrentUser(defaultUser);
      }
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  // Fetch Config
  const loadConfig = useCallback(async () => {
    try {
      const res = await api.getConfig();
      setConfig(res.config);
    } catch (e: any) {
      console.error('Failed to load round config:', e);
    }
  }, []);

  // Fetch Team State
  const refreshTeam = useCallback(async () => {
    if (!currentUser) return;
    try {
      if (!team?.id) {
        const res = await api.getAdminTeams(currentUser).catch(() => ({ teams: [] }));
        const myTeam = res.teams?.find(t => t.memberIds.includes(currentUser.uid));
        if (myTeam) {
          setTeam(myTeam);
          setTasks(myTeam.tasks || []);
          setLedger(myTeam.ledger || []);
        }
      } else {
        const teamData = await api.getTeam(team.id, currentUser);
        setTeam(teamData.team);
        setTasks(teamData.tasks);
        setLedger(teamData.ledger);
      }
    } catch (e: any) {
      console.warn('Could not refresh team state:', e);
    }
  }, [currentUser, team?.id]);

  useEffect(() => {
    loadConfig();
    const timer = setInterval(() => {
      loadConfig();
      if (team?.id) refreshTeam();
    }, 4000);
    return () => clearInterval(timer);
  }, [loadConfig, refreshTeam, team?.id]);

  useEffect(() => {
    if (currentUser) {
      refreshTeam();
    }
  }, [currentUser, refreshTeam]);

  // Notifications helper
  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Anti-Cheat Hook
  const activeTaskId = team?.state === 'RUNNING' ? team.currentTaskId : null;
  const antiCheat = useAntiCheat({
    team,
    currentUser,
    activeTaskId,
    penalties: config?.penalties || null,
    onStrikeReceived: (strikeCount, penalty, flagged) => {
      refreshTeam();
      if (flagged) {
        notify(`ALERT: Team reached ${strikeCount} strikes and is flagged for admin review.`);
      } else if (penalty > 0) {
        notify(`PENALTY: Strike #${strikeCount} applied (-${penalty} points).`);
      } else {
        notify(`WARNING: Away event detected. Strike #${strikeCount}/2.`);
      }
    },
  });

  // Actions
  const handleGoogleLogin = async () => {
    try {
      setActionError(null);
      await loginWithGoogle();
    } catch (e: any) {
      setActionError('Google Sign-in failed or was closed. You can also continue as guest.');
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setTeam(null);
    setTasks([]);
    setLedger([]);
  };

  const handleToggleRole = () => {
    if (!currentUser) return;
    const newAdmin = !currentUser.isAdmin;
    setCurrentUser({
      ...currentUser,
      email: newAdmin ? 'astrohridayraj@gmail.com' : 'participant@hackteam.io',
      isAdmin: newAdmin,
    });
    setTeam(null);
    setActiveTab('participant');
    notify(`Switched session role to: ${newAdmin ? 'Admin' : 'Participant'}`);
  };

  const handleCreateTeam = async (name: string) => {
    if (!currentUser) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await api.createTeam(name, currentUser);
      setTeam(res.team);
      setTasks(res.tasks);
      notify(`Team "${res.team.name}" created! Join code: ${res.team.joinCode}`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to create team');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleJoinTeam = async (joinCode: string) => {
    if (!currentUser) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await api.joinTeam(joinCode, currentUser);
      setTeam(res.team);
      setTasks(res.tasks);
      notify(`Successfully joined ${res.team.name}!`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to join team');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleProceedToModeSelect = async () => {
    if (!team || !currentUser) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await api.startModeSelect(team.id, currentUser);
      setTeam(res.team);
      setIsModeSelectOpen(true);
    } catch (err: any) {
      setActionError(err.message || 'Failed to start mode select');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleConfirmMode = async (mode: 'SEQUENCE' | 'FREE') => {
    if (!team || !currentUser) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await api.chooseMode(team.id, mode, currentUser);
      setTeam(res.team);
      setTasks(res.tasks);
      setLedger(res.ledger);
      setIsModeSelectOpen(false);
      notify(`Round started in ${mode} mode!`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to confirm mode');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleStartTask = async (taskId: string) => {
    if (!team || !currentUser) return;
    // Enforce fullscreen before starting task
    if (!document.fullscreenElement) {
      await antiCheat.requestFullscreen();
    }
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await api.startTask(team.id, taskId, currentUser);
      setTeam(res.team);
      setTasks(prev => prev.map(t => (t.taskId === taskId ? res.task : t)));
      notify(`Started task ${taskId}! Clock is running.`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to start task');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSwapTask = async (taskId: string) => {
    if (!team || !currentUser) return;
    const penalty = team.mode === 'FREE' ? config?.penalties.swapFree : config?.penalties.swapSeq;
    if (!window.confirm(`Swap variant for ${taskId}? This will deduct ${penalty} points.`)) {
      return;
    }
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await api.swapTask(team.id, taskId, currentUser);
      setTeam(res.team);
      setTasks(prev => prev.map(t => (t.taskId === taskId ? res.task : t)));
      notify(`Swapped ${taskId} to a new variant (-${penalty} pts)`);
      refreshTeam();
    } catch (err: any) {
      setActionError(err.message || 'Failed to swap task');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleHopTask = async (taskId: string) => {
    if (!team || !currentUser) return;
    const penalty = config?.penalties.hop || 20;
    if (!window.confirm(`Hop task ${taskId}? This will forfeit this problem, deduct ${penalty} points, and unlock the next task.`)) {
      return;
    }
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await api.hopTask(team.id, taskId, currentUser);
      setTeam(res.team);
      setTasks(res.tasks);
      notify(`Hopped ${taskId} (-${penalty} pts). Next task unlocked.`);
      refreshTeam();
    } catch (err: any) {
      setActionError(err.message || 'Failed to hop task');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSubmitTask = async (notes: string) => {
    if (!team || !currentUser || !submittingTaskId) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await api.submitTask(team.id, submittingTaskId, notes, currentUser);
      setTeam(res.team);
      setTasks(res.tasks);
      setSubmittingTaskId(null);
      notify(`Task ${submittingTaskId} solution submitted for admin grading!`);
      refreshTeam();
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit task');
    } finally {
      setLoadingAction(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
          <span className="text-sm font-semibold text-slate-300">Initializing HackArena Platform...</span>
        </div>
      </div>
    );
  }

  const isCaptain = team?.captainId === currentUser?.uid;
  const isRunning = team?.state === 'RUNNING';
  const isFinished = team?.state === 'FINISHED';
  const isModeSelect = team?.state === 'MODE_SELECT';
  const activeTaskObj = tasks.find(t => t.status === 'STARTED');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      {currentUser && (
        <Header
          user={currentUser}
          team={team}
          config={config}
          onLogout={handleLogout}
          onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
          onOpenLedger={() => setIsLedgerOpen(true)}
          onRequestFullscreen={antiCheat.requestFullscreen}
          isFullscreen={antiCheat.isFullscreen}
        />
      )}

      {/* Persistent Anti-Cheat Overlay & Fullscreen Guard */}
      <AntiCheatOverlay antiCheat={antiCheat} activeTaskId={activeTaskId} />

      {/* Floating Notification & Error Banners */}
      <div className="fixed top-20 right-4 z-40 max-w-sm space-y-2 pointer-events-none">
        {notification && (
          <div className="pointer-events-auto p-3.5 rounded-xl bg-indigo-900/90 border border-indigo-700/80 text-white text-xs font-semibold shadow-xl flex items-center gap-2 animate-in slide-in-from-top-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {actionError && (
          <div className="pointer-events-auto p-3.5 rounded-xl bg-red-950/90 border border-red-700/80 text-red-200 text-xs font-medium shadow-xl flex items-start gap-2 animate-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Action Rejected</span>
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-red-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Role & Navigation Switcher Bar */}
        <div className="mb-6 p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-400">Authenticated:</span>
            <strong className="text-white">{currentUser?.email}</strong>
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${currentUser?.isAdmin ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-300'}`}>
              {currentUser?.isAdmin ? 'Admin' : 'Participant'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* If user is admin, allow switching between Participant Workspace & Admin Console */}
            {currentUser?.isAdmin && (
              <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button
                  onClick={() => setActiveTab('participant')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${activeTab === 'participant' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Participant View
                </button>
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${activeTab === 'admin' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Admin Console
                </button>
              </div>
            )}

            <button
              onClick={handleToggleRole}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Toggle between admin and participant email"
            >
              Toggle Role ({currentUser?.isAdmin ? 'To Participant' : 'To Admin'})
            </button>

            <button
              onClick={handleGoogleLogin}
              className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign-In
            </button>
          </div>
        </div>

        {/* Tab 1: Admin Console (if active) */}
        {currentUser?.isAdmin && activeTab === 'admin' ? (
          <AdminDashboard
            user={currentUser}
            config={config}
            onRefreshConfig={loadConfig}
          />
        ) : (
          /* Tab 2: Participant Flow */
          <>
            {/* View 1: Team Lobby (Create, Join, Wait in Lobby) */}
            {(!team || team.state === 'LOBBY') && config && (
              <TeamLobby
                user={currentUser!}
                team={team}
                config={config}
                onCreateTeam={handleCreateTeam}
                onJoinTeam={handleJoinTeam}
                onProceedToModeSelect={handleProceedToModeSelect}
                isCaptain={isCaptain}
                isLoading={loadingAction}
              />
            )}

            {/* View 2: MODE_SELECT State */}
            {team && isModeSelect && config && (
              <div className="max-w-xl mx-auto my-12 p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-white">Mode Selection Underway</h2>
                <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                  Team captain <strong>{team.members.find(m => m.uid === team.captainId)?.displayName}</strong> is
                  selecting between SEQUENCE and FREE mode.
                </p>

                {isCaptain ? (
                  <button
                    onClick={() => setIsModeSelectOpen(true)}
                    className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg transition"
                  >
                    <span>Open Mode Selection Modal</span>
                  </button>
                ) : (
                  <div className="mt-6 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-400">
                    Waiting for captain to lock in the mode...
                  </div>
                )}
              </div>
            )}

            {/* View 3: RUNNING or FINISHED State (Active Competition Grid) */}
            {team && (isRunning || isFinished) && config && (
              <div>
                {/* Status / Mode Banner */}
                <div className="mb-6 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${team.mode === 'FREE' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'}`}>
                      {team.mode === 'FREE' ? <Grid className="w-5 h-5" /> : <ListOrdered className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-white">{team.name}</h2>
                        <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${team.mode === 'FREE' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'}`}>
                          {team.mode} Mode
                        </span>
                        {isFinished && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Finished
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {team.mode === 'SEQUENCE'
                          ? 'Progress sequentially through tasks. Swapping is allowed on offered tasks; hopping unlocks next task.'
                          : 'Free choice: start any offered task in any order. Hopping is prohibited.'}
                      </p>
                    </div>
                  </div>

                  {/* Active task badge */}
                  <div className="flex items-center gap-3">
                    {activeTaskObj ? (
                      <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-xl text-xs text-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>Working on: <strong>{activeTaskObj.taskId.toUpperCase()}</strong></span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/60">
                        Ready to pick a task
                      </div>
                    )}

                    <button
                      onClick={refreshTeam}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Force Sync State"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Flagged Review Warning */}
                {team.isFlagged && (
                  <div className="mb-6 p-4 rounded-xl bg-red-950/80 border border-red-700/80 text-red-200 text-xs flex items-center gap-3 animate-pulse">
                    <Flag className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm text-red-300">Team Flagged for Administrative Review</h4>
                      <p className="text-red-200/90">{team.flagReason || 'Excessive away / tab-switching strikes recorded.'}</p>
                    </div>
                  </div>
                )}

                {/* 8 Tasks Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-5">
                  {config.tasks.map(taskDef => {
                    const teamTask = tasks.find(t => t.taskId === taskDef.id) || {
                      taskId: taskDef.id,
                      status: 'LOCKED',
                      currentVariantIndex: 0,
                      variantId: 'default',
                      swapsUsed: 0,
                      startedAt: null,
                      submittedAt: null,
                      activeTimeMs: 0,
                      awardedPoints: 0,
                      gradedBy: null,
                      gradedAt: null,
                      feedback: null,
                    };

                    return (
                      <TaskCard
                        key={taskDef.id}
                        task={teamTask}
                        definition={taskDef}
                        teamMode={team.mode}
                        isTeamActiveTask={team.currentTaskId === taskDef.id}
                        canStartAnyTask={team.currentTaskId === null && !isFinished}
                        swapPenaltyCost={team.mode === 'FREE' ? config.penalties.swapFree : config.penalties.swapSeq}
                        hopPenaltyCost={config.penalties.hop}
                        onStart={handleStartTask}
                        onSwap={handleSwapTask}
                        onHop={handleHopTask}
                        onSubmitOpen={taskId => setSubmittingTaskId(taskId)}
                        disabledActions={loadingAction || isFinished}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Mode Selection Modal */}
      {config && (
        <ModeSelectModal
          isOpen={isModeSelectOpen}
          onClose={() => setIsModeSelectOpen(false)}
          onConfirmMode={handleConfirmMode}
          config={config}
          isLoading={loadingAction}
        />
      )}

      {/* Task Submission Modal */}
      <TaskSubmitModal
        isOpen={!!submittingTaskId}
        onClose={() => setSubmittingTaskId(null)}
        onSubmit={handleSubmitTask}
        definition={config?.tasks.find(t => t.id === submittingTaskId) || null}
        isLoading={loadingAction}
      />

      {/* Append-Only Ledger Drawer */}
      <LedgerTimeline
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        ledger={ledger}
        teamScore={team?.score || 0}
      />

      {/* Leaderboard Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentTeamId={team?.id}
      />
    </div>
  );
}
