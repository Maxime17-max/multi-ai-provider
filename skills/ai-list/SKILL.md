---
name: ai-list
description: List configured AI providers and their available models
---

When the user wants to see providers or models, follow these steps:

1. Call `ai_provider_list` to show all configured providers and their status.
2. For each configured provider (where `configured` is true), call `ai_model_list provider="<name>"` to get its models.
3. Format and present the results to the user in a readable way, showing provider name, status, and available models with their capabilities.