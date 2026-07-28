export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class RateLimitError extends ProviderError {
  constructor(provider: string, public readonly retryAfter?: number) {
    const msg = retryAfter
      ? `Rate limited by ${provider}, retry after ${retryAfter}s`
      : `Rate limited by ${provider}`;
    super(msg, provider, 429);
    this.name = 'RateLimitError';
  }
}

export class TimeoutError extends ProviderError {
  constructor(provider: string, timeoutMs: number) {
    super(`Provider ${provider} timed out after ${timeoutMs}ms`, provider, 408);
    this.name = 'TimeoutError';
  }
}

export class AuthError extends ProviderError {
  constructor(provider: string) {
    super(`Authentication failed for provider ${provider}`, provider, 401);
    this.name = 'AuthError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}