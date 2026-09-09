import { AIContractValidationError, assertValid, validateDetections, validateExtractionResult, validateIsolationResult, validatePrettifyResult } from '../../validation';
import type { Detection, ExtractionResult, IsolationResult, PrettifyResult } from '../../contracts';

function unwrap(payload: unknown): unknown {
  if (typeof payload !== 'string') {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const value = payload as Record<string, unknown>;
      for (const key of ['result', 'data', 'output', 'content', 'text']) {
        if (key in value) return unwrap(value[key]);
      }
    }
    return payload;
  }
  const trimmed = payload.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(trimmed) as unknown; } catch {
    throw new AIContractValidationError('Provider response was not valid JSON', [{ path: 'response', message: 'Expected JSON object or array', received: payload }]);
  }
}

function parse<T>(payload: unknown, validate: (value: unknown) => { success: true; data: T } | { success: false; errors: { path: string; message: string; received?: unknown }[] }, context: string): T {
  return assertValid(validate(unwrap(payload)), context);
}

export function parseDetectionResponse(payload: unknown): Detection[] {
  return parse(payload, validateDetections, 'Detection provider response');
}
export function parseIsolationResponse(payload: unknown): IsolationResult {
  return parse(payload, validateIsolationResult, 'Isolation provider response');
}
export function parseExtractionResponse(payload: unknown): ExtractionResult {
  return parse(payload, validateExtractionResult, 'Extraction provider response');
}
export function parsePrettifyResponse(payload: unknown): PrettifyResult {
  return parse(payload, validatePrettifyResult, 'Prettify provider response');
}
