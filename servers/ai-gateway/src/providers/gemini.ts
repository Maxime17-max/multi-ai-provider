import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProviderAdapter } from './interface.js';
import type { ChatMessage, ChatOptions, ChatChunk, ModelInfo, ProviderConfig } from '../utils/types.js';
import { RateLimitError, AuthError, ProviderError } from '../utils/errors.js';

const KNOWN_MODELS: ModelInfo[] = [
  { id: 'gemini-2.5-pro-exp-03-25', name: 'Gemini 2.5 Pro', provider: 'gemini', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: true, contextWindow: 1048576, maxTokens: 8192 } },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: false, contextWindow: 1048576, maxTokens: 8192 } },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: true, contextWindow: 1048576, maxTokens: 8192 } },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', capabilities: { streaming: true, toolCalling: true, vision: true, reasoning: false, contextWindow: 1048576, maxTokens: 8192 } },
];

export class GeminiAdapter extends ProviderAdapter {
  readonly name = 'gemini';
  private client: GoogleGenerativeAI | null = null;

  configure(config: ProviderConfig): void {
    super.configure(config);
    if (config.apiKey) {
      this.client = new GoogleGenerativeAI(config.apiKey as string);
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return KNOWN_MODELS;
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<ChatChunk> {
    if (!this.client) throw new AuthError('gemini');
    const model = this.client.getGenerativeModel({ model: options.model });

    const systemMsg = messages.find((m) => m.role === 'system');
    const history = messages
      .filter((m) => m.role !== 'system' && m.role !== 'user')
      .map((m) => ({ role: 'model' as const, parts: [{ text: m.content }] }));

    const lastUserMsg = messages.filter((m) => m.role === 'user').pop();

    try {
      const chat = model.startChat({
        systemInstruction: systemMsg ? { role: 'user', parts: [{ text: systemMsg.content }] } : undefined,
        history: history.length > 0 ? history : undefined,
      });

      if (options.stream) {
        const result = await chat.sendMessageStream(lastUserMsg?.content || '');
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            yield { type: 'chunk', content: text, model: options.model };
          }
        }
      } else {
        const result = await chat.sendMessage(lastUserMsg?.content || '');
        const text = result.response.text();
        yield { type: 'chunk', content: text, model: options.model };
      }

      yield { type: 'done', model: options.model };
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
          throw new RateLimitError('gemini');
        }
        if (err.message?.includes('API_KEY')) throw new AuthError('gemini');
        throw new ProviderError(err.message, 'gemini');
      }
      throw err;
    }
  }
}