import { describe, expect, it } from 'vitest';
import type { Detection, ExtractionResult, IsolationResult, PrettifyResult } from '../../contracts';
import type { GarmentDetector } from '../detector';
import type { AttributeExtractor } from '../extractor';
import type { GarmentIsolator } from '../isolator';
import type { GarmentPrettifier } from '../prettifier';
import { AIProviderError } from '../errors';
import { RealDetector, RealExtractor, RealIsolator, RealPrettifier } from './index';
import type { AIProviderTransport, AIRequest } from './transport';

class StubTransport implements AIProviderTransport {
  constructor(private readonly response: unknown, private readonly failure?: Error) {}
  async generate(_request: AIRequest): Promise<unknown> {
    if (this.failure) throw this.failure;
    return this.response;
  }
}

const detection: Detection = { box: { x: 0.1, y: 0.1, width: 0.4, height: 0.3 }, category: 'top', confidence: 0.9 };
const extraction: ExtractionResult = {
  rawImageUrl: 'https://example.test/garment.png',
  confidence: 0.9,
  confidencePerField: { category: 0.9 },
  attributes: { category: 'top', displayName: 'Blue shirt', color: { primary: 'blue' } },
};
const isolation: IsolationResult = { rawImageUrl: 'https://example.test/isolated.png', box: detection.box, confidence: 0.9 };
const prettify: PrettifyResult = { status: 'done', originalImageUrl: isolation.rawImageUrl, prettifiedImageUrl: 'https://example.test/pretty.png', error: null };

describe('real provider adapters', () => {
  it('implements each frozen Gate 3 interface and validates parsed responses', async () => {
    const detector: GarmentDetector = new RealDetector(new StubTransport(JSON.stringify([detection])));
    const isolator: GarmentIsolator = new RealIsolator(new StubTransport(isolation));
    const extractor: AttributeExtractor = new RealExtractor(new StubTransport(extraction));
    const prettifier: GarmentPrettifier = new RealPrettifier(new StubTransport(prettify));

    expect(await detector.detect('https://example.test/source.jpg')).toEqual([detection]);
    expect(await isolator.isolate('https://example.test/source.jpg', detection.box)).toEqual(isolation);
    expect(await extractor.extract(extraction.rawImageUrl)).toEqual(extraction);
    expect(await prettifier.prettify(isolation.rawImageUrl)).toEqual(prettify);
  });

  it('accepts known markdown transport wrapping but rejects semantic errors', async () => {
    const adapter = new RealDetector(new StubTransport('```json\n[{"box":{"x":0,"y":0,"width":0.5,"height":0.5},"category":"shirt","confidence":0.9}]\n```'));
    await expect(adapter.detect('https://example.test/source.jpg')).rejects.toMatchObject({ name: 'AIContractValidationError' });
  });

  it('preserves provider failures as AIProviderError', async () => {
    const failure = new AIProviderError('timeout', 'TestProvider', 'AI_PROVIDER_TRANSPORT_ERROR');
    const adapter = new RealExtractor(new StubTransport(null, failure));
    await expect(adapter.extract('https://example.test/garment.png')).rejects.toBe(failure);
  });

  it('rejects invalid crop boxes before making an isolation request', async () => {
    const transport = new StubTransport(isolation);
    const adapter = new RealIsolator(transport);
    await expect(adapter.isolate('https://example.test/source.jpg', { x: 0.8, y: 0, width: 0.5, height: 0.2 })).rejects.toMatchObject({ name: 'AIContractValidationError' });
  });
});
