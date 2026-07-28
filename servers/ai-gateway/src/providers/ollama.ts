import { ProviderAdapter } from './interface.js';
import type { ChatMessage, ChatOptions, ChatChunk, ModelInfo, ProviderConfig } from '../utils/types.js';
import { ProviderError, TimeoutError } from '../utils/errors.js';

export class OllamaAdapter extends ProviderAdapter {
  readonly name = 'ollama';

  configure(config: ProviderConfig): void {
    super.configure(config);
  }

  private endpoint(): string {
    return (this.config.baseUrl as string) || 'http://localhost:11434';
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.endpoint()}/api/tags`);
      if (!res.ok) return this.defaultModels();
      const data = await res.json() as { models?: Array<{ name: string }> };
      if (!data.models || data.models.length === 0) return this.defaultModels();
      return data.models.map((m) => ({
        id: m.name,
        name: m.name,
        provider: 'ollama',
        capabilities: {
          streaming: true,
          toolCalling: true,
          vision: m.name.includes('vision') || m.name.includes('llava') || m.name.includes('bakllava'),
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
      { id: 'llama3.2', name: 'Llama 3.2', provider: 'ollama', capabilities: { streaming: true, toolCalling: true, vision: false, reasoning: false, contextWindow: 8192, maxTokens: 4096 } },
      { id: 'llama3.2-vision', name: 'Llama 3.2 Vision', provider: 'ollama', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: false, contextWindow: 8192, maxTokens: 4096 } },
      { id: 'mistral', name: 'Mistral', provider: 'ollama', capabilities: { streaming: true, toolCalling: false, vision: false, reasoning: false, contextWindow: 8192, maxTokens: 4096 } },
      { id: 'codellama', name: 'CodeLlama', provider: 'ollama', capabilities: { streaming: true, toolCalling: false, vision: false, reasoning: false, contextWindow: 16384, maxTokens: 4096 } },
      { id: 'mixtral', name: 'Mixtral', provider: 'ollama', capabilities: { streaming: true, toolCalling: false, vision: false, reasoning: false, contextWindow: 32768, maxTokens: 4096 } },
      { id: 'qwen2.5', name: 'Qwen 2.5', provider: 'ollama', capabilities: { streaming: true, toolCalling: true, vision: false, reasoning: false, contextWindow: 32768, maxTokens: 8192 } },
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
        stream: options.stream ?? true,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 4096,
        },
      };

      if (options.stream) {
        const res = await fetch(`${this.endpoint()}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new ProviderError(`Ollama error: ${text}`, 'ollama', res.status);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new ProviderError('No response body', 'ollama');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                yield { type: 'chunk', content: json.message.content, model: options.model };
              }
              if (json.done) {
                yield { type: 'done', model: options.model };
              }
            } catch { /* skip malformed */ }
          }
        }
      } else {
        const res = await fetch(`${this.endpoint()}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, stream: false }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new ProviderError(`Ollama error: ${text}`, 'ollama', res.status);
        }

        const data = await res.json() as { message?: { content: string } };
        yield { type: 'chunk', content: data.message?.content || '', model: options.model };
        yield { type: 'done', model: options.model };
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new TimeoutError('ollama', timeoutMs);
      }
      if (err instanceof ProviderError) throw err;
      throw new ProviderError((err as Error).message, 'ollama');
    } finally {
      clearTimeout(timer);
    }
  }
}