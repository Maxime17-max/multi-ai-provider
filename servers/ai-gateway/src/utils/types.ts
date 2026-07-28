export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapabilities;
}

export interface ModelCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  vision: boolean;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  conversationId?: string;
}

export interface ChatChunk {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  model?: string;
  usage?: TokenUsage;
  error?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  [key: string]: unknown;
}

export interface Conversation {
  id: string;
  provider: string;
  model: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  summary?: string;
  tokenCount: number;
}

export interface FallbackStrategy {
  enabled: boolean;
  strategy: 'sequential';
  order: string[];
}

export interface AppConfig {
  providers: Record<string, ProviderConfig>;
  activeProvider: string;
  activeModel: string;
  fallback: FallbackStrategy;
}

export function defaultConfig(): AppConfig {
  return {
    providers: {},
    activeProvider: '',
    activeModel: '',
    fallback: { enabled: false, strategy: 'sequential', order: [] },
  };
}