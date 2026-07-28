# Changelog

## 0.1.0 (2026-07-28)

- Initial release
- 6 provider adapters: OpenAI, Anthropic, Gemini, OpenRouter, Ollama, LM Studio
- MCP server with tools: provider management, model listing, chat, conversations
- Streaming support for all providers
- Conversation management with automatic context compression
- Configurable fallback between providers
- Plugin skills: `ai-chat`, `ai-switch`, `ai-list`
- Hooks for PostToolUse logging
- Logging with automatic secret redaction