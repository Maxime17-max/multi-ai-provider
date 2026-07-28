import { describe, it, expect } from 'vitest';
import { needsCompression, compressMessages } from '../../src/conversation/compressor.js';
import type { Conversation, ChatMessage } from '../../src/utils/types.js';

describe('Compressor', () => {
  it('detects when compression is needed', () => {
    const conv: Conversation = {
      id: 'test',
      provider: 'openai',
      model: 'gpt-4o',
      messages: Array(20).fill({ role: 'user', content: 'hello' }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tokenCount: 90000,
    };
    expect(needsCompression(conv, 128000)).toBe(true);
  });

  it('does not compress when under threshold', () => {
    const conv: Conversation = {
      id: 'test',
      provider: 'openai',
      model: 'gpt-4o',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tokenCount: 1000,
    };
    expect(needsCompression(conv, 128000)).toBe(false);
  });

  it('compressMessages keeps system context and recent messages', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...Array(10).fill(null).map((_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`,
      })),
    ];
    const compressed = compressMessages(messages, 'Previous conversation summary');
    expect(compressed.length).toBe(5);
    expect(compressed[0].role).toBe('system');
    expect(compressed[0].content).toContain('Previous conversation summary');
  });

  it('creates system message with summary when no existing system message', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ];
    const compressed = compressMessages(messages, 'Summary text');
    expect(compressed[0].role).toBe('system');
    expect(compressed[0].content).toContain('Summary text');
  });
});