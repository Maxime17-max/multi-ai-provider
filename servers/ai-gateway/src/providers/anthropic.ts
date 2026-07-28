import Anthropic from '@anthropic-ai/sdk';
import { ProviderAdapter } from './interface.js';
import type { ChatMessage, ChatOptions, ChatChunk, ModelInfo, ProviderConfig } from '../utils/types.js';
import { RateLimitError, AuthError, TimeoutError, ProviderError } from '../utils/errors.js';

const KNOWN_MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: true, contextWindow: 200000, maxTokens: 8192 } },
  { id: 'claude-haiku-4-20250514', name: 'Claude Haiku 4', provider: 'anthropic', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: false, contextWindow: 200000, maxTokens: 8192 } },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: true, contextWindow: 200000, maxTokens: 8192 } },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: true, contextWindow: 200000, maxTokens: 8192 } },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: false, contextWindow: 200000, maxTokens: 8192 } },
];

export class AnthropicAdapter extends ProviderAdapter {
  readonly name = 'anthropic';
  private client: Anthropic | null = null;

  configure(config: ProviderConfig): void {
    super.configure(config);
    if (config.apiKey) {
      this.client = new Anthropic({
        apiKey: config.apiKey as string,
        baseURL: (config.baseUrl as string) || undefined,
      });
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return KNOWN_MODELS;
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<ChatChunk> {
    if (!this.client) throw new AuthError('anthropic');
    const timeoutMs = 120000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const systemMsg = messages.find((m) => m.role === 'system');
      const userMessages = messages.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const stream = await this.client.messages.create({
        model: options.model,
        max_tokens: options.maxTokens ?? 8192,
        system: systemMsg?.content,
        messages: userMessages,
        stream: true,
      }, { signal: controller.signal });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          yield { type: 'chunk', content: event.delta.text, model: options.model };
        }
      }

      yield { type: 'done', model: options.model };
    } catch (err: unknown) {
      if (err instanceof Anthropic.APIError) {
        if (err.status === 429) throw new RateLimitError('anthropic');
        if (err.status === 401) throw new AuthError('anthropic');
        throw new ProviderError(err.message, 'anthropic', err.status);
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new TimeoutError('anthropic', timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}