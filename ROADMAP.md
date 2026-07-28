# Roadmap

## v0.1 (current)
- [x] 6 provider adapters
- [x] MCP server with core tools
- [x] Streaming chat
- [x] Conversation management
- [x] Fallback routing
- [x] Plugin skills
- [x] Tests (15 passing)

## v0.2 — Conversation improvements
- [ ] Automatic conversation summarization using active provider
- [ ] Conversation export/import
- [ ] Token usage tracking
- [ ] Multi-turn conversation support in ai-chat skill
- [ ] Conversation search

## v0.3 — Production hardening
- [ ] Rate-limit aware backoff with exponential retry
- [ ] Provider health checks and status monitoring
- [ ] Diagnostics command (/ai:diagnose)
- [ ] Enhanced error reporting with recovery suggestions
- [ ] Config validation on startup

## v0.4 — Advanced features
- [ ] OpenAI-compatible generic adapter (auto-detect)
- [ ] Custom provider registry (user-defined adapters)
- [ ] Model benchmarking (latency comparison)
- [ ] Provider-aware agent routing
- [ ] Web UI for configuration

## Future
- [ ] Plugin marketplace submission
- [ ] Prompt template system
- [ ] Multi-model orchestration (split prompts across models)
- [ ] Tool calling relay (use tools from any provider)
- [ ] Streaming via Server-Sent Events channel