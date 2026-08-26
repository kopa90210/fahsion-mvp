/**
 * Tests for src/app/actions/closet.ts
 *
 * Run with:  npx vitest run src/app/actions/closet.test.ts
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
    upsert: vi.fn().mockReturnThis(),
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
// Import functions under test (after mock is set up)
// ---------------------------------------------------------------------------

const {
  getUserWardrobeItems,
  updateWardrobeItemAttributes,
  removeWardrobeItem,
  replaceWardrobeItemPhoto,
  uploadDraftWardrobeItem,
} = await import('@/src/app/actions/closet')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'user-test-closet-001'

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
    data: { publicUrl: 'https://cdn.example.com/wardrobe/test.jpg' },
  })
  // Re-attach mock (vi.clearAllMocks resets mockReturnValue but not implementation)
  mockSupabase.storage.from.mockReturnValue({
    upload: mockStorageUpload,
    getPublicUrl: mockStorageGetPublicUrl,
  })
})

// ---------------------------------------------------------------------------
// getUserWardrobeItems
// ---------------------------------------------------------------------------

describe('getUserWardrobeItems', () => {
  it('returns items joined from user_wardrobe_items with isOwned=true for owned rows', async () => {
    mockAuthenticatedUser()

    tableResponses['user_wardrobe_items'] = {
      data: [
        {
          added_at: '2025-01-01T00:00:00Z',
          wardrobe_items: {
            id: 'item-owned',
            category: 'top',
            subcategory: 'shirt',
            display_name: 'White Oxford',
            brand: 'Arket',
            image_url: 'https://cdn.example.com/item-owned.jpg',
            color: { primary: 'white' },
            fit: {},
            style_tags: { minimal: 0.9 },
            layer_role: 'base_layer',
            owner_id: TEST_USER_ID,
          },
        },
        {
          added_at: '2025-01-02T00:00:00Z',
          wardrobe_items: {
            id: 'item-curated',
            category: 'bottom',
            subcategory: 'trouser',
            display_name: 'Navy Chinos',
            brand: null,
            image_url: null,
            color: {},
            fit: {},
            style_tags: {},
            layer_role: 'bottom',
            owner_id: null, // curated item
          },
        },
      ],
      error: null,
    }

    const items = await getUserWardrobeItems()

    expect(items).toHaveLength(2)

    const owned = items.find((i) => i.id === 'item-owned')
    expect(owned?.isOwned).toBe(true)
    expect(owned?.category).toBe('top')
    expect(owned?.brand).toBe('Arket')

    const curated = items.find((i) => i.id === 'item-curated')
    expect(curated?.isOwned).toBe(false)
    expect(curated?.category).toBe('bottom')
  })

  it('throws when unauthenticated', async () => {
    mockUnauthenticated()
    await expect(getUserWardrobeItems()).rejects.toThrow('Not authenticated')
  })

  it('returns empty array when user has no linked items', async () => {
    mockAuthenticatedUser()
    tableResponses['user_wardrobe_items'] = { data: [], error: null }
    const items = await getUserWardrobeItems()
    expect(items).toHaveLength(0)
  })

  it('applies normalizeWardrobeItem category mapping for items with null category', async () => {
    mockAuthenticatedUser()
    tableResponses['user_wardrobe_items'] = {
      data: [
        {
          added_at: '2025-01-01T00:00:00Z',
          wardrobe_items: {
            id: 'fuzzy-item',
            category: null,
            subcategory: 'sneaker',
            display_name: 'Running Shoe',
            brand: null,
            image_url: null,
            color: {},
            fit: {},
            style_tags: {},
            layer_role: 'footwear',
            owner_id: null,
          },
        },
      ],
      error: null,
    }

    const items = await getUserWardrobeItems()
    expect(items[0].category).toBe('footwear')
  })
})

// ---------------------------------------------------------------------------
// updateWardrobeItemAttributes
// ---------------------------------------------------------------------------

describe('updateWardrobeItemAttributes', () => {
  it('sends the update payload to wardrobe_items and derives layer_role from category', async () => {
    mockAuthenticatedUser()
    tableResponses['wardrobe_items'] = { data: null, error: null }

    await updateWardrobeItemAttributes('item-owned-1', {
      display_name: 'Black Turtleneck',
      category: 'top',
    })

    const [payload] = updateCalls['wardrobe_items'] as Array<Record<string, unknown>>
    expect(payload.display_name).toBe('Black Turtleneck')
    expect(payload.category).toBe('top')
    // layer_role should be derived from 'top' → 'base_layer'
    expect(payload.layer_role).toBe('base_layer')
  })

  it('throws when unauthenticated', async () => {
    mockUnauthenticated()
    await expect(
      updateWardrobeItemAttributes('any-id', { display_name: 'Test' }),
    ).rejects.toThrow('Not authenticated')
  })

  it('does not derive layer_role when category is not in the payload', async () => {
    mockAuthenticatedUser()
    tableResponses['wardrobe_items'] = { data: null, error: null }

    await updateWardrobeItemAttributes('item-id', { brand: 'Acne Studios' })

    const [payload] = updateCalls['wardrobe_items'] as Array<Record<string, unknown>>
    expect(payload.brand).toBe('Acne Studios')
    expect(payload.layer_role).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// removeWardrobeItem
// ---------------------------------------------------------------------------

describe('removeWardrobeItem', () => {
  it('always deletes the user_wardrobe_items link row', async () => {
    mockAuthenticatedUser()
    // Both tables respond with no error
    tableResponses['user_wardrobe_items'] = { data: null, error: null }
    tableResponses['wardrobe_items'] = { data: null, error: null }

    await removeWardrobeItem('item-to-remove')

    expect(deleteCalls['user_wardrobe_items']).toBeDefined()
  })

  it('also attempts to delete from wardrobe_items (RLS rejects curated items silently)', async () => {
    mockAuthenticatedUser()
    tableResponses['user_wardrobe_items'] = { data: null, error: null }
    tableResponses['wardrobe_items'] = { data: null, error: null }

    await removeWardrobeItem('owned-item')

    // Both tables should have received a delete call
    expect(deleteCalls['user_wardrobe_items']).toBeDefined()
    expect(deleteCalls['wardrobe_items']).toBeDefined()
  })

  it('throws when unauthenticated', async () => {
    mockUnauthenticated()
    await expect(removeWardrobeItem('any-id')).rejects.toThrow('Not authenticated')
  })
})

// ---------------------------------------------------------------------------
// replaceWardrobeItemPhoto
// ---------------------------------------------------------------------------

describe('replaceWardrobeItemPhoto', () => {
  it('uploads to wardrobe-images bucket and updates image_url in wardrobe_items', async () => {
    mockAuthenticatedUser()
    tableResponses['wardrobe_items'] = { data: null, error: null }

    const fakeFile = new File(['pixel'], 'photo.jpg', { type: 'image/jpeg' })
    const result = await replaceWardrobeItemPhoto('item-owned-2', fakeFile)

    expect(mockStorageUpload).toHaveBeenCalledOnce()
    const [bucketPath] = mockSupabase.storage.from.mock.calls[0]
    expect(bucketPath).toBe('wardrobe-images')

    expect(result.image_url).toContain('https://cdn.example.com')

    const [updatePayload] = updateCalls['wardrobe_items'] as Array<Record<string, unknown>>
    expect(updatePayload.image_url).toBeTruthy()
  })

  it('throws when unauthenticated', async () => {
    mockUnauthenticated()
    const fakeFile = new File(['pixel'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(replaceWardrobeItemPhoto('any-id', fakeFile)).rejects.toThrow('Not authenticated')
  })

  it('throws when storage upload fails', async () => {
    mockAuthenticatedUser()
    mockStorageUpload.mockResolvedValueOnce({ error: new Error('Storage quota exceeded') })

    const fakeFile = new File(['pixel'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(replaceWardrobeItemPhoto('item-id', fakeFile)).rejects.toThrow('Photo upload failed')
  })
})

// ---------------------------------------------------------------------------
// uploadDraftWardrobeItem
// ---------------------------------------------------------------------------

describe('uploadDraftWardrobeItem', () => {
  it('inserts a new wardrobe_items row with owner_id and links it', async () => {
    mockAuthenticatedUser()

    // insert returns an id
    tableResponses['wardrobe_items'] = { data: { id: 'new-draft-id' }, error: null }
    tableResponses['user_wardrobe_items'] = { data: null, error: null }

    const formData = new FormData()
    formData.append('display_name', 'Cream Knit Sweater')
    formData.append('category', 'top')
    formData.append('brand', 'Toast')
    const fakeFile = new File(['pixel'], 'sweater.jpg', { type: 'image/jpeg' })
    formData.append('file', fakeFile)

    const result = await uploadDraftWardrobeItem(formData)
    expect(result.id).toBe('new-draft-id')

    const [wardrobeInsert] = insertCalls['wardrobe_items'] as Array<Record<string, unknown>>
    expect(wardrobeInsert.display_name).toBe('Cream Knit Sweater')
    expect(wardrobeInsert.category).toBe('top')
    expect(wardrobeInsert.layer_role).toBe('base_layer')
    expect(wardrobeInsert.owner_id).toBe(TEST_USER_ID)
    expect(wardrobeInsert.source).toBe('user')

    const [linkInsert] = insertCalls['user_wardrobe_items'] as Array<Record<string, unknown>>
    expect(linkInsert.user_id).toBe(TEST_USER_ID)
    expect(linkInsert.item_id).toBe('new-draft-id')
  })

  it('normalizes category through WARDROBE_CATEGORIES taxonomy', async () => {
    mockAuthenticatedUser()
    tableResponses['wardrobe_items'] = { data: { id: 'sneaker-id' }, error: null }
    tableResponses['user_wardrobe_items'] = { data: null, error: null }

    const formData = new FormData()
    formData.append('display_name', 'White Sneakers')
    formData.append('category', 'shoe') // non-canonical — should map to 'footwear'
    const fakeFile = new File(['pixel'], 'shoe.jpg', { type: 'image/jpeg' })
    formData.append('file', fakeFile)

    await uploadDraftWardrobeItem(formData)

    const [wardrobeInsert] = insertCalls['wardrobe_items'] as Array<Record<string, unknown>>
    expect(wardrobeInsert.category).toBe('footwear')
    expect(wardrobeInsert.layer_role).toBe('footwear')
  })

  it('throws when unauthenticated', async () => {
    mockUnauthenticated()
    const formData = new FormData()
    const fakeFile = new File(['pixel'], 'photo.jpg', { type: 'image/jpeg' })
    formData.append('file', fakeFile)
    await expect(uploadDraftWardrobeItem(formData)).rejects.toThrow('Not authenticated')
  })
})
