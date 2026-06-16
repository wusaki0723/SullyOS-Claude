import path from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { config } from '../config.js';
import type { AgentMessageResponse, AgentTaskRecord } from '../types.js';

type TaskIndex = Record<string, {
  taskId: string;
  userId: string;
  charId: string;
  conversationId: string;
  turnId: string;
  status: AgentTaskRecord['status'];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}>;

const tasksDir = () => path.join(config.dataDir, 'tasks');
const indexPath = () => path.join(config.dataDir, 'tasks-index.json');
const taskPath = (taskId: string) => path.join(tasksDir(), `${taskId}.json`);

async function readIndex(): Promise<TaskIndex> {
  try {
    return JSON.parse(await readFile(indexPath(), 'utf8')) as TaskIndex;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, file);
}

async function writeIndex(index: TaskIndex): Promise<void> {
  await writeJsonAtomic(indexPath(), index);
}

function summarizeTask(task: AgentTaskRecord): TaskIndex[string] {
  return {
    taskId: task.taskId,
    userId: task.userId,
    charId: task.charId,
    conversationId: task.conversationId,
    turnId: task.turnId,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
  };
}

export async function createTask(input: {
  userId: string;
  charId: string;
  conversationId: string;
  turnId: string;
  meta?: AgentTaskRecord['meta'];
}): Promise<AgentTaskRecord> {
  const now = Date.now();
  const task: AgentTaskRecord = {
    taskId: `task-${now}-${crypto.randomUUID()}`,
    userId: input.userId,
    charId: input.charId,
    conversationId: input.conversationId,
    turnId: input.turnId,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    meta: input.meta,
  };
  await saveTask(task);
  return task;
}

export async function saveTask(task: AgentTaskRecord): Promise<void> {
  const index = await readIndex();
  index[task.taskId] = summarizeTask(task);
  await Promise.all([
    writeJsonAtomic(taskPath(task.taskId), task),
    writeIndex(index),
  ]);
}

export async function getTask(taskId: string): Promise<AgentTaskRecord | undefined> {
  try {
    return JSON.parse(await readFile(taskPath(taskId), 'utf8')) as AgentTaskRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function markTaskRunning(taskId: string): Promise<AgentTaskRecord | undefined> {
  const task = await getTask(taskId);
  if (!task) return undefined;
  const now = Date.now();
  task.status = 'running';
  task.startedAt = task.startedAt || now;
  task.updatedAt = now;
  await saveTask(task);
  return task;
}

export async function markTaskCompleted(taskId: string, response: AgentMessageResponse): Promise<AgentTaskRecord | undefined> {
  const task = await getTask(taskId);
  if (!task) return undefined;
  const now = Date.now();
  task.status = 'completed';
  task.response = response;
  task.completedAt = now;
  task.updatedAt = now;
  await saveTask(task);
  return task;
}

export async function markTaskFailed(taskId: string, error: AgentTaskRecord['error']): Promise<AgentTaskRecord | undefined> {
  const task = await getTask(taskId);
  if (!task) return undefined;
  const now = Date.now();
  task.status = 'failed';
  task.error = error;
  task.completedAt = now;
  task.updatedAt = now;
  await saveTask(task);
  return task;
}

export async function listTasks(filter: {
  userId?: string;
  charId?: string;
  statuses?: AgentTaskRecord['status'][];
  since?: number;
  limit?: number;
} = {}): Promise<AgentTaskRecord[]> {
  const index = await readIndex();
  const rows = Object.values(index)
    .filter((task) => !filter.userId || task.userId === filter.userId)
    .filter((task) => !filter.charId || task.charId === filter.charId)
    .filter((task) => !filter.statuses?.length || filter.statuses.includes(task.status))
    .filter((task) => !filter.since || task.updatedAt >= filter.since)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, filter.limit || 50);
  const tasks = await Promise.all(rows.map((task) => getTask(task.taskId)));
  return tasks.filter(Boolean) as AgentTaskRecord[];
}
