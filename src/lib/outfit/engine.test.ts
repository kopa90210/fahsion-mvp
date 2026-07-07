/**
 * Unit tests for src/lib/outfit/engine.ts
 *
 * Run with:  npx vitest run src/lib/outfit/engine.test.ts
 *       or:  npx jest src/lib/outfit/engine.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  recommendOutfits,
  scoreItem,
  scoreOutfit,
  type WardrobeItem,
} from './engine'
import type { StyleVector } from '@/src/lib/quiz/scoring'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DNA: StyleVector = {
  minimal: 0.8,
  streetwear: 0.2,
  formal: 0.1,
  bohemian: 0.0,
  edgy: 0.05,
  earth_tones: 0.3,
}

function item(
  id: string,
  layer_role: WardrobeItem['layer_role'],
  style_tags: Partial<StyleVector>,
): WardrobeItem {
  return { id, display_name: id, image_url: null, layer_role, style_tags }
}

/** 10-item wardrobe covering all required and optional slots */
const WARDROBE: WardrobeItem[] = [
  // base layers (3)
  item('tee-white',    'base_layer', { minimal: 0.9, earth_tones: 0.2 }),
  item('tee-graphic',  'base_layer', { streetwear: 0.8, edgy: 0.4 }),
  item('shirt-oxford', 'base_layer', { formal: 0.9, minimal: 0.5 }),

  // bottoms (3)
  item('chino-tan',   'bottom', { minimal: 0.7, earth_tones: 0.8 }),
  item('jeans-slim',  'bottom', { streetwear: 0.6, minimal: 0.4 }),
  item('trousers',    'bottom', { formal: 0.85, minimal: 0.6 }),

  // footwear (2)
  item('sneaker-white', 'footwear', { minimal: 0.9, streetwear: 0.5 }),
  item('derby-black',   'footwear', { formal: 0.9, minimal: 0.4 }),

  // outerwear (1 optional)
  item('bomber',     'outerwear', { streetwear: 0.7, edgy: 0.3 }),

  // accessory (1 optional)
  item('leather-belt', 'accessory', { minimal: 0.6, earth_tones: 0.4 }),
]

// ---------------------------------------------------------------------------
// scoreItem
// ---------------------------------------------------------------------------

