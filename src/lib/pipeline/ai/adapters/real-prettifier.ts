import type { PrettifyResult } from '../../contracts';
import { assertValid, validateImageUrl, validatePrettifyResult } from '../../validation';
import type { GarmentPrettifier } from '../prettifier';
import { PRETTIFY_PROMPT } from '../prompts';
import { parsePrettifyResponse } from './parsing';
import type { AIProviderTransport } from './transport';

export class RealPrettifier implements GarmentPrettifier {
  constructor(private readonly transport: AIProviderTransport) {}

  async prettify(rawImageUrl: string): Promise<PrettifyResult> {
    assertValid(validateImageUrl(rawImageUrl, 'rawImageUrl'), 'Prettifier input');
    const raw = await this.transport.generate({ stage: 'prettify', imageUrl: rawImageUrl, prompt: PRETTIFY_PROMPT });
    const parsed = parsePrettifyResponse(raw);
    return assertValid(validatePrettifyResult(parsed), 'RealPrettifier');
  }
}
