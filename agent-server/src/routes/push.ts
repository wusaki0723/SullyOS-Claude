import { Router } from 'express';
import { z } from 'zod';
import { requireClientAuth } from '../security/auth.js';
import { asyncRoute, HttpError } from '../utils/errors.js';
import { getVapidPublicKey, isPushConfigured } from '../push/pushService.js';
import { deletePushSubscriptionByEndpoint, upsertPushSubscription } from '../storage/pushStore.js';
import { notifyTaskSettled } from '../push/pushService.js';
import type { AgentTaskRecord } from '../types.js';

export const pushRouter = Router();

const subscriptionSchema = z.object({
  userId: z.string().min(1),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  userAgent: z.string().optional(),
});

pushRouter.get('/push/status', requireClientAuth, (_req, res) => {
  res.json({
    ok: true,
    configured: isPushConfigured(),
    vapidPublicKey: getVapidPublicKey() || null,
  });
});

pushRouter.post('/push/subscriptions', requireClientAuth, asyncRoute(async (req, res) => {
  if (!isPushConfigured()) {
    throw new HttpError(400, 'push_not_configured', 'Agent Server 尚未配置 VAPID 密钥');
  }
  const parsed = subscriptionSchema.parse(req.body);
  const record = await upsertPushSubscription({
    userId: parsed.userId,
    endpoint: parsed.subscription.endpoint,
    keys: parsed.subscription.keys,
    userAgent: parsed.userAgent,
  });
  res.json({ ok: true, subscriptionId: record.id, updatedAt: record.updatedAt });
}));

pushRouter.delete('/push/subscriptions', requireClientAuth, asyncRoute(async (req, res) => {
  const endpoint = typeof req.query.endpoint === 'string' ? req.query.endpoint : '';
  if (!endpoint) throw new HttpError(400, 'missing_endpoint', '缺少 endpoint');
  await deletePushSubscriptionByEndpoint(endpoint);
  res.json({ ok: true });
}));

pushRouter.post('/push/test', requireClientAuth, asyncRoute(async (req, res) => {
  if (!isPushConfigured()) {
    throw new HttpError(400, 'push_not_configured', 'Agent Server 尚未配置 VAPID 密钥');
  }
  const userId = typeof req.body?.userId === 'string' && req.body.userId.trim() ? req.body.userId.trim() : 'local-user';
  const now = Date.now();
  const task: AgentTaskRecord = {
    taskId: `push-test-${now}`,
    userId,
    charId: 'push-test',
    conversationId: 'push-test',
    turnId: 'push-test',
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    meta: { charName: 'SullyOS' },
    response: {
      ok: true,
      content: 'Agent Server 推送测试成功',
      sessionId: 'push-test',
      diagnostics: { durationMs: 0 },
    },
  };
  const result = await notifyTaskSettled(task);
  res.json({ ok: true, ...result });
}));
