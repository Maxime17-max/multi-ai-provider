# Multi-AI Provider Plugin for Claude Code

A plugin that adds multi-provider AI integration to Claude Code via the official [MCP](https://modelcontextprotocol.io/) extension mechanism.

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

| Skill | Command | Description |
|-------|---------|-------------|
| ai-chat | `/multi-ai-provider:ai-chat` | Chat with current provider |
| ai-switch | `/multi-ai-provider:ai-switch` | Change provider/model |
| ai-list | `/multi-ai-provider:ai-list` | List providers and models |

## Available MCP Tools

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

## Plugin Manifest

```json
{
  "name": "multi-ai-provider",
  "version": "0.1.0",
  "description": "Multi-provider AI gateway for Claude Code",
  "author": {
    "name": "Community",
    "email": "community@example.com"
  },
  "license": "MIT",
  "mcpServers": {
    "ai-gateway": {
      "command": "npx",
      "args": ["tsx", "${CLAUDE_PLUGIN_ROOT}/servers/ai-gateway/src/index.ts"],
      "env": {
        "PLUGIN_DATA_DIR": "${CLAUDE_PLUGIN_DATA}"
      }
    }
  }
}
```

Note: The `author` field **must** be an object (`{ "name": "...", "email": "..." }`). A plain string will cause a manifest validation error.

## Architecture

```
Claude Code ──→ Plugin (skills)
                     │
                     ▼
          MCP Server (ai-gateway)
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
      OpenAI    Anthropic    Gemini ...
```

The MCP server runs as a local stdio subprocess. Provider adapters are loaded at startup. Configurations and conversation history are persisted in `${CLAUDE_PLUGIN_DATA}`.

## Troubleshooting

### Plugin not loading

```bash
# Verify the manifest is valid JSON
python3 -m json.tool ~/.claude/plugins/multi-ai-provider/.claude-plugin/plugin.json

# Check your Claude Code version
claude --version

# Restart with debug logging
claude --debug --plugin-dir ~/.claude/plugins/multi-ai-provider
```

Common errors:

| Error | Cause | Fix |
|-------|-------|-----|
| `author: Invalid input: expected object` | `author` is a string, must be object | Use `{ "name": "...", "email": "..." }` |
| `0 skills` after reload | Plugin didn't load | Check `/plugin` for the exact error |
| `Unknown command` | Plugin not loaded or wrong namespace | Use format `/multi-ai-provider:ai-xxx` |

### MCP server issues

```bash
# Check MCP server status in Claude Code
/mcp

# Verify the server's tool list
/mcp list-tools ai-gateway
```

## Development

```bash
cd servers/ai-gateway
npm run typecheck   # TypeScript check
npm test            # Run tests
npm run test:watch  # Watch mode
```

## Project Structure

```
multi-ai-provider/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── skills/                  # Skills (3)
│   ├── ai-chat/SKILL.md
│   ├── ai-switch/SKILL.md
│   └── ai-list/SKILL.md
├── hooks/
│   └── hooks.json           # PostToolUse hooks
├── servers/
│   └── ai-gateway/          # MCP server
│       ├── src/
│       │   ├── index.ts         # Entry point
│       │   ├── gateway.ts       # Core gateway
│       │   ├── providers/       # 6 adapters
│       │   ├── tools/           # 12 MCP tools
│       │   ├── conversation/    # History + compression
│       │   ├── fallback/        # Fallback routing
│       │   ├── config/          # Config persistence
│       │   ├── logging/         # Logging (secret-safe)
│       │   ├── models/          # Model capabilities
│       │   └── utils/           # Errors, validation
│       └── tests/               # 15 tests
└── config/
    └── providers.example.json
```

## Security

- API keys are stored in `${CLAUDE_PLUGIN_DATA}/providers.json` with mode `0600`
- All logs automatically redact API keys and secrets (pattern `[REDACTED]`)
- Input validation via Zod schemas on all MCP tool calls
- No calls to Anthropic's API — only the user's own provider keys are used
- Plugin uses only official Claude Code extension mechanisms

## License

MIT