import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dbService, memoryStore } from './server/db.ts';
import { StateMachineEngine, StateMachineError } from './server/stateMachine.ts';
import { isAdminEmail, ADMIN_EMAILS } from './server/defaultConfig.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Auth & User Extraction Middleware
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    displayName: string;
    isAdmin: boolean;
  };
}

const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Support standard authorization headers or custom client session headers
  const uid = (req.headers['x-user-id'] as string) || req.body?.uid || 'guest_user';
  const email = (req.headers['x-user-email'] as string) || req.body?.email || 'participant@hackarena.io';
  const displayName = (req.headers['x-user-name'] as string) || req.body?.displayName || email.split('@')[0];

  const isAdmin = isAdminEmail(email);

  req.user = {
    uid,
    email: email.toLowerCase(),
    displayName,
    isAdmin,
  };
  next();
};

app.use(authMiddleware);

// ============================================================================
// API ROUTES
// ============================================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Get Config
app.get('/api/config', async (req, res, next) => {
  try {
    const config = await dbService.getConfig();
    res.json({ config, serverTime: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// Create Team
app.post('/api/teams/create', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { name } = req.body;
    const team = await StateMachineEngine.createTeam(name, req.user!);
    const tasks = await dbService.getTeamTasks(team.id);
    res.status(201).json({ team, tasks });
  } catch (err) {
    next(err);
  }
});

// Join Team
app.post('/api/teams/join', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { joinCode } = req.body;
    const team = await StateMachineEngine.joinTeam(joinCode, req.user!);
    const tasks = await dbService.getTeamTasks(team.id);
    res.json({ team, tasks });
  } catch (err) {
    next(err);
  }
});

// Get Team Detail
app.get('/api/teams/:teamId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { teamId } = req.params;
    const team = await dbService.getTeam(teamId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Access control: must be member or admin
    if (!req.user?.isAdmin && !team.memberIds.includes(req.user!.uid)) {
      res.status(403).json({ error: 'Forbidden: You are not a member of this team.' });
      return;
    }

    const tasks = await dbService.getTeamTasks(teamId);
    const ledger = await dbService.getTeamLedger(teamId);
    res.json({ team, tasks, ledger });
  } catch (err) {
    next(err);
  }
});

// Get Team Tasks
app.get('/api/teams/:teamId/tasks', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { teamId } = req.params;
    const team = await dbService.getTeam(teamId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    if (!req.user?.isAdmin && !team.memberIds.includes(req.user!.uid)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const tasks = await dbService.getTeamTasks(teamId);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

// Get Team Ledger
app.get('/api/teams/:teamId/ledger', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { teamId } = req.params;
    const team = await dbService.getTeam(teamId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    if (!req.user?.isAdmin && !team.memberIds.includes(req.user!.uid)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const ledger = await dbService.getTeamLedger(teamId);
    res.json({ ledger });
  } catch (err) {
    next(err);
  }
});

// Advance to Mode Selection (Captain only)
app.post('/api/teams/:teamId/mode-select', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { teamId } = req.params;
    const team = await StateMachineEngine.startModeSelect(teamId, req.user!);
    res.json({ team });
  } catch (err) {
    next(err);
  }
});

// Choose Game Mode (Captain only, Irreversible)
app.post('/api/teams/:teamId/choose-mode', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { teamId } = req.params;
    const { mode } = req.body;
    if (mode !== 'SEQUENCE' && mode !== 'FREE') {
      res.status(400).json({ error: 'Invalid mode. Must be "SEQUENCE" or "FREE".' });
      return;
    }
    const team = await StateMachineEngine.chooseMode(teamId, mode, req.user!);
    const tasks = await dbService.getTeamTasks(teamId);
    const ledger = await dbService.getTeamLedger(teamId);
    res.json({ team, tasks, ledger });
  } catch (err) {
    next(err);
  }
});

// Start Task
app.post('/api/teams/:teamId/tasks/:taskId/start', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { teamId, taskId } = req.params;
    const result = await StateMachineEngine.startTask(teamId, taskId, req.user!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Swap Task
app.post('/api/teams/:teamId/tasks/:taskId/swap', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { teamId, taskId } = req.params;
    const result = await StateMachineEngine.swapTask(teamId, taskId, req.user!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Hop Task
app.post('/api/teams/:teamId/tasks/:taskId/hop', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { teamId, taskId } = req.params;
    const result = await StateMachineEngine.hopTask(teamId, taskId, req.user!);
    const tasks = await dbService.getTeamTasks(teamId);
    res.json({ ...result, tasks });
  } catch (err) {
    next(err);
  }
});

// Submit Task
app.post('/api/teams/:teamId/tasks/:taskId/submit', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { teamId, taskId } = req.params;
    const { submissionNotes } = req.body;
    const result = await StateMachineEngine.submitTask(teamId, taskId, submissionNotes, req.user!);
    const tasks = await dbService.getTeamTasks(teamId);
    res.json({ ...result, tasks });
  } catch (err) {
    next(err);
  }
});

// Anti-Cheat Telemetry Endpoint
app.post('/api/teams/:teamId/anticheat/event', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { teamId } = req.params;
    const { eventType, clientSequence, clientTimestamp, awayDurationSeconds } = req.body;

    const result = await StateMachineEngine.processAntiCheatEvent(
      teamId,
      {
        eventType,
        clientSequence: Number(clientSequence) || 0,
        clientTimestamp: Number(clientTimestamp) || Date.now(),
        awayDurationSeconds: Number(awayDurationSeconds) || 0,
      },
      req.user!
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Leaderboard
app.get('/api/leaderboard', async (req, res, next) => {
  try {
    const leaderboard = await dbService.getLeaderboard();
    res.json({ leaderboard, serverTime: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

// Admin: Get all teams live dashboard
app.get('/api/admin/teams', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    const teams = await dbService.getAllTeams();
    const teamsWithDetails = await Promise.all(
      teams.map(async t => {
        const tasks = await dbService.getTeamTasks(t.id);
        const ledger = await dbService.getTeamLedger(t.id);
        const antiCheatEvents = await dbService.getTeamAntiCheatEvents(t.id);
        return {
          ...t,
          tasks,
          ledger,
          antiCheatEvents,
        };
      })
    );
    res.json({ teams: teamsWithDetails });
  } catch (err) {
    next(err);
  }
});

// Admin: Grade a task
app.post('/api/admin/grade', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    const { teamId, taskId, points, feedback } = req.body;
    const result = await StateMachineEngine.adminAwardPoints(
      teamId,
      taskId,
      Number(points),
      feedback,
      req.user!
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Admin: Manual score adjustment
app.post('/api/admin/adjust', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    const { teamId, deltaPoints, reason } = req.body;
    const team = await StateMachineEngine.adminManualAdjust(
      teamId,
      Number(deltaPoints),
      reason,
      req.user!
    );
    res.json({ team });
  } catch (err) {
    next(err);
  }
});

// Admin: Round Control
app.post('/api/admin/round-control', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    const { action, minutesValue } = req.body;
    const config = await StateMachineEngine.adminRoundControl(action, minutesValue, req.user!);
    res.json({ config });
  } catch (err) {
    next(err);
  }
});

// Admin: Get / Update Rubric
app.get('/api/admin/rubrics/:taskId', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    const { taskId } = req.params;
    const rubric = await dbService.getAdminRubric(taskId);
    res.json({ rubric });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/rubrics/:taskId', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    const { taskId } = req.params;
    const rubricData = req.body;
    await dbService.saveAdminRubric(taskId, rubricData);
    res.json({ success: true, rubricData });
  } catch (err) {
    next(err);
  }
});

// Centralized error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof StateMachineError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ============================================================================
// SERVER INITIALIZATION (Dev with Vite or Production Static)
// ============================================================================
async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const distIndexPath = path.resolve(distPath, 'index.html');
  const hasDist = fs.existsSync(distIndexPath);
  const isProd = process.env.NODE_ENV === 'production' || hasDist;

  if (isProd && hasDist) {
    console.log('[HackArena] Serving production static bundle from:', distPath);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(distIndexPath);
    });
  } else {
    console.log('[HackArena] Initializing Vite middleware mode for development');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false, // HMR disabled in AI Studio environment
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback HTML handler for SPA routes
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }
      try {
        const indexHtmlPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexHtmlPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HackArena] Server listening on http://0.0.0.0:${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
    console.log(`[HackArena] Configured admin emails: ${ADMIN_EMAILS.join(', ')}`);
  });
}

// Only start the server if not imported by test runner
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
  });
}

export { app };
