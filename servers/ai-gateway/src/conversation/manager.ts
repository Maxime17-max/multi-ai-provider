import type { Conversation, ChatMessage } from '../utils/types.js';
import { logger } from '../logging/logger.js';

export class ConversationManager {
  private conversations = new Map<string, Conversation>();
  private dir: string;

  constructor(dataDir: string) {
    this.dir = dataDir;
  }

  private path(id: string): string {
    return `${this.dir}/conversations/${id}.json`;
  }

  async loadAll(): Promise<void> {
    try {
      const fs = await import('node:fs');
      const convDir = `${this.dir}/conversations`;
      if (!fs.existsSync(convDir)) return;
      const files = fs.readdirSync(convDir).filter((f: string) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const data = fs.readFileSync(`${convDir}/${file}`, 'utf-8');
          const conv = JSON.parse(data) as Conversation;
          this.conversations.set(conv.id, conv);
        } catch { /* skip corrupt */ }
      }
      logger.info(`Loaded ${this.conversations.size} conversations`);
    } catch {
      logger.info('No conversations directory found');
    }
  }

  create(provider: string, model: string): Conversation {
    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const conv: Conversation = {
      id,
      provider,
      model,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tokenCount: 0,
    };
    this.conversations.set(id, conv);
    logger.debug(`Conversation ${id} created`);
    return conv;
  }

  get(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  list(): Conversation[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  addMessage(id: string, message: ChatMessage): void {
    const conv = this.conversations.get(id);
    if (!conv) throw new Error(`Conversation ${id} not found`);
    conv.messages.push(message);
    conv.updatedAt = new Date().toISOString();
    conv.tokenCount = this.estimateTokens(conv.messages);
    this.save(id).catch(() => {});
  }

  delete(id: string): void {
    this.conversations.delete(id);
    const fs = import('node:fs');
    fs.then((m) => {
      try { m.unlinkSync(this.path(id)); } catch { /* ignore */ }
    });
  }

  private async save(id: string): Promise<void> {
    const conv = this.conversations.get(id);
    if (!conv) return;
    const fs = await import('node:fs');
    const dir = this.path(id).split('/').slice(0, -1).join('/');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.path(id), JSON.stringify(conv, null, 2));
  }

  estimateTokens(messages: ChatMessage[]): number {
    let total = 0;
    for (const msg of messages) {
      total += msg.content.length / 4;
    }
    return Math.round(total);
  }
}