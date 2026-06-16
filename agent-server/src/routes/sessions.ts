import { Router } from 'express';
import { resetAllStoredSessions, resetStoredSession } from '../storage/sessionStore.js';
import { requireClientAuth } from '../security/auth.js';
import { asyncRoute } from '../utils/errors.js';

export const sessionsRouter = Router();

sessionsRouter.delete('/session/:userId/:charId', requireClientAuth, asyncRoute(async (req, res) => {
  await resetStoredSession(req.params.userId, req.params.charId);
  res.json({ ok: true });
}));

sessionsRouter.delete('/sessions', requireClientAuth, asyncRoute(async (_req, res) => {
  await resetAllStoredSessions();
  res.json({ ok: true });
}));
