import type { CropBox, IsolationResult } from '../../contracts';
import { assertValid, validateCropBox, validateImageUrl, validateIsolationResult } from '../../validation';
import type { GarmentIsolator } from '../isolator';
import { ISOLATION_PROMPT } from '../prompts';
import { parseIsolationResponse } from './parsing';
import type { AIProviderTransport } from './transport';

export class RealIsolator implements GarmentIsolator {
  constructor(private readonly transport: AIProviderTransport) {}

  async isolate(imageUrl: string, box: CropBox): Promise<IsolationResult> {
    assertValid(validateImageUrl(imageUrl, 'imageUrl'), 'Isolator input');
    assertValid(validateCropBox(box), 'Isolator crop box');
    const raw = await this.transport.generate({ stage: 'isolation', imageUrl, box, prompt: ISOLATION_PROMPT });
    const parsed = parseIsolationResponse(raw);
    return assertValid(validateIsolationResult(parsed), 'RealIsolator');
  }
}
