import OpenAI from 'openai';
import { ProviderAdapter } from './interface.js';
import type { ChatMessage, ChatOptions, ChatChunk, ModelInfo, ProviderConfig } from '../utils/types.js';
import { RateLimitError, AuthError, TimeoutError, ProviderError } from '../utils/errors.js';
import { logger } from '../logging/logger.js';

const KNOWN_MODELS: ModelInfo[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: true, contextWindow: 128000, maxTokens: 16384 } },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: false, contextWindow: 128000, maxTokens: 16384 } },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: false, contextWindow: 128000, maxTokens: 4096 } },
  { id: 'gpt-4', name: 'GPT-4', provider: 'openai', capabilities: { streaming: true, toolCalling: true, vision: false, reasoning: false, contextWindow: 8192, maxTokens: 4096 } },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', capabilities: { streaming: true, toolCalling: true, vision: false, reasoning: false, contextWindow: 16385, maxTokens: 4096 } },
  { id: 'o1', name: 'o1', provider: 'openai', capabilities: { streaming: false, toolCalling: true, vision: true, reasoning: true, contextWindow: 200000, maxTokens: 100000 } },
  { id: 'o3-mini', name: 'o3 Mini', provider: 'openai', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: true, contextWindow: 200000, maxTokens: 100000 } },
];

export class OpenAIAdapter extends ProviderAdapter {
  readonly name = 'openai';
  private client: OpenAI | null = null;

  configure(config: ProviderConfig): void {
    super.configure(config);
    if (config.apiKey) {
      this.client = new OpenAI({
        apiKey: config.apiKey as string,
        baseURL: (config.baseUrl as string) || undefined,
      });
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      if (!this.client) return KNOWN_MODELS;
      const response = await this.client.models.list();
      const remoteIds = new Set(response.data.map((m) => m.id));
      const known = KNOWN_MODELS.filter((m) => remoteIds.has(m.id));
      if (known.length > 0) return known;
      return response.data.map((m) => ({
        id: m.id,
        name: m.id,
        provider: 'openai',
        capabilities: { streaming: true, toolCalling: true, vision: false, reasoning: false, contextWindow: 8192, maxTokens: 4096 },
      }));
    } catch {
      return KNOWN_MODELS;
    }
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<ChatChunk> {
    if (!this.client) throw new AuthError('openai');
    const timeoutMs = 120000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const stream = await this.client.chat.completions.create({
        model: options.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: options.stream ?? true,
      }, { signal: controller.signal });

      if (options.stream && Symbol.asyncIterator in stream) {
        for await (const chunk of stream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            yield { type: 'chunk', content: delta, model: options.model };
          }
        }
      } else {
        const nonStreamResult = stream as unknown as OpenAI.Chat.Completions.ChatCompletion;
        const content = nonStreamResult.choices?.[0]?.message?.content || '';
        yield { type: 'chunk', content, model: options.model };
      }

      yield {
        type: 'done',
        model: options.model,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    } catch (err: unknown) {
      if (err instanceof OpenAI.APIError) {
        if (err.status === 429) throw new RateLimitError('openai');
        if (err.status === 401) throw new AuthError('openai');
        throw new ProviderError(err.message, 'openai', err.status);
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new TimeoutError('openai', timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}