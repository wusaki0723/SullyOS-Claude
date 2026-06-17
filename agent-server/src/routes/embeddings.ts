import { Router } from 'express';
import { z } from 'zod';
import { requireClientAuth } from '../security/auth.js';
import { asyncRoute, HttpError } from '../utils/errors.js';

export const embeddingsRouter = Router();

const embeddingSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  input: z.union([z.string(), z.array(z.string().min(0)).min(1).max(32)]),
  encoding_format: z.string().optional(),
  dimensions: z.number().int().positive().optional(),
});

function normalizeEmbeddingBaseUrl(raw: string): string {
  const url = new URL(raw.replace(/\/+$/, '').replace('ai.siliconflow.cn', 'api.siliconflow.cn'));
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new HttpError(400, 'invalid_embedding_url', 'Embedding baseUrl 只支持 http/https');
  }
  return url.toString().replace(/\/+$/, '');
}

embeddingsRouter.post('/embeddings', requireClientAuth, asyncRoute(async (req, res) => {
  const parsed = embeddingSchema.parse(req.body);
  const baseUrl = normalizeEmbeddingBaseUrl(parsed.baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const upstream = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${parsed.apiKey}`,
      },
      body: JSON.stringify({
        model: parsed.model,
        input: parsed.input,
        encoding_format: parsed.encoding_format || 'float',
        ...(parsed.dimensions ? { dimensions: parsed.dimensions } : {}),
      }),
      signal: controller.signal,
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.type(upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      throw new HttpError(504, 'embedding_timeout', 'Embedding 上游请求超时');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}));
