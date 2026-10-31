import type {
  Team,
  TeamTask,
  LedgerEntry,
  AntiCheatEvent,
  RoundConfig,
  LeaderboardEntry,
  TeamMember,
} from '../src/types/index.ts';
import { DEFAULT_ROUND_CONFIG, ADMIN_EMAILS } from './defaultConfig.ts';
import * as fs from 'fs';
import * as path from 'path';

// Load Firebase configuration
let firebaseConfig: any = null;
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not load firebase-applet-config.json:', e);
}

// In-memory store for high-speed deterministic transactions, tests & real-time cache
class MemoryStore {
  config: RoundConfig = { ...DEFAULT_ROUND_CONFIG };
  teams: Map<string, Team> = new Map();
  teamTasks: Map<string, Map<string, TeamTask>> = new Map(); // teamId -> taskId -> TeamTask
  ledgers: Map<string, LedgerEntry[]> = new Map(); // teamId -> LedgerEntry[]
  antiCheatEvents: Map<string, AntiCheatEvent[]> = new Map(); // teamId -> AntiCheatEvent[]
  users: Map<string, any> = new Map();
  adminRubrics: Map<string, any> = new Map();

  // Reset helper for testing
  reset() {
    this.config = JSON.parse(JSON.stringify(DEFAULT_ROUND_CONFIG));
    this.teams.clear();
    this.teamTasks.clear();
    this.ledgers.clear();
    this.antiCheatEvents.clear();
    this.users.clear();
    this.adminRubrics.clear();
  }
}

export const memoryStore = new MemoryStore();

// Per-team async mutex to serialize state transitions
const teamLocks: Map<string, Promise<any>> = new Map();

export async function withTeamLock<T>(teamId: string, fn: () => Promise<T>): Promise<T> {
  const currentLock = teamLocks.get(teamId) || Promise.resolve();
  let release: () => void;
  const nextLock = new Promise<void>(res => {
    release = res;
  });
  teamLocks.set(teamId, currentLock.then(() => nextLock));

  try {
    await currentLock;
    return await fn();
  } finally {
    release!();
    if (teamLocks.get(teamId) === nextLock) {
      teamLocks.delete(teamId);
    }
  }
}

