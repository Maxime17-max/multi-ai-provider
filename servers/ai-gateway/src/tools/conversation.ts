import type { Gateway } from '../gateway.js';
import type { ToolDefinition, ToolHandler } from './types.js';
import { ConversationManager } from '../conversation/manager.js';
import { needsCompression, compressMessages } from '../conversation/compressor.js';
import type { ChatMessage } from '../utils/types.js';

let convManager: ConversationManager;

export function initConversationTools(dataDir: string): void {
  convManager = new ConversationManager(dataDir);
  convManager.loadAll().catch(() => {});
}

export function conversationTools(gateway: Gateway): { definitions: ToolDefinition[]; handlers: Record<string, ToolHandler> } {
  const definitions: ToolDefinition[] = [
    {
      name: 'ai_conversation_list',
      description: 'List all saved conversations',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'ai_conversation_create',
      description: 'Create a new conversation',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Provider name' },
          model: { type: 'string', description: 'Model ID' },
        },
        required: ['provider', 'model'],
      },
    },
    {
      name: 'ai_conversation_get',
      description: 'Get conversation history',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Conversation ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'ai_conversation_delete',
      description: 'Delete a conversation',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Conversation ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'ai_conversation_chat',
      description: 'Send a message in a conversation context (auto-compresses if needed)',
      inputSchema: {
        type: 'object',
        properties: {
          conversationId: { type: 'string', description: 'Conversation ID' },
          message: { type: 'string', description: 'User message' },
          stream: { type: 'boolean', description: 'Whether to stream', default: false },
        },
        required: ['conversationId', 'message'],
      },
    },
  ];

  const handlers: Record<string, ToolHandler> = {
    ai_conversation_list: async () => {
      const list = convManager.list().map((c) => ({
        id: c.id,
        provider: c.provider,
        model: c.model,
        messageCount: c.messages.length,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        hasSummary: !!c.summary,
      }));
      return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
    },

    ai_conversation_create: async (args: Record<string, unknown>) => {
      const conv = convManager.create(args.provider as string, args.model as string);
      return { content: [{ type: 'text', text: JSON.stringify(conv, null, 2) }] };
    },

    ai_conversation_get: async (args: Record<string, unknown>) => {
      const conv = convManager.get(args.id as string);
      if (!conv) {
        return { isError: true, content: [{ type: 'text', text: `Conversation ${args.id} not found` }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(conv, null, 2) }] };
    },

    ai_conversation_delete: async (args: Record<string, unknown>) => {
      convManager.delete(args.id as string);
      return { content: [{ type: 'text', text: `Conversation ${args.id} deleted` }] };
    },

    ai_conversation_chat: async (args: Record<string, unknown>) => {
      const convId = args.conversationId as string;
      const message = args.message as string;
      const stream = args.stream as boolean | undefined;

      const conv = convManager.get(convId);
      if (!conv) {
        return { isError: true, content: [{ type: 'text', text: `Conversation ${convId} not found` }] };
      }

      convManager.addMessage(convId, { role: 'user', content: message });

      const adapter = gateway.getAdapter(conv.provider);
      if (!adapter) {
        return { isError: true, content: [{ type: 'text', text: `Provider ${conv.provider} not found` }] };
      }

      let messages: ChatMessage[];

      if (conv.summary && needsCompression(conv, 128000)) {
        messages = compressMessages(conv.messages, conv.summary);
      } else {
        messages = conv.messages;
      }

      try {
        const chunks: string[] = [];
        for await (const chunk of adapter.chat(messages, {
          model: conv.model,
          stream: stream ?? true,
        })) {
          if (chunk.type === 'chunk' && chunk.content) {
            chunks.push(chunk.content);
          }
          if (chunk.type === 'error') {
            return { isError: true, content: [{ type: 'text', text: chunk.error || 'Unknown error' }] };
          }
        }
        const fullResponse = chunks.join('');
        convManager.addMessage(convId, { role: 'assistant', content: fullResponse });
        return { content: [{ type: 'text', text: fullResponse }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { isError: true, content: [{ type: 'text', text: msg }] };
      }
    },
  };

  return { definitions, handlers };
}