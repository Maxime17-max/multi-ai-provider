import { ProviderAdapter } from './interface.js';
import type { ChatMessage, ChatOptions, ChatChunk, ModelInfo, ProviderConfig } from '../utils/types.js';
import { ProviderError, TimeoutError } from '../utils/errors.js';

const OPENAI_COMPATIBLE_ENDPOINTS = ['/v1/chat/completions', '/chat/completions'];

export class LMStudioAdapter extends ProviderAdapter {
  readonly name = 'lm-studio';

  configure(config: ProviderConfig): void {
    super.configure(config);
  }

  private endpoint(): string {
    return (this.config.baseUrl as string) || 'http://localhost:1234/v1';
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.endpoint()}/models`);
      if (!res.ok) return this.defaultModels();
      const data = await res.json() as { data?: Array<{ id: string }> };
      if (!data.data || data.data.length === 0) return this.defaultModels();
      return data.data.map((m) => ({
        id: m.id,
        name: m.id,
        provider: 'lm-studio',
        capabilities: {
          streaming: true,
          toolCalling: true,
          vision: false,
          reasoning: false,
          contextWindow: 8192,
          maxTokens: 4096,
        },
      }));
    } catch {
      return this.defaultModels();
    }
  }

  private defaultModels(): ModelInfo[] {
    return [
      { id: 'local-model', name: 'Local Model', provider: 'lm-studio', capabilities: { streaming: true, toolCalling: true, vision: false, reasoning: false, contextWindow: 8192, maxTokens: 4096 } },
    ];
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<ChatChunk> {
    const timeoutMs = 120000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body = {
        model: options.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: options.stream ?? true,
      };

      const res = await fetch(`${this.endpoint()}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new ProviderError(`LM Studio error: ${text}`, 'lm-studio', res.status);
      }

      if (options.stream) {
        const reader = res.body?.getReader();
        if (!reader) throw new ProviderError('No response body', 'lm-studio');
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              yield { type: 'done', model: options.model };
              continue;
            }
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                yield { type: 'chunk', content: delta, model: options.model };
              }
            } catch { /* skip malformed */ }
          }
        }
      } else {
        const data = await res.json() as { choices?: Array<{ message?: { content: string } }> };
        yield { type: 'chunk', content: data.choices?.[0]?.message?.content || '', model: options.model };
        yield { type: 'done', model: options.model };
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new TimeoutError('lm-studio', timeoutMs);
      }
      if (err instanceof ProviderError) throw err;
      throw new ProviderError((err as Error).message, 'lm-studio');
    } finally {
      clearTimeout(timer);
    }
  }
}