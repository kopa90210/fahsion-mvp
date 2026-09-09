import type { Detection } from '../../contracts';
import { assertValid, validateDetections, validateImageUrl } from '../../validation';
import type { GarmentDetector } from '../detector';
import { DETECTION_PROMPT } from '../prompts';
import { parseDetectionResponse } from './parsing';
import type { AIProviderTransport } from './transport';

export class RealDetector implements GarmentDetector {
  constructor(private readonly transport: AIProviderTransport) {}

  async detect(imageUrl: string): Promise<Detection[]> {
    assertValid(validateImageUrl(imageUrl, 'imageUrl'), 'Detector input');
    const raw = await this.transport.generate({ stage: 'detection', imageUrl, prompt: DETECTION_PROMPT });
    const parsed = parseDetectionResponse(raw);
    return assertValid(validateDetections(parsed), 'RealDetector');
  }
}