export const dbService = {
  // Config
  async getConfig(): Promise<RoundConfig> {
    return memoryStore.config;
  },

  async updateConfig(partial: Partial<RoundConfig>, updatedBy: string): Promise<RoundConfig> {
    memoryStore.config = {
      ...memoryStore.config,
      ...partial,
      penalties: {
        ...memoryStore.config.penalties,
        ...(partial.penalties || {}),
      },
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    return memoryStore.config;
  },

  // Teams
  async getTeam(teamId: string): Promise<Team | null> {
    const team = memoryStore.teams.get(teamId);
    return team ? JSON.parse(JSON.stringify(team)) : null;
  },

  async getTeamByJoinCode(joinCode: string): Promise<Team | null> {
    const code = joinCode.trim().toUpperCase();
    for (const team of memoryStore.teams.values()) {
      if (team.joinCode.toUpperCase() === code) {
        return JSON.parse(JSON.stringify(team));
      }
    }
    return null;
  },

  async getAllTeams(): Promise<Team[]> {
    return Array.from(memoryStore.teams.values()).map(t => JSON.parse(JSON.stringify(t)));
  },

  async saveTeam(team: Team): Promise<void> {
    team.updatedAt = new Date().toISOString();
    memoryStore.teams.set(team.id, JSON.parse(JSON.stringify(team)));
  },

  // Team Tasks
  async getTeamTasks(teamId: string): Promise<TeamTask[]> {
    const map = memoryStore.teamTasks.get(teamId);
    if (!map) return [];
    return Array.from(map.values()).map(t => JSON.parse(JSON.stringify(t)));
  },

  async getTeamTask(teamId: string, taskId: string): Promise<TeamTask | null> {
    const map = memoryStore.teamTasks.get(teamId);
    if (!map) return null;
    const task = map.get(taskId);
    return task ? JSON.parse(JSON.stringify(task)) : null;
  },

  async saveTeamTask(teamId: string, task: TeamTask): Promise<void> {
    let map = memoryStore.teamTasks.get(teamId);
    if (!map) {
      map = new Map();
      memoryStore.teamTasks.set(teamId, map);
    }
    map.set(task.taskId, JSON.parse(JSON.stringify(task)));
  },

  // Append-only Ledger
  async appendLedgerEntry(entry: Omit<LedgerEntry, 'id' | 'timestamp'>): Promise<LedgerEntry> {
    const newEntry: LedgerEntry = {
      id: `ledger_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    let list = memoryStore.ledgers.get(entry.teamId);
    if (!list) {
      list = [];
      memoryStore.ledgers.set(entry.teamId, list);
    }
    list.push(newEntry);
    return newEntry;
  },

  async getTeamLedger(teamId: string): Promise<LedgerEntry[]> {
    const list = memoryStore.ledgers.get(teamId) || [];
    return JSON.parse(JSON.stringify(list));
  },

  // Anti-Cheat Events
  async appendAntiCheatEvent(event: Omit<AntiCheatEvent, 'id' | 'serverTimestamp'>): Promise<AntiCheatEvent> {
    const newEvent: AntiCheatEvent = {
      id: `ace_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      serverTimestamp: new Date().toISOString(),
      ...event,
    };
    let list = memoryStore.antiCheatEvents.get(event.userId);
    if (!list) {
      list = [];
      memoryStore.antiCheatEvents.set(event.userId, list);
    }
    list.push(newEvent);
    return newEvent;
  },

  async getTeamAntiCheatEvents(teamId: string): Promise<AntiCheatEvent[]> {
    // Get team members
    const team = memoryStore.teams.get(teamId);
    if (!team) return [];
    const allEvents: AntiCheatEvent[] = [];
    for (const memberId of team.memberIds) {
      const userEvents = memoryStore.antiCheatEvents.get(memberId) || [];
      allEvents.push(...userEvents);
    }
    allEvents.sort((a, b) => new Date(b.serverTimestamp).getTime() - new Date(a.serverTimestamp).getTime());
    return allEvents;
  },

  // Leaderboard
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const teams = Array.from(memoryStore.teams.values());
    const entries: LeaderboardEntry[] = [];

    for (const t of teams) {
      const tasks = Array.from(memoryStore.teamTasks.get(t.id)?.values() || []);
      const completedCount = tasks.filter(task => task.status === 'SUBMITTED').length;

      entries.push({
        teamId: t.id,
        name: t.name,
        score: t.score,
        totalActiveTimeMs: t.totalActiveTimeMs,
        state: t.state,
        currentTaskId: t.currentTaskId,
        tasksCompleted: completedCount,
        strikes: t.strikes,
        isFlagged: t.isFlagged,
        memberCount: t.members.length,
      });
    }

    // Sort by score desc, tie break by lower totalActiveTimeMs
    entries.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.totalActiveTimeMs - b.totalActiveTimeMs;
    });

    return entries;
  },

  // Admin Rubrics
  async getAdminRubric(taskId: string): Promise<any | null> {
    return memoryStore.adminRubrics.get(taskId) || {
      taskId,
      rubric: `Standard evaluation rubric for ${taskId}. Verify correctness, architectural soundness, and edge-case handling.`,
      solutionKey: `Reference solution specifications and expected system throughput for ${taskId}.`,
      gradingCriteria: ['Correctness (40%)', 'Scalability (30%)', 'Fault Tolerance (20%)', 'Code/Design Clarity (10%)'],
      updatedAt: new Date().toISOString(),
    };
  },

  async saveAdminRubric(taskId: string, rubricData: any): Promise<void> {
    memoryStore.adminRubrics.set(taskId, {
      taskId,
      ...rubricData,
      updatedAt: new Date().toISOString(),
    });
  }
};
