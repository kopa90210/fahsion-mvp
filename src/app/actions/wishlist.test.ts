import { beforeEach, describe, expect, it, vi } from 'vitest'

let responses: Record<string, { data: unknown; error: unknown }> = {}
let calls: Array<{ table: string; method: string; payload?: unknown }> = []

function builder(table: string) {
  const response = () => responses[table] ?? { data: null, error: null }
  const query: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockImplementation((payload: unknown) => { calls.push({ table, method: 'insert', payload }); return query }),
    update: vi.fn().mockImplementation((payload: unknown) => { calls.push({ table, method: 'update', payload }); return query }),
    delete: vi.fn().mockImplementation(() => { calls.push({ table, method: 'delete' }); return query }),
    single: vi.fn().mockImplementation(() => response()),
  }
  query.then = (resolve: (value: unknown) => unknown) => resolve(response())
  return query
}

const supabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn((table: string) => builder(table)),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://images.test/item.jpg' } })),
    })),
  },
}

vi.mock('@/src/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue(supabase) }))
const { addWishlistItem, getWishlistItems, removeWishlistItem, updateWishlistItemAttributes } = await import('@/src/app/actions/wishlist')

beforeEach(() => {
  vi.clearAllMocks()
  responses = {}
  calls = []
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
})

describe('wishlist actions', () => {
  it('gets owner-scoped items and maps them to the UI shape', async () => {
    responses.wishlist_items = { data: [{ id: 'w1', category: 'top', subcategory: 'sweater', brand: 'Acme', display_name: 'Knit', image_url: 'https://img/1', layer_role: 'base_layer', created_at: '2026-01-01' }], error: null }
    await expect(getWishlistItems('top')).resolves.toEqual([{ id: 'w1', category: 'top', subcategory: 'sweater', brand: 'Acme', display_name: 'Knit', image_url: 'https://img/1', color: {}, fit: {}, style_tags: {}, layer_role: 'base_layer', quantity: 1, added_at: '2026-01-01' }])
    expect(calls).toEqual([])
    expect(supabase.from).toHaveBeenCalledWith('wishlist_items')
  })

  it('uploads a photo and inserts it for the authenticated owner', async () => {
    responses.wishlist_items = { data: null, error: null }
    const result = await addWishlistItem(new File(['photo'], 'coat.jpg', { type: 'image/jpeg' }))
    expect(result.success).toBe(true)
    expect(result.itemId).toMatch(/^[0-9a-f-]{36}$/)
    expect(calls[0].payload).toEqual(expect.objectContaining({ user_id: 'user-1', image_url: 'https://images.test/item.jpg' }))
  })

  it('normalizes category and updates only allowed wishlist attributes', async () => {
    await expect(updateWishlistItemAttributes('w1', { category: 'top', subcategory: 'shirt', brand: 'Acme', color: { primary: 'blue' }, fit: {}, style_tags: {}, display_name: 'Saved name' })).resolves.toEqual({ success: true })
    expect(calls[0]).toEqual({ table: 'wishlist_items', method: 'update', payload: { category: 'top', subcategory: 'shirt', brand: 'Acme', display_name: 'Saved name', color: { primary: 'blue' }, fit: {}, style_tags: {}, layer_role: 'base_layer' } })
  })

  it('removes only the authenticated owner item', async () => {
    await expect(removeWishlistItem('w1')).resolves.toEqual({ success: true })
    expect(calls[0]).toEqual({ table: 'wishlist_items', method: 'delete' })
  })
})
