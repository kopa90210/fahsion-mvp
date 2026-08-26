'use server'

import { createClient } from '@/src/lib/supabase/server'
import { normalizeWardrobeItem, WARDROBE_CATEGORIES, type WardrobeCategory } from '@/src/lib/wardrobe/normalize'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ClosetItem = {
  id: string
  category: WardrobeCategory
  layer_role: string
  display_name: string | null
  brand: string | null
  subcategory: string | null
  image_url: string | null
  color: Record<string, unknown>
  fit: Record<string, unknown>
  style_tags: Record<string, number>
  /** true if auth.uid() == owner_id — determines whether edit/delete is allowed */
  isOwned: boolean
  added_at: string
}

export type UpdateWardrobeItemPayload = {
  display_name?: string
  brand?: string
  category?: WardrobeCategory
  subcategory?: string
  color?: Record<string, unknown>
  fit?: Record<string, unknown>
  style_tags?: Record<string, number>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthenticatedUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) throw new Error('Not authenticated')
  return data.user.id
}

// ---------------------------------------------------------------------------
// getUserWardrobeItems
//
// Returns ALL items linked to the user via user_wardrobe_items
// (both curated catalog items and user-uploaded items). The isOwned
// flag indicates which items the user may edit or delete.
// ---------------------------------------------------------------------------

