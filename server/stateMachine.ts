import type {
  Team,
  TeamTask,
  GameMode,
  RoundConfig,
  LedgerEntry,
  TeamMember,
} from '../src/types/index.ts';
import { dbService, withTeamLock } from './db.ts';
import { isAdminEmail } from './defaultConfig.ts';

// Helper to generate 6-character alphanumeric join code
export function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid visually ambiguous I, O, 0, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class StateMachineError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'StateMachineError';
    this.statusCode = statusCode;
  }
}

export class StateMachineEngine {
  // Validate that round is currently active and unpaused using SERVER clock
  private static validateRoundActive(config: RoundConfig, now = new Date()): void {
    const roundStart = new Date(config.roundStart);
    const roundEnd = new Date(config.roundEnd);

    if (now < roundStart) {
      throw new StateMachineError(`Round has not started yet. Starts at ${config.roundStart}`, 403);
    }
    if (now > roundEnd) {
      throw new StateMachineError(`Round has concluded at ${config.roundEnd}. No further actions permitted.`, 403);
    }
    if (config.isPaused) {
      throw new StateMachineError('Round is currently paused by administrator.', 403);
    }
  }

  // Create Team
  static async createTeam(
    name: string,
    user: { uid: string; email: string; displayName?: string }
  ): Promise<Team> {
    if (!name || name.trim().length < 2) {
      throw new StateMachineError('Team name must be at least 2 characters.', 400);
    }
    const trimmedName = name.trim();

    // Check if user is already in a team
    const allTeams = await dbService.getAllTeams();
    const existing = allTeams.find(t => t.memberIds.includes(user.uid));
    if (existing) {
      throw new StateMachineError(`User is already a member of team "${existing.name}".`, 400);
    }

    // Generate unique 6-char join code
    let joinCode = generateJoinCode();
    while (allTeams.some(t => t.joinCode === joinCode)) {
      joinCode = generateJoinCode();
    }

    const teamId = `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowStr = new Date().toISOString();

    const member: TeamMember = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      joinedAt: nowStr,
    };

    const team: Team = {
      id: teamId,
      name: trimmedName,
      joinCode,
      captainId: user.uid,
      memberIds: [user.uid],
      members: [member],
      mode: 'NONE',
      state: 'LOBBY',
      currentTaskId: null,
      score: 0,
      totalActiveTimeMs: 0,
      strikes: 0,
      isFlagged: false,
      flagReason: null,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    await dbService.saveTeam(team);

    // Initialize 8 tasks for this team in LOCKED status
    const config = await dbService.getConfig();
    for (const tDef of config.tasks) {
      const initialTask: TeamTask = {
        taskId: tDef.id,
        status: 'LOCKED',
        currentVariantIndex: 0,
        variantId: tDef.variantPool[0]?.variantId || 'default',
        swapsUsed: 0,
        startedAt: null,
        submittedAt: null,
        activeTimeMs: 0,
        awardedPoints: 0,
        gradedBy: null,
        gradedAt: null,
        feedback: null,
      };
      await dbService.saveTeamTask(teamId, initialTask);
    }

    // Append ledger entry
    await dbService.appendLedgerEntry({
      teamId,
      type: 'TEAM_CREATED',
      deltaPoints: 0,
      reason: `Team "${trimmedName}" created by captain ${user.email}`,
      actorId: user.uid,
      actorEmail: user.email,
    });

    return team;
  }

  // Join Team with 6-char code
  static async joinTeam(
    joinCode: string,
    user: { uid: string; email: string; displayName?: string }
  ): Promise<Team> {
    if (!joinCode || joinCode.trim().length !== 6) {
      throw new StateMachineError('Join code must be exactly 6 characters.', 400);
    }
    const code = joinCode.trim().toUpperCase();

    const team = await dbService.getTeamByJoinCode(code);
    if (!team) {
      throw new StateMachineError(`No team found with join code "${code}".`, 404);
    }

    return await withTeamLock(team.id, async () => {
      // Re-fetch under lock
      const freshTeam = (await dbService.getTeam(team.id))!;

      // Already member?
      if (freshTeam.memberIds.includes(user.uid)) {
        return freshTeam;
      }

      // Check user not in another team
      const allTeams = await dbService.getAllTeams();
      const existing = allTeams.find(t => t.id !== team.id && t.memberIds.includes(user.uid));
      if (existing) {
        throw new StateMachineError(`User is already a member of team "${existing.name}".`, 400);
      }

      const config = await dbService.getConfig();
      if (freshTeam.members.length >= config.penalties.maxMembersPerTeam) {
        throw new StateMachineError(`Team is full. Maximum ${config.penalties.maxMembersPerTeam} members allowed.`, 400);
      }

      const member: TeamMember = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        joinedAt: new Date().toISOString(),
      };

      freshTeam.members.push(member);
      freshTeam.memberIds.push(user.uid);
      await dbService.saveTeam(freshTeam);

      await dbService.appendLedgerEntry({
        teamId: freshTeam.id,
        type: 'MEMBER_JOINED',
        deltaPoints: 0,
        reason: `${user.email} joined the team`,
        actorId: user.uid,
        actorEmail: user.email,
      });

      return freshTeam;
    });
  }

  // Captain moves team from LOBBY -> MODE_SELECT
  static async startModeSelect(
    teamId: string,
    user: { uid: string; email: string }
  ): Promise<Team> {
    return await withTeamLock(teamId, async () => {
      const team = await dbService.getTeam(teamId);
      if (!team) throw new StateMachineError('Team not found', 404);

      if (team.captainId !== user.uid) {
        throw new StateMachineError('Only the team captain can advance to mode selection.', 403);
      }

      if (team.state !== 'LOBBY') {
        throw new StateMachineError(`Cannot enter mode select from state "${team.state}". Expected "LOBBY".`, 400);
      }

      team.state = 'MODE_SELECT';
      await dbService.saveTeam(team);

      await dbService.appendLedgerEntry({
        teamId: team.id,
        type: 'MODE_SELECTED',
        deltaPoints: 0,
        reason: 'Captain advanced team to Mode Selection',
        actorId: user.uid,
        actorEmail: user.email,
      });

      return team;
    });
  }

  // Choose Game Mode: SEQUENCE or FREE (Captain only, Irreversible)
  static async chooseMode(
    teamId: string,
    mode: 'SEQUENCE' | 'FREE',
    user: { uid: string; email: string }
  ): Promise<Team> {
    return await withTeamLock(teamId, async () => {
      const team = await dbService.getTeam(teamId);
      if (!team) throw new StateMachineError('Team not found', 404);

      if (team.captainId !== user.uid) {
        throw new StateMachineError('Only the team captain can choose the game mode.', 403);
      }

      if (team.state !== 'MODE_SELECT') {
        throw new StateMachineError(`Cannot choose mode when team is in state "${team.state}". Expected "MODE_SELECT".`, 400);
      }

      if (team.mode !== 'NONE') {
        throw new StateMachineError(`Game mode has already been chosen as "${team.mode}" and is irreversible.`, 400);
      }

      const config = await dbService.getConfig();
      this.validateRoundActive(config);

      team.mode = mode;
      team.state = 'RUNNING';

      const tasks = await dbService.getTeamTasks(teamId);

      if (mode === 'FREE') {
        // Apply Free Mode Entry Penalty (-50 points)
        const penalty = config.penalties.freeModeEntry;
        team.score -= penalty;

        await dbService.appendLedgerEntry({
          teamId,
          type: 'MODE_SELECTED',
          deltaPoints: -penalty,
          reason: `FREE mode chosen: deducted freeModeEntry penalty (-${penalty} points)`,
          actorId: user.uid,
          actorEmail: user.email,
        });

        // In FREE mode: all non-terminal tasks become OFFERED
        for (const t of tasks) {
          if (t.status === 'LOCKED') {
            t.status = 'OFFERED';
            await dbService.saveTeamTask(teamId, t);
          }
        }
      } else {
        // In SEQUENCE mode: only task 1 is OFFERED, all others LOCKED
        for (let i = 0; i < tasks.length; i++) {
          const t = tasks[i];
          if (i === 0) {
            t.status = 'OFFERED';
          } else {
            t.status = 'LOCKED';
          }
          await dbService.saveTeamTask(teamId, t);
        }

        await dbService.appendLedgerEntry({
          teamId,
          type: 'MODE_SELECTED',
          deltaPoints: 0,
          reason: 'SEQUENCE mode chosen: Task 1 OFFERED',
          actorId: user.uid,
          actorEmail: user.email,
        });
      }

      await dbService.saveTeam(team);
      return team;
    });
  }

  // Start Task: OFFERED -> STARTED
  // Sets server-side startedAt timestamp and makes swap illegal.
  // Only one task may be STARTED at a time.
  static async startTask(
    teamId: string,
    taskId: string,
    user: { uid: string; email: string }
  ): Promise<{ team: Team; task: TeamTask }> {
    return await withTeamLock(teamId, async () => {
      const team = await dbService.getTeam(teamId);
      if (!team) throw new StateMachineError('Team not found', 404);

      if (!team.memberIds.includes(user.uid)) {
        throw new StateMachineError('You are not a member of this team.', 403);
      }

      if (team.state !== 'RUNNING') {
        throw new StateMachineError(`Cannot start task when team state is "${team.state}". Expected "RUNNING".`, 400);
      }

      const config = await dbService.getConfig();
      this.validateRoundActive(config);

      // Verify no other task is currently STARTED
      if (team.currentTaskId) {
        throw new StateMachineError(
          `Cannot start ${taskId}. Task "${team.currentTaskId}" is already in progress. Only one task may be STARTED at a time.`,
          409
        );
      }

      const task = await dbService.getTeamTask(teamId, taskId);
      if (!task) throw new StateMachineError(`Task "${taskId}" not found.`, 404);

      if (task.status !== 'OFFERED') {
        throw new StateMachineError(`Cannot start task "${taskId}" with status "${task.status}". Expected "OFFERED".`, 400);
      }

      const nowStr = new Date().toISOString();
      task.status = 'STARTED';
      task.startedAt = nowStr;

      team.currentTaskId = taskId;

      await dbService.saveTeamTask(teamId, task);
      await dbService.saveTeam(team);

      await dbService.appendLedgerEntry({
        teamId,
        type: 'TASK_STARTED',
        deltaPoints: 0,
        reason: `Task ${taskId} started by ${user.email} at ${nowStr}`,
        taskId,
        actorId: user.uid,
        actorEmail: user.email,
      });

      return { team, task };
    });
  }

  // Swap Task: Draws unseen variant from task pool, applies penalty.
  // Allowed ONLY while OFFERED (not while STARTED, SUBMITTED, HOPPED, or LOCKED).
  // Max swaps: maxSwapsPerTask (1).
  static async swapTask(
    teamId: string,
    taskId: string,
    user: { uid: string; email: string }
  ): Promise<{ team: Team; task: TeamTask }> {
    return await withTeamLock(teamId, async () => {
      const team = await dbService.getTeam(teamId);
      if (!team) throw new StateMachineError('Team not found', 404);

      if (!team.memberIds.includes(user.uid)) {
        throw new StateMachineError('You are not a member of this team.', 403);
      }

      if (team.state !== 'RUNNING') {
        throw new StateMachineError(`Cannot swap task when team state is "${team.state}".`, 400);
      }

      const config = await dbService.getConfig();
      this.validateRoundActive(config);

      const task = await dbService.getTeamTask(teamId, taskId);
      if (!task) throw new StateMachineError(`Task "${taskId}" not found.`, 404);

      // Swap is STRICTLY illegal once STARTED, or if not OFFERED
      if (task.status !== 'OFFERED') {
        throw new StateMachineError(
          `Cannot swap task "${taskId}". Swaps are strictly permitted only while the task is OFFERED. Current status: "${task.status}".`,
          400
        );
      }

      if (task.swapsUsed >= config.penalties.maxSwapsPerTask) {
        throw new StateMachineError(
          `Maximum swaps (${config.penalties.maxSwapsPerTask}) already reached for task "${taskId}".`,
          400
        );
      }

      const taskDef = config.tasks.find(t => t.id === taskId);
      if (!taskDef || taskDef.variantPool.length <= 1) {
        throw new StateMachineError('No additional variants available in the task pool.', 400);
      }

      // Draw unseen variant
      const nextIndex = (task.currentVariantIndex + 1) % taskDef.variantPool.length;
      const nextVariant = taskDef.variantPool[nextIndex];

      task.currentVariantIndex = nextIndex;
      task.variantId = nextVariant.variantId;
      task.swapsUsed += 1;

      // Calculate penalty based on mode
      const penalty = team.mode === 'FREE' ? config.penalties.swapFree : config.penalties.swapSeq;
      team.score -= penalty;

      await dbService.saveTeamTask(teamId, task);
      await dbService.saveTeam(team);

      await dbService.appendLedgerEntry({
        teamId,
        type: 'TASK_SWAPPED',
        deltaPoints: -penalty,
        reason: `Swapped task ${taskId} to variant ${nextVariant.variantId} in ${team.mode} mode (-${penalty} points)`,
        taskId,
        actorId: user.uid,
        actorEmail: user.email,
      });

      return { team, task };
    });
  }

  // Hop Task: Allowed ONLY in SEQUENCE mode while OFFERED or STARTED.
  // Prohibited in FREE mode.
  // Applies hop penalty (-20), sets task to HOPPED, and unlocks next task in sequence.
  static async hopTask(
    teamId: string,
    taskId: string,
    user: { uid: string; email: string }
  ): Promise<{ team: Team; task: TeamTask }> {
    return await withTeamLock(teamId, async () => {
      const team = await dbService.getTeam(teamId);
      if (!team) throw new StateMachineError('Team not found', 404);

      if (!team.memberIds.includes(user.uid)) {
        throw new StateMachineError('You are not a member of this team.', 403);
      }

      if (team.state !== 'RUNNING') {
        throw new StateMachineError(`Cannot hop task when team state is "${team.state}".`, 400);
      }

      // Prohibited in FREE mode
      if (team.mode === 'FREE') {
        throw new StateMachineError('Hopping is strictly forbidden in FREE mode.', 400);
      }

      const config = await dbService.getConfig();
      this.validateRoundActive(config);

      const task = await dbService.getTeamTask(teamId, taskId);
      if (!task) throw new StateMachineError(`Task "${taskId}" not found.`, 404);

      if (task.status !== 'OFFERED' && task.status !== 'STARTED') {
        throw new StateMachineError(
          `Cannot hop task "${taskId}". Hop is only allowed while OFFERED or STARTED. Current status: "${task.status}".`,
          400
        );
      }

      // If task was STARTED, compute active time up to now
      if (task.status === 'STARTED' && task.startedAt) {
        const elapsed = Math.max(0, Date.now() - new Date(task.startedAt).getTime());
        task.activeTimeMs += elapsed;
        team.totalActiveTimeMs += elapsed;
      }

      task.status = 'HOPPED';
      if (team.currentTaskId === taskId) {
        team.currentTaskId = null;
      }

      // Apply hop penalty
      const penalty = config.penalties.hop;
      team.score -= penalty;

      await dbService.saveTeamTask(teamId, task);

      await dbService.appendLedgerEntry({
        teamId,
        type: 'TASK_HOPPED',
        deltaPoints: -penalty,
        reason: `Hopped task ${taskId} (-${penalty} points)`,
        taskId,
        actorId: user.uid,
        actorEmail: user.email,
      });

      // In SEQUENCE mode: offer the next non-terminal task
      const allTasks = await dbService.getTeamTasks(teamId);
      let nextOffered = false;
      for (const t of allTasks) {
        if (t.status === 'LOCKED') {
          t.status = 'OFFERED';
          await dbService.saveTeamTask(teamId, t);
          nextOffered = true;
          await dbService.appendLedgerEntry({
            teamId,
            type: 'TASK_OFFERED',
            deltaPoints: 0,
            reason: `Sequence progression: Task ${t.taskId} is now OFFERED`,
            taskId: t.taskId,
            actorId: 'system',
          });
          break;
        }
      }

      // If no tasks left to offer, team is finished
      const remaining = allTasks.filter(t => t.status === 'OFFERED' || t.status === 'STARTED' || t.status === 'LOCKED');
      if (!nextOffered && remaining.length === 0) {
        team.state = 'FINISHED';
        await dbService.appendLedgerEntry({
          teamId,
          type: 'TEAM_FINISHED',
          deltaPoints: 0,
          reason: 'Team completed all sequence tasks (all submitted or hopped)',
          actorId: 'system',
        });
      }

      await dbService.saveTeam(team);
      return { team, task };
    });
  }

  // Submit Task: Allowed while STARTED.
  // Records server submittedAt, computes active duration, clears currentTaskId.
  // In SEQUENCE mode, offers next task. In both modes, if all tasks terminal, finishes round.
  static async submitTask(
    teamId: string,
    taskId: string,
    submissionNotes: string,
    user: { uid: string; email: string }
  ): Promise<{ team: Team; task: TeamTask }> {
    return await withTeamLock(teamId, async () => {
      const team = await dbService.getTeam(teamId);
      if (!team) throw new StateMachineError('Team not found', 404);

      if (!team.memberIds.includes(user.uid)) {
        throw new StateMachineError('You are not a member of this team.', 403);
      }

      if (team.state !== 'RUNNING') {
        throw new StateMachineError(`Cannot submit task when team state is "${team.state}".`, 400);
      }

      const config = await dbService.getConfig();
      this.validateRoundActive(config);

      const task = await dbService.getTeamTask(teamId, taskId);
      if (!task) throw new StateMachineError(`Task "${taskId}" not found.`, 404);

      if (task.status !== 'STARTED') {
        throw new StateMachineError(`Cannot submit task "${taskId}" with status "${task.status}". Expected "STARTED".`, 400);
      }

      const now = new Date();
      const nowStr = now.toISOString();

      // Compute active time
      let activeElapsed = 0;
      if (task.startedAt) {
        activeElapsed = Math.max(0, now.getTime() - new Date(task.startedAt).getTime());
      }
      task.activeTimeMs += activeElapsed;
      team.totalActiveTimeMs += activeElapsed;

      task.status = 'SUBMITTED';
      task.submittedAt = nowStr;
      task.submissionNotes = submissionNotes || 'Submitted by participant.';

      team.currentTaskId = null;

      await dbService.saveTeamTask(teamId, task);

      await dbService.appendLedgerEntry({
        teamId,
        type: 'TASK_SUBMITTED',
        deltaPoints: 0,
        reason: `Task ${taskId} submitted by ${user.email}. Active time: ${Math.round(activeElapsed / 1000)}s`,
        taskId,
        actorId: user.uid,
        actorEmail: user.email,
        metadata: { submissionNotes },
      });

      const allTasks = await dbService.getTeamTasks(teamId);

      if (team.mode === 'SEQUENCE') {
        // Unlock next locked task
        let nextOffered = false;
        for (const t of allTasks) {
          if (t.status === 'LOCKED') {
            t.status = 'OFFERED';
            await dbService.saveTeamTask(teamId, t);
            nextOffered = true;
            await dbService.appendLedgerEntry({
              teamId,
              type: 'TASK_OFFERED',
              deltaPoints: 0,
              reason: `Sequence progression: Task ${t.taskId} is now OFFERED`,
              taskId: t.taskId,
              actorId: 'system',
            });
            break;
          }
        }

        const remaining = allTasks.filter(t => t.status === 'OFFERED' || t.status === 'STARTED' || t.status === 'LOCKED');
        if (!nextOffered && remaining.length === 0) {
          team.state = 'FINISHED';
          await dbService.appendLedgerEntry({
            teamId,
            type: 'TEAM_FINISHED',
            deltaPoints: 0,
            reason: 'All sequence tasks finished',
            actorId: 'system',
          });
        }
      } else {
        // FREE mode: check if all 8 tasks are SUBMITTED
        const nonSubmitted = allTasks.filter(t => t.status !== 'SUBMITTED');
        if (nonSubmitted.length === 0) {
          team.state = 'FINISHED';
          await dbService.appendLedgerEntry({
            teamId,
            type: 'TEAM_FINISHED',
            deltaPoints: 0,
            reason: 'All tasks submitted in FREE mode',
            actorId: 'system',
          });
        }
      }

      await dbService.saveTeam(team);
      return { team, task };
    });
  }

  // Anti-Cheat Event Processing
  // Away time > 3s triggers a strike.
  // Strikes 1-2: warn only (0 delta).
  // Strike 3+: apply tabStrikePenalty (-10).
  // At tabStrikeFlagAt (6): flag team for admin review.
  // NEVER auto-disqualify or auto-zero.
  static async processAntiCheatEvent(
    teamId: string,
    eventData: {
      eventType: 'visibilitychange' | 'blur' | 'focus' | 'fullscreenchange' | 'paste';
      clientSequence: number;
      clientTimestamp: number;
      awayDurationSeconds?: number;
    },
    user: { uid: string; email: string }
  ): Promise<{ team: Team; strikeCount: number; isStrike: boolean; isFlagged: boolean; penaltyApplied: number }> {
    return await withTeamLock(teamId, async () => {
      const team = await dbService.getTeam(teamId);
      if (!team) throw new StateMachineError('Team not found', 404);

      if (!team.memberIds.includes(user.uid)) {
        throw new StateMachineError('User not in team', 403);
      }

      const config = await dbService.getConfig();
      const awaySec = eventData.awayDurationSeconds || 0;
      const isStrike = awaySec > 3; // Strike ONLY if away time > 3s
      let penaltyApplied = 0;

      if (isStrike) {
        team.strikes += 1;

        // Strikes 1-2: warn only. From strike 3 onward: apply tabStrikePenalty (10 points)
        if (team.strikes > config.penalties.tabStrikeFreeCount) {
          penaltyApplied = config.penalties.tabStrikePenalty;
          team.score -= penaltyApplied;

          await dbService.appendLedgerEntry({
            teamId,
            type: 'STRIKE_PENALTY',
            deltaPoints: -penaltyApplied,
            reason: `Strike #${team.strikes} for away duration ${awaySec.toFixed(1)}s by ${user.email} (-${penaltyApplied} pts)`,
            actorId: user.uid,
            actorEmail: user.email,
            metadata: { strikes: team.strikes, awaySeconds: awaySec },
          });
        }

        // Check if team reached flag threshold
        if (team.strikes >= config.penalties.tabStrikeFlagAt && !team.isFlagged) {
          team.isFlagged = true;
          team.flagReason = `Flagged for administrator review: reached ${team.strikes} tab/away strikes.`;

          await dbService.appendLedgerEntry({
            teamId,
            type: 'FLAG_ADMIN',
            deltaPoints: 0,
            reason: team.flagReason,
            actorId: 'system',
            metadata: { strikes: team.strikes },
          });
        }
      }

      // Log event
      await dbService.appendAntiCheatEvent({
        eventType: eventData.eventType,
        clientSequence: eventData.clientSequence,
        clientTimestamp: eventData.clientTimestamp,
        awayDurationSeconds: awaySec,
        isStrike,
        totalStrikesNow: team.strikes,
        teamFlagged: team.isFlagged,
        userId: user.uid,
        userEmail: user.email,
      });

      await dbService.saveTeam(team);

      return {
        team,
        strikeCount: team.strikes,
        isStrike,
        isFlagged: team.isFlagged,
        penaltyApplied,
      };
    });
  }

  // Admin: Award points for a task (0..basePoints)
  static async adminAwardPoints(
    teamId: string,
    taskId: string,
    points: number,
    feedback: string,
    adminUser: { uid: string; email: string }
  ): Promise<{ team: Team; task: TeamTask }> {
    if (!isAdminEmail(adminUser.email)) {
      throw new StateMachineError('Unauthorized: Only administrators can grade tasks.', 403);
    }

    return await withTeamLock(teamId, async () => {
      const team = await dbService.getTeam(teamId);
      if (!team) throw new StateMachineError('Team not found', 404);

      const config = await dbService.getConfig();
      const taskDef = config.tasks.find(t => t.id === taskId);
      if (!taskDef) throw new StateMachineError(`Task "${taskId}" definition not found.`, 404);

      if (points < 0 || points > taskDef.basePoints) {
        throw new StateMachineError(
          `Awarded points must be between 0 and basePoints (${taskDef.basePoints}). Received: ${points}`,
          400
        );
      }

      const task = await dbService.getTeamTask(teamId, taskId);
      if (!task) throw new StateMachineError(`Team task "${taskId}" not found.`, 404);

      const previousPoints = task.awardedPoints;
      const pointDifference = points - previousPoints;

      task.awardedPoints = points;
      task.gradedBy = adminUser.email;
      task.gradedAt = new Date().toISOString();
      task.feedback = feedback || null;

      team.score += pointDifference;

      await dbService.saveTeamTask(teamId, task);
      await dbService.saveTeam(team);

      await dbService.appendLedgerEntry({
        teamId,
        type: 'POINTS_AWARDED',
        deltaPoints: pointDifference,
        reason: `Admin ${adminUser.email} graded ${taskId}: awarded ${points}/${taskDef.basePoints} points (${pointDifference >= 0 ? '+' : ''}${pointDifference})`,
        taskId,
        actorId: adminUser.uid,
        actorEmail: adminUser.email,
        metadata: { feedback, points, previousPoints },
      });

      return { team, task };
    });
  }

  // Admin: Add manual score adjustment (logged with admin email)
  static async adminManualAdjust(
    teamId: string,
    deltaPoints: number,
    reason: string,
    adminUser: { uid: string; email: string }
  ): Promise<Team> {
    if (!isAdminEmail(adminUser.email)) {
      throw new StateMachineError('Unauthorized: Only administrators can adjust scores.', 403);
    }

    if (!reason || reason.trim().length === 0) {
      throw new StateMachineError('Adjustment reason is required.', 400);
    }

    return await withTeamLock(teamId, async () => {
      const team = await dbService.getTeam(teamId);
      if (!team) throw new StateMachineError('Team not found', 404);

      team.score += deltaPoints;
      await dbService.saveTeam(team);

      await dbService.appendLedgerEntry({
        teamId,
        type: 'MANUAL_ADJUSTMENT',
        deltaPoints,
        reason: `Admin adjustment by ${adminUser.email}: ${reason} (${deltaPoints >= 0 ? '+' : ''}${deltaPoints} pts)`,
        actorId: adminUser.uid,
        actorEmail: adminUser.email,
        metadata: { deltaPoints, reason },
      });

      return team;
    });
  }

  // Admin: Round Control (Start, Pause, Resume, End, Extend)
  static async adminRoundControl(
    action: 'START_NOW' | 'PAUSE' | 'RESUME' | 'END_NOW' | 'EXTEND_MINUTES',
    minutesValue: number | undefined,
    adminUser: { uid: string; email: string }
  ): Promise<RoundConfig> {
    if (!isAdminEmail(adminUser.email)) {
      throw new StateMachineError('Unauthorized: Only administrators can modify round schedule.', 403);
    }

    const currentConfig = await dbService.getConfig();
    const now = new Date();

    if (action === 'START_NOW') {
      currentConfig.roundStart = now.toISOString();
      currentConfig.isPaused = false;
    } else if (action === 'PAUSE') {
      currentConfig.isPaused = true;
    } else if (action === 'RESUME') {
      currentConfig.isPaused = false;
    } else if (action === 'END_NOW') {
      currentConfig.roundEnd = now.toISOString();
    } else if (action === 'EXTEND_MINUTES') {
      const mins = minutesValue || 15;
      const currentEnd = new Date(currentConfig.roundEnd).getTime();
      currentConfig.roundEnd = new Date(Math.max(now.getTime(), currentEnd) + mins * 60 * 1000).toISOString();
    }

    return await dbService.updateConfig(currentConfig, adminUser.email);
  }
}
