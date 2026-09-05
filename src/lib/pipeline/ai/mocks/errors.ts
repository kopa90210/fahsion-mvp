/**
 * Phase 4B Gate 3: AI Provider Error
 *
 * Controlled error type thrown during mock or real AI provider failures.
 */

export class AIProviderError extends Error {
  public readonly providerName: string;
  public readonly code: string;

  constructor(message: string, providerName: string, code = 'AI_PROVIDER_ERROR') {
    super(`[${providerName}] ${message}`);
    this.name = 'AIProviderError';
    this.providerName = providerName;
    this.code = code;
  }
}
