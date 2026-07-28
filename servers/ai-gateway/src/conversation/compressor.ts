import type { Conversation } from '../utils/types.js';
import { logger } from '../logging/logger.js';

const COMPRESSION_THRESHOLD = 0.7;

export function needsCompression(conv: Conversation, contextWindow: number): boolean {
  if (contextWindow <= 0) return false;
  const ratio = conv.tokenCount / contextWindow;
  return ratio >= COMPRESSION_THRESHOLD && conv.messages.length > 6;
}

export function compressMessages(
  messages: import('../utils/types.js').ChatMessage[],
  summary: string,
): import('../utils/types.js').ChatMessage[] {
  const systemMsg = messages.find((m) => m.role === 'system');
  const tail = messages.slice(-4);

  const result: import('../utils/types.js').ChatMessage[] = [];

  if (systemMsg) {
    result.push({
      role: 'system',
      content: `${systemMsg.content}\n\n[Previous conversation summary: ${summary}]`,
    });
  } else {
    result.push({
      role: 'system',
      content: `[Previous conversation summary: ${summary}]`,
    });
  }

  result.push(...tail);
  logger.debug(`Compressed ${messages.length} messages to ${result.length} with summary`);
  return result;
}