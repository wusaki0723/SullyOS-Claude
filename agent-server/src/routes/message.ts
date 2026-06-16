import { Router } from 'express';
import { z } from 'zod';
import { runClaudeAgentTurn } from '../claude/claudeAgent.js';
import { requireClientAuth } from '../security/auth.js';
import { asyncRoute } from '../utils/errors.js';

export const messageSchema = z.object({
  userId: z.string().min(1),
  charId: z.string().min(1),
  conversationId: z.string().min(1),
  turnId: z.string().min(1),
  fullMessages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.unknown(),
  })),
  systemPrompt: z.string(),
  cleanedApiMessages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.unknown(),
  })),
  latestUserMessage: z.string().optional(),
  sessionId: z.string().optional(),
  options: z.object({
    model: z.string().optional(),
    maxTurns: z.number().int().positive().max(50).optional(),
    temperature: z.number().optional(),
    stream: z.boolean().optional(),
    permissionPreset: z.enum(['chat-only', 'read-only-tools', 'custom-tools']).optional(),
    enabledTools: z.array(z.string()).optional(),
  }).optional(),
  meta: z.object({
    charName: z.string().optional(),
    userName: z.string().optional(),
    appName: z.string().optional(),
    purpose: z.string().optional(),
  }).optional(),
});

export const messageRouter = Router();

messageRouter.post('/message', requireClientAuth, asyncRoute(async (req, res) => {
  const parsed = messageSchema.parse(req.body);
  const result = await runClaudeAgentTurn(parsed);
  res.json(result);
}));
