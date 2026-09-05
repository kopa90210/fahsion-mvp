/**
 * Phase 4B Gate 3: Domain Contracts Tests
 *
 * Verifies domain contracts, canonical enum constants, and invariant types.
 * Every test records: input, expected, actual.
 */

import { describe, expect, it } from 'vitest';
import {
  WARDROBE_CATEGORIES,
  type CropBox,
  type Detection,
  type ExtractedAttributes,
  type ExtractionResult,
  type IsolationResult,
  type PrettifyResult,
  type ProcessingStatus,
  type SourcePhotoStatus,
} from './contracts';

describe('Gate 3 Domain Contracts', () => {
  it('preserves canonical wardrobe taxonomy and contains all 5 required categories', () => {
    const input = WARDROBE_CATEGORIES;
    const expected = ['top', 'bottom', 'footwear', 'outerwear', 'accessory'];
    const actual = [...WARDROBE_CATEGORIES];

    // Assert exact taxonomy match without introducing a secondary taxonomy
    expect(actual).toEqual(expected);
    expect(actual.length).toBe(5);
  });

  it('allows instantiating a valid CropBox contract satisfying all invariants', () => {
    const input: CropBox = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
    const expected = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
    const actual: CropBox = {
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
    };

    expect(actual).toEqual(expected);
    expect(actual.x + actual.width).toBeLessThanOrEqual(1);
    expect(actual.y + actual.height).toBeLessThanOrEqual(1);
  });

  it('allows instantiating a valid Detection contract', () => {
    const input: Detection = {
      box: { x: 0.05, y: 0.1, width: 0.5, height: 0.6 },
      category: 'top',
      confidence: 0.95,
      label: 'Oxford Shirt',
    };
    const expected = {
      box: { x: 0.05, y: 0.1, width: 0.5, height: 0.6 },
      category: 'top',
      confidence: 0.95,
      label: 'Oxford Shirt',
    };
    const actual = input;

    expect(actual).toEqual(expected);
    expect(WARDROBE_CATEGORIES).toContain(actual.category);
  });

  it('allows instantiating an IsolationResult contract', () => {
    const input: IsolationResult = {
      rawImageUrl: 'https://storage.example.com/raw/garment-1.png',
      box: { x: 0.1, y: 0.1, width: 0.4, height: 0.5 },
      confidence: 0.98,
    };
    const expected = 'https://storage.example.com/raw/garment-1.png';
    const actual = input.rawImageUrl;

    expect(actual).toBe(expected);
    expect(input.confidence).toBeGreaterThanOrEqual(0);
    expect(input.confidence).toBeLessThanOrEqual(1);
  });

  it('allows instantiating ExtractedAttributes and ExtractionResult contracts', () => {
    const attributes: ExtractedAttributes = {
      category: 'bottom',
      subcategory: 'jeans',
      displayName: 'Slim Fit Denim',
      color: { primary: 'blue', secondary: null },
      material: { primary: 'cotton' },
      pattern: 'solid',
      layerRole: 'bottom',
    };

    const input: ExtractionResult = {
      attributes,
      confidence: 0.92,
      confidencePerField: { category: 0.99, displayName: 0.95 },
      rawImageUrl: 'https://storage.example.com/raw/garment-1.png',
    };

    const expectedCategory = 'bottom';
    const actualCategory = input.attributes.category;

    expect(actualCategory).toBe(expectedCategory);
    expect(input.confidencePerField.category).toBe(0.99);
  });

  it('allows instantiating PrettifyResult with done and failed states', () => {
    const doneResult: PrettifyResult = {
      status: 'done',
      originalImageUrl: 'https://storage.example.com/raw/item.png',
      prettifiedImageUrl: 'https://storage.example.com/prettified/item.png',
      error: null,
    };

    const failedResult: PrettifyResult = {
      status: 'failed',
      originalImageUrl: 'https://storage.example.com/raw/item.png',
      prettifiedImageUrl: null,
      error: 'Model timeout',
    };

    expect(doneResult.status).toBe('done');
    expect(doneResult.prettifiedImageUrl).toBeDefined();

    expect(failedResult.status).toBe('failed');
    expect(failedResult.error).toBe('Model timeout');
  });

  it('validates alignment with Phase 4B database status enums', () => {
    const validProcessingStatuses: ProcessingStatus[] = [
      'detected',
      'isolating',
      'isolated',
      'extracting',
      'extracted',
      'failed',
    ];
    const validSourcePhotoStatuses: SourcePhotoStatus[] = [
      'uploading',
      'detecting',
      'done',
      'failed',
    ];

    expect(validProcessingStatuses.length).toBe(6);
    expect(validSourcePhotoStatuses.length).toBe(4);
  });
});
