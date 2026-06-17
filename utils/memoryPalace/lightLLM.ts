import { safeFetchJson } from '../safeApi';
import type { ApiCallMeta } from '../apiCallLog';
import type { LightLLMConfig } from './pipeline';

export interface LightLLMTextRequest {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    purpose?: string;
}

export interface LightLLMTextResult {
    reply: string;
    finishReason?: string;
    usage?: unknown;
}

export async function callLightLLMText(
    llmConfig: LightLLMConfig,
    input: LightLLMTextRequest,
    meta?: ApiCallMeta,
    retryOptions: { maxRetries?: number; timeoutMs?: number } = {},
): Promise<LightLLMTextResult> {
    if (llmConfig.sendText) {
        const reply = await llmConfig.sendText(input);
        return { reply };
    }

    const data = await safeFetchJson(
        `${llmConfig.baseUrl.replace(/\/+$/, '')}/agent-disabled`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${llmConfig.apiKey}`,
            },
            body: JSON.stringify({
                model: llmConfig.model,
                messages: [
                    { role: 'system', content: input.systemPrompt },
                    { role: 'user', content: input.userPrompt },
                ],
                temperature: input.temperature,
                max_tokens: input.maxTokens,
                stream: false,
            }),
        },
        retryOptions.maxRetries ?? 2,
        retryOptions.timeoutMs ?? 0,
        meta,
    );

    return {
        reply: data.choices?.[0]?.message?.content || '',
        finishReason: data.choices?.[0]?.finish_reason,
        usage: data.usage,
    };
}
