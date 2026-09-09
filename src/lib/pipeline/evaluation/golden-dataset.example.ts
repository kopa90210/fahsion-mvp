/**
 * Phase 4B Gate 4: Golden Dataset Example
 *
 * This file demonstrates the expected format for evaluation datasets.
 * Each example contains:
 *   - image: URL or path to the image
 *   - expected: Object with garments array
 *     - garments: Array of GoldenGarment (category + normalized box)
 *
 * Canonical categories: top, bottom, footwear, outerwear, accessory
 * Box coordinates: normalized [0, 1] with invariants:
 *   - 0 <= x < 1
 *   - 0 <= y < 1
 *   - 0 < width <= 1
 *   - 0 < height <= 1
 *   - x + width <= 1
 *   - y + height <= 1
 */

import type { GoldenExample, GoldenDataset } from './types';

/**
 * Single garment example - simple t-shirt image.
 * Expected: One top garment detected in upper-center portion.
 */
export const goldenSingleTopExample: GoldenExample = {
  image: 'https://example.com/images/single-tshirt.jpg',
  expected: {
    garments: [
      {
        category: 'top',
        box: {
          x: 0.2,
          y: 0.1,
          width: 0.6,
          height: 0.4,
        },
      },
    ],
  },
};

/**
 * Multiple garments example - full outfit.
 * Expected: Top, bottom, and shoes all visible.
 */
export const goldenFullOutfitExample: GoldenExample = {
  image: 'https://example.com/images/full-outfit.jpg',
  expected: {
    garments: [
      {
        category: 'top',
        box: {
          x: 0.15,
          y: 0.08,
          width: 0.7,
          height: 0.35,
        },
      },
      {
        category: 'bottom',
        box: {
          x: 0.1,
          y: 0.38,
          width: 0.8,
          height: 0.35,
        },
      },
      {
        category: 'footwear',
        box: {
          x: 0.2,
          y: 0.75,
          width: 0.6,
          height: 0.2,
        },
      },
    ],
  },
};

/**
 * Overlapping garments example - layered clothing.
 * Expected: Jacket and shirt underneath both visible, box overlaps.
 */
export const goldenLayeredExample: GoldenExample = {
  image: 'https://example.com/images/layered-outfit.jpg',
  expected: {
    garments: [
      {
        category: 'outerwear',
        box: {
          x: 0.1,
          y: 0.1,
          width: 0.8,
          height: 0.5,
        },
      },
      {
        category: 'top',
        box: {
          x: 0.2,
          y: 0.15,
          width: 0.6,
          height: 0.35,
        },
      },
    ],
  },
};

/**
 * Accessory example - bag or hat.
 */
export const goldenAccessoryExample: GoldenExample = {
  image: 'https://example.com/images/bag-accessory.jpg',
  expected: {
    garments: [
      {
        category: 'accessory',
        box: {
          x: 0.65,
          y: 0.2,
          width: 0.3,
          height: 0.3,
        },
      },
    ],
  },
};

/**
 * Empty image example - no garments detected.
 */
export const goldenEmptyExample: GoldenExample = {
  image: 'https://example.com/images/no-garments.jpg',
  expected: {
    garments: [],
  },
};

/**
 * Sample golden dataset for initial evaluation.
 * Start with 5-10 examples, expand to 50-100 over time.
 */
export const sampleGoldenDataset: GoldenDataset = [
  goldenSingleTopExample,
  goldenFullOutfitExample,
  goldenLayeredExample,
  goldenAccessoryExample,
  goldenEmptyExample,
];

/**
 * Example of how to evaluate detections against the golden dataset:
 *
 * ```typescript
 * import { evaluateDetection } from './metrics';
 *
 * for (const example of sampleGoldenDataset) {
 *   const predictions = await detector.detect(example.image);
 *   const result = evaluateDetection(example, predictions);
 *   console.log(`Image: ${example.image}`);</n *   console.log(`  Precision: ${result.precision.toFixed(2)}`);\n *   console.log(`  Recall: ${result.recall.toFixed(2)}`);\n *   console.log(`  F1: ${result.f1Score.toFixed(2)}`);\n *   console.log(`  Mean IoU: ${result.meanIoU.toFixed(3)}`);\n * }\n * ```\n */\n