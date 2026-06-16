import type { Response } from 'express';
import type { AgentTaskRecord } from '../types.js';

const listeners = new Map<string, Set<Response>>();

function writeSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function attachTaskEventStream(taskId: string, res: Response): () => void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  writeSse(res, 'hello', { taskId });
  let set = listeners.get(taskId);
  if (!set) {
    set = new Set();
    listeners.set(taskId, set);
  }
  set.add(res);
  const heartbeat = setInterval(() => writeSse(res, 'ping', { t: Date.now() }), 15000);
  return () => {
    clearInterval(heartbeat);
    set?.delete(res);
    if (set && set.size === 0) listeners.delete(taskId);
  };
}

export function publishTaskEvent(task: AgentTaskRecord): void {
  const set = listeners.get(task.taskId);
  if (!set?.size) return;
  const event = task.status === 'completed' ? 'result' : task.status === 'failed' ? 'error' : 'status';
  for (const res of set) {
    writeSse(res, event, task);
    if (task.status === 'completed' || task.status === 'failed') {
      res.end();
    }
  }
  if (task.status === 'completed' || task.status === 'failed') {
    listeners.delete(task.taskId);
  }
}
