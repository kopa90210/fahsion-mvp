'use server'

import { createClient } from '@/src/lib/supabase/server'
import { normalizeWardrobeItem, WARDROBE_CATEGORIES, type WardrobeCategory } from '@/src/lib/wardrobe/normalize'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type WishlistItem = {
  id: string
  user_id: string
  category: WardrobeCategory
  layer_role: string
  subcategory: string | null
  display_name: string | null
  brand: string | null
  image_url: string | null
  color: Record<string, unknown>
  fit: Record<string, unknown>
  style_tags: Record<string, number>
  notes: string | null
  created_at: string
}

export type UpdateWishlistItemPayload = {
  display_name?: string
  brand?: string
  category?: WardrobeCategory
  subcategory?: string
  color?: Record<string, unknown>
  fit?: Record<string, unknown>
  style_tags?: Record<string, number>
  notes?: string
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function getAuthenticatedUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) throw new Error('Not authenticated')
  return data.user.id
}

// ---------------------------------------------------------------------------
// getWishlistItems
//
// Returns all wishlist items for the calling user, with categories
// normalized through normalizeWardrobeItem() — same taxonomy as
// wardrobe items, enabling future gap-recommendation matching.
// ---------------------------------------------------------------------------

export async function getWishlistItems(): Promise<WishlistItem[]> {
  const supabase = await createClient()
  const userId = await getAuthenticatedUserId(supabase)

  const { data, error } = await supabase
    .from('wishlist_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error('Could not fetch wishlist items')

  return (data ?? []).map((row) => {
    const { category, layer_role } = normalizeWardrobeItem(row)
    return {
      id: row.id,
      user_id: row.user_id,
      category,
      layer_role,
      subcategory: row.subcategory ?? null,
      display_name: row.display_name ?? null,
      brand: row.brand ?? null,
      image_url: row.image_url ?? null,
      color: (row.color ?? {}) as Record<string, unknown>,
      fit: (row.fit ?? {}) as Record<string, unknown>,
      style_tags: (row.style_tags ?? {}) as Record<string, number>,
      notes: row.notes ?? null,
      created_at: row.created_at,
    }
  })
}

// ---------------------------------------------------------------------------
// addWishlistItem
//
// Uploads the item photo to the wishlist-images Storage bucket and
// inserts a new row into wishlist_items. Category taxonomy flows
// through normalizeWardrobeItem() — same source of truth as wardrobe.
// ---------------------------------------------------------------------------

export async function addWishlistItem(formData: FormData): Promise<{ id: string }> {
  const supabase = await createClient()
  const userId = await getAuthenticatedUserId(supabase)

  const file = formData.get('file') as File | null
  const displayName = (formData.get('display_name') as string | null)?.trim() ?? ''
  const rawCategory = (formData.get('category') as string | null)?.trim() ?? ''
  const subcategory = (formData.get('subcategory') as string | null)?.trim() ?? ''
  const brand = (formData.get('brand') as string | null)?.trim() ?? ''
  const notes = (formData.get('notes') as string | null)?.trim() ?? ''

  // Normalize through the single source of truth
  const { category, layer_role } = normalizeWardrobeItem({
    category: rawCategory,
    subcategory,
    display_name: displayName,
  })

  let image_url: string | null = null

  if (file && file.size > 0) {
    if (!file.type.startsWith('image/')) throw new Error('File must be an image')

    const ext = file.name.split('.').pop() ?? 'jpg'
    const storagePath = `${userId}/wish-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('wishlist-images')
      .upload(storagePath, file, { upsert: false, contentType: file.type })

    if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`)

    const { data: publicUrlData } = supabase.storage
      .from('wishlist-images')
      .getPublicUrl(storagePath)

    image_url = publicUrlData.publicUrl
  }

  const { data: inserted, error: insertError } = await supabase
    .from('wishlist_items')
    .insert({
      user_id: userId,
      category,
      layer_role,
      subcategory: subcategory || null,
      display_name: displayName || null,
      brand: brand || null,
      image_url,
      notes: notes || null,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    throw new Error(`Could not add wishlist item: ${insertError?.message}`)
  }

  return { id: inserted.id }
}

// ---------------------------------------------------------------------------
// updateWishlistItemAttributes
//
// Partial update; RLS ensures only the owner can update.
// Derives layer_role from category if category is changed.
// ---------------------------------------------------------------------------

export async function updateWishlistItemAttributes(
  itemId: string,
  attrs: UpdateWishlistItemPayload,
): Promise<void> {
  const supabase = await createClient()
  await getAuthenticatedUserId(supabase)

  const updatePayload: Record<string, unknown> = { ...attrs }
  if (attrs.category) {
    const { layer_role } = normalizeWardrobeItem({ category: attrs.category })
    updatePayload.layer_role = layer_role
  }

  const { error } = await supabase
    .from('wishlist_items')
    .update(updatePayload)
    .eq('id', itemId)

  if (error) throw new Error(`Could not update wishlist item: ${error.message}`)
}

// ---------------------------------------------------------------------------
// removeWishlistItem
//
// Deletes the wishlist item row. RLS ensures user_id = auth.uid(),
// so cross-user deletion is impossible at the database level.
// ---------------------------------------------------------------------------

export async function removeWishlistItem(itemId: string): Promise<void> {
  const supabase = await createClient()
  const userId = await getAuthenticatedUserId(supabase)

  const { error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId) // redundant with RLS — belt-and-suspenders

  if (error) throw new Error(`Could not remove wishlist item: ${error.message}`)
}


