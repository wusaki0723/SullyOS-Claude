import path from 'node:path';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { config } from '../config.js';
import type { StoredSession } from '../types.js';
import { ensureCharacterWorkdir, safeSegment, sessionRoot } from './fileLayout.js';

type SessionIndex = Record<string, StoredSession>;

const indexPath = () => path.join(config.dataDir, 'sessions-index.json');
const keyFor = (userId: string, charId: string) => `${safeSegment(userId)}:${safeSegment(charId)}`;

async function readIndex(): Promise<SessionIndex> {
  try {
    const raw = await readFile(indexPath(), 'utf8');
    return JSON.parse(raw) as SessionIndex;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

async function writeIndex(index: SessionIndex): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  const file = indexPath();
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(index, null, 2));
  await rename(tmp, file);
}

export async function getStoredSession(userId: string, charId: string): Promise<StoredSession | undefined> {
  const index = await readIndex();
  return index[keyFor(userId, charId)];
}

export async function saveStoredSession(input: {
  userId: string;
  charId: string;
  sessionId: string;
  cwd?: string;
}): Promise<StoredSession> {
  const index = await readIndex();
  const key = keyFor(input.userId, input.charId);
  const previous = index[key];
  const now = Date.now();
  const cwd = input.cwd || previous?.cwd || await ensureCharacterWorkdir(input.userId, input.charId);
  const stored: StoredSession = {
    userId: input.userId,
    charId: input.charId,
    sessionId: input.sessionId,
    cwd,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
  index[key] = stored;
  await writeIndex(index);
  await mkdir(path.join(sessionRoot(input.userId, input.charId)), { recursive: true });
  await writeFile(path.join(sessionRoot(input.userId, input.charId), 'session.json'), JSON.stringify(stored, null, 2));
  return stored;
}

export async function resetStoredSession(userId: string, charId: string): Promise<void> {
  const index = await readIndex();
  delete index[keyFor(userId, charId)];
  await writeIndex(index);
  await rm(path.join(sessionRoot(userId, charId), 'session.json'), { force: true });
}

export async function resetAllStoredSessions(): Promise<void> {
  await writeIndex({});
  await rm(path.join(config.dataDir, 'sessions'), { recursive: true, force: true });
}
