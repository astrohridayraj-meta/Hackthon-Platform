import { Team, TeamTask, LedgerEntry, RoundConfig, LeaderboardEntry } from '../types/index.ts';

export interface CurrentUser {
  uid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

export async function apiRequest<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  user?: CurrentUser | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (user) {
    headers['x-user-id'] = user.uid;
    headers['x-user-email'] = user.email;
    headers['x-user-name'] = user.displayName;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || `HTTP error ${res.status}`, res.status);
  }

  return data as T;
}

export const api = {
  // Config
  getConfig: () => apiRequest<{ config: RoundConfig; serverTime: string }>('/api/config'),

  // Teams
  createTeam: (name: string, user: CurrentUser) =>
    apiRequest<{ team: Team; tasks: TeamTask[] }>('/api/teams/create', 'POST', { name }, user),

  joinTeam: (joinCode: string, user: CurrentUser) =>
    apiRequest<{ team: Team; tasks: TeamTask[] }>('/api/teams/join', 'POST', { joinCode }, user),

  getTeam: (teamId: string, user: CurrentUser) =>
    apiRequest<{ team: Team; tasks: TeamTask[]; ledger: LedgerEntry[] }>(`/api/teams/${teamId}`, 'GET', undefined, user),

  // Mode Selection
  startModeSelect: (teamId: string, user: CurrentUser) =>
    apiRequest<{ team: Team }>(`/api/teams/${teamId}/mode-select`, 'POST', {}, user),

  chooseMode: (teamId: string, mode: 'SEQUENCE' | 'FREE', user: CurrentUser) =>
    apiRequest<{ team: Team; tasks: TeamTask[]; ledger: LedgerEntry[] }>(
      `/api/teams/${teamId}/choose-mode`,
      'POST',
      { mode },
      user
    ),

  // Tasks
  startTask: (teamId: string, taskId: string, user: CurrentUser) =>
    apiRequest<{ team: Team; task: TeamTask }>(`/api/teams/${teamId}/tasks/${taskId}/start`, 'POST', {}, user),

  swapTask: (teamId: string, taskId: string, user: CurrentUser) =>
    apiRequest<{ team: Team; task: TeamTask }>(`/api/teams/${teamId}/tasks/${taskId}/swap`, 'POST', {}, user),

  hopTask: (teamId: string, taskId: string, user: CurrentUser) =>
    apiRequest<{ team: Team; task: TeamTask; tasks: TeamTask[] }>(`/api/teams/${teamId}/tasks/${taskId}/hop`, 'POST', {}, user),

  submitTask: (teamId: string, taskId: string, submissionNotes: string, user: CurrentUser) =>
    apiRequest<{ team: Team; task: TeamTask; tasks: TeamTask[] }>(
      `/api/teams/${teamId}/tasks/${taskId}/submit`,
      'POST',
      { submissionNotes },
      user
    ),

  // Anti-Cheat
  sendAntiCheatEvent: (
    teamId: string,
    event: {
      eventType: string;
      clientSequence: number;
      clientTimestamp: number;
      awayDurationSeconds?: number;
    },
    user: CurrentUser
  ) =>
    apiRequest<{
      team: Team;
      strikeCount: number;
      isStrike: boolean;
      isFlagged: boolean;
      penaltyApplied: number;
    }>(`/api/teams/${teamId}/anticheat/event`, 'POST', event, user),

  // Leaderboard
  getLeaderboard: () => apiRequest<{ leaderboard: LeaderboardEntry[]; serverTime: string }>('/api/leaderboard'),

  // Admin
  getAdminTeams: (user: CurrentUser) =>
    apiRequest<{ teams: (Team & { tasks: TeamTask[]; ledger: LedgerEntry[] })[] }>('/api/admin/teams', 'GET', undefined, user),

  adminGradeTask: (teamId: string, taskId: string, points: number, feedback: string, user: CurrentUser) =>
    apiRequest<{ team: Team; task: TeamTask }>('/api/admin/grade', 'POST', { teamId, taskId, points, feedback }, user),

  adminManualAdjust: (teamId: string, deltaPoints: number, reason: string, user: CurrentUser) =>
    apiRequest<{ team: Team }>('/api/admin/adjust', 'POST', { teamId, deltaPoints, reason }, user),

  adminRoundControl: (action: string, minutesValue: number | undefined, user: CurrentUser) =>
    apiRequest<{ config: RoundConfig }>('/api/admin/round-control', 'POST', { action, minutesValue }, user),

  getAdminRubric: (taskId: string, user: CurrentUser) =>
    apiRequest<{ rubric: any }>(`/api/admin/rubrics/${taskId}`, 'GET', undefined, user),
};
