import path from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { config } from '../config.js';
import type { PushSubscriptionRecord } from '../types.js';

type PushIndex = Record<string, PushSubscriptionRecord>;

const filePath = () => path.join(config.dataDir, 'push-subscriptions.json');

async function readIndex(): Promise<PushIndex> {
  try {
    return JSON.parse(await readFile(filePath(), 'utf8')) as PushIndex;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

async function writeIndex(index: PushIndex): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  const file = filePath();
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(index, null, 2));
  await rename(tmp, file);
}

export async function upsertPushSubscription(input: {
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}): Promise<PushSubscriptionRecord> {
  const index = await readIndex();
  const existing = Object.values(index).find((row) => row.endpoint === input.endpoint);
  const now = Date.now();
  const record: PushSubscriptionRecord = {
    id: existing?.id || `sub-${now}-${crypto.randomUUID()}`,
    userId: input.userId,
    endpoint: input.endpoint,
    keys: input.keys,
    userAgent: input.userAgent,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastSuccessAt: existing?.lastSuccessAt,
    lastErrorAt: existing?.lastErrorAt,
    lastError: existing?.lastError,
  };
  index[record.id] = record;
  await writeIndex(index);
  return record;
}

export async function listPushSubscriptions(userId: string): Promise<PushSubscriptionRecord[]> {
  const index = await readIndex();
  return Object.values(index).filter((row) => row.userId === userId);
}

export async function markPushSubscriptionSuccess(id: string): Promise<void> {
  const index = await readIndex();
  if (!index[id]) return;
  index[id] = { ...index[id], updatedAt: Date.now(), lastSuccessAt: Date.now(), lastError: undefined };
  await writeIndex(index);
}

export async function markPushSubscriptionError(id: string, message: string): Promise<void> {
  const index = await readIndex();
  if (!index[id]) return;
  index[id] = { ...index[id], updatedAt: Date.now(), lastErrorAt: Date.now(), lastError: message };
  await writeIndex(index);
}

export async function deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
  const index = await readIndex();
  for (const [id, row] of Object.entries(index)) {
    if (row.endpoint === endpoint) delete index[id];
  }
  await writeIndex(index);
}
