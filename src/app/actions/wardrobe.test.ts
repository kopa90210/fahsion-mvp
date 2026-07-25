/**
 * Tests for src/app/actions/wardrobe.ts
 *
 * Run with:  npx vitest run src/app/actions/wardrobe.test.ts
 *
 * All Supabase calls are mocked — no real database is hit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock setup
// ---------------------------------------------------------------------------

let tableResponses: Record<
  string,
  { data: unknown; error: unknown }
> = {}

function createQueryBuilder(tableName: string) {
  const response = () =>
    tableResponses[tableName] ?? { data: null, error: null }

  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => response()),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
  }

  builder.then = (resolve: (v: unknown) => unknown) => resolve(response())
  return builder
}

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn().mockImplementation((table: string) => createQueryBuilder(table)),
}

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}))

// ---------------------------------------------------------------------------
// Import functions under test
// ---------------------------------------------------------------------------

const { getCuratedPieces, getRankedPieces, searchPieces } = await import(
  '@/src/app/actions/wardrobe'
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'user-abc-123'

function mockAuthenticatedUser() {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: TEST_USER_ID } },
    error: null,
  })
}

/** Generate N mock wardrobe items in a given category. */
function makeItems(
  category: string,
  count: number,
  tagValue = 0.5,
) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${category}-${i}`,
    category,
    subcategory: category,
    image_url: `/img/${category}-${i}.jpg`,
    display_name: `${category} item ${i}`,
    layer_role: category === 'top' ? 'base_layer' : category,
    style_tags: { minimal: tagValue - i * 0.05 },
    model_confidence: 0.95,
    color: { primary: 'black', family_weights: { dark: 1.0 } },
    fit: { weights: { regular: 1.0 } },
  }))
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  tableResponses = {}
})

// ---------------------------------------------------------------------------
// getRankedPieces — threshold-ranked & paginated
// ---------------------------------------------------------------------------

describe('getRankedPieces', () => {
  it('produces visibly different result counts for sharp vs. broad fashion DNA', async () => {
    mockAuthenticatedUser()

    // 10 top items with varying tag weights
    const topItems = Array.from({ length: 10 }, (_, i) => ({
      id: `top-${i}`,
      category: 'top',
      subcategory: 'shirt',
      image_url: `/img/top-${i}.jpg`,
      display_name: `Top Item ${i}`,
      layer_role: 'base_layer',
      style_tags: { minimal: 1.0 - i * 0.1, streetwear: i * 0.1 },
    }))

    tableResponses['wardrobe_items'] = { data: topItems, error: null }

    // Test A: Sharp vector heavily weighted on minimal (1.0 vs 0.0)
    tableResponses['fashion_dna'] = {
      data: { vector: { minimal: 1.0, streetwear: 0.0 } },
      error: null,
    }
    const sharpResult = await getRankedPieces('top', 0)

    // Test B: Broad vector with flatter weights (0.5 vs 0.5)
    tableResponses['fashion_dna'] = {
      data: { vector: { minimal: 0.5, streetwear: 0.5 } },
      error: null,
    }
    const broadResult = await getRankedPieces('top', 0)

    // Sharp vector produces fewer high-confidence threshold matches than broad vector
    expect(sharpResult.items.length).not.toEqual(broadResult.items.length)
  })

  it('clamps result counts to floor of 4 and ceiling of 14', async () => {
    mockAuthenticatedUser()
    tableResponses['fashion_dna'] = {
      data: { vector: { minimal: 0.9 } },
      error: null,
    }

    // 20 items in top category
    const items = makeItems('top', 20, 0.9)
    tableResponses['wardrobe_items'] = { data: items, error: null }

    const res = await getRankedPieces('top', 0)
    expect(res.items.length).toBeGreaterThanOrEqual(4)
    expect(res.items.length).toBeLessThanOrEqual(14)
  })

  it('never exposes style_tags, score, or internal fields', async () => {
    mockAuthenticatedUser()
    tableResponses['fashion_dna'] = {
      data: { vector: { minimal: 0.8 } },
      error: null,
    }
    tableResponses['wardrobe_items'] = {
      data: makeItems('top', 5, 0.8),
      error: null,
    }

    const res = await getRankedPieces('top', 0)
    expect(res.items.length).toBeGreaterThan(0)

    for (const item of res.items) {
      expect(Object.keys(item).sort()).toEqual(
        ['category', 'display_name', 'id', 'image_url'].sort(),
      )
      expect(item).not.toHaveProperty('style_tags')
      expect(item).not.toHaveProperty('score')
    }
  })
})

// ---------------------------------------------------------------------------
// searchPieces — category-scoped ILIKE search
// ---------------------------------------------------------------------------

describe('searchPieces', () => {
  it('returns items matching query scoped strictly to requested category', async () => {
    mockAuthenticatedUser()

    const items = [
      { id: 't1', category: 'top', subcategory: 't-shirt', display_name: 'White Linen Shirt', image_url: null, layer_role: 'base_layer' },
      { id: 't2', category: 'top', subcategory: 'sweater', display_name: 'Black Hoodie', image_url: null, layer_role: 'base_layer' },
      { id: 'b1', category: 'bottom', subcategory: 'pant', display_name: 'White Chino Pants', image_url: null, layer_role: 'bottom' },
    ]
    tableResponses['wardrobe_items'] = { data: items, error: null }

    // Search for "White" in 'top' category — should return 't1' but NOT 'b1' (which is a bottom)
    const topResults = await searchPieces('top', 'white')
    expect(topResults).toHaveLength(1)
    expect(topResults[0].id).toBe('t1')

    // Search for "white" in 'bottom' category — should return 'b1'
    const bottomResults = await searchPieces('bottom', 'white')
    expect(bottomResults).toHaveLength(1)
    expect(bottomResults[0].id).toBe('b1')
  })

  it('prefers the stored category over mixed layer-role text when scoping search results', async () => {
    mockAuthenticatedUser()

    tableResponses['wardrobe_items'] = {
      data: [
        {
          id: 'mixed-top',
          category: 'top',
          subcategory: 'shirt',
          display_name: 'White Oxford Shirt',
          image_url: null,
          layer_role: 'bottom',
        },
      ],
      error: null,
    }

    const topResults = await searchPieces('top', 'white')
    expect(topResults).toHaveLength(1)
    expect(topResults[0].id).toBe('mixed-top')
  })

  it('never exposes internal or scoring fields in search results', async () => {
    mockAuthenticatedUser()

    tableResponses['wardrobe_items'] = {
      data: [
        { id: 't1', category: 'top', subcategory: 'shirt', display_name: 'Oxford Shirt', image_url: null, layer_role: 'base_layer', style_tags: { formal: 0.9 } },
      ],
      error: null,
    }

    const results = await searchPieces('top', 'oxford')
    expect(results).toHaveLength(1)
    expect(Object.keys(results[0]).sort()).toEqual(
      ['category', 'display_name', 'id', 'image_url'].sort(),
    )
  })
})

// ---------------------------------------------------------------------------
// getCuratedPieces — backward compatibility
// ---------------------------------------------------------------------------

describe('getCuratedPieces', () => {
  it('returns at most 5 items per category', async () => {
    mockAuthenticatedUser()
    tableResponses['fashion_dna'] = {
      data: { vector: { minimal: 0.8 } },
      error: null,
    }

    const items = [
      ...makeItems('top', 8, 0.9),
      ...makeItems('bottom', 7, 0.7),
      ...makeItems('footwear', 3, 0.6),
    ]
    tableResponses['wardrobe_items'] = { data: items, error: null }

    const result = await getCuratedPieces()

    for (const [, categoryItems] of Object.entries(result)) {
      expect(categoryItems.length).toBeLessThanOrEqual(5)
    }

    expect(result['top'].length).toBe(5)
  })
})
