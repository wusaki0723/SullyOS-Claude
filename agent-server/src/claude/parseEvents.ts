import type { AgentEvent } from '../types.js';

export function collectTextFromAssistantMessage(message: any): string {
  const content = message?.message?.content;
  if (!Array.isArray(content)) return '';
  return content.map((part) => {
    if (part?.type === 'text') return part.text || '';
    return '';
  }).join('');
}

export function toAgentEvent(message: any): AgentEvent | undefined {
  if (!message?.type) return undefined;
  if (message.type === 'assistant') {
    const tool = Array.isArray(message.message?.content)
      ? message.message.content.find((part: any) => part?.type === 'tool_use')
      : undefined;
    if (tool) {
      return { type: 'tool', name: tool.name, status: 'running', input: tool.input };
    }
    const text = collectTextFromAssistantMessage(message);
    return text ? { type: 'text', text } : { type: 'assistant' };
  }
  if (message.type === 'result') {
    return { type: 'result', status: message.subtype };
  }
  if (message.type === 'system') {
    return { type: 'system', subtype: message.subtype };
  }
  return { type: message.type, subtype: message.subtype };
}

export function usageFromResult(result: any) {
  const usage = result?.usage || {};
  const inputTokens = usage.input_tokens ?? usage.inputTokens;
  const outputTokens = usage.output_tokens ?? usage.outputTokens;
  const totalTokens = usage.total_tokens ?? (
    typeof inputTokens === 'number' && typeof outputTokens === 'number'
      ? inputTokens + outputTokens
      : undefined
  );
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd: result?.total_cost_usd,
  };
}
