import { z } from 'zod';
import { ValidationError } from './errors.js';

export const ProviderConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
}).passthrough();

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

export const ChatOptionsSchema = z.object({
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  stream: z.boolean().optional().default(false),
  conversationId: z.string().optional(),
});

export const ProviderConfigureSchema = z.object({
  name: z.string().min(1),
  config: ProviderConfigSchema,
});

export const FallbackConfigSchema = z.object({
  enabled: z.boolean().default(false),
  strategy: z.enum(['sequential']).default('sequential'),
  order: z.array(z.string()).min(1).optional(),
});

export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.errors[0];
    throw new ValidationError(first.message, first.path.join('.'));
  }
  return result.data;
}