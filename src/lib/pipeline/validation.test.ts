/**
 * Phase 4B Gate 3: Validation Unit Tests
 *
 * Verifies invariant enforcement and controlled validation error reporting.
 * Every test records: input, expected result, actual result.
 */

import { describe, expect, it } from 'vitest';
import {
  AIContractValidationError,
  assertValid,
  validateCategory,
  validateConfidence,
  validateCropBox,
  validateDetection,
  validateDetections,
  validateExtractedAttributes,
  validateExtractionResult,
  validateImageUrl,
  validateIsolationResult,
  validatePrettifyResult,
} from './validation';

describe('Gate 3 Invariant & Contract Validation', () => {
  describe('CropBox Validation & Invariants', () => {
    it('accepts valid CropBox at boundaries: x=0, y=0, x+w=1, y+h=1', () => {
      const input = { x: 0, y: 0, width: 1, height: 1 };
      const expected = { success: true, data: { x: 0, y: 0, width: 1, height: 1 } };
      const actual = validateCropBox(input);

      expect(actual.success).toBe(true);
      if (actual.success) {
        expect(actual.data).toEqual(expected.data);
      }
    });

    it('accepts valid normalized interior CropBox', () => {
      const input = { x: 0.15, y: 0.2, width: 0.5, height: 0.6 };
      const actual = validateCropBox(input);

      expect(actual.success).toBe(true);
      if (actual.success) {
        expect(actual.data.x).toBe(0.15);
        expect(actual.data.width).toBe(0.5);
      }
    });

    it('rejects CropBox when x < 0', () => {
      const input = { x: -0.01, y: 0.1, width: 0.5, height: 0.5 };
      const expectedErrorPath = 'box.x';
      const actual = validateCropBox(input);

      expect(actual.success).toBe(false);
      if (!actual.success) {
        expect(actual.errors.some((e) => e.path === expectedErrorPath)).toBe(true);
      }
    });

    it('rejects CropBox when x >= 1', () => {
      const input = { x: 1.0, y: 0.1, width: 0.5, height: 0.5 };
      const expectedErrorPath = 'box.x';
      const actual = validateCropBox(input);

      expect(actual.success).toBe(false);
      if (!actual.success) {
        expect(actual.errors.some((e) => e.path === expectedErrorPath)).toBe(true);
      }
    });

    it('rejects CropBox when y < 0', () => {
      const input = { x: 0.1, y: -0.2, width: 0.5, height: 0.5 };
      const expectedErrorPath = 'box.y';
      const actual = validateCropBox(input);

      expect(actual.success).toBe(false);
      if (!actual.success) {
        expect(actual.errors.some((e) => e.path === expectedErrorPath)).toBe(true);
      }
    });

    it('rejects CropBox when y >= 1', () => {
      const input = { x: 0.1, y: 1.05, width: 0.5, height: 0.5 };
      const expectedErrorPath = 'box.y';
      const actual = validateCropBox(input);

      expect(actual.success).toBe(false);
      if (!actual.success) {
        expect(actual.errors.some((e) => e.path === expectedErrorPath)).toBe(true);
      }
    });

    it('rejects CropBox when width <= 0', () => {
      const input = { x: 0.1, y: 0.1, width: 0, height: 0.5 };
      const expectedErrorPath = 'box.width';
      const actual = validateCropBox(input);

      expect(actual.success).toBe(false);
      if (!actual.success) {
        expect(actual.errors.some((e) => e.path === expectedErrorPath)).toBe(true);
      }
    });

    it('rejects CropBox when width > 1', () => {
      const input = { x: 0.1, y: 0.1, width: 1.2, height: 0.5 };
      const expectedErrorPath = 'box.width';
      const actual = validateCropBox(input);

      expect(actual.success).toBe(false);
      if (!actual.success) {
        expect(actual.errors.some((e) => e.path === expectedErrorPath)).toBe(true);
      }
    });

    it('rejects CropBox when height <= 0', () => {
      const input = { x: 0.1, y: 0.1, width: 0.5, height: -0.1 };
      const expectedErrorPath = 'box.height';
      const actual = validateCropBox(input);

      expect(actual.success).toBe(false);
      if (!actual.success) {
        expect(actual.errors.some((e) => e.path === expectedErrorPath)).toBe(true);
      }
    });

    it('rejects CropBox when height > 1', () => {
      const input = { x: 0.1, y: 0.1, width: 0.5, height: 1.5 };
      const expectedErrorPath = 'box.height';
      const actual = validateCropBox(input);

      expect(actual.success).toBe(false);
      if (!actual.success) {
        expect(actual.errors.some((e) => e.path === expectedErrorPath)).toBe(true);
      }
    });

    it('rejects CropBox when invariant x + width <= 1 is violated', () => {
      const input = { x: 0.6, y: 0.1, width: 0.5, height: 0.5 }; // x + width = 1.1
      const expectedErrorPath = 'box.x + width';
      const actual = validateCropBox(input);

      expect(actual.success).toBe(false);
      if (!actual.success) {
        expect(actual.errors.some((e) => e.path === expectedErrorPath)).toBe(true);
      }
    });

    it('rejects CropBox when invariant y + height <= 1 is violated', () => {
      const input = { x: 0.1, y: 0.7, width: 0.4, height: 0.4 }; // y + height = 1.1
      const expectedErrorPath = 'box.y + height';
      const actual = validateCropBox(input);

      expect(actual.success).toBe(false);
      if (!actual.success) {
        expect(actual.errors.some((e) => e.path === expectedErrorPath)).toBe(true);
      }
    });

    it('rejects non-numeric and non-finite CropBox values (NaN, Infinity, null, strings)', () => {
      const inputs = [
        { x: NaN, y: 0, width: 0.5, height: 0.5 },
        { x: 0, y: Infinity, width: 0.5, height: 0.5 },
        { x: '0.1', y: 0.2, width: 0.3, height: 0.4 },
        null,
        undefined,
      ];

      for (const input of inputs) {
        const actual = validateCropBox(input);
        expect(actual.success).toBe(false);
      }
    });
  });

  describe('Confidence Validation', () => {
    it('accepts valid confidence in range [0, 1]', () => {
      const inputs = [0, 0.5, 0.999, 1];
      for (const input of inputs) {
        const actual = validateConfidence(input);
        expect(actual.success).toBe(true);
      }
    });

    it('rejects confidence outside [0, 1] and non-numbers', () => {
      const inputs = [-0.1, 1.05, 2, NaN, Infinity, '0.8', null];
      for (const input of inputs) {
        const actual = validateConfidence(input);
        expect(actual.success).toBe(false);
      }
    });
  });

  describe('Image URL Validation', () => {
    it('accepts supported valid image URLs', () => {
      const validUrls = [
        'https://example.com/photo.jpg',
        'http://localhost:3000/image.png',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA',
        'mock://storage/isolated/garment-1.png',
        '/uploads/garment-1.png',
      ];

      for (const url of validUrls) {
        const actual = validateImageUrl(url);
        expect(actual.success).toBe(true);
      }
    });

    it('rejects invalid or empty image URLs without silent fallback', () => {
      const invalidUrls = ['', '   ', 'ftp://example.com/photo.jpg', null, 123];
      for (const url of invalidUrls) {
        const actual = validateImageUrl(url);
        expect(actual.success).toBe(false);
      }
    });
  });

  describe('Category Validation', () => {
    it('accepts canonical categories from existing taxonomy', () => {
      const valid = ['top', 'bottom', 'footwear', 'outerwear', 'accessory'];
      for (const cat of valid) {
        const actual = validateCategory(cat);
        expect(actual.success).toBe(true);
      }
    });

    it('rejects non-canonical categories', () => {
      const invalid = ['shirt', 'pants', 'shoes', 'dress', 'unknown', ''];
      for (const cat of invalid) {
        const actual = validateCategory(cat);
        expect(actual.success).toBe(false);
      }
    });
  });

  describe('Detection Validation', () => {
    it('accepts a valid Detection object', () => {
      const input = {
        box: { x: 0.1, y: 0.1, width: 0.8, height: 0.4 },
        category: 'top',
        confidence: 0.95,
        label: 'crewneck sweater',
      };
      const actual = validateDetection(input);
      expect(actual.success).toBe(true);
    });

    it('rejects detection with invalid CropBox or confidence', () => {
      const input = {
        box: { x: 0.9, y: 0.1, width: 0.5, height: 0.4 }, // x + w > 1
        category: 'top',
        confidence: 1.5, // > 1
      };
      const actual = validateDetection(input);
      expect(actual.success).toBe(false);
      if (!actual.success) {
        expect(actual.errors.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('validates a collection of detections and rejects if any are malformed', () => {
      const validCollection = [
        { box: { x: 0, y: 0, width: 0.5, height: 0.5 }, category: 'top', confidence: 0.9 },
        { box: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }, category: 'bottom', confidence: 0.85 },
      ];
      const actualValid = validateDetections(validCollection);
      expect(actualValid.success).toBe(true);

      const invalidCollection = [
        { box: { x: 0, y: 0, width: 0.5, height: 0.5 }, category: 'top', confidence: 0.9 },
        { box: { x: 0, y: 0, width: 2.0, height: 0.5 }, category: 'invalid', confidence: -1 },
      ];
      const actualInvalid = validateDetections(invalidCollection);
      expect(actualInvalid.success).toBe(false);
    });
  });

  describe('IsolationResult Validation', () => {
    it('accepts valid IsolationResult', () => {
      const input = {
        rawImageUrl: 'https://mock.storage/isolated/garment-1.png',
        box: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
        confidence: 0.98,
      };
      const actual = validateIsolationResult(input);
      expect(actual.success).toBe(true);
    });

    it('rejects IsolationResult with invalid image URL or out-of-bounds CropBox', () => {
      const input = {
        rawImageUrl: '',
        box: { x: -0.1, y: 0, width: 0.3, height: 0.4 },
        confidence: 0.98,
      };
      const actual = validateIsolationResult(input);
      expect(actual.success).toBe(false);
    });
  });

  describe('ExtractedAttributes and ExtractionResult Validation', () => {
    it('accepts valid ExtractedAttributes containing required fields', () => {
      const input = {
        category: 'top',
        displayName: 'White Oxford Shirt',
        color: { primary: 'white' },
        subcategory: 'button-up',
        formalityScore: 0.7,
      };
      const actual = validateExtractedAttributes(input);
      expect(actual.success).toBe(true);
    });

    it('rejects ExtractedAttributes when required fields are missing', () => {
      const missingCategory = { displayName: 'Shirt', color: { primary: 'white' } };
      const missingName = { category: 'top', color: { primary: 'white' } };
      const missingColor = { category: 'top', displayName: 'Shirt' };
      const missingColorPrimary = { category: 'top', displayName: 'Shirt', color: {} };

      expect(validateExtractedAttributes(missingCategory).success).toBe(false);
      expect(validateExtractedAttributes(missingName).success).toBe(false);
      expect(validateExtractedAttributes(missingColor).success).toBe(false);
      expect(validateExtractedAttributes(missingColorPrimary).success).toBe(false);
    });

    it('accepts valid complete ExtractionResult', () => {
      const input = {
        rawImageUrl: 'https://mock.storage/isolated/item.png',
        confidence: 0.94,
        confidencePerField: {
          category: 0.98,
          displayName: 0.95,
          color: 0.96,
        },
        attributes: {
          category: 'top',
          displayName: 'Navy Blazer',
          color: { primary: 'navy' },
        },
      };
      const actual = validateExtractionResult(input);
      expect(actual.success).toBe(true);
    });

    it('rejects ExtractionResult with out-of-bounds confidence or malformed field scores', () => {
      const input = {
        rawImageUrl: 'https://mock.storage/isolated/item.png',
        confidence: 1.2, // out of range
        confidencePerField: {
          category: -0.5, // out of range
        },
        attributes: {
          category: 'top',
          displayName: 'Navy Blazer',
          color: { primary: 'navy' },
        },
      };
      const actual = validateExtractionResult(input);
      expect(actual.success).toBe(false);
    });
  });

  describe('PrettifyResult Validation', () => {
    it('accepts valid PrettifyResult with done status and image URL', () => {
      const input = {
        status: 'done',
        originalImageUrl: 'https://mock.storage/raw.png',
        prettifiedImageUrl: 'https://mock.storage/pretty.png',
        error: null,
      };
      const actual = validatePrettifyResult(input);
      expect(actual.success).toBe(true);
    });

    it('accepts valid PrettifyResult with failed status and error message', () => {
      const input = {
        status: 'failed',
        originalImageUrl: 'https://mock.storage/raw.png',
        prettifiedImageUrl: null,
        error: 'Background enhancement failed',
      };
      const actual = validatePrettifyResult(input);
      expect(actual.success).toBe(true);
    });

    it('rejects PrettifyResult when status is done but prettifiedImageUrl is missing or invalid', () => {
      const input = {
        status: 'done',
        originalImageUrl: 'https://mock.storage/raw.png',
        prettifiedImageUrl: '',
      };
      const actual = validatePrettifyResult(input);
      expect(actual.success).toBe(false);
    });

    it('rejects PrettifyResult when status is failed but error is missing', () => {
      const input = {
        status: 'failed',
        originalImageUrl: 'https://mock.storage/raw.png',
        prettifiedImageUrl: null,
        error: '',
      };
      const actual = validatePrettifyResult(input);
      expect(actual.success).toBe(false);
    });

    it('rejects unknown status enum values', () => {
      const input = {
        status: 'pending', // not in allowed statuses
        originalImageUrl: 'https://mock.storage/raw.png',
      };
      const actual = validatePrettifyResult(input);
      expect(actual.success).toBe(false);
    });
  });

  describe('assertValid Helper', () => {
    it('unwraps data when validation succeeds', () => {
      const input = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };
      const res = validateCropBox(input);
      const unwrapped = assertValid(res, 'CropBox');
      expect(unwrapped.x).toBe(0.1);
    });

    it('throws AIContractValidationError with detailed errors when validation fails', () => {
      const input = { x: -1, y: 0.1, width: 0.5, height: 0.5 };
      const res = validateCropBox(input);

      expect(() => assertValid(res, 'CropBox')).toThrow(AIContractValidationError);
      try {
        assertValid(res, 'CropBox');
      } catch (err) {
        const aiErr = err as AIContractValidationError;
        expect(aiErr.errors.length).toBeGreaterThan(0);
        expect(aiErr.errors[0].path).toBe('box.x');
      }
    });
  });
});
