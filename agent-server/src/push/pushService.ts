import webpush from 'web-push';
import { config } from '../config.js';
import type { AgentTaskRecord } from '../types.js';
import { listPushSubscriptions, markPushSubscriptionError, markPushSubscriptionSuccess } from '../storage/pushStore.js';
import { logger } from '../utils/logger.js';

function configureVapid(): boolean {
  if (!config.vapidPublicKey || !config.vapidPrivateKey) return false;
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(config.vapidPublicKey && config.vapidPrivateKey);
}

export function getVapidPublicKey(): string | undefined {
  return config.vapidPublicKey;
}

function buildTaskPushPayload(task: AgentTaskRecord): Record<string, unknown> {
  const title = task.meta?.charName || 'SullyOS';
  const body = task.status === 'failed'
    ? '后台回复失败了，打开 SullyOS 查看详情'
    : (task.response?.content || 'Claude Agent 已完成回复').replace(/\s+/g, ' ').trim().slice(0, 160);
  return {
    messageKind: task.status === 'failed' ? 'error' : 'content',
    messageId: task.taskId,
    source: 'sully-agent-server',
    title,
    body,
    contactName: title,
    notification: {
      show: 'always',
      title,
      body,
      tag: `sully-agent-${task.taskId}`,
      data: {
        payload: {
          source: 'sully-agent-server',
          taskId: task.taskId,
          userId: task.userId,
          charId: task.charId,
          conversationId: task.conversationId,
          status: task.status,
        },
      },
    },
    metadata: {
      taskId: task.taskId,
      userId: task.userId,
      charId: task.charId,
      conversationId: task.conversationId,
      status: task.status,
    },
  };
}

export async function notifyTaskSettled(task: AgentTaskRecord): Promise<{ attempted: number; sent: number }> {
  if (!configureVapid()) {
    logger.warn({ taskId: task.taskId }, 'Web Push skipped: VAPID is not configured');
    return { attempted: 0, sent: 0 };
  }
  const subscriptions = await listPushSubscriptions(task.userId);
  const payload = JSON.stringify(buildTaskPushPayload(task));
  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: sub.keys,
      }, payload, { TTL: 60 * 60 });
      sent += 1;
      await markPushSubscriptionSuccess(sub.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markPushSubscriptionError(sub.id, message);
      logger.warn({ userId: task.userId, taskId: task.taskId, subId: sub.id, err: message }, 'Web Push delivery failed');
    }
  }
  logger.info({ userId: task.userId, taskId: task.taskId, attempted: subscriptions.length, sent }, 'Web Push task notification finished');
  return { attempted: subscriptions.length, sent };
}
