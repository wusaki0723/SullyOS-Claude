# SullyOS Claude Agent Edition

SullyOS Claude Agent Edition is a fork focused on one runtime: SullyOS immersive UI backed by the Claude Agent SDK.

The original SullyOS remains the general provider edition. This fork keeps the cyber-phone shell, characters, chat, memory palace, worldbooks, diaries, rooms, calls, group chat, MiniMax TTS, and app ecosystem, but the main character reply path goes through a Node sidecar:

```text
SullyOS Web / Android WebView
        ↓
frontend Agent Client
        ↓
sully-agent-server
        ↓
@anthropic-ai/claude-agent-sdk
        ↓
Claude Agent session / tools / memory / cwd
```

## What Changed

- The browser no longer stores Anthropic API keys.
- Main chat goes to `agent-server` at `/api/agent/message`.
- Each character gets an isolated Claude Agent `cwd` and session.
- Built-in risky tools are disabled by default.
- Emotion eval, Instant Push, and app tool-calling are disabled in the first migration stage until their Agent SDK versions are implemented.
- MiniMax TTS, ACE-Step, NetEase Music, local data, backups, and non-Claude service settings remain separate.

## Run Locally

Frontend:

```sh
npm install
npm run dev
```

Agent Server:

```sh
cd agent-server
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`, then go to Settings and configure:

- Agent Server URL, usually `http://127.0.0.1:8787`
- Optional client token, matching `SULLY_AGENT_CLIENT_TOKEN`
- Model alias or model id
- Max turns
- Permission preset

`ANTHROPIC_API_KEY` belongs only in `agent-server/.env` or server environment variables.

## Agent Server API

Health:

```sh
curl http://127.0.0.1:8787/api/agent/health
```

Message:

```sh
curl -X POST http://127.0.0.1:8787/api/agent/message \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer change-me' \
  -d '{"userId":"local-user","charId":"test-char","conversationId":"test-char","turnId":"test-turn","systemPrompt":"你是一个简洁的聊天角色。","cleanedApiMessages":[{"role":"user","content":"你好"}],"fullMessages":[{"role":"system","content":"你是一个简洁的聊天角色。"},{"role":"user","content":"你好"}]}'
```

## Safety Defaults

- `HOST=127.0.0.1`
- `SULLY_AGENT_ENABLE_BUILTIN_TOOLS=false`
- `SULLY_AGENT_ENABLE_BASH=false`
- `SULLY_AGENT_ENABLE_FILE_EDIT=false`
- `SULLY_AGENT_ENABLE_WEB_SEARCH=false`
- Claude SDK calls use `settingSources: []`
- Character sessions live under `agent-server/.data/sessions/{userId}/{charId}/workdir`

## Data

SullyOS user data remains in browser IndexedDB unless you explicitly use backup features. Agent SDK session metadata and per-character workdirs live in `agent-server/.data`.

Do not export or publish `agent-server/.env` or `agent-server/.data`.
