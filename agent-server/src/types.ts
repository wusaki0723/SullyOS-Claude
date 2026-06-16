export type PermissionPreset = 'chat-only' | 'read-only-tools' | 'custom-tools';

export type AgentRole = 'system' | 'user' | 'assistant';

export interface AgentChatMessage {
  role: AgentRole;
  content: unknown;
}

export interface AgentMessageRequest {
  userId: string;
  charId: string;
  conversationId: string;
  turnId: string;
  fullMessages: AgentChatMessage[];
  systemPrompt: string;
  cleanedApiMessages: AgentChatMessage[];
  latestUserMessage?: string;
  sessionId?: string;
  options?: {
    model?: string;
    maxTurns?: number;
    temperature?: number;
    stream?: boolean;
    permissionPreset?: PermissionPreset;
    enabledTools?: string[];
  };
  meta?: {
    charName?: string;
    userName?: string;
    appName?: string;
    purpose?: string;
  };
}

export interface AgentEvent {
  type: string;
  subtype?: string;
  text?: string;
  name?: string;
  status?: string;
  input?: unknown;
  output?: unknown;
}

export interface AgentMessageResponse {
  ok: true;
  content: string;
  sessionId: string;
  events?: AgentEvent[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    costUsd?: number;
  };
  diagnostics?: {
    durationMs: number;
    model?: string;
    maxTurns?: number;
    toolCalls?: number;
  };
}

export interface StoredSession {
  userId: string;
  charId: string;
  sessionId: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
}

export type AgentTaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface AgentTaskRecord {
  taskId: string;
  userId: string;
  charId: string;
  conversationId: string;
  turnId: string;
  status: AgentTaskStatus;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  response?: AgentMessageResponse;
  error?: {
    code: string;
    message: string;
    detail?: string;
  };
  meta?: AgentMessageRequest['meta'];
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: number;
  updatedAt: number;
  lastSuccessAt?: number;
  lastErrorAt?: number;
  lastError?: string;
}
