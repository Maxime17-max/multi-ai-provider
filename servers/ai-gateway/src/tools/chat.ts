import type { Gateway } from '../gateway.js';
import type { ToolDefinition, ToolHandler } from './types.js';
import type { ChatMessage } from '../utils/types.js';
import { FallbackRouter } from '../fallback/router.js';

export function chatTools(gateway: Gateway): { definitions: ToolDefinition[]; handlers: Record<string, ToolHandler> } {
  const fallbackRouter = new FallbackRouter(
    new Map(gateway.listProviders().map((n) => [n, gateway.getAdapter(n)!])),
    gateway.getConfig(),
  );

  const definitions: ToolDefinition[] = [
    {
      name: 'ai_chat',
      description: 'Send a chat message to an AI provider and get a response',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The user message' },
          provider: { type: 'string', description: 'Provider name (optional, uses active if omitted)' },
          model: { type: 'string', description: 'Model ID (optional, uses active if omitted)' },
          systemPrompt: { type: 'string', description: 'Optional system prompt' },
          temperature: { type: 'number', description: 'Sampling temperature (0-2)' },
          maxTokens: { type: 'number', description: 'Maximum tokens in response' },
          stream: { type: 'boolean', description: 'Whether to stream the response', default: false },
        },
        required: ['message'],
      },
    },
  ];

  const handlers: Record<string, ToolHandler> = {
    ai_chat: async (args: Record<string, unknown>) => {
      const message = args.message as string;
      let provider = (args.provider as string) || gateway.getActiveProvider();
      let model = (args.model as string) || gateway.getActiveModel();
      const systemPrompt = args.systemPrompt as string | undefined;
      const temperature = args.temperature as number | undefined;
      const maxTokens = args.maxTokens as number | undefined;
      const stream = args.stream as boolean | undefined;

      if (!provider || !model) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'No active provider/model. Use ai_switch_active or specify provider and model.' }],
        };
      }

      const adapter = gateway.getAdapter(provider);
      if (!adapter) {
        return { isError: true, content: [{ type: 'text', text: `Unknown provider: ${provider}` }] };
      }

      const messages: ChatMessage[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: message });

      try {
        const chunks: string[] = [];
        for await (const chunk of adapter.chat(messages, {
          model,
          temperature,
          maxTokens,
          stream: stream ?? true,
        })) {
          if (chunk.type === 'chunk' && chunk.content) {
            chunks.push(chunk.content);
          }
          if (chunk.type === 'error') {
            return { isError: true, content: [{ type: 'text', text: chunk.error || 'Unknown error' }] };
          }
        }
        return { content: [{ type: 'text', text: chunks.join('') }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { isError: true, content: [{ type: 'text', text: msg }] };
      }
    },
  };

  return { definitions, handlers };
}