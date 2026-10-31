import { StateMachineEngine, StateMachineError } from '../server/stateMachine.ts';
import { dbService, memoryStore } from '../server/db.ts';

// Simple lightweight test runner to run all unit tests deterministically
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function test(name: string, fn: () => Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (error: any) {
    failedTests++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${error.message}`);
  }
}

export async function runAllStateMachineTests() {
  console.log('\n======================================================');
  console.log('RUNNING HACKARENA STATE MACHINE & SERVER ENDPOINT TESTS');
  console.log('======================================================\n');

  const captain = { uid: 'u_cap', email: 'captain@team.com', displayName: 'Captain Alice' };
  const member2 = { uid: 'u_m2', email: 'm2@team.com', displayName: 'Bob' };
  const member3 = { uid: 'u_m3', email: 'm3@team.com', displayName: 'Charlie' };
  const member4 = { uid: 'u_m4', email: 'm4@team.com', displayName: 'Diana' };
  const member5 = { uid: 'u_m5', email: 'm5@team.com', displayName: 'Evan' };
  const outsider = { uid: 'u_out', email: 'outsider@other.com', displayName: 'Outsider' };
  const admin = { uid: 'u_admin', email: 'astrohridayraj@gmail.com', displayName: 'Admin Hriday' };
  const fakeAdmin = { uid: 'u_impostor', email: 'impostor@hacker.io', displayName: 'Impostor' };

  // --------------------------------------------------------------------------
  // 1. LEGAL TRANSITIONS
  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: LEGAL TRANSITIONS ---');

  await test('Legal 1: Team Creation creates LOBBY state, 6-char code & initializes 8 tasks', async () => {
    memoryStore.reset();
    const team = await StateMachineEngine.createTeam('Quantum Coders', captain);
    assert(team.name === 'Quantum Coders', 'Name matches');
    assert(team.state === 'LOBBY', 'Initial state is LOBBY');
    assert(team.joinCode.length === 6, 'Join code is 6 characters');
    assert(team.captainId === captain.uid, 'Captain assigned');
    assert(team.memberIds.includes(captain.uid), 'Captain in memberIds');
    assert(team.score === 0, 'Initial score is 0');

    const tasks = await dbService.getTeamTasks(team.id);
    assert(tasks.length === 8, '8 tasks initialized');
    assert(tasks.every(t => t.status === 'LOCKED'), 'All 8 tasks start LOCKED');

    const ledger = await dbService.getTeamLedger(team.id);
    assert(ledger.length === 1 && ledger[0].type === 'TEAM_CREATED', 'TEAM_CREATED logged to ledger');
  });

  await test('Legal 2: Joining team with valid code up to max capacity (4)', async () => {
    const team = (await dbService.getAllTeams())[0];
    await StateMachineEngine.joinTeam(team.joinCode, member2);
    await StateMachineEngine.joinTeam(team.joinCode, member3);
    const updated = await StateMachineEngine.joinTeam(team.joinCode, member4);

    assert(updated.members.length === 4, 'Team has 4 members');
    assert(updated.memberIds.includes(member4.uid), 'Member 4 included');
    const ledger = await dbService.getTeamLedger(team.id);
    const joinLogs = ledger.filter(l => l.type === 'MEMBER_JOINED');
    assert(joinLogs.length === 3, '3 MEMBER_JOINED events logged');
  });

  await test('Legal 3: Captain advances team from LOBBY -> MODE_SELECT', async () => {
    const team = (await dbService.getAllTeams())[0];
    const updated = await StateMachineEngine.startModeSelect(team.id, captain);
    assert(updated.state === 'MODE_SELECT', 'State is MODE_SELECT');
  });

  await test('Legal 4: Choosing SEQUENCE mode: state RUNNING, Task 1 OFFERED, others LOCKED', async () => {
    const team = (await dbService.getAllTeams())[0];
    const updated = await StateMachineEngine.chooseMode(team.id, 'SEQUENCE', captain);
    assert(updated.state === 'RUNNING', 'State is RUNNING');
    assert(updated.mode === 'SEQUENCE', 'Mode is SEQUENCE');
    assert(updated.score === 0, 'No entry penalty for SEQUENCE mode');

    const tasks = await dbService.getTeamTasks(team.id);
    assert(tasks[0].status === 'OFFERED', 'Task 1 is OFFERED');
    assert(tasks.slice(1).every(t => t.status === 'LOCKED'), 'Tasks 2-8 remain LOCKED');
  });

  await test('Legal 5: Choosing FREE mode: -50 penalty deducted, all 8 tasks become OFFERED', async () => {
    // Create separate team to test FREE mode
    const freeCaptain = { uid: 'u_free_cap', email: 'free_cap@team.com' };
    const freeTeam = await StateMachineEngine.createTeam('Free Runners', freeCaptain);
    await StateMachineEngine.startModeSelect(freeTeam.id, freeCaptain);
    const chosen = await StateMachineEngine.chooseMode(freeTeam.id, 'FREE', freeCaptain);

    assert(chosen.mode === 'FREE', 'Mode is FREE');
    assert(chosen.state === 'RUNNING', 'State is RUNNING');
    assert(chosen.score === -50, 'Free mode entry penalty of 50 points applied');

    const tasks = await dbService.getTeamTasks(freeTeam.id);
    assert(tasks.every(t => t.status === 'OFFERED'), 'All tasks OFFERED in FREE mode');

    const ledger = await dbService.getTeamLedger(freeTeam.id);
    const freeModeLog = ledger.find(l => l.deltaPoints === -50);
    assert(freeModeLog !== undefined, 'Free mode penalty logged in ledger');
  });

  await test('Legal 6: Starting task from OFFERED -> STARTED sets startedAt and currentTaskId', async () => {
    const team = (await dbService.getAllTeams())[0]; // Sequence team
    const { team: updatedTeam, task } = await StateMachineEngine.startTask(team.id, 'task_1', member2);
    assert(task.status === 'STARTED', 'Task status is STARTED');
    assert(task.startedAt !== null, 'Server startedAt timestamp recorded');
    assert(updatedTeam.currentTaskId === 'task_1', 'Team currentTaskId points to task_1');
  });

  await test('Legal 7: Swapping task in OFFERED status (SEQUENCE mode) applies 10pt penalty & variant change', async () => {
    // In our sequence team, task 1 is already started, so let's test on another team or unlock
    const swapCaptain = { uid: 'u_swap_cap', email: 'swap_cap@team.com' };
    const sTeam = await StateMachineEngine.createTeam('Swap Test Team', swapCaptain);
    await StateMachineEngine.startModeSelect(sTeam.id, swapCaptain);
    await StateMachineEngine.chooseMode(sTeam.id, 'SEQUENCE', swapCaptain);

    const initialScore = (await dbService.getTeam(sTeam.id))!.score;
    const { team: swappedTeam, task } = await StateMachineEngine.swapTask(sTeam.id, 'task_1', swapCaptain);

    assert(task.status === 'OFFERED', 'Task stays OFFERED after swap');
    assert(task.swapsUsed === 1, 'swapsUsed incremented to 1');
    assert(task.variantId === 'v1_b', 'Variant switched from v1_a to v1_b');
    assert(swappedTeam.score === initialScore - 10, '10 points swapSeq penalty applied');
  });

  await test('Legal 8: Swapping task in OFFERED status (FREE mode) applies 15pt swapFree penalty', async () => {
    const freeTeam = (await dbService.getAllTeams()).find(t => t.name === 'Free Runners')!;
    const preScore = (await dbService.getTeam(freeTeam.id))!.score;
    const { team: swappedTeam, task } = await StateMachineEngine.swapTask(freeTeam.id, 'task_2', { uid: 'u_free_cap', email: 'free_cap@team.com' });

    assert(task.swapsUsed === 1, 'swapsUsed is 1');
    assert(swappedTeam.score === preScore - 15, '15 points swapFree penalty applied');
  });

  await test('Legal 9: Hopping task while OFFERED in SEQUENCE mode: applies 20pt penalty, offers next task', async () => {
    const sTeam = (await dbService.getAllTeams()).find(t => t.name === 'Swap Test Team')!;
    const preScore = (await dbService.getTeam(sTeam.id))!.score;
    const { team: hoppedTeam, task } = await StateMachineEngine.hopTask(sTeam.id, 'task_1', { uid: 'u_swap_cap', email: 'swap_cap@team.com' });

    assert(task.status === 'HOPPED', 'Task 1 status is HOPPED');
    assert(hoppedTeam.score === preScore - 20, '20 points hop penalty applied');

    const task2 = await dbService.getTeamTask(sTeam.id, 'task_2');
    assert(task2?.status === 'OFFERED', 'Task 2 was unlocked as OFFERED');
  });

  await test('Legal 10: Hopping task while STARTED in SEQUENCE mode: clears currentTaskId & active time accumulated', async () => {
    const team = (await dbService.getAllTeams())[0]; // task_1 is currently STARTED
    assert(team.currentTaskId === 'task_1', 'task_1 is currentTaskId');

    const { team: updatedTeam, task } = await StateMachineEngine.hopTask(team.id, 'task_1', captain);
    assert(task.status === 'HOPPED', 'Task 1 is HOPPED');
    assert(updatedTeam.currentTaskId === null, 'currentTaskId cleared');
    assert(task.activeTimeMs > 0, 'Active elapsed time accumulated');

    const task2 = await dbService.getTeamTask(team.id, 'task_2');
    assert(task2?.status === 'OFFERED', 'Task 2 is now OFFERED');
  });

  await test('Legal 11: Submitting a STARTED task: records submittedAt, unlocks next task in SEQUENCE', async () => {
    const team = (await dbService.getAllTeams())[0];
    // Start task 2
    await StateMachineEngine.startTask(team.id, 'task_2', member3);
    const { team: afterSubmitTeam, task: submittedTask } = await StateMachineEngine.submitTask(
      team.id,
      'task_2',
      'Implemented sliding partition buffer with dead-letter queue.',
      member3
    );

    assert(submittedTask.status === 'SUBMITTED', 'Status is SUBMITTED');
    assert(submittedTask.submittedAt !== null, 'submittedAt timestamp stamped');
    assert(afterSubmitTeam.currentTaskId === null, 'currentTaskId cleared');

    const task3 = await dbService.getTeamTask(team.id, 'task_3');
    assert(task3?.status === 'OFFERED', 'Task 3 unlocked as OFFERED');
  });

  await test('Legal 12: Anti-Cheat away time > 3s: strikes 1 and 2 warn only with 0 penalty', async () => {
    const team = (await dbService.getAllTeams())[0];
    const initialScore = (await dbService.getTeam(team.id))!.score;

    // Strike 1
    const res1 = await StateMachineEngine.processAntiCheatEvent(
      team.id,
      { eventType: 'visibilitychange', clientSequence: 1, clientTimestamp: Date.now(), awayDurationSeconds: 4.5 },
      member2
    );
    assert(res1.isStrike === true, 'Away 4.5s is a strike');
    assert(res1.strikeCount === 1, 'Strike count is 1');
    assert(res1.penaltyApplied === 0, 'Strike 1 is free warning');
    assert((await dbService.getTeam(team.id))!.score === initialScore, 'Score unchanged');

    // Strike 2
    const res2 = await StateMachineEngine.processAntiCheatEvent(
      team.id,
      { eventType: 'blur', clientSequence: 2, clientTimestamp: Date.now(), awayDurationSeconds: 5.0 },
      member2
    );
    assert(res2.strikeCount === 2, 'Strike count is 2');
    assert(res2.penaltyApplied === 0, 'Strike 2 is free warning');
    assert((await dbService.getTeam(team.id))!.score === initialScore, 'Score unchanged');
  });

  await test('Legal 13: Anti-Cheat Strike 3 applies tabStrikePenalty (-10 points)', async () => {
    const team = (await dbService.getAllTeams())[0];
    const preScore = (await dbService.getTeam(team.id))!.score;

    const res3 = await StateMachineEngine.processAntiCheatEvent(
      team.id,
      { eventType: 'visibilitychange', clientSequence: 3, clientTimestamp: Date.now(), awayDurationSeconds: 3.8 },
      member2
    );
    assert(res3.strikeCount === 3, 'Strike count is 3');
    assert(res3.penaltyApplied === 10, '10 points penalty applied on strike 3');
    assert((await dbService.getTeam(team.id))!.score === preScore - 10, 'Score decreased by 10');
  });

  await test('Legal 14: Anti-Cheat reaching tabStrikeFlagAt (6) flags team for admin review without disqualifying', async () => {
    const team = (await dbService.getAllTeams())[0];

    // Trigger strikes 4, 5, 6
    await StateMachineEngine.processAntiCheatEvent(team.id, { eventType: 'blur', clientSequence: 4, clientTimestamp: Date.now(), awayDurationSeconds: 4 }, member2);
    await StateMachineEngine.processAntiCheatEvent(team.id, { eventType: 'blur', clientSequence: 5, clientTimestamp: Date.now(), awayDurationSeconds: 4 }, member2);
    const res6 = await StateMachineEngine.processAntiCheatEvent(team.id, { eventType: 'blur', clientSequence: 6, clientTimestamp: Date.now(), awayDurationSeconds: 4 }, member2);

    assert(res6.strikeCount === 6, 'Strike count reached 6');
    assert(res6.isFlagged === true, 'Team is flagged for admin review');
    assert(res6.team.state === 'RUNNING', 'Team remains RUNNING (never auto-disqualified)');
    assert(res6.team.score < 0, 'Penalties accumulated without auto-zeroing');
  });

  await test('Legal 15: Admin manual grading awards points (0..basePoints) and updates ledger', async () => {
    const team = (await dbService.getAllTeams())[0];
    const preScore = (await dbService.getTeam(team.id))!.score;

    const { team: gradedTeam, task } = await StateMachineEngine.adminAwardPoints(
      team.id,
      'task_2', // basePoints = 120
      110,
      'Superb idempotent consumer implementation with clean backpressure handling.',
      admin
    );

    assert(task.awardedPoints === 110, 'Task awarded points is 110');
    assert(task.gradedBy === admin.email, 'Graded by admin recorded');
    assert(gradedTeam.score === preScore + 110, 'Team score increased by awarded points');

    const ledger = await dbService.getTeamLedger(team.id);
    const gradeLog = ledger.find(l => l.type === 'POINTS_AWARDED' && l.taskId === 'task_2');
    assert(gradeLog !== undefined && gradeLog.deltaPoints === 110, 'POINTS_AWARDED entry logged');
  });

  await test('Legal 16: Admin manual score adjustment with email and audit reason', async () => {
    const team = (await dbService.getAllTeams())[0];
    const preScore = (await dbService.getTeam(team.id))!.score;

    const updated = await StateMachineEngine.adminManualAdjust(team.id, 25, 'Bonus for exceptional documentation clarity', admin);
    assert(updated.score === preScore + 25, 'Score increased by 25');

    const ledger = await dbService.getTeamLedger(team.id);
    const adjustLog = ledger.find(l => l.type === 'MANUAL_ADJUSTMENT');
    assert(adjustLog?.actorEmail === admin.email, 'Adjustment logged with admin email');
    assert(adjustLog?.deltaPoints === 25, 'Delta points matches');
  });

  await test('Legal 17: Leaderboard ranking sorted by score desc, tie-break by lower active time', async () => {
    const leaderboard = await dbService.getLeaderboard();
    assert(leaderboard.length >= 2, 'Leaderboard contains all teams');
    for (let i = 0; i < leaderboard.length - 1; i++) {
      const a = leaderboard[i];
      const b = leaderboard[i + 1];
      if (a.score === b.score) {
        assert(a.totalActiveTimeMs <= b.totalActiveTimeMs, 'Tie-break by lower active time');
      } else {
        assert(a.score >= b.score, 'Sorted by score descending');
      }
    }
  });

  // --------------------------------------------------------------------------
  // 2. ILLEGAL TRANSITIONS & INVARIANTS
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: ILLEGAL TRANSITIONS & INVARIANTS ---');

  await test('Illegal 18: Reject team creation with invalid name (< 2 chars)', async () => {
    try {
      await StateMachineEngine.createTeam('A', { uid: 'u_solo', email: 'solo@hack.com' });
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err instanceof StateMachineError, 'Expected StateMachineError');
    }
  });

  await test('Illegal 19: Reject user creating a team if already in a team', async () => {
    try {
      await StateMachineEngine.createTeam('Duplicate Team', captain);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('already a member'), 'Rejected with already a member');
    }
  });

  await test('Illegal 20: Reject joining team with non-existent join code', async () => {
    try {
      await StateMachineEngine.joinTeam('ZZZZZZ', outsider);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('No team found'), 'Rejected non-existent code');
    }
  });

  await test('Illegal 21: Reject joining team when team is full (exceeds 4 members)', async () => {
    const fullTeam = (await dbService.getAllTeams())[0];
    assert(fullTeam.members.length === 4, 'Team is at capacity (4)');
    try {
      await StateMachineEngine.joinTeam(fullTeam.joinCode, member5);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('Team is full'), 'Rejected team full');
    }
  });

  await test('Illegal 22: Reject non-captain attempting startModeSelect', async () => {
    const team = (await dbService.getAllTeams())[0];
    try {
      await StateMachineEngine.startModeSelect(team.id, member2);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('Only the team captain'), 'Rejected non-captain');
    }
  });

  await test('Illegal 23: Reject changing mode once chosen (irreversible)', async () => {
    const team = (await dbService.getAllTeams())[0];
    assert(team.mode === 'SEQUENCE', 'Mode already chosen as SEQUENCE');
    try {
      await StateMachineEngine.chooseMode(team.id, 'FREE', captain);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('Cannot choose mode') || err.message.includes('irreversible'), 'Rejected mode modification');
    }
  });

  await test('Illegal 24: Reject starting task when team is in LOBBY or MODE_SELECT', async () => {
    const lobbyCap = { uid: 'u_lcap', email: 'lcap@test.com' };
    const lobbyTeam = await StateMachineEngine.createTeam('Lobby Only', lobbyCap);
    try {
      await StateMachineEngine.startTask(lobbyTeam.id, 'task_1', lobbyCap);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('Expected "RUNNING"'), 'Rejected starting from LOBBY');
    }
  });

  await test('Illegal 25: Reject starting a LOCKED task in SEQUENCE mode', async () => {
    const team = (await dbService.getAllTeams())[0];
    // task_3 is currently OFFERED; task_8 is LOCKED
    try {
      await StateMachineEngine.startTask(team.id, 'task_8', captain);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('Expected "OFFERED"'), 'Rejected starting LOCKED task');
    }
  });

  await test('Illegal 26: Reject starting second task when another task is already STARTED (concurrency lock)', async () => {
    const team = (await dbService.getAllTeams())[0];
    // Start task_3
    await StateMachineEngine.startTask(team.id, 'task_3', member2);
    const freshTeam = (await dbService.getTeam(team.id))!;
    assert(freshTeam.currentTaskId === 'task_3', 'task_3 is active');

    // Attempt to start another task
    try {
      await StateMachineEngine.startTask(team.id, 'task_3', member3);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('already in progress'), 'Rejected concurrent task start');
    }
  });

  await test('Illegal 27: Reject swapping a task that is already STARTED', async () => {
    const team = (await dbService.getAllTeams())[0];
    // task_3 is currently STARTED
    try {
      await StateMachineEngine.swapTask(team.id, 'task_3', member2);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('strictly permitted only while the task is OFFERED'), 'Rejected swap while STARTED');
    }
  });

  await test('Illegal 28: Reject swapping more than maxSwapsPerTask (1)', async () => {
    // In Swap Test Team, task_1 had 1 swap and was hopped. Let's test on task_2
    const sTeam = (await dbService.getAllTeams()).find(t => t.name === 'Swap Test Team')!;
    const sCap = { uid: 'u_swap_cap', email: 'swap_cap@team.com' };

    // Swap task_2 once
    await StateMachineEngine.swapTask(sTeam.id, 'task_2', sCap);

    // Swap task_2 second time -> MUST REJECT
    try {
      await StateMachineEngine.swapTask(sTeam.id, 'task_2', sCap);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('Maximum swaps'), 'Rejected second swap');
    }
  });

  await test('Illegal 29: Reject hopping a task in FREE mode (strictly forbidden)', async () => {
    const freeTeam = (await dbService.getAllTeams()).find(t => t.name === 'Free Runners')!;
    const freeCap = { uid: 'u_free_cap', email: 'free_cap@team.com' };

    try {
      await StateMachineEngine.hopTask(freeTeam.id, 'task_1', freeCap);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('strictly forbidden in FREE mode'), 'Rejected hop in FREE mode');
    }
  });

  await test('Illegal 30: Reject submitting a task that is NOT STARTED (e.g. OFFERED or LOCKED)', async () => {
    const sTeam = (await dbService.getAllTeams()).find(t => t.name === 'Swap Test Team')!;
    const sCap = { uid: 'u_swap_cap', email: 'swap_cap@team.com' };

    // task_2 is OFFERED, not STARTED
    try {
      await StateMachineEngine.submitTask(sTeam.id, 'task_2', 'premature submission', sCap);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('Expected "STARTED"'), 'Rejected submitting unstarted task');
    }
  });

  await test('Illegal 31: Reject any action after roundEnd using SERVER clock', async () => {
    const team = (await dbService.getAllTeams())[0];

    // Temporarily wind server config roundEnd to the past
    const config = await dbService.getConfig();
    const originalEnd = config.roundEnd;
    config.roundEnd = new Date(Date.now() - 1000 * 60).toISOString();
    await dbService.updateConfig(config, 'test');

    try {
      await StateMachineEngine.startTask(team.id, 'task_4', captain);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('Round has concluded'), 'Rejected action after roundEnd');
    } finally {
      // Restore original roundEnd
      config.roundEnd = originalEnd;
      await dbService.updateConfig(config, 'test');
    }
  });

  await test('Illegal 32: Reject any action when round is paused by administrator', async () => {
    const team = (await dbService.getAllTeams())[0];
    const config = await dbService.getConfig();
    config.isPaused = true;
    await dbService.updateConfig(config, 'test');

    try {
      await StateMachineEngine.startTask(team.id, 'task_4', captain);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('Round is currently paused'), 'Rejected action while paused');
    } finally {
      config.isPaused = false;
      await dbService.updateConfig(config, 'test');
    }
  });

  await test('Illegal 33: Reject non-admin attempting to award points or adjust scores', async () => {
    const team = (await dbService.getAllTeams())[0];
    try {
      await StateMachineEngine.adminAwardPoints(team.id, 'task_1', 100, 'cheat', fakeAdmin);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('Only administrators'), 'Rejected non-admin grading');
    }

    try {
      await StateMachineEngine.adminManualAdjust(team.id, 500, 'cheat bonus', fakeAdmin);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('Only administrators'), 'Rejected non-admin adjustment');
    }
  });

  await test('Illegal 34: Reject awarding negative points or points > basePoints', async () => {
    const team = (await dbService.getAllTeams())[0];
    // task_1 basePoints is 100
    try {
      await StateMachineEngine.adminAwardPoints(team.id, 'task_1', 150, 'Too high', admin);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('must be between 0 and basePoints'), 'Rejected points > basePoints');
    }

    try {
      await StateMachineEngine.adminAwardPoints(team.id, 'task_1', -10, 'Negative points', admin);
      assert(false, 'Should have failed');
    } catch (err: any) {
      assert(err.message.includes('must be between 0 and basePoints'), 'Rejected negative points');
    }
  });

  await test('Illegal 35: Anti-Cheat away duration <= 3 seconds must NOT count as a strike', async () => {
    const team = (await dbService.getAllTeams())[0];
    const initialStrikes = (await dbService.getTeam(team.id))!.strikes;

    const res = await StateMachineEngine.processAntiCheatEvent(
      team.id,
      { eventType: 'blur', clientSequence: 99, clientTimestamp: Date.now(), awayDurationSeconds: 2.9 },
      member2
    );

    assert(res.isStrike === false, 'Away 2.9s is NOT a strike');
    assert(res.strikeCount === initialStrikes, 'Strike count did not increase');
    assert((await dbService.getTeam(team.id))!.strikes === initialStrikes, 'DB strikes unchanged');
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    throw new Error(`${failedTests} unit test(s) failed.`);
  }
}

// Auto-run if executed via tsx
if (import.meta.url.endsWith('tests/stateMachine.test.ts')) {
  runAllStateMachineTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
