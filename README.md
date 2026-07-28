# Multi-AI Provider Plugin for Claude Code

A plugin that adds multi-provider AI integration to Claude Code via the official MCP extension mechanism.

> This plugin works **within** Claude Code's documented extension system. It does not modify Claude Code, bypass authentication, or change which model Claude Code uses internally.

## Features

- **6 providers**: OpenAI, Anthropic (user key), Gemini, OpenRouter, Ollama, LM Studio
- **Model management**: list models, inspect capabilities (streaming, vision, tool calling, reasoning, context window)
- **Streaming**: real-time response streaming for all providers
- **Conversations**: persistent history with automatic context compression
- **Fallback**: configurable sequential fallback between providers
- **Skills**: 3 built-in skills for common tasks

## Installation

```bash
# Clone the repository
git clone https://github.com/Maxime17-max/multi-ai-provider.git ~/.claude/plugins/multi-ai-provider

# Install MCP server dependencies
cd ~/.claude/plugins/multi-ai-provider/servers/ai-gateway
npm install

# Start Claude Code with the plugin
claude --plugin-dir ~/.claude/plugins/multi-ai-provider
```

## Quick Start

### 1. Configure a provider

In Claude Code, use the MCP tools to configure your API keys:

```
ai_provider_configure name="openai" apiKey="sk-..."
ai_provider_configure name="anthropic" apiKey="sk-ant-..."
ai_provider_configure name="gemini" apiKey="AIza..."
ai_provider_configure name="ollama" baseUrl="http://localhost:11434"
```

### 2. Switch to a provider and model

```
ai_switch_active provider="openai" model="gpt-4o"
```

### 3. Chat

```
ai_chat message="What is the capital of France?"
```

### 4. Use skills

Invoke any of the 3 built-in skills:

| Skill | Command | Description |
|-------|---------|-------------|
| ai-chat | `/multi-ai:chat` | Chat with current provider |
| ai-switch | `/multi-ai:switch` | Change provider/model |
| ai-list | `/multi-ai:list` | List providers and models |

## Available Tools

| Tool | Description |
|------|-------------|
| `ai_provider_list` | List configured providers |
| `ai_provider_configure` | Add/modify a provider |
| `ai_provider_remove` | Remove a provider |
| `ai_model_list` | List models for a provider |
| `ai_model_info` | Model capabilities detail |
| `ai_chat` | Send a chat message |
| `ai_switch_active` | Switch active provider/model |
| `ai_conversation_create` | Create a conversation |
| `ai_conversation_list` | List conversations |
| `ai_conversation_get` | Get conversation history |
| `ai_conversation_delete` | Delete a conversation |
| `ai_conversation_chat` | Chat within a conversation |

## Provider Configuration

| Provider | Required | Notes |
|----------|----------|-------|
| OpenAI | `apiKey` | `baseUrl` optional (default: `https://api.openai.com/v1`) |
| Anthropic | `apiKey` | Uses the user's own Anthropic key |
| Gemini | `apiKey` | Google AI Studio key |
| OpenRouter | `apiKey` | `baseUrl` optional (default: `https://openrouter.ai/api/v1`) |
| Ollama | `baseUrl` | Default: `http://localhost:11434` |
| LM Studio | `baseUrl` | Default: `http://localhost:1234/v1` |

## Architecture

```
Claude Code ──→ Plugin (skills/agents)
                     │
                     ▼
               MCP Server (ai-gateway)
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
      OpenAI    Anthropic    Gemini ...
```

The MCP server runs as a local stdio subprocess. Provider adapters are loaded at startup. Configurations are persisted in `${CLAUDE_PLUGIN_DATA}/providers.json`.

## Security

- API keys are stored in `${CLAUDE_PLUGIN_DATA}/providers.json` with mode `0600`
- All logs automatically redact API keys and secrets
- Input validation via Zod schemas on all MCP tool calls
- No calls to Anthropic's API for the user — only the user's own provider keys are used

## Development

```bash
cd servers/ai-gateway
npm run typecheck   # TypeScript check
npm test            # Run tests
npm run test:watch  # Watch mode
```

## License

MIT