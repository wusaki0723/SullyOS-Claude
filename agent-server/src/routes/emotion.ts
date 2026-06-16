import { Router } from 'express';
import { requireClientAuth } from '../security/auth.js';

export const emotionRouter = Router();

emotionRouter.post('/emotion', requireClientAuth, (_req, res) => {
  res.status(501).json({
    ok: false,
    error: {
      code: 'emotion_not_enabled',
      message: 'Claude Agent SDK 模式第一版暂未启用 emotion eval',
    },
  });
});
