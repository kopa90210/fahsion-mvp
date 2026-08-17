/**
 * Tests for src/app/actions/outfit.ts
 *
 * Run with:  npx vitest run src/app/actions/outfit.test.ts
 *
 * All Supabase calls are mocked — no real database is hit.
 * The mock uses a chainable builder that mirrors the Supabase
 * PostgREST API so each `.from('table').select(...).eq(...)` chain
 * resolves to whatever fixture data the test configures.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock setup
// ---------------------------------------------------------------------------

/**
 * tableResponses lets each test say "when someone queries table X,
 * return this data/error". The mock builder reads from here.
 */
let tableResponses: Record<
  string,
  { data: unknown; error: unknown }
> = {}

let tableResponseSequences: Record<
  string,
  { data: unknown; error: unknown }[]
> = {}

/** Track which tables had .insert() called and with what payload. */
let insertCalls: Record<string, unknown[]> = {}

/** Track which tables had .update() called and with what payload. */
let updateCalls: Record<string, unknown[]> = {}

let queryBuilders: Array<{ table: string; builder: Record<string, unknown> }> = []

/**
 * Build a chainable mock that mimics the Supabase query builder.
 *
 * Every chaining method (select, eq, in, single, insert, update)
 * returns `this` so the chain keeps working.  The terminal methods
 * (single, execute, or awaiting the builder itself) resolve the
 * configured fixture from `tableResponses[tableName]`.
 */
function createQueryBuilder(tableName: string) {
  const response = () => {
    const sequence = tableResponseSequences[tableName]
    if (sequence?.length) {
      return sequence.shift() ?? { data: null, error: null }
    }
    return tableResponses[tableName] ?? { data: null, error: null }
  }

  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => response()),
    insert: vi.fn().mockImplementation((payload: unknown) => {
      if (!insertCalls[tableName]) insertCalls[tableName] = []
      insertCalls[tableName].push(payload)
      // Return a builder that supports chaining .select().single()
      const insertBuilder: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => response()),
        eq: vi.fn().mockReturnThis(),
      }
      // Make the insert builder thenable so `await supabase.from().insert()` works
      insertBuilder.then = (resolve: (v: unknown) => unknown) =>
        resolve(response())
      return insertBuilder
    }),
    update: vi.fn().mockImplementation((payload: unknown) => {
      if (!updateCalls[tableName]) updateCalls[tableName] = []
      updateCalls[tableName].push(payload)
      const updateBuilder: Record<string, unknown> = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => response()),
      }
      updateBuilder.then = (resolve: (v: unknown) => unknown) =>
        resolve(response())
      return updateBuilder
    }),
    upsert: vi.fn().mockReturnThis(),
  }

  // Make the builder itself thenable so plain `await` resolves it
  builder.then = (resolve: (v: unknown) => unknown) => resolve(response())
  queryBuilders.push({ table: tableName, builder })
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

vi.mock('@/src/lib/outfit/engine', async (importActual) => {
  const actual = await importActual<typeof import('@/src/lib/outfit/engine')>()
  return {
    ...actual,
    recommendOutfits: vi.fn(actual.recommendOutfits),
  }
})

// ---------------------------------------------------------------------------
// Import functions under test (after the mock is set up)
// ---------------------------------------------------------------------------

const {
  getCalibrationOutfits,
  getDailyOutfit,
  shouldShowOutfitCalibration,
  submitOutfitFeedback,
  skipOutfitCalibration,
} = await import('@/src/app/actions/outfit')
const outfitEngine = await import('@/src/lib/outfit/engine')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'user-abc-123'
const DNA = { minimal: 0.8, streetwear: 0.2, formal: 0.1 }

/** Convenience to set a Supabase table's mock response. */
function mockTable(table: string, data: unknown, error: unknown = null) {
  tableResponses[table] = { data, error }
}

function mockTableSequence(table: string, responses: Array<{ data: unknown; error?: unknown }>) {
  tableResponseSequences[table] = responses.map((response) => ({
    data: response.data,
    error: response.error ?? null,
  }))
}

function mockAuthenticatedUser() {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: TEST_USER_ID } },
    error: null,
  })
}

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  tableResponses = {}
  tableResponseSequences = {}
  insertCalls = {}
  updateCalls = {}
  queryBuilders = []
  delete process.env.ENABLE_AI_DAILY_OUTFITS
})

// ---------------------------------------------------------------------------
// getDailyOutfit
// ---------------------------------------------------------------------------