describe('scoreItem', () => {
  it('returns 0 for a zero DNA vector', () => {
    const zeroDna: StyleVector = { minimal: 0, streetwear: 0, formal: 0, bohemian: 0, edgy: 0, earth_tones: 0 }
    expect(scoreItem(WARDROBE[0], zeroDna)).toBe(0)
  })

  it('returns 0 for an item with empty style_tags', () => {
    const empty = item('empty', 'base_layer', {})
    expect(scoreItem(empty, DNA)).toBe(0)
  })

  it('returns 1 for a perfect alignment', () => {
    const perfectDna: StyleVector = { minimal: 1 }
    const perfectItem = item('p', 'base_layer', { minimal: 1 })
    expect(scoreItem(perfectItem, perfectDna)).toBeCloseTo(1, 5)
  })

  it('returns value in [0, 1] for all wardrobe items', () => {
    for (const i of WARDROBE) {
      const s = scoreItem(i, DNA)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })
})

// ---------------------------------------------------------------------------
// scoreOutfit
// ---------------------------------------------------------------------------

describe('scoreOutfit', () => {
  it('returns 0 for an empty item list', () => {
    expect(scoreOutfit([], DNA)).toBe(0)
  })

  it('returns a value in [0, 1]', () => {
    const s = scoreOutfit(WARDROBE.slice(0, 3), DNA)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(1)
  })

  it('rounds to 4 decimal places', () => {
    const s = scoreOutfit(WARDROBE.slice(0, 3), DNA)
    expect(s).toBe(Math.round(s * 10_000) / 10_000)
  })
})

// ---------------------------------------------------------------------------
// recommendOutfits — acceptance criteria
// ---------------------------------------------------------------------------

describe('recommendOutfits', () => {
  it('returns exactly 5 outfits for a wardrobe with 10 items', () => {
    const results = recommendOutfits(WARDROBE, DNA)
    expect(results).toHaveLength(5)
  })

  it('each outfit has at least 3 items (base + bottom + footwear)', () => {
    const results = recommendOutfits(WARDROBE, DNA)
    for (const outfit of results) {
      expect(outfit.items.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('each outfit contains exactly one base_layer', () => {
    const results = recommendOutfits(WARDROBE, DNA)
    for (const outfit of results) {
      const count = outfit.items.filter((i) => i.layer_role === 'base_layer').length
      expect(count).toBe(1)
    }
  })

  it('each outfit contains exactly one bottom', () => {
    const results = recommendOutfits(WARDROBE, DNA)
    for (const outfit of results) {
      const count = outfit.items.filter((i) => i.layer_role === 'bottom').length
      expect(count).toBe(1)
    }
  })

  it('each outfit contains exactly one footwear', () => {
    const results = recommendOutfits(WARDROBE, DNA)
    for (const outfit of results) {
      const count = outfit.items.filter((i) => i.layer_role === 'footwear').length
      expect(count).toBe(1)
    }
  })

  it('each outfit contains at most one outerwear', () => {
    const results = recommendOutfits(WARDROBE, DNA)
    for (const outfit of results) {
      const count = outfit.items.filter((i) => i.layer_role === 'outerwear').length
      expect(count).toBeLessThanOrEqual(1)
    }
  })

  it('each outfit contains at most one accessory', () => {
    const results = recommendOutfits(WARDROBE, DNA)
    for (const outfit of results) {
      const count = outfit.items.filter((i) => i.layer_role === 'accessory').length
      expect(count).toBeLessThanOrEqual(1)
    }
  })

  it('all 5 outfits are distinct (no duplicate item sets)', () => {
    const results = recommendOutfits(WARDROBE, DNA)
    const keys = results.map((o) =>
      o.items.map((i) => i.id).sort().join('|'),
    )
    const unique = new Set(keys)
    expect(unique.size).toBe(results.length)
  })

  it('outfits are sorted by score descending', () => {
    const results = recommendOutfits(WARDROBE, DNA)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })

  it('each score is a number in [0, 1]', () => {
    const results = recommendOutfits(WARDROBE, DNA)
    for (const outfit of results) {
      expect(typeof outfit.score).toBe('number')
      expect(outfit.score).toBeGreaterThanOrEqual(0)
      expect(outfit.score).toBeLessThanOrEqual(1)
    }
  })

  it('ignores items with unrecognised layer_role', () => {
    const withBad = [
      ...WARDROBE,
      { ...item('unknown-role', 'base_layer', { minimal: 1 }), layer_role: 'handbag' as WardrobeItem['layer_role'] },
    ]
    // Should not throw and still return 5 outfits
    expect(() => recommendOutfits(withBad, DNA)).not.toThrow()
    expect(recommendOutfits(withBad, DNA)).toHaveLength(5)
  })

  it('respects topN option', () => {
    expect(recommendOutfits(WARDROBE, DNA, { topN: 3 })).toHaveLength(3)
    expect(recommendOutfits(WARDROBE, DNA, { topN: 1 })).toHaveLength(1)
  })

  it('returns fewer than topN when not enough valid combinations exist', () => {
    // Only 1 base + 1 bottom + 1 footwear → exactly 1 valid outfit
    const tiny: WardrobeItem[] = [
      item('b', 'base_layer', { minimal: 0.8 }),
      item('p', 'bottom',     { minimal: 0.7 }),
      item('s', 'footwear',   { minimal: 0.9 }),
    ]
    const results = recommendOutfits(tiny, DNA)
    expect(results).toHaveLength(1)
  })

  it('returns empty array when a required slot is missing', () => {
    // No footwear → no valid outfits
    const noShoes = WARDROBE.filter((i) => i.layer_role !== 'footwear')
    expect(recommendOutfits(noShoes, DNA)).toHaveLength(0)
  })
})
