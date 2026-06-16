import { query } from '@anthropic-ai/claude-agent-sdk';
import { config } from '../config.js';
import { resolveAllowedTools, resolveBaseTools } from '../security/permissions.js';
import type { AgentMessageRequest, AgentMessageResponse } from '../types.js';
import { ensureCharacterWorkdir } from '../storage/fileLayout.js';
import { getStoredSession, saveStoredSession } from '../storage/sessionStore.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/errors.js';
import { formatSullyPrompt } from './formatPrompt.js';
import { collectTextFromAssistantMessage, toAgentEvent, usageFromResult } from './parseEvents.js';

export async function runClaudeAgentTurn(req: AgentMessageRequest): Promise<AgentMessageResponse> {
  const startedAt = Date.now();
  const cwd = await ensureCharacterWorkdir(req.userId, req.charId);
  const stored = await getStoredSession(req.userId, req.charId);
  const sessionId = req.sessionId || stored?.sessionId;
  const model = req.options?.model || config.defaultModel;
  const maxTurns = req.options?.maxTurns || config.defaultMaxTurns;
  const allowedTools = resolveAllowedTools(req.options?.permissionPreset || 'chat-only', req.options?.enabledTools || []);
  const tools = resolveBaseTools(allowedTools);
  const prompt = formatSullyPrompt({
    systemPrompt: req.systemPrompt,
    cleanedApiMessages: req.cleanedApiMessages,
    latestUserMessage: req.latestUserMessage,
    charName: req.meta?.charName,
    userName: req.meta?.userName,
  });

  if (config.debugPrompt) {
    logger.info({ userId: req.userId, charId: req.charId, prompt }, 'Formatted Sully prompt');
  }

  let finalContent = '';
  let finalSessionId = sessionId || '';
  let finalResult: any;
  let toolCalls = 0;
  const events = [];

  const stream = query({
    prompt,
    options: {
      cwd,
      model,
      maxTurns,
      resume: sessionId,
      settingSources: [],
      tools,
      allowedTools,
      permissionMode: 'dontAsk',
      env: {
        ...process.env,
        ...(config.anthropicApiKey ? { ANTHROPIC_API_KEY: config.anthropicApiKey } : {}),
        ...(config.claudeCodeOauthToken ? { CLAUDE_CODE_OAUTH_TOKEN: config.claudeCodeOauthToken } : {}),
        CLAUDE_AGENT_SDK_CLIENT_APP: 'sullyos-claude-agent-edition/0.1.0',
      },
    },
  });

  for await (const message of stream) {
    const anyMessage = message as any;
    if (anyMessage.session_id) finalSessionId = anyMessage.session_id;
    const event = toAgentEvent(anyMessage);
    if (event) {
      if (event.type === 'tool') toolCalls += 1;
      events.push(event);
    }
    if (anyMessage.type === 'assistant') {
      const assistantText = collectTextFromAssistantMessage(anyMessage);
      if (assistantText) finalContent = assistantText;
    }
    if (anyMessage.type === 'result') {
      finalResult = anyMessage;
      if (typeof anyMessage.result === 'string' && anyMessage.result.trim()) {
        finalContent = anyMessage.result;
      }
      if (anyMessage.session_id) finalSessionId = anyMessage.session_id;
      if (anyMessage.is_error) {
        throw new HttpError(502, anyMessage.subtype || 'claude_agent_error', 'Claude Agent SDK 调用失败', (anyMessage.errors || []).join('\n') || anyMessage.stop_reason || undefined);
      }
    }
  }

  if (!finalContent.trim()) {
    throw new HttpError(502, 'empty_agent_response', 'Claude Agent SDK 没有返回可用文本');
  }
  if (!finalSessionId) {
    throw new HttpError(502, 'missing_session_id', 'Claude Agent SDK 没有返回 sessionId');
  }

  await saveStoredSession({
    userId: req.userId,
    charId: req.charId,
    sessionId: finalSessionId,
    cwd,
  });

  const durationMs = Date.now() - startedAt;
  logger.info({
    userId: req.userId,
    charId: req.charId,
    sessionId: finalSessionId,
    durationMs,
    eventsCount: events.length,
    toolCalls,
  }, 'Claude Agent turn completed');

  return {
    ok: true,
    content: finalContent.trim(),
    sessionId: finalSessionId,
    events,
    usage: usageFromResult(finalResult),
    diagnostics: {
      durationMs,
      model,
      maxTurns,
      toolCalls,
    },
  };
}
