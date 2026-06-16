export type AgentPermissionPreset = 'chat-only' | 'read-only-tools' | 'custom-tools';

export interface AgentRuntimeConfig {
  provider: 'claude-agent-sdk';
  agentServerUrl: string;
  clientToken?: string;
  model?: string;
  maxTurns?: number;
  stream?: boolean;
  permissionPreset: AgentPermissionPreset;
  enabledTools?: string[];
  temperature?: number;
  backgroundTasks?: boolean;
  pushNotifications?: boolean;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: unknown;
}

export interface AgentMessageRequest {
  userId: string;
  charId: string;
  conversationId: string;
  turnId: string;
  fullMessages: AgentMessage[];
  systemPrompt: string;
  cleanedApiMessages: AgentMessage[];
  latestUserMessage?: string;
  sessionId?: string;
  options?: {
    model?: string;
    maxTurns?: number;
    temperature?: number;
    stream?: boolean;
    permissionPreset?: AgentPermissionPreset;
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

export interface AgentErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    detail?: string;
  };
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
  error?: AgentErrorResponse['error'];
  meta?: AgentMessageRequest['meta'];
}

export interface AgentPushStatus {
  ok: true;
  configured: boolean;
  vapidPublicKey: string | null;
}
