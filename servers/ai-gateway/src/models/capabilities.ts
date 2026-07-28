import type { ModelCapabilities, ModelInfo } from '../utils/types.js';

const CAPABILITY_OVERRIDES: Record<string, Partial<ModelCapabilities>> = {
  'gpt-4o': { contextWindow: 128000, maxTokens: 16384, vision: true, toolCalling: true, reasoning: true },
  'gpt-4o-mini': { contextWindow: 128000, maxTokens: 16384, vision: true, toolCalling: true },
  'gpt-4-turbo': { contextWindow: 128000, maxTokens: 4096, vision: true, toolCalling: true },
  'claude-sonnet-4-20250514': { contextWindow: 200000, maxTokens: 8192, vision: true, toolCalling: true, reasoning: true },
  'claude-haiku-4-20250514': { contextWindow: 200000, maxTokens: 8192, vision: true, toolCalling: true },
  'gemini-2.5-pro-exp-03-25': { contextWindow: 1048576, maxTokens: 8192, vision: true, toolCalling: true, reasoning: true },
  'gemini-2.0-flash': { contextWindow: 1048576, maxTokens: 8192, vision: true, toolCalling: true },
};

export function enhanceCapabilities(model: ModelInfo): ModelInfo {
  const overrides = CAPABILITY_OVERRIDES[model.id];
  if (!overrides) return model;
  return {
    ...model,
    capabilities: { ...model.capabilities, ...overrides },
  };
}

export function detectCapabilities(modelId: string, provider: string): ModelCapabilities {
  const lower = modelId.toLowerCase();
  return {
    streaming: !lower.includes('o1-preview'),
    toolCalling: !(lower.includes('o1') && !lower.includes('o3')),
    vision: lower.includes('vision') || lower.includes('vl') || lower.includes('llava') || lower.includes('gemini'),
    reasoning: lower.includes('reasoning') || lower.includes('thinking') || lower.includes('r1') || lower.startsWith('o1') || lower.startsWith('o3'),
    contextWindow: lower.includes('gemini') ? 1048576 : lower.includes('claude') ? 200000 : lower.includes('gpt-4o') ? 128000 : 8192,
    maxTokens: lower.includes('gpt-4o') ? 16384 : lower.includes('claude') ? 8192 : 4096,
  };
}