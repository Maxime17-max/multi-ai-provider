---
name: ai-switch
description: Switch the active AI provider and model for the multi-provider gateway
---

When the user wants to switch provider or model, follow these steps:

1. Call `ai_provider_list` to see which providers are configured.
2. If the user specified a provider name, call `ai_model_list provider="<name>"` to see available models.
3. Call `ai_switch_active provider="<name>" model="<id>"` with the chosen provider and model.
4. Confirm to the user: "Switched to {provider}/{model}".