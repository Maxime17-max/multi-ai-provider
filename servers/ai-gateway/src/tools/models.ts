import type { Gateway } from '../gateway.js';
import type { ToolDefinition, ToolHandler } from './types.js';
import { enhanceCapabilities } from '../models/capabilities.js';

export function modelTools(gateway: Gateway): { definitions: ToolDefinition[]; handlers: Record<string, ToolHandler> } {
  const definitions: ToolDefinition[] = [
    {
      name: 'ai_model_list',
      description: 'List available models for a provider (or all providers if not specified)',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Provider name (optional, lists all if omitted)' },
        },
        required: [],
      },
    },
    {
      name: 'ai_model_info',
      description: 'Get detailed capabilities for a specific model',
      inputSchema: {
        type: 'object',
        properties: {
          modelId: { type: 'string', description: 'Full model ID' },
          provider: { type: 'string', description: 'Provider name' },
        },
        required: ['modelId', 'provider'],
      },
    },
  ];

  const handlers: Record<string, ToolHandler> = {
    ai_model_list: async (args: Record<string, unknown>) => {
      const provider = args.provider as string | undefined;

      if (provider) {
        try {
          const models = await gateway.getModels(provider);
          const enhanced = models.map(enhanceCapabilities);
          return { content: [{ type: 'text', text: JSON.stringify(enhanced, null, 2) }] };
        } catch (err: unknown) {
          return { isError: true, content: [{ type: 'text', text: (err as Error).message }] };
        }
      }

      const allModels: Record<string, unknown[]> = {};
      for (const name of gateway.listProviders()) {
        try {
          allModels[name] = (await gateway.getModels(name)).map(enhanceCapabilities);
        } catch {
          allModels[name] = [];
        }
      }
      return { content: [{ type: 'text', text: JSON.stringify(allModels, null, 2) }] };
    },

    ai_model_info: async (args: Record<string, unknown>) => {
      const modelId = args.modelId as string;
      const provider = args.provider as string;
      try {
        const models = await gateway.getModels(provider);
        const model = models.find((m) => m.id === modelId);
        if (!model) {
          return { isError: true, content: [{ type: 'text', text: `Model ${modelId} not found for ${provider}` }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify(enhanceCapabilities(model), null, 2) }] };
      } catch (err: unknown) {
        return { isError: true, content: [{ type: 'text', text: (err as Error).message }] };
      }
    },
  };

  return { definitions, handlers };
}