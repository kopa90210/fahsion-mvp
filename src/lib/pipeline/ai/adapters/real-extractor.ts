import type { ExtractionResult } from '../../contracts';
import { assertValid, validateExtractionResult, validateImageUrl } from '../../validation';
import type { AttributeExtractor } from '../extractor';
import { EXTRACTION_PROMPT } from '../prompts';
import { parseExtractionResponse } from './parsing';
import type { AIProviderTransport } from './transport';

export class RealExtractor implements AttributeExtractor {
  constructor(private readonly transport: AIProviderTransport) {}

  async extract(rawImageUrl: string): Promise<ExtractionResult> {
    assertValid(validateImageUrl(rawImageUrl, 'rawImageUrl'), 'Extractor input');
    const raw = await this.transport.generate({ stage: 'extraction', imageUrl: rawImageUrl, prompt: EXTRACTION_PROMPT });
    const parsed = parseExtractionResponse(raw);
    return assertValid(validateExtractionResult(parsed), 'RealExtractor');
  }
}
