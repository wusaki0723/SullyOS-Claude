import { safeFetchJson } from './safeApi';
import { KeepAlive } from './keepAlive';
import { recordApiCall } from './apiCallLog';
import { bytesToB64u, isDeadPushEndpoint, SUBSCRIBE_SETTLE_MS, subscribeWithRetry } from './pushSubscribeShared';
import type { AgentMessage, AgentMessageRequest, AgentMessageResponse, AgentPermissionPreset, AgentPushStatus, AgentRuntimeConfig, AgentTaskRecord } from '../types/agentRuntime';

const PENDING_TASKS_KEY = 'sully_agent_pending_tasks_v1';

function baseUrl(config: AgentRuntimeConfig): string {
  return (config.agentServerUrl || '').replace(/\/+$/, '');
}

function authHeaders(config: AgentRuntimeConfig): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (config.clientToken?.trim()) {
    headers.Authorization = `Bearer ${config.clientToken.trim()}`;
  }
  return headers;
}

function agentCallMeta(req: AgentMessageRequest, purposeFallback: string) {
  return {
    appName: req.meta?.appName || '消息',
    charId: req.charId,
    charName: req.meta?.charName,
    purpose: req.meta?.purpose || purposeFallback,
  };
}

export async function sendAgentMessage(
  config: AgentRuntimeConfig,
  req: AgentMessageRequest,
): Promise<AgentMessageResponse> {
  if (!config.agentServerUrl?.trim()) {
    throw new Error('请先在设置中配置 Agent Server URL');
  }

  if (config.backgroundTasks || config.pushNotifications) {
    const startedAt = Date.now();
    const taskUrl = `${baseUrl(config)}/api/agent/tasks`;
    let task: AgentTaskRecord | null = null;
    try {
      task = await createAgentTask(config, req);
      rememberPendingAgentTask(task, req);
      const result = await waitForAgentTask(config, task.taskId);
      forgetPendingAgentTask(task.taskId);
      recordApiCall({
        url: taskUrl,
        body: req,
        status: 200,
        ok: true,
        response: result,
        meta: agentCallMeta(req, 'Claude Agent 后台任务'),
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      recordApiCall({
        url: taskUrl,
        body: req,
        ok: false,
        response: error instanceof Error ? { error: { message: error.message } } : undefined,
        meta: agentCallMeta(req, 'Claude Agent 后台任务'),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  const data = await safeFetchJson(`${baseUrl(config)}/api/agent/message`, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify(req),
  }, 1, 0, {
    ...agentCallMeta(req, 'Claude Agent 回复'),
  });

  if (!data?.ok) {
    const msg = data?.error?.message || 'Agent Server 返回失败';
    throw new Error(msg);
  }
  return data as AgentMessageResponse;
}

export async function createAgentTask(
  config: AgentRuntimeConfig,
  req: AgentMessageRequest,
): Promise<AgentTaskRecord> {
  const data = await safeFetchJson(`${baseUrl(config)}/api/agent/tasks`, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify(req),
  }, 1, 0, {
    appName: req.meta?.appName || '消息',
    charId: req.charId,
    charName: req.meta?.charName,
    purpose: req.meta?.purpose || 'Claude Agent 后台任务',
  });
  if (!data?.ok) {
    throw new Error(data?.error?.message || 'Agent Server 创建后台任务失败');
  }
  return {
    taskId: data.taskId,
    userId: req.userId,
    charId: req.charId,
    conversationId: req.conversationId,
    turnId: req.turnId,
    status: data.status || 'queued',
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.createdAt || Date.now(),
    meta: req.meta,
  };
}

export async function getAgentTask(config: AgentRuntimeConfig, taskId: string): Promise<AgentTaskRecord> {
  const res = await fetch(`${baseUrl(config)}/api/agent/tasks/${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: authHeaders(config),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error?.message || `后台任务查询失败 HTTP ${res.status}`);
  }
  return data.task as AgentTaskRecord;
}

export async function listAgentTasks(
  config: AgentRuntimeConfig,
  input: { userId?: string; charId?: string; status?: string; since?: number; limit?: number } = {},
): Promise<AgentTaskRecord[]> {
  const params = new URLSearchParams();
  if (input.userId) params.set('userId', input.userId);
  if (input.charId) params.set('charId', input.charId);
  if (input.status) params.set('status', input.status);
  if (input.since) params.set('since', String(input.since));
  if (input.limit) params.set('limit', String(input.limit));
  const res = await fetch(`${baseUrl(config)}/api/agent/tasks?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders(config),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error?.message || `后台任务列表失败 HTTP ${res.status}`);
  }
  return Array.isArray(data.tasks) ? data.tasks as AgentTaskRecord[] : [];
}

async function waitForAgentTask(config: AgentRuntimeConfig, taskId: string): Promise<AgentMessageResponse> {
  const started = Date.now();
  let waitMs = 900;
  while (Date.now() - started < 10 * 60 * 1000) {
    const task = await getAgentTask(config, taskId);
    if (task.status === 'completed' && task.response) return task.response;
    if (task.status === 'failed') {
      throw new Error(task.error?.message || '后台 Agent 任务失败');
    }
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    waitMs = Math.min(3000, Math.round(waitMs * 1.25));
  }
  throw new Error('后台 Agent 任务仍在运行，请稍后回到聊天页恢复结果');
}

export function rememberPendingAgentTask(task: AgentTaskRecord, req: AgentMessageRequest): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const list = getPendingAgentTasks();
    const next = [
      {
        taskId: task.taskId,
        userId: req.userId,
        charId: req.charId,
        conversationId: req.conversationId,
        turnId: req.turnId,
        createdAt: task.createdAt,
        charName: req.meta?.charName,
      },
      ...list.filter((x) => x.taskId !== task.taskId),
    ].slice(0, 50);
    localStorage.setItem(PENDING_TASKS_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export function forgetPendingAgentTask(taskId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const next = getPendingAgentTasks().filter((x) => x.taskId !== taskId);
    localStorage.setItem(PENDING_TASKS_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export function getPendingAgentTasks(): Array<{
  taskId: string;
  userId: string;
  charId: string;
  conversationId: string;
  turnId: string;
  createdAt: number;
  charName?: string;
}> {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_TASKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function sendAgentText(
  config: AgentRuntimeConfig,
  input: {
    userId: string;
    charId: string;
    conversationId?: string;
    prompt: string;
    systemPrompt?: string;
    sessionId?: string;
    appName?: string;
    purpose?: string;
    charName?: string;
    userName?: string;
    temperature?: number;
    maxTurns?: number;
    permissionPreset?: AgentPermissionPreset;
    enabledTools?: string[];
  },
): Promise<string> {
  const systemPrompt = input.systemPrompt || '你正在作为 SullyOS 的 Claude Agent 后端执行一次应用内文本任务。只输出应用需要的结果正文。';
  const cleanedApiMessages: AgentMessage[] = [{ role: 'user', content: input.prompt }];
  const fullMessages: AgentMessage[] = [
    { role: 'system', content: systemPrompt },
    ...cleanedApiMessages,
  ];
  const result = await sendAgentMessage(config, {
    userId: input.userId || 'local-user',
    charId: input.charId,
    conversationId: input.conversationId || input.charId,
    turnId: (globalThis.crypto?.randomUUID?.() || `agent-task-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    fullMessages,
    systemPrompt,
    cleanedApiMessages,
    latestUserMessage: input.prompt,
    sessionId: input.sessionId,
    options: {
      model: config.model,
      maxTurns: input.maxTurns ?? config.maxTurns ?? 1,
      temperature: input.temperature ?? config.temperature,
      stream: false,
      permissionPreset: input.permissionPreset || 'chat-only',
      enabledTools: input.enabledTools || [],
    },
    meta: {
      charName: input.charName,
      userName: input.userName,
      appName: input.appName,
      purpose: input.purpose,
    },
  });
  return result.content || '';
}

export async function checkAgentHealth(config: AgentRuntimeConfig): Promise<boolean> {
  if (!config.agentServerUrl?.trim()) return false;
  try {
    const res = await fetch(`${baseUrl(config)}/api/agent/health`, {
      method: 'GET',
      headers: authHeaders(config),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true && data?.runtime === 'claude-agent-sdk';
  } catch {
    return false;
  }
}

export async function checkAgentPushStatus(config: AgentRuntimeConfig): Promise<AgentPushStatus> {
  if (!config.agentServerUrl?.trim()) {
    return { ok: true, configured: false, vapidPublicKey: null };
  }
  const res = await fetch(`${baseUrl(config)}/api/agent/push/status`, {
    method: 'GET',
    headers: authHeaders(config),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error?.message || `Push 状态检查失败 HTTP ${res.status}`);
  }
  return data as AgentPushStatus;
}

export async function registerAgentPushSubscription(
  config: AgentRuntimeConfig,
  userId: string,
): Promise<{ ok: true; subscriptionId: string; updatedAt: number }> {
  const status = await checkAgentPushStatus(config);
  if (!status.configured || !status.vapidPublicKey) {
    throw new Error('Agent Server 尚未配置 VAPID 密钥');
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('当前浏览器不支持 Service Worker 或 Push API');
  }
  await KeepAlive.init();
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && isDeadPushEndpoint(sub.endpoint)) {
    try { await sub.unsubscribe(); } catch { /* ignore */ }
    await new Promise((resolve) => setTimeout(resolve, SUBSCRIBE_SETTLE_MS));
    sub = null;
  }
  if (sub) {
    try {
      const existingKey = bytesToB64u(sub.options.applicationServerKey);
      if (existingKey && existingKey !== status.vapidPublicKey) {
        await sub.unsubscribe();
        await new Promise((resolve) => setTimeout(resolve, SUBSCRIBE_SETTLE_MS));
        sub = null;
      }
    } catch { /* ignore */ }
  }
  if (!sub) {
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('通知权限未授予');
    } else if (Notification.permission === 'denied') {
      throw new Error('通知权限已被拒绝，请到浏览器站点设置里手动开启');
    }
    const fresh = await subscribeWithRetry(reg, status.vapidPublicKey, '[AgentPush]');
    if (!fresh.sub) throw new Error(fresh.reason || '创建推送订阅失败');
    sub = fresh.sub;
  }
  const p256dh = bytesToB64u(sub.getKey('p256dh'));
  const auth = bytesToB64u(sub.getKey('auth'));
  if (!p256dh || !auth) throw new Error('订阅缺少加密公钥');

  const res = await fetch(`${baseUrl(config)}/api/agent/push/subscriptions`, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({
      userId: userId || 'local-user',
      userAgent: navigator.userAgent,
      subscription: {
        endpoint: sub.endpoint,
        keys: { p256dh, auth },
      },
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error?.message || `注册推送订阅失败 HTTP ${res.status}`);
  }
  return data;
}

export async function testAgentPushNotification(config: AgentRuntimeConfig, userId: string): Promise<{ ok: true; attempted: number; sent: number }> {
  const res = await fetch(`${baseUrl(config)}/api/agent/push/test`, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({ userId: userId || 'local-user' }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error?.message || `测试推送失败 HTTP ${res.status}`);
  }
  return data;
}

export async function resetAgentSession(
  config: AgentRuntimeConfig,
  userId: string,
  charId: string,
): Promise<void> {
  if (!config.agentServerUrl?.trim()) throw new Error('请先配置 Agent Server URL');
  const res = await fetch(`${baseUrl(config)}/api/agent/session/${encodeURIComponent(userId)}/${encodeURIComponent(charId)}`, {
    method: 'DELETE',
    headers: authHeaders(config),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export async function resetAllAgentSessions(config: AgentRuntimeConfig): Promise<void> {
  if (!config.agentServerUrl?.trim()) throw new Error('请先配置 Agent Server URL');
  const res = await fetch(`${baseUrl(config)}/api/agent/sessions`, {
    method: 'DELETE',
    headers: authHeaders(config),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
}
