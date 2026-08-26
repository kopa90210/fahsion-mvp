/**
 * Tests for src/app/actions/wishlist.ts
 *
 * Run with:  npx vitest run src/app/actions/wishlist.test.ts
 *
 * All Supabase calls are mocked — no real database is hit.
 * Follows the exact chainable query builder mock pattern used in
 * src/app/actions/wardrobe.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock — chainable query builder
// ---------------------------------------------------------------------------

let tableResponses: Record<string, { data: unknown; error: unknown }> = {}
let deleteCalls: Record<string, unknown[]> = {}
let updateCalls: Record<string, unknown[]> = {}
let insertCalls: Record<string, unknown[]> = {}

type QueryBuilder = Record<string, unknown>

function createQueryBuilder(tableName: string): QueryBuilder {
  const response = () => tableResponses[tableName] ?? { data: null, error: null }

  const builder: QueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => response()),
    delete: vi.fn().mockImplementation(() => {
      if (!deleteCalls[tableName]) deleteCalls[tableName] = []
      deleteCalls[tableName].push(tableName)
      return builder
    }),
    update: vi.fn().mockImplementation((payload: unknown) => {
      if (!updateCalls[tableName]) updateCalls[tableName] = []
      updateCalls[tableName].push(payload)
      return builder
    }),
    insert: vi.fn().mockImplementation((payload: unknown) => {
      if (!insertCalls[tableName]) insertCalls[tableName] = []
      insertCalls[tableName].push(payload)
      return builder
    }),
  }

  builder.then = (resolve: (v: unknown) => unknown) => resolve(response())
  return builder
}

const mockStorageUpload = vi.fn()
const mockStorageGetPublicUrl = vi.fn()

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn().mockImplementation((table: string) => createQueryBuilder(table)),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: mockStorageUpload,
      getPublicUrl: mockStorageGetPublicUrl,
    }),
  },
}

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}))

// ---------------------------------------------------------------------------
// Import functions under test
// ---------------------------------------------------------------------------

const {
  getWishlistItems,
  addWishlistItem,
  updateWishlistItemAttributes,
  removeWishlistItem,
} = await import('@/src/app/actions/wishlist')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'user-test-wishlist-001'

function mockAuthenticatedUser(id = TEST_USER_ID) {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id } },
    error: null,
  })
}

function mockUnauthenticated() {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: new Error('Not authenticated'),
  })
}

function makeWishlistRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wish-item-1',
    user_id: TEST_USER_ID,
    category: 'footwear',
    subcategory: 'chelsea boot',
    display_name: 'Tan Chelsea Boots',
    brand: 'Clarks',
    image_url: 'https://cdn.example.com/wish.jpg',
    color: { primary: 'tan' },
    fit: {},
    style_tags: { classic: 1 },
    layer_role: 'footwear',
    notes: 'Under £200',
    created_at: '2025-06-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  tableResponses = {}
  deleteCalls = {}
  updateCalls = {}
  insertCalls = {}
  mockStorageUpload.mockResolvedValue({ error: null })
  mockStorageGetPublicUrl.mockReturnValue({
    data: { publicUrl: 'https://cdn.example.com/wishlist/test.jpg' },
  })
  mockSupabase.storage.from.mockReturnValue({
    upload: mockStorageUpload,
    getPublicUrl: mockStorageGetPublicUrl,
  })
})

// ---------------------------------------------------------------------------
// getWishlistItems
// ---------------------------------------------------------------------------

describe('getWishlistItems', () => {
  it('returns the calling user\'s wishlist items with normalized categories', async () => {
    mockAuthenticatedUser()
    tableResponses['wishlist_items'] = {
      data: [makeWishlistRow(), makeWishlistRow({ id: 'wish-item-2', category: 'top', layer_role: 'base_layer', display_name: 'White Oxford' })],
      error: null,
    }

    const items = await getWishlistItems()
    expect(items).toHaveLength(2)
    expect(items[0].category).toBe('footwear')
    expect(items[0].display_name).toBe('Tan Chelsea Boots')
    expect(items[1].category).toBe('top')
  })

  it('applies normalizeWardrobeItem for items with non-canonical category', async () => {
    mockAuthenticatedUser()
    tableResponses['wishlist_items'] = {
      data: [makeWishlistRow({ category: null, subcategory: 'sneaker', layer_role: 'footwear' })],
      error: null,
    }

    const items = await getWishlistItems()
    // normalizeWardrobeItem should infer 'footwear' from subcategory
    expect(items[0].category).toBe('footwear')
  })

  it('returns empty array when user has no wishlist items', async () => {
    mockAuthenticatedUser()
    tableResponses['wishlist_items'] = { data: [], error: null }
    const items = await getWishlistItems()
    expect(items).toHaveLength(0)
  })

  it('throws when unauthenticated', async () => {
    mockUnauthenticated()
    await expect(getWishlistItems()).rejects.toThrow('Not authenticated')
  })

  it('never exposes internal DB fields beyond the WishlistItem shape', async () => {
    mockAuthenticatedUser()
    tableResponses['wishlist_items'] = { data: [makeWishlistRow()], error: null }

    const items = await getWishlistItems()
    const allowedKeys = [
      'id', 'user_id', 'category', 'layer_role', 'subcategory',
      'display_name', 'brand', 'image_url', 'color', 'fit',
      'style_tags', 'notes', 'created_at',
    ].sort()

    expect(Object.keys(items[0]).sort()).toEqual(allowedKeys)
  })
})

// ---------------------------------------------------------------------------
// addWishlistItem
// ---------------------------------------------------------------------------

describe('addWishlistItem', () => {
  it('inserts a row with the correct user_id and normalized category', async () => {
    mockAuthenticatedUser()
    tableResponses['wishlist_items'] = { data: { id: 'new-wish-id' }, error: null }

    const formData = new FormData()
    formData.append('display_name', 'Camel Overcoat')
    formData.append('category', 'outerwear')
    formData.append('brand', 'Margaret Howell')
    formData.append('notes', 'Autumn 2025')

    const result = await addWishlistItem(formData)
    expect(result.id).toBe('new-wish-id')

    const [insertPayload] = insertCalls['wishlist_items'] as Array<Record<string, unknown>>
    expect(insertPayload.user_id).toBe(TEST_USER_ID)
    expect(insertPayload.category).toBe('outerwear')
    expect(insertPayload.layer_role).toBe('outerwear')
    expect(insertPayload.display_name).toBe('Camel Overcoat')
    expect(insertPayload.brand).toBe('Margaret Howell')
    expect(insertPayload.notes).toBe('Autumn 2025')
  })

  it('maps non-canonical category through normalizeWardrobeItem before insert', async () => {
    mockAuthenticatedUser()
    tableResponses['wishlist_items'] = { data: { id: 'shoe-wish-id' }, error: null }

    const formData = new FormData()
    formData.append('display_name', 'Chelsea Boots')
    formData.append('category', 'shoe') // non-canonical → should become 'footwear'

    await addWishlistItem(formData)

    const [insertPayload] = insertCalls['wishlist_items'] as Array<Record<string, unknown>>
    expect(insertPayload.category).toBe('footwear')
    expect(insertPayload.layer_role).toBe('footwear')
  })

  it('uploads photo to wishlist-images bucket when a file is provided', async () => {
    mockAuthenticatedUser()
    tableResponses['wishlist_items'] = { data: { id: 'photo-wish-id' }, error: null }

    const formData = new FormData()
    formData.append('display_name', 'White Sneakers')
    formData.append('category', 'footwear')
    const fakeFile = new File(['pixel'], 'sneaker.jpg', { type: 'image/jpeg' })
    formData.append('file', fakeFile)

    await addWishlistItem(formData)

    expect(mockStorageUpload).toHaveBeenCalledOnce()
    const [bucket] = mockSupabase.storage.from.mock.calls[0]
    expect(bucket).toBe('wishlist-images')

    const [insertPayload] = insertCalls['wishlist_items'] as Array<Record<string, unknown>>
    expect(insertPayload.image_url).toContain('https://cdn.example.com')
  })

  it('inserts without image_url when no file is provided', async () => {
    mockAuthenticatedUser()
    tableResponses['wishlist_items'] = { data: { id: 'no-photo-id' }, error: null }

    const formData = new FormData()
    formData.append('display_name', 'Linen Trousers')
    formData.append('category', 'bottom')

    await addWishlistItem(formData)

    expect(mockStorageUpload).not.toHaveBeenCalled()

    const [insertPayload] = insertCalls['wishlist_items'] as Array<Record<string, unknown>>
    expect(insertPayload.image_url).toBeNull()
  })

  it('throws when unauthenticated', async () => {
    mockUnauthenticated()
    const formData = new FormData()
    await expect(addWishlistItem(formData)).rejects.toThrow('Not authenticated')
  })
})

// ---------------------------------------------------------------------------
// updateWishlistItemAttributes
// ---------------------------------------------------------------------------

describe('updateWishlistItemAttributes', () => {
  it('sends partial update to wishlist_items and derives layer_role from category', async () => {
    mockAuthenticatedUser()
    tableResponses['wishlist_items'] = { data: null, error: null }

    await updateWishlistItemAttributes('wish-item-1', {
      display_name: 'Dark Brown Chelsea Boots',
      category: 'footwear',
    })

    const [payload] = updateCalls['wishlist_items'] as Array<Record<string, unknown>>
    expect(payload.display_name).toBe('Dark Brown Chelsea Boots')
    expect(payload.category).toBe('footwear')
    expect(payload.layer_role).toBe('footwear')
  })

  it('can update notes field', async () => {
    mockAuthenticatedUser()
    tableResponses['wishlist_items'] = { data: null, error: null }

    await updateWishlistItemAttributes('wish-item-1', { notes: 'Sale season — wait for Nov' })

    const [payload] = updateCalls['wishlist_items'] as Array<Record<string, unknown>>
    expect(payload.notes).toBe('Sale season — wait for Nov')
  })

  it('throws when unauthenticated', async () => {
    mockUnauthenticated()
    await expect(
      updateWishlistItemAttributes('any-id', { brand: 'Test' }),
    ).rejects.toThrow('Not authenticated')
  })

  it('does not set layer_role when category is absent from payload', async () => {
    mockAuthenticatedUser()
    tableResponses['wishlist_items'] = { data: null, error: null }

    await updateWishlistItemAttributes('wish-item-1', { brand: 'Loro Piana' })

    const [payload] = updateCalls['wishlist_items'] as Array<Record<string, unknown>>
    expect(payload.brand).toBe('Loro Piana')
    expect(payload.layer_role).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// removeWishlistItem
// ---------------------------------------------------------------------------

describe('removeWishlistItem', () => {
  it('deletes the wishlist row scoped to the calling user', async () => {
    mockAuthenticatedUser()
    tableResponses['wishlist_items'] = { data: null, error: null }

    await removeWishlistItem('wish-item-to-delete')

    expect(deleteCalls['wishlist_items']).toBeDefined()
    expect(deleteCalls['wishlist_items']).toHaveLength(1)
  })

  it('throws when unauthenticated', async () => {
    mockUnauthenticated()
    await expect(removeWishlistItem('any-id')).rejects.toThrow('Not authenticated')
  })
})
