import OpenAI from 'openai';
import { ProviderAdapter } from './interface.js';
import type { ChatMessage, ChatOptions, ChatChunk, ModelInfo, ProviderConfig } from '../utils/types.js';
import { RateLimitError, AuthError, TimeoutError, ProviderError } from '../utils/errors.js';
import { logger } from '../logging/logger.js';

export class OpenRouterAdapter extends ProviderAdapter {
  readonly name = 'openrouter';
  private client: OpenAI | null = null;

  configure(config: ProviderConfig): void {
    super.configure(config);
    if (config.apiKey) {
      this.client = new OpenAI({
        apiKey: config.apiKey as string,
        baseURL: (config.baseUrl as string) || 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/anthropics/claude-code',
          'X-Title': 'Claude Code Multi-AI Plugin',
        },
      });
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      if (!this.client) return [];
      const response = await this.client.models.list();
      return response.data.map((m) => ({
        id: m.id,
        name: m.id,
        provider: 'openrouter',
        capabilities: {
          streaming: true,
          toolCalling: true,
          vision: m.id.includes('vision') || m.id.includes('vl'),
          reasoning: m.id.includes('reasoning') || m.id.includes('thinking'),
          contextWindow: 128000,
          maxTokens: 4096,
        },
      }));
    } catch {
      return [
        { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openrouter', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: true, contextWindow: 128000, maxTokens: 16384 } },
        { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'openrouter', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: true, contextWindow: 200000, maxTokens: 8192 } },
        { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'openrouter', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: false, contextWindow: 1048576, maxTokens: 8192 } },
        { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout', provider: 'openrouter', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: false, contextWindow: 256000, maxTokens: 4096 } },
        { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'openrouter', capabilities: { streaming: true, toolCalling: false, vision: false, reasoning: true, contextWindow: 128000, maxTokens: 8192 } },
      ];
    }
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<ChatChunk> {
    if (!this.client) throw new AuthError('openrouter');
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
        const result = stream as unknown as OpenAI.Chat.Completions.ChatCompletion;
        yield { type: 'chunk', content: result.choices?.[0]?.message?.content || '', model: options.model };
      }

      yield { type: 'done', model: options.model };
    } catch (err: unknown) {
      if (err instanceof OpenAI.APIError) {
        if (err.status === 429) throw new RateLimitError('openrouter');
        if (err.status === 401) throw new AuthError('openrouter');
        throw new ProviderError(err.message, 'openrouter', err.status);
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new TimeoutError('openrouter', timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}