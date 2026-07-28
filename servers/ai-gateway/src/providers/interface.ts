import type { ChatMessage, ChatOptions, ChatChunk, ModelInfo, ProviderConfig } from '../utils/types.js';

export abstract class ProviderAdapter {
  abstract readonly name: string;
  protected config: ProviderConfig = {};

  configure(config: ProviderConfig): void {
    this.config = config;
  }

  abstract listModels(): Promise<ModelInfo[]>;

  abstract chat(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<ChatChunk>;

  protected baseUrl(): string {
    return (this.config.baseUrl as string) || '';
  }

  protected apiKey(): string {
    return (this.config.apiKey as string) || '';
  }
}