import { sendAgentText } from '../agentClient';
import type { AgentRuntimeConfig } from '../../types/agentRuntime';
import type { LightLLMConfig } from './pipeline';

export function createAgentMemoryPalaceLLM(
    agentRuntimeConfig: AgentRuntimeConfig,
    input: {
        userId: string;
        charId: string;
        charName?: string;
        userName?: string;
    },
): LightLLMConfig {
    const isolatedCharId = `${input.charId}__memory_palace`;
    return {
        baseUrl: 'agent://sully',
        apiKey: 'agent-server',
        model: agentRuntimeConfig.model || '',
        sendText: async (req) => sendAgentText(agentRuntimeConfig, {
            userId: input.userId || 'local-user',
            charId: isolatedCharId,
            conversationId: isolatedCharId,
            prompt: req.userPrompt,
            systemPrompt: req.systemPrompt,
            appName: '记忆宫殿',
            purpose: req.purpose || '记忆宫殿文本任务',
            charName: input.charName,
            userName: input.userName,
            temperature: req.temperature,
            maxTurns: 1,
            permissionPreset: 'chat-only',
            enabledTools: [],
        }),
    };
}