export async function getUserWardrobeItems(): Promise<ClosetItem[]> {
  const supabase = await createClient()
  const userId = await getAuthenticatedUserId(supabase)

  const { data, error } = await supabase
    .from('user_wardrobe_items')
    .select(`
      added_at,
      wardrobe_items (
        id,
        category,
        subcategory,
        display_name,
        brand,
        image_url,
        color,
        fit,
        style_tags,
        layer_role,
        owner_id
      )
    `)
    .eq('user_id', userId)

  if (error) throw new Error('Could not fetch wardrobe items')

  const items: ClosetItem[] = []

  for (const row of data ?? []) {
    // PostgREST may return an array or a single object for a to-one join.
    const raw = Array.isArray(row.wardrobe_items)
      ? row.wardrobe_items[0]
      : row.wardrobe_items

    if (!raw) continue

    const { category, layer_role } = normalizeWardrobeItem(raw)

    items.push({
      id: raw.id,
      category,
      layer_role,
      display_name: raw.display_name ?? null,
      brand: (raw as Record<string, unknown>).brand as string | null ?? null,
      subcategory: raw.subcategory ?? null,
      image_url: raw.image_url ?? null,
      color: (raw.color ?? {}) as Record<string, unknown>,
      fit: (raw.fit ?? {}) as Record<string, unknown>,
      style_tags: (raw.style_tags ?? {}) as Record<string, number>,
      isOwned: (raw as Record<string, unknown>).owner_id === userId,
      added_at: (row as Record<string, unknown>).added_at as string ?? '',
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// updateWardrobeItemAttributes
//
// Updates structured attributes on a wardrobe_items row.
// RLS enforces that owner_id = auth.uid() — calling this on a
// curated item will be rejected by the database policy.
// Reuses this single action; no parallel update path is created.
// ---------------------------------------------------------------------------

export async function updateWardrobeItemAttributes(
  itemId: string,
  attrs: UpdateWardrobeItemPayload,
): Promise<void> {
  const supabase = await createClient()
  await getAuthenticatedUserId(supabase) // ensure authenticated

  // Derive layer_role from category change if present
  const updatePayload: Record<string, unknown> = { ...attrs }
  if (attrs.category) {
    const { layer_role } = normalizeWardrobeItem({ category: attrs.category })
    updatePayload.layer_role = layer_role
  }

  const { error } = await supabase
    .from('wardrobe_items')
    .update(updatePayload)
    .eq('id', itemId)

  if (error) throw new Error(`Could not update wardrobe item: ${error.message}`)
}

// ---------------------------------------------------------------------------
// removeWardrobeItem
//
// Always unlinks the item from the user's wardrobe (user_wardrobe_items).
// If the item is owned by the calling user (owner_id = auth.uid()) it is
// also deleted from the global wardrobe_items catalog; otherwise only
// the link row is removed.
// ---------------------------------------------------------------------------

export async function removeWardrobeItem(itemId: string): Promise<void> {
  const supabase = await createClient()
  const userId = await getAuthenticatedUserId(supabase)

  // 1. Remove the membership link — always allowed (user owns their links).
  const { error: unlinkError } = await supabase
    .from('user_wardrobe_items')
    .delete()
    .eq('user_id', userId)
    .eq('item_id', itemId)

  if (unlinkError) throw new Error(`Could not unlink wardrobe item: ${unlinkError.message}`)

  // 2. Try to delete the catalog row; the RLS policy will silently reject
  //    this for curated items (owner_id IS NULL) — no error is raised.
  await supabase
    .from('wardrobe_items')
    .delete()
    .eq('id', itemId)
    .eq('owner_id', userId)
}

// ---------------------------------------------------------------------------
// replaceWardrobeItemPhoto
//
// Swaps the image_url of a user-owned wardrobe item.
// Decision: image-only swap — no re-extraction.
// The Python pipeline (extract_and_upload.py) performs full attribute
// extraction and is out of scope for in-app photo replacement. Attributes
// extracted from the original image (style_tags, color, fit, etc.) are
// preserved after a photo replace; only the visual is updated.
// ---------------------------------------------------------------------------

export async function replaceWardrobeItemPhoto(
  itemId: string,
  file: File,
): Promise<{ image_url: string }> {
  const supabase = await createClient()
  const userId = await getAuthenticatedUserId(supabase)

  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${userId}/${itemId}-replace-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('wardrobe-images')
    .upload(storagePath, file, { upsert: true, contentType: file.type })

  if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`)

  const { data: publicUrlData } = supabase.storage
    .from('wardrobe-images')
    .getPublicUrl(storagePath)

  const image_url = publicUrlData.publicUrl

  const { error: updateError } = await supabase
    .from('wardrobe_items')
    .update({ image_url })
    .eq('id', itemId)
    .eq('owner_id', userId) // RLS guard at app layer too

  if (updateError) throw new Error(`Could not update item photo: ${updateError.message}`)

  return { image_url }
}

// ---------------------------------------------------------------------------
// uploadDraftWardrobeItem
//
// Creates a new wardrobe item owned by the calling user:
//   1. Uploads the photo to Supabase Storage (wardrobe-images bucket).
//   2. Inserts a row into wardrobe_items with owner_id = auth.uid().
//   3. Links the item to the user via user_wardrobe_items.
//
// Category taxonomy: WARDROBE_CATEGORIES from normalize.ts is the
// single source of truth — no second taxonomy is introduced here.
// ---------------------------------------------------------------------------

export async function uploadDraftWardrobeItem(formData: FormData): Promise<{ id: string }> {
  const supabase = await createClient()
  const userId = await getAuthenticatedUserId(supabase)

  const file = formData.get('file') as File | null
  if (!file) throw new Error('No file provided')
  if (!file.type.startsWith('image/')) throw new Error('File must be an image')

  const displayName = (formData.get('display_name') as string | null)?.trim() || file.name
  const rawCategory = (formData.get('category') as string | null)?.trim() ?? ''
  const subcategory = (formData.get('subcategory') as string | null)?.trim() ?? ''
  const brand = (formData.get('brand') as string | null)?.trim() ?? ''

  // Normalize category through the single source of truth
  const { category, layer_role } = normalizeWardrobeItem({
    category: rawCategory,
    subcategory,
    display_name: displayName,
  })

  // 1. Upload photo
  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${userId}/draft-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('wardrobe-images')
    .upload(storagePath, file, { upsert: false, contentType: file.type })

  if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`)

  const { data: publicUrlData } = supabase.storage
    .from('wardrobe-images')
    .getPublicUrl(storagePath)

  const image_url = publicUrlData.publicUrl

  // 2. Insert catalog row
  const { data: inserted, error: insertError } = await supabase
    .from('wardrobe_items')
    .insert({
      category,
      subcategory: subcategory || category,
      display_name: displayName,
      brand: brand || null,
      image_url,
      layer_role,
      color: {},
      material: {},
      fit: {},
      style_tags: {},
      source: 'user',
      owner_id: userId,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    throw new Error(`Could not create wardrobe item: ${insertError?.message}`)
  }

  // 3. Link to user
  const { error: linkError } = await supabase
    .from('user_wardrobe_items')
    .insert({ user_id: userId, item_id: inserted.id })

  if (linkError) throw new Error(`Could not link wardrobe item: ${linkError.message}`)

  return { id: inserted.id }
}


