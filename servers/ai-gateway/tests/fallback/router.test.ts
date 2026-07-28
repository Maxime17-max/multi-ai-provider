import { describe, it, expect } from 'vitest';
import { FallbackRouter } from '../../src/fallback/router.js';
import { ProviderAdapter } from '../../src/providers/interface.js';
import type { ChatMessage, ChatOptions, ChatChunk, ModelInfo, ProviderConfig, AppConfig, FallbackStrategy } from '../../src/utils/types.js';

class MockSuccessAdapter extends ProviderAdapter {
  readonly name = 'mock-success';
  async listModels(): Promise<ModelInfo[]> { return []; }
  async *chat(_messages: ChatMessage[], options: ChatOptions): AsyncGenerator<ChatChunk> {
    yield { type: 'chunk', content: 'from-mock-success', model: options.model };
    yield { type: 'done', model: options.model };
  }
}

class MockFailingAdapter extends ProviderAdapter {
  readonly name = 'mock-fail';
  async listModels(): Promise<ModelInfo[]> { return []; }
  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<ChatChunk> {
    throw new Error('Mock failure');
  }
}

describe('FallbackRouter', () => {
  it('returns result from primary provider when no fallback', async () => {
    const adapters = new Map<string, ProviderAdapter>();
    adapters.set('mock-success', new MockSuccessAdapter());

    const config: AppConfig = {
      providers: {},
      activeProvider: 'mock-success',
      activeModel: 'test-model',
      fallback: { enabled: false, strategy: 'sequential', order: [] },
    };

    const router = new FallbackRouter(adapters, config);
    const chunks: string[] = [];
    for await (const chunk of router.chatWithFallback([{ role: 'user', content: 'hi' }], { model: 'mock-success/test-model' })) {
      if (chunk.type === 'chunk') chunks.push(chunk.content || '');
    }
    expect(chunks.join('')).toBe('from-mock-success');
  });

  it('falls back to next provider when primary fails', async () => {
    const adapters = new Map<string, ProviderAdapter>();
    adapters.set('mock-fail', new MockFailingAdapter());
    adapters.set('mock-success', new MockSuccessAdapter());

    const config: AppConfig = {
      providers: {},
      activeProvider: 'mock-fail',
      activeModel: 'test-model',
      fallback: { enabled: true, strategy: 'sequential', order: ['mock-fail', 'mock-success'] },
    };

    const router = new FallbackRouter(adapters, config);
    const chunks: string[] = [];
    for await (const chunk of router.chatWithFallback([{ role: 'user', content: 'hi' }], { model: 'test-model' })) {
      if (chunk.type === 'chunk') chunks.push(chunk.content || '');
    }
    expect(chunks.join('')).toBe('from-mock-success');
  });

  it('throws when all providers fail', async () => {
    const adapters = new Map<string, ProviderAdapter>();
    adapters.set('mock-fail', new MockFailingAdapter());

    const config: AppConfig = {
      providers: {},
      activeProvider: 'mock-fail',
      activeModel: 'test-model',
      fallback: { enabled: true, strategy: 'sequential', order: ['mock-fail'] },
    };

    const router = new FallbackRouter(adapters, config);
    await expect(async () => {
      for await (const _ of router.chatWithFallback([{ role: 'user', content: 'hi' }], { model: 'test-model' })) { /* empty */ }
    }).rejects.toThrow('All fallback providers failed');
  });
});