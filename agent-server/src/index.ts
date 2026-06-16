import express from 'express';
import { assertConfig, config } from './config.js';
import { corsMiddleware } from './security/cors.js';
import { healthRouter } from './routes/health.js';
import { messageRouter } from './routes/message.js';
import { sessionsRouter } from './routes/sessions.js';
import { emotionRouter } from './routes/emotion.js';
import { tasksRouter } from './routes/tasks.js';
import { pushRouter } from './routes/push.js';
import { errorHandler } from './utils/errors.js';
import { logger } from './utils/logger.js';

assertConfig();

const app = express();

app.use(corsMiddleware);
app.use(express.json({ limit: '8mb' }));

app.use('/api/agent', healthRouter);
app.use('/api/agent', messageRouter);
app.use('/api/agent', sessionsRouter);
app.use('/api/agent', emotionRouter);
app.use('/api/agent', tasksRouter);
app.use('/api/agent', pushRouter);
app.use(errorHandler);

app.listen(config.port, config.host, () => {
  logger.info({
    host: config.host,
    port: config.port,
    dataDir: config.dataDir,
    runtime: 'claude-agent-sdk',
  }, 'Sully Agent Server listening');
});
