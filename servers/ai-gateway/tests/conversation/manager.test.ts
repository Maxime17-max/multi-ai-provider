import { describe, it, expect } from 'vitest';
import { ConversationManager } from '../../src/conversation/manager.js';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

describe('ConversationManager', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-test-'));
  const manager = new ConversationManager(tmpDir);

  it('creates a conversation', () => {
    const conv = manager.create('openai', 'gpt-4o');
    expect(conv.id).toBeDefined();
    expect(conv.provider).toBe('openai');
    expect(conv.model).toBe('gpt-4o');
    expect(conv.messages).toHaveLength(0);
  });

  it('adds messages to a conversation', () => {
    const conv = manager.create('anthropic', 'claude-sonnet-4-20250514');
    manager.addMessage(conv.id, { role: 'user', content: 'Hello' });
    manager.addMessage(conv.id, { role: 'assistant', content: 'Hi there!' });

    const updated = manager.get(conv.id)!;
    expect(updated.messages).toHaveLength(2);
    expect(updated.messages[0].content).toBe('Hello');
    expect(updated.messages[1].content).toBe('Hi there!');
    expect(updated.tokenCount).toBeGreaterThan(0);
  });

  it('lists conversations most recent first', () => {
    const conv1 = manager.create('openai', 'gpt-4o');
    const conv2 = manager.create('anthropic', 'claude-sonnet-4-20250514');
    manager.addMessage(conv1.id, { role: 'user', content: 'test' });

    const list = manager.list();
    expect(list[0].id).toBe(conv1.id);
    expect(list.length).toBeGreaterThanOrEqual(4);
  });

  it('deletes a conversation', () => {
    const conv = manager.create('openai', 'gpt-4o');
    manager.delete(conv.id);
    expect(manager.get(conv.id)).toBeUndefined();
  });

  it('estimates token count', () => {
    const messages = [
      { role: 'user' as const, content: 'Hello world' },
      { role: 'assistant' as const, content: 'Hi there, how can I help you today?' },
    ];
    const tokens = manager.estimateTokens(messages);
    expect(tokens).toBeGreaterThan(0);
  });
});