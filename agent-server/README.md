# Sully Agent Server

Node.js sidecar for SullyOS Claude Agent Edition.

The browser or Android WebView talks to this server. This server owns
`ANTHROPIC_API_KEY`, starts Claude Agent SDK sessions, and stores one isolated
Claude workdir/session per SullyOS character.

## Development

```sh
cd agent-server
npm install
cp .env.example .env
npm run dev
```

Health check:

```sh
curl http://127.0.0.1:8787/api/agent/health
```

Message test:

```sh
curl -X POST http://127.0.0.1:8787/api/agent/message \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer change-me' \
  -d '{
    "userId":"local-user",
    "charId":"test-char",
    "conversationId":"test-char",
    "turnId":"test-turn",
    "systemPrompt":"你是一个简洁的聊天角色。",
    "cleanedApiMessages":[{"role":"user","content":"你好"}],
    "fullMessages":[
      {"role":"system","content":"你是一个简洁的聊天角色。"},
      {"role":"user","content":"你好"}
    ]
  }'
```

## Safety Defaults

- Binds to `127.0.0.1` by default.
- `ANTHROPIC_API_KEY` only lives in `.env` or server environment variables.
- `settingSources: []` prevents global Claude settings and `CLAUDE.md` from
  leaking into character sessions.
- Every `{userId, charId}` pair gets an isolated `workdir`.
- Built-in tools are disabled by default. `chat-only` maps to no tools.
