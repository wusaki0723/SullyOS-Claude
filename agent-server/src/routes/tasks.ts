import { Router } from 'express';
import { z } from 'zod';
import { messageSchema } from './message.js';
import { requireClientAuth } from '../security/auth.js';
import { asyncRoute, HttpError } from '../utils/errors.js';
import { createAndStartAgentTask } from '../tasks/taskRunner.js';
import { getTask, listTasks } from '../storage/taskStore.js';
import { attachTaskEventStream } from '../tasks/taskEvents.js';

export const tasksRouter = Router();

const listQuerySchema = z.object({
  userId: z.string().optional(),
  charId: z.string().optional(),
  status: z.string().optional(),
  since: z.coerce.number().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

tasksRouter.post('/tasks', requireClientAuth, asyncRoute(async (req, res) => {
  const parsed = messageSchema.parse(req.body);
  const task = await createAndStartAgentTask(parsed);
  res.status(202).json({
    ok: true,
    taskId: task.taskId,
    status: task.status,
    createdAt: task.createdAt,
  });
}));

tasksRouter.get('/tasks', requireClientAuth, asyncRoute(async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const statuses = query.status
    ? query.status.split(',').map((x) => x.trim()).filter(Boolean) as any
    : undefined;
  const tasks = await listTasks({
    userId: query.userId,
    charId: query.charId,
    statuses,
    since: query.since,
    limit: query.limit,
  });
  res.json({ ok: true, tasks });
}));

tasksRouter.get('/tasks/:taskId', requireClientAuth, asyncRoute(async (req, res) => {
  const task = await getTask(req.params.taskId);
  if (!task) throw new HttpError(404, 'task_not_found', '后台任务不存在');
  res.json({ ok: true, task });
}));

tasksRouter.get('/tasks/:taskId/events', requireClientAuth, asyncRoute(async (req, res) => {
  const task = await getTask(req.params.taskId);
  if (!task) throw new HttpError(404, 'task_not_found', '后台任务不存在');
  const detach = attachTaskEventStream(req.params.taskId, res);
  req.on('close', detach);
  if (task.status === 'completed' || task.status === 'failed') {
    res.write(`event: ${task.status === 'completed' ? 'result' : 'error'}\n`);
    res.write(`data: ${JSON.stringify(task)}\n\n`);
    res.end();
  }
}));
