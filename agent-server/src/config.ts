import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const boolEnv = (name: string): boolean => process.env[name] === 'true';

export const config = {
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || '127.0.0.1',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  claudeCodeOauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN,
  clientToken: process.env.SULLY_AGENT_CLIENT_TOKEN,
  dataDir: path.resolve(process.cwd(), process.env.SULLY_AGENT_DATA_DIR || '.data'),
  defaultModel: process.env.SULLY_AGENT_DEFAULT_MODEL || 'sonnet',
  defaultMaxTurns: Number(process.env.SULLY_AGENT_MAX_TURNS || 6),
  corsOrigin: process.env.SULLY_AGENT_CORS_ORIGIN || 'http://localhost:5173',
  debugPrompt: process.env.DEBUG_PROMPT === 'true',
  vapidPublicKey: process.env.SULLY_AGENT_VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.SULLY_AGENT_VAPID_PRIVATE_KEY,
  vapidSubject: process.env.SULLY_AGENT_VAPID_SUBJECT || 'mailto:sully-agent@example.local',
  enableBuiltinTools: boolEnv('SULLY_AGENT_ENABLE_BUILTIN_TOOLS'),
  enableBash: boolEnv('SULLY_AGENT_ENABLE_BASH'),
  enableFileEdit: boolEnv('SULLY_AGENT_ENABLE_FILE_EDIT'),
  enableWebSearch: boolEnv('SULLY_AGENT_ENABLE_WEB_SEARCH'),
};

export function assertConfig(): void {
  if (!config.anthropicApiKey && !config.claudeCodeOauthToken) {
    throw new Error('Missing ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN. Put one in agent-server/.env or the server environment.');
  }
}
