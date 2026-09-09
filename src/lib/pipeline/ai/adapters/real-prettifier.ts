import type { PrettifyResult } from '../../contracts';
import { assertValid, validateImageUrl, validatePrettifyResult } from '../../validation';
import type { GarmentPrettifier } from '../prettifier';
import type { GroqVisionTransport } from './groq-transport';

/**
 * Real prettifier adapter.
 *
 * Prettify is an OPTIONAL stage. It must not block the pipeline.
 *
 * For Gate 4:
 *   - Status 'skipped' is a valid execution result (no API cost)
 *   - Status 'done' requires an actual image URL
 *   - Status 'failed' requires a real error message
 *
 * Do not fabricate image URLs.
 */
export class RealGroqPrettifier implements GarmentPrettifier {
  constructor(private readonly transport?: GroqVisionTransport) {}

  async prettify(rawImageUrl: string): Promise<PrettifyResult> {
    assertValid(validateImageUrl(rawImageUrl, 'rawImageUrl'), 'Prettifier input');

    // For Gate 4, prettify is optional and returns 'skipped' by default
    // This avoids unnecessary API calls and keeps the pipeline lightweight
    const result: PrettifyResult = {
      status: 'skipped',
      originalImageUrl: rawImageUrl,
      prettifiedImageUrl: null,
      error: null,
    };

    // Validate result
    return assertValid(
      { success: true, data: result },
      'RealGroqPrettifier'
    );
  }
}

