import type { ChatMessage, ChatOptions, ChatChunk, FallbackStrategy, AppConfig } from '../utils/types.js';
import { ProviderAdapter } from '../providers/interface.js';
import { logger } from '../logging/logger.js';
import { RateLimitError, TimeoutError, AuthError } from '../utils/errors.js';

export class FallbackRouter {
  private adapters: Map<string, ProviderAdapter>;
  private strategy: FallbackStrategy;

  constructor(adapters: Map<string, ProviderAdapter>, config: AppConfig) {
    this.adapters = adapters;
    this.strategy = config.fallback;
  }

  update(config: AppConfig): void {
    this.strategy = config.fallback;
  }

  async *chatWithFallback(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<ChatChunk> {
    if (!this.strategy.enabled || this.strategy.order.length === 0) {
      const adapter = this.adapters.get(options.model.split('/')[0]);
      if (!adapter) throw new Error(`No adapter for model ${options.model}`);
      logger.debug('Fallback disabled, using primary provider');
      yield* adapter.chat(messages, options);
      return;
    }

    const providers = this.strategy.order;
    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of providers) {
      const adapter = this.adapters.get(provider);
      if (!adapter) {
        errors.push({ provider, error: 'Adapter not found' });
        continue;
      }

      try {
        logger.info(`Attempting ${provider} (fallback attempt ${errors.length + 1}/${providers.length})`);
        yield* adapter.chat(messages, { ...options, model: options.model });
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ provider, error: msg });
        logger.warn(`Provider ${provider} failed: ${msg}`);

        if (err instanceof AuthError) {
          continue;
        }

        const isFatal = (err instanceof RateLimitError || err instanceof TimeoutError);
        if (isFatal && errors.length < providers.length) {
          continue;
        }
      }
    }

    throw new Error(
      `All fallback providers failed:\n${errors.map((e) => `  - ${e.provider}: ${e.error}`).join('\n')}`,
    );
  }
}