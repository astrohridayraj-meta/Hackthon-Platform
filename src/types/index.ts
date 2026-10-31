export type TeamState = 'LOBBY' | 'MODE_SELECT' | 'RUNNING' | 'FINISHED' | 'TIME_UP';
export type GameMode = 'NONE' | 'SEQUENCE' | 'FREE';
export type TaskStatus = 'LOCKED' | 'OFFERED' | 'STARTED' | 'SUBMITTED' | 'HOPPED';

export interface TaskVariant {
  variantId: string;
  prompt: string;
  hints?: string[];
}

export interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  basePoints: number;
  variantPool: TaskVariant[];
}

export interface PenaltyConfig {
  freeModeEntry: number;     // 50
  swapSeq: number;           // 10
  swapFree: number;          // 15
  hop: number;               // 20
  tabStrikePenalty: number;  // 10
  tabStrikeFreeCount: number;// 2 (strikes 1 and 2 are free)
  tabStrikeFlagAt: number;   // 6
  maxSwapsPerTask: number;   // 1
  maxMembersPerTeam: number; // 4
}

export interface RoundConfig {
  roundStart: string;
  roundEnd: string;
  isPaused: boolean;
  penalties: PenaltyConfig;
  tasks: TaskDefinition[];
  updatedAt: string;
  updatedBy: string;
}

export interface TeamMember {
  uid: string;
  email: string;
  displayName: string;
  joinedAt: string;
}

export interface TeamTask {
  taskId: string;
  status: TaskStatus;
  currentVariantIndex: number;
  variantId: string;
  swapsUsed: number;
  startedAt: string | null;
  submittedAt: string | null;
  activeTimeMs: number;
  awardedPoints: number;
  gradedBy: string | null;
  gradedAt: string | null;
  feedback: string | null;
  submissionNotes?: string;
}

export type LedgerType =
  | 'TEAM_CREATED'
  | 'MEMBER_JOINED'
  | 'MODE_SELECTED'
  | 'TASK_OFFERED'
  | 'TASK_STARTED'
  | 'TASK_SWAPPED'
  | 'TASK_HOPPED'
  | 'TASK_SUBMITTED'
  | 'STRIKE_PENALTY'
  | 'POINTS_AWARDED'
  | 'MANUAL_ADJUSTMENT'
  | 'FLAG_ADMIN'
  | 'TEAM_FINISHED'
  | 'TIME_UP';

export interface LedgerEntry {
  id: string;
  teamId: string;
  type: LedgerType;
  deltaPoints: number;
  reason: string;
  taskId?: string;
  actorId: string;
  actorEmail?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AntiCheatEvent {
  id: string;
  eventType: 'visibilitychange' | 'blur' | 'focus' | 'fullscreenchange' | 'paste' | 'strike_applied';
  clientSequence: number;
  clientTimestamp: number;
  serverTimestamp: string;
  awayDurationSeconds?: number;
  isStrike: boolean;
  totalStrikesNow: number;
  teamFlagged: boolean;
  userId: string;
  userEmail: string;
}

export interface Team {
  id: string;
  name: string;
  joinCode: string;
  captainId: string;
  memberIds: string[];
  members: TeamMember[];
  mode: GameMode;
  state: TeamState;
  currentTaskId: string | null;
  score: number;
  totalActiveTimeMs: number;
  strikes: number;
  isFlagged: boolean;
  flagReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardEntry {
  teamId: string;
  name: string;
  score: number;
  totalActiveTimeMs: number;
  state: TeamState;
  currentTaskId: string | null;
  tasksCompleted: number;
  strikes: number;
  isFlagged: boolean;
  memberCount: number;
}