describe('getDailyOutfit', () => {
  it('returns null when the user has fewer than 3 valid wardrobe items', async () => {
    mockAuthenticatedUser()

    // DNA exists
    mockTable('fashion_dna', { vector: DNA })

    // Only 2 items — missing footwear, so the engine can't build a
    // valid outfit (requires base_layer + bottom + footwear).
    mockTable('user_wardrobe_items', [
      {
        wardrobe_items: {
          id: 'tee-1',
          display_name: 'White Tee',
          image_url: null,
          layer_role: 'base_layer',
          style_tags: { minimal: 0.9 },
        },
      },
      {
        wardrobe_items: {
          id: 'chino-1',
          display_name: 'Tan Chinos',
          image_url: null,
          layer_role: 'bottom',
          style_tags: { minimal: 0.7 },
        },
      },
    ])

    const result = await getDailyOutfit()
    expect(result).toBeNull()
  })

  it('returns a pre-generated AI outfit with stored reasons when the feature flag is on', async () => {
    process.env.ENABLE_AI_DAILY_OUTFITS = 'true'
    mockAuthenticatedUser()
    mockTable('fashion_dna', { vector: DNA })
    mockTable('user_wardrobe_items', [
      {
        wardrobe_items: {
          id: 'tee-1', display_name: 'Tee', image_url: null,
          layer_role: 'base_layer', style_tags: { minimal: 0.9 },
        },
      },
      {
        wardrobe_items: {
          id: 'chino-1', display_name: 'Chinos', image_url: null,
          layer_role: 'bottom', style_tags: { minimal: 0.7 },
        },
      },
      {
        wardrobe_items: {
          id: 'sneaker-1', display_name: 'Sneakers', image_url: null,
          layer_role: 'footwear', style_tags: { minimal: 0.8 },
        },
      },
    ])
    mockTable('outfits', {
      id: 'ai-outfit-1',
      item_ids: ['tee-1', 'chino-1', 'sneaker-1'],
      reasoning: ['stored reason one', 'stored reason two'],
    })

    const result = await getDailyOutfit()

    expect(result?.id).toBe('ai-outfit-1')
    expect(result?.items.map((item) => item.id)).toEqual(['tee-1', 'chino-1', 'sneaker-1'])
    expect(result?.reasons).toEqual(['stored reason one', 'stored reason two'])
    expect(outfitEngine.recommendOutfits).not.toHaveBeenCalled()
  })

  it('falls through to the live engine when a stored AI outfit references a missing item', async () => {
    process.env.ENABLE_AI_DAILY_OUTFITS = 'true'
    mockAuthenticatedUser()
    mockTable('fashion_dna', { vector: DNA })
    mockTable('user_wardrobe_items', [
      {
        wardrobe_items: {
          id: 'tee-1', display_name: 'Tee', image_url: null,
          layer_role: 'base_layer', style_tags: { minimal: 0.9 },
        },
      },
      {
        wardrobe_items: {
          id: 'chino-1', display_name: 'Chinos', image_url: null,
          layer_role: 'bottom', style_tags: { minimal: 0.7 },
        },
      },
      {
        wardrobe_items: {
          id: 'sneaker-1', display_name: 'Sneakers', image_url: null,
          layer_role: 'footwear', style_tags: { minimal: 0.8 },
        },
      },
    ])
    mockTableSequence('outfits', [
      {
        data: {
          id: 'stale-ai-outfit',
          item_ids: ['tee-1', 'chino-1', 'deleted-item'],
          reasoning: ['stale stored reason'],
        },
      },
      { data: [] },
      { data: { id: 'engine-outfit-1' } },
    ])

    const result = await getDailyOutfit()

    expect(result?.id).toBe('engine-outfit-1')
    expect(result?.items.map((item) => item.id)).toEqual(['tee-1', 'chino-1', 'sneaker-1'])
    expect(outfitEngine.recommendOutfits).toHaveBeenCalled()
  })

  it('falls through to the live engine when no stored daily AI row exists', async () => {
    process.env.ENABLE_AI_DAILY_OUTFITS = 'true'
    mockAuthenticatedUser()
    mockTable('fashion_dna', { vector: DNA })
    mockTable('user_wardrobe_items', [
      {
        wardrobe_items: {
          id: 'tee-1', display_name: 'Tee', image_url: null,
          layer_role: 'base_layer', style_tags: { minimal: 0.9 },
        },
      },
      {
        wardrobe_items: {
          id: 'chino-1', display_name: 'Chinos', image_url: null,
          layer_role: 'bottom', style_tags: { minimal: 0.7 },
        },
      },
      {
        wardrobe_items: {
          id: 'sneaker-1', display_name: 'Sneakers', image_url: null,
          layer_role: 'footwear', style_tags: { minimal: 0.8 },
        },
      },
    ])
    mockTableSequence('outfits', [
      { data: null },
      { data: [] },
      { data: { id: 'engine-outfit-1' } },
    ])

    const result = await getDailyOutfit()

    expect(result?.id).toBe('engine-outfit-1')
    expect(outfitEngine.recommendOutfits).toHaveBeenCalled()
  })

  it('does not query the AI daily read path when the feature flag is off', async () => {
    mockAuthenticatedUser()
    mockTable('fashion_dna', { vector: DNA })
    mockTable('user_wardrobe_items', [
      {
        wardrobe_items: {
          id: 'tee-1', display_name: 'Tee', image_url: null,
          layer_role: 'base_layer', style_tags: { minimal: 0.9 },
        },
      },
      {
        wardrobe_items: {
          id: 'chino-1', display_name: 'Chinos', image_url: null,
          layer_role: 'bottom', style_tags: { minimal: 0.7 },
        },
      },
      {
        wardrobe_items: {
          id: 'sneaker-1', display_name: 'Sneakers', image_url: null,
          layer_role: 'footwear', style_tags: { minimal: 0.8 },
        },
      },
    ])
    mockTableSequence('outfits', [
      { data: [] },
      { data: { id: 'engine-outfit-1' } },
    ])

    const result = await getDailyOutfit()
    const outfitsSelects = queryBuilders
      .filter((query) => query.table === 'outfits')
      .map((query) => query.builder.select as ReturnType<typeof vi.fn>)

    expect(result?.id).toBe('engine-outfit-1')
    expect(outfitsSelects.some((select) => select.mock.calls.some((call) => call[0] === 'id, item_ids, reasoning'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// shouldShowOutfitCalibration
// ---------------------------------------------------------------------------

describe('shouldShowOutfitCalibration', () => {
  it('returns false when has_completed_calibration is true, regardless of item count', async () => {
    mockAuthenticatedUser()

    mockTable('fashion_dna', { vector: DNA })
    mockTable('user_wardrobe_items', [
      {
        wardrobe_items: {
          id: 'tee-1', display_name: 'Tee', image_url: null,
          layer_role: 'base_layer', style_tags: { minimal: 0.9 },
        },
      },
      {
        wardrobe_items: {
          id: 'chino-1', display_name: 'Chinos', image_url: null,
          layer_role: 'bottom', style_tags: { minimal: 0.7 },
        },
      },
      {
        wardrobe_items: {
          id: 'sneaker-1', display_name: 'Sneakers', image_url: null,
          layer_role: 'footwear', style_tags: { minimal: 0.8 },
        },
      },
      {
        wardrobe_items: {
          id: 'shirt-1', display_name: 'Shirt', image_url: null,
          layer_role: 'base_layer', style_tags: { formal: 0.8 },
        },
      },
      {
        wardrobe_items: {
          id: 'trousers-1', display_name: 'Trousers', image_url: null,
          layer_role: 'bottom', style_tags: { formal: 0.8 },
        },
      },
      {
        wardrobe_items: {
          id: 'derby-1', display_name: 'Derbies', image_url: null,
          layer_role: 'footwear', style_tags: { formal: 0.9 },
        },
      },
    ])
    mockTable('users', { has_completed_calibration: true })

    const result = await shouldShowOutfitCalibration()
    expect(result).toBe(false)
  })

  it('returns true when at least one valid outfit can be generated', async () => {
    mockAuthenticatedUser()
    mockTable('fashion_dna', { vector: DNA })
    mockTable('user_wardrobe_items', [
      {
        wardrobe_items: {
          id: 'tee-1', display_name: 'Tee', image_url: null,
          layer_role: 'base_layer', style_tags: { minimal: 0.9 },
        },
      },
      {
        wardrobe_items: {
          id: 'chino-1', display_name: 'Chinos', image_url: null,
          layer_role: 'bottom', style_tags: { minimal: 0.7 },
        },
      },
      {
        wardrobe_items: {
          id: 'sneaker-1', display_name: 'Sneakers', image_url: null,
          layer_role: 'footwear', style_tags: { minimal: 0.8 },
        },
      },
    ])
    mockTable('users', { has_completed_calibration: false })

    const result = await shouldShowOutfitCalibration()
    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getCalibrationOutfits
// ---------------------------------------------------------------------------

describe('getCalibrationOutfits', () => {
  it('returns up to three calibration outfits when the wardrobe can support them', async () => {
    mockAuthenticatedUser()
    mockTable('fashion_dna', { vector: DNA })
    mockTable('user_wardrobe_items', [
      {
        wardrobe_items: {
          id: 'tee-1', display_name: 'Tee', image_url: null,
          layer_role: 'base_layer', style_tags: { minimal: 0.9 },
        },
      },
      {
        wardrobe_items: {
          id: 'tee-2', display_name: 'Button-up', image_url: null,
          layer_role: 'base_layer', style_tags: { formal: 0.8 },
        },
      },
      {
        wardrobe_items: {
          id: 'chino-1', display_name: 'Chinos', image_url: null,
          layer_role: 'bottom', style_tags: { minimal: 0.7 },
        },
      },
      {
        wardrobe_items: {
          id: 'trouser-1', display_name: 'Trousers', image_url: null,
          layer_role: 'bottom', style_tags: { formal: 0.9 },
        },
      },
      {
        wardrobe_items: {
          id: 'sneaker-1', display_name: 'Sneakers', image_url: null,
          layer_role: 'footwear', style_tags: { minimal: 0.8 },
        },
      },
      {
        wardrobe_items: {
          id: 'boot-1', display_name: 'Boots', image_url: null,
          layer_role: 'footwear', style_tags: { formal: 0.8 },
        },
      },
    ])
    mockTable('users', { has_completed_calibration: false })
    mockTable('outfits', { id: 'outfit-1' })

    const result = await getCalibrationOutfits()

    expect(result).toHaveLength(3)
    expect(insertCalls.outfits).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// skipOutfitCalibration
// ---------------------------------------------------------------------------

describe('skipOutfitCalibration', () => {
  it('updates has_completed_calibration to true on the users table', async () => {
    mockAuthenticatedUser()
    mockTable('users', { id: TEST_USER_ID, has_completed_calibration: true })

    const result = await skipOutfitCalibration()
    expect(result).toEqual({ success: true })

    expect(mockSupabase.from).toHaveBeenCalledWith('users')
  })
})

// ---------------------------------------------------------------------------
// submitOutfitFeedback — server-side re-fetch
// ---------------------------------------------------------------------------

describe('submitOutfitFeedback', () => {
  it('re-fetches item style_tags from the database rather than trusting client input', async () => {
    mockAuthenticatedUser()

    // Feedback insert succeeds
    mockTable('feedback', { id: 'fb-1' })

    // The outfit row on the server knows item_ids
    const serverItemIds = ['item-a', 'item-b']
    mockTable('outfits', { item_ids: serverItemIds })

    // Server-side style_tags — these are the REAL tags the DNA
    // update should be based on, NOT anything a client sends.
    const serverStyleTags = [
      { style_tags: { minimal: 0.9, earth_tones: 0.3 } },
      { style_tags: { minimal: 0.6 } },
    ]
    mockTable('wardrobe_items', serverStyleTags)

    // Current DNA vector
    mockTable('fashion_dna', { vector: { minimal: 0.5, earth_tones: 0.2 } })

    const result = await submitOutfitFeedback('outfit-xyz', true)

    // changedTags should be derived from the server items, not from
    // any client-supplied data (submitOutfitFeedback only takes
    // outfitId and liked — there is no items parameter).
    expect(result.changedTags).toContain('minimal')
    expect(result.changedTags).toContain('earth_tones')

    // The updated vector should have the liked delta (+0.05) applied
    expect(result.vector.minimal).toBeCloseTo(0.55, 2)
    expect(result.vector.earth_tones).toBeCloseTo(0.25, 2)

    // Verify the server actually queried the outfits table
    expect(mockSupabase.from).toHaveBeenCalledWith('outfits')

    // Verify the server queried wardrobe_items for style_tags
    expect(mockSupabase.from).toHaveBeenCalledWith('wardrobe_items')
  })

  it('does not accept an items parameter in its signature', () => {
    // TypeScript enforces this at compile time, but we verify at
    // runtime that the function only has 2 parameters (outfitId, liked).
    expect(submitOutfitFeedback.length).toBeLessThanOrEqual(2)
  })
})
