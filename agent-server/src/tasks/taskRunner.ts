import { runClaudeAgentTurn } from '../claude/claudeAgent.js';
import type { AgentMessageRequest } from '../types.js';
import { createTask, markTaskCompleted, markTaskFailed, markTaskRunning } from '../storage/taskStore.js';
import { notifyTaskSettled } from '../push/pushService.js';
import { publishTaskEvent } from './taskEvents.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/errors.js';

function normalizeError(error: unknown): { code: string; message: string; detail?: string } {
  if (error instanceof HttpError) {
    return { code: error.code, message: error.message, detail: error.detail };
  }
  if (error instanceof Error) {
    return { code: 'agent_task_failed', message: error.message };
  }
  return { code: 'agent_task_failed', message: String(error) };
}

export async function createAndStartAgentTask(req: AgentMessageRequest) {
  const task = await createTask({
    userId: req.userId,
    charId: req.charId,
    conversationId: req.conversationId,
    turnId: req.turnId,
    meta: req.meta,
  });

  void (async () => {
    try {
      const running = await markTaskRunning(task.taskId);
      if (running) publishTaskEvent(running);
      const response = await runClaudeAgentTurn(req);
      const completed = await markTaskCompleted(task.taskId, response);
      if (completed) {
        publishTaskEvent(completed);
        await notifyTaskSettled(completed);
      }
    } catch (error) {
      const failed = await markTaskFailed(task.taskId, normalizeError(error));
      if (failed) {
        publishTaskEvent(failed);
        await notifyTaskSettled(failed);
      }
      logger.error({ err: error, taskId: task.taskId, userId: task.userId, charId: task.charId }, 'Agent task failed');
    }
  })();

  return task;
}
