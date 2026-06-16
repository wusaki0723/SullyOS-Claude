import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    runtime: 'claude-agent-sdk',
    version: '0.1.0',
  });
});
