# SullyOS Claude Agent Edition Plan

This fork is dedicated to Claude Agent SDK. It is not a general provider client.

## Current Milestone

1. Add `agent-server/` with Node.js, TypeScript, Express, and `@anthropic-ai/claude-agent-sdk`.
2. Expose `/api/agent/health`, `/api/agent/message`, `/api/agent/session/:userId/:charId`, and `/api/agent/sessions`.
3. Add frontend Agent Runtime config and client.
4. Route main chat through Agent Server after `buildChatRequestPayload()`.
5. Store Claude `sessionId` per character.
6. Keep first release `chat-only`.

## Deferred

- Streaming over SSE.
- Emotion eval through `/api/agent/emotion`.
- Instant Push through Agent Server jobs.
- SullyOS custom tools and MCP.
- App-specific tool card rendering from Agent SDK events.

## Non-goals

- Browser-side Claude SDK.
- Anthropic API key in frontend storage.
- Multi-provider runtime selection in this fork.
- Default Bash, file edit, or write tools.
