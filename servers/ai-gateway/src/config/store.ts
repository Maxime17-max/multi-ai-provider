import { z } from 'zod';
import { logger } from '../logging/logger.js';
import type { AppConfig, ProviderConfig, FallbackStrategy } from '../utils/types.js';
import { defaultConfig } from '../utils/types.js';

const StoreSchema = z.object({
  providers: z.record(z.record(z.unknown())),
  activeProvider: z.string(),
  activeModel: z.string(),
  fallback: z.object({
    enabled: z.boolean(),
    strategy: z.enum(['sequential']),
    order: z.array(z.string()),
  }),
});

export class ConfigStore {
  private config: AppConfig = defaultConfig();
  private dir: string;

  constructor(dataDir: string) {
    this.dir = dataDir;
  }

  private path(): string {
    return `${this.dir}/providers.json`;
  }

  async load(): Promise<void> {
    try {
      const fs = await import('node:fs');
      const raw = fs.readFileSync(this.path(), 'utf-8');
      const parsed = StoreSchema.parse(JSON.parse(raw));
      this.config = {
        providers: parsed.providers as Record<string, ProviderConfig>,
        activeProvider: parsed.activeProvider,
        activeModel: parsed.activeModel,
        fallback: parsed.fallback as FallbackStrategy,
      };
      logger.info('Config loaded from', this.path());
    } catch {
      logger.info('No saved config, using defaults');
    }
  }

  async save(): Promise<void> {
    const fs = await import('node:fs');
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.path(), JSON.stringify(this.config, null, 2), { mode: 0o600 });
    logger.debug('Config saved');
  }

  get(): AppConfig {
    return this.config;
  }

  setProvider(name: string, cfg: ProviderConfig): void {
    this.config.providers[name] = cfg;
  }

  removeProvider(name: string): void {
    delete this.config.providers[name];
    if (this.config.activeProvider === name) {
      this.config.activeProvider = '';
      this.config.activeModel = '';
    }
  }

  setActive(provider: string, model: string): void {
    this.config.activeProvider = provider;
    this.config.activeModel = model;
  }

  setFallback(fb: FallbackStrategy): void {
    this.config.fallback = fb;
  }
}