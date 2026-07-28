import type { Gateway } from '../gateway.js';
import type { ToolDefinition, ToolHandler } from './types.js';

export function providerTools(gateway: Gateway): { definitions: ToolDefinition[]; handlers: Record<string, ToolHandler> } {
  const definitions: ToolDefinition[] = [
    {
      name: 'ai_provider_list',
      description: 'List all configured AI providers and their status',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'ai_provider_configure',
      description: 'Configure an AI provider with API key and endpoint',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Provider name (openai, anthropic, gemini, openrouter, ollama, lm-studio)' },
          apiKey: { type: 'string', description: 'API key for the provider' },
          baseUrl: { type: 'string', description: 'Custom base URL (optional)' },
        },
        required: ['name'],
      },
    },
    {
      name: 'ai_provider_remove',
      description: 'Remove a configured provider',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Provider name to remove' },
        },
        required: ['name'],
      },
    },
    {
      name: 'ai_switch_active',
      description: 'Switch the active provider and model',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Provider name' },
          model: { type: 'string', description: 'Model ID' },
        },
        required: ['provider', 'model'],
      },
    },
  ];

  const handlers: Record<string, ToolHandler> = {
    ai_provider_list: async () => {
      const providers = gateway.getConfiguredProviders();
      const items = Object.entries(providers).map(([name, cfg]) => ({
        name,
        configured: !!cfg.apiKey,
        isActive: name === gateway.getActiveProvider(),
        baseUrl: cfg.baseUrl || '',
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(items, null, 2) }],
      };
    },

    ai_provider_configure: async (args: Record<string, unknown>) => {
      const name = args.name as string;
      const apiKey = args.apiKey as string | undefined;
      const baseUrl = args.baseUrl as string | undefined;

      if (!gateway.listProviders().includes(name)) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown provider: ${name}. Available: ${gateway.listProviders().join(', ')}` }],
        };
      }

      gateway.configureProvider(name, { apiKey, baseUrl });
      await gateway.saveConfig();
      return { content: [{ type: 'text', text: `Provider ${name} configured successfully` }] };
    },

    ai_provider_remove: async (args: Record<string, unknown>) => {
      const name = args.name as string;
      gateway.removeProvider(name);
      await gateway.saveConfig();
      return { content: [{ type: 'text', text: `Provider ${name} removed` }] };
    },

    ai_switch_active: async (args: Record<string, unknown>) => {
      try {
        gateway.setActive(args.provider as string, args.model as string);
        await gateway.saveConfig();
        return {
          content: [{ type: 'text', text: `Switched to ${args.provider}/${args.model}` }],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: 'text', text: (err as Error).message }],
        };
      }
    },
  };

  return { definitions, handlers };
}