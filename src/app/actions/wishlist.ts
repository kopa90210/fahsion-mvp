'use server'

import { createClient } from '@/src/lib/supabase/server'
import { normalizeWardrobeItem } from '@/src/lib/wardrobe/normalize'
import type { WardrobeAttributeUpdates } from './wardrobe'

export type WishlistItem = {
  id: string
  category: string | null
  subcategory: string | null
  brand: string | null
  display_name: string | null
  image_url: string | null
  color: unknown
  fit: unknown
  style_tags: unknown
  layer_role: string | null
  quantity: number
  added_at: string
}

async function getAuthenticatedClient() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) throw new Error('Not authenticated')
  return { supabase, userId: data.user.id }
}

function mapWishlistItem(row: Record<string, unknown>): WishlistItem {
  return {
    id: String(row.id),
    category: (row.category as string | null) ?? null,
    subcategory: (row.subcategory as string | null) ?? null,
    brand: (row.brand as string | null) ?? null,
    display_name: (row.display_name as string | null) ?? null,
    image_url: (row.image_url as string | null) ?? null,
    color: row.color ?? {},
    fit: row.fit ?? {},
    style_tags: row.style_tags ?? {},
    layer_role: (row.layer_role as string | null) ?? null,
    quantity: 1,
    added_at: String(row.created_at ?? ''),
  }
}

export async function getWishlistItems(category?: string, subcategory?: string) {
  const { supabase, userId } = await getAuthenticatedClient()
  let query = supabase.from('wishlist_items').select('id, category, subcategory, brand, display_name, image_url, color, fit, style_tags, layer_role, created_at').eq('user_id', userId).order('created_at', { ascending: false })
  if (category) query = query.eq('category', category)
  if (subcategory) query = query.eq('subcategory', subcategory)
  const { data, error } = await query
  if (error) throw new Error('Could not fetch wishlist items')
  return ((data ?? []) as Record<string, unknown>[]).map(mapWishlistItem)
}

export async function addWishlistItem(imageFile: File) {
  const { supabase, userId } = await getAuthenticatedClient()
  const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/wishlist/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from('wardrobe-images').upload(path, imageFile, { contentType: imageFile.type })
  if (uploadError) throw new Error('Could not upload wishlist image')
  const { data: urlData } = supabase.storage.from('wardrobe-images').getPublicUrl(path)
  const itemId = crypto.randomUUID()
  const { error } = await supabase.from('wishlist_items').insert({ id: itemId, user_id: userId, image_url: urlData.publicUrl })
  if (error) throw new Error(`Could not create wishlist item: ${error.message}`)
  return { success: true, itemId }
}

export async function updateWishlistItemAttributes(itemId: string, updates: WardrobeAttributeUpdates) {
  const { supabase, userId } = await getAuthenticatedClient()
  const allowed = Object.fromEntries(Object.entries(updates).filter(([key]) => ['category', 'subcategory', 'brand', 'display_name', 'color', 'fit', 'style_tags'].includes(key)))
  const classification = ('category' in allowed || 'subcategory' in allowed)
    ? normalizeWardrobeItem({ category: (allowed.category as string | null) ?? null, subcategory: (allowed.subcategory as string | null) ?? null })
    : null
  const { error } = await supabase.from('wishlist_items').update({ ...allowed, ...(classification ? { category: classification.category, layer_role: classification.layer_role } : {}) }).eq('id', itemId).eq('user_id', userId)
  if (error) throw new Error('Could not update wishlist item')
  return { success: true }
}

export async function removeWishlistItem(itemId: string) {
  const { supabase, userId } = await getAuthenticatedClient()
  const { error } = await supabase.from('wishlist_items').delete().eq('id', itemId).eq('user_id', userId)
  if (error) throw new Error('Could not remove wishlist item')
  return { success: true }
}