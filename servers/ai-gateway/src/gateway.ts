import type { ModelInfo, AppConfig, ProviderConfig } from './utils/types.js';
import { defaultConfig } from './utils/types.js';
import { logger } from './logging/logger.js';
import { ProviderAdapter } from './providers/interface.js';
import { OpenAIAdapter } from './providers/openai.js';
import { AnthropicAdapter } from './providers/anthropic.js';
import { GeminiAdapter } from './providers/gemini.js';
import { OpenRouterAdapter } from './providers/openrouter.js';
import { OllamaAdapter } from './providers/ollama.js';
import { LMStudioAdapter } from './providers/lm-studio.js';

const PROVIDER_MAP: Record<string, new () => ProviderAdapter> = {
  openai: OpenAIAdapter,
  anthropic: AnthropicAdapter,
  gemini: GeminiAdapter,
  openrouter: OpenRouterAdapter,
  ollama: OllamaAdapter,
  'lm-studio': LMStudioAdapter,
};

export class Gateway {
  private adapters = new Map<string, ProviderAdapter>();
  private config: AppConfig = defaultConfig();
  private modelCache = new Map<string, ModelInfo[]>();

  constructor() {
    for (const [name, ctor] of Object.entries(PROVIDER_MAP)) {
      const adapter = new ctor();
      this.adapters.set(name, adapter);
    }
  }

  private storePath(): string {
    return process.env.PLUGIN_DATA_DIR
      ? `${process.env.PLUGIN_DATA_DIR}/providers.json`
      : './providers.json';
  }

  async loadConfig(): Promise<void> {
    try {
      const fs = await import('node:fs');
      const data = fs.readFileSync(this.storePath(), 'utf-8');
      this.config = JSON.parse(data) as AppConfig;
      for (const [name, cfg] of Object.entries(this.config.providers)) {
        this.adapters.get(name)?.configure(cfg);
      }
      logger.info('Configuration loaded', { activeProvider: this.config.activeProvider });
    } catch {
      logger.info('No existing config found, using defaults');
    }
  }

  async saveConfig(): Promise<void> {
    const fs = await import('node:fs');
    const dir = this.storePath().split('/').slice(0, -1).join('/');
    if (dir) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storePath(), JSON.stringify(this.config, null, 2), 'utf-8');
    logger.debug('Configuration saved');
  }

  listProviders(): string[] {
    return Array.from(this.adapters.keys());
  }

  getConfiguredProviders(): Record<string, ProviderConfig> {
    return this.config.providers;
  }

  configureProvider(name: string, config: ProviderConfig): void {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Unknown provider: ${name}`);
    }
    adapter.configure(config);
    this.config.providers[name] = config;
    logger.info(`Provider ${name} configured`);
  }

  removeProvider(name: string): void {
    this.config.providers[name] = {};
    this.adapters.get(name)?.configure({});
    if (this.config.activeProvider === name) {
      this.config.activeProvider = '';
      this.config.activeModel = '';
    }
    logger.info(`Provider ${name} removed`);
  }

  getActiveProvider(): string {
    return this.config.activeProvider;
  }

  getActiveModel(): string {
    return this.config.activeModel;
  }

  setActive(provider: string, model: string): void {
    if (!this.adapters.has(provider)) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    if (!this.config.providers[provider]?.apiKey && provider !== 'ollama' && provider !== 'lm-studio') {
      throw new Error(`Provider ${provider} is not configured`);
    }
    this.config.activeProvider = provider;
    this.config.activeModel = model;
    logger.info(`Switched to ${provider}/${model}`);
  }

  async getModels(provider: string): Promise<ModelInfo[]> {
    const cached = this.modelCache.get(provider);
    if (cached) return cached;
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error(`Unknown provider: ${provider}`);
    const models = await adapter.listModels();
    this.modelCache.set(provider, models);
    return models;
  }

  getAdapter(name: string): ProviderAdapter | undefined {
    return this.adapters.get(name);
  }

  getConfig(): AppConfig {
    return this.config;
  }
}