import { describe, it, expect } from 'vitest';
import { OpenAIAdapter } from '../../src/providers/openai.js';
import type { ChatMessage, ChatOptions } from '../../src/utils/types.js';

describe('OpenAIAdapter', () => {
  const adapter = new OpenAIAdapter();

  it('has the correct name', () => {
    expect(adapter.name).toBe('openai');
  });

  it('returns known models', async () => {
    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThan(0);
    const gpt4 = models.find((m) => m.id === 'gpt-4o');
    expect(gpt4).toBeDefined();
    expect(gpt4!.capabilities.streaming).toBe(true);
    expect(gpt4!.capabilities.vision).toBe(true);
  });

  it('throws AuthError when not configured', async () => {
    const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];
    const options: ChatOptions = { model: 'gpt-4o' };
    await expect(async () => {
      for await (const _ of adapter.chat(messages, options)) { /* empty */ }
    }).rejects.toThrow('Authentication failed');
  });
});