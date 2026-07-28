---
name: ai-chat
description: Chat with an AI provider and model via the multi-provider gateway
---

When the user wants to chat with an AI model, follow these steps:

1. If the user specified a provider (e.g. "use openai") or a model (e.g. "use gpt-4o"), first call `ai_switch_active` to set it as active.
2. Call `ai_chat` with the user's message parameter: `message="..."`.
3. Return the response to the user.

If no provider is active when `ai_chat` is called and it returns an error, tell the user to first configure a provider with `ai_provider_configure` and set it active with `ai_switch_active`.