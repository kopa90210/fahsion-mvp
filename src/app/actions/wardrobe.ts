'use server'

import { createClient } from '@/src/lib/supabase/server'

export type CuratedItem = {
  id: string
  category: string
  image_url: string | null
  display_name: string
}

const CATEGORY_ORDER = ['top', 'bottom', 'footwear', 'outerwear', 'accessory'] as const

function mapWardrobeCategory(item: {
  category: string | null
  subcategory?: string | null
  display_name?: string | null
  layer_role?: string | null
}) {
  const text = [
    item.category,
    item.subcategory,
    item.display_name,
    item.layer_role,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (text.includes('shoe') || text.includes('footwear') || text.includes('sneaker') || text.includes('boot') || text.includes('loafer')) {
    return 'footwear'
  }

  if (text.includes('outerwear') || text.includes('outer wear') || text.includes('outer_layer') || text.includes('outer layer') || text.includes('jacket') || text.includes('coat') || text.includes('blazer')) {
    return 'outerwear'
  }

  if (text.includes('bottom') || text.includes('pant') || text.includes('trouser') || text.includes('skirt') || text.includes('jean') || text.includes('short')) {
    return 'bottom'
  }

  if (text.includes('top') || text.includes('shirt') || text.includes('blouse') || text.includes('tee') || text.includes('sweater')) {
    return 'top'
  }

  return 'accessory'
}

export async function getCuratedPieces(): Promise<Record<string, CuratedItem[]>> {
  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) {
    throw new Error('Not authenticated')
  }

  // 1. Fetch user's fashion DNA
  const { data: dna, error: dnaError } = await supabase
    .from('fashion_dna')
    .select('vector')
    .eq('user_id', userData.user.id)
    .single()

  if (dnaError || !dna) {
    console.error('Error fetching fashion DNA:', dnaError)
    throw new Error('Fashion DNA not found')
  }

  const userVector = dna.vector as Record<string, number>

  // 2. Fetch all wardrobe items
  const { data: items, error: itemsError } = await supabase
    .from('wardrobe_items')
    .select('id, category, subcategory, image_url, display_name, layer_role, style_tags')

  if (itemsError || !items) {
    console.error('Error fetching wardrobe items:', itemsError)
    throw new Error('Could not fetch wardrobe items')
  }

  // 3. Score items
  const scoredItems = items.map((item) => {
    let score = 0
    const styleTags = item.style_tags as Record<string, number>

    // Simple dot product for scoring
    for (const tag in userVector) {
      if (styleTags[tag]) {
        score += userVector[tag] * styleTags[tag]
      }
    }

    return {
      id: item.id,
      category: item.category,
      subcategory: item.subcategory,
      image_url: item.image_url,
      display_name: item.display_name,
      layer_role: item.layer_role,
      score,
    }
  })

  // 4. Group by category and take top 10
  const grouped: Record<string, CuratedItem[]> = Object.fromEntries(
    CATEGORY_ORDER.map((category) => [category, []]),
  )

  // Sort globally first, then push to categories to keep highest scored first
  scoredItems.sort((a, b) => b.score - a.score)

  for (const item of scoredItems) {
    const mappedCat = mapWardrobeCategory(item)

    if (!grouped[mappedCat]) {
      grouped[mappedCat] = []
    }

    if (grouped[mappedCat].length < 10) {
      grouped[mappedCat].push({
        id: item.id,
        category: mappedCat,
        image_url: item.image_url,
        display_name: item.display_name,
      })
    }
  }

  return grouped
}

export async function saveWardrobeSelection(itemIds: string[]) {
  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) {
    throw new Error('Not authenticated')
  }

  const userId = userData.user.id

  const inserts = itemIds.map((itemId) => ({
    user_id: userId,
    item_id: itemId,
  }))

  const { error } = await supabase
    .from('user_wardrobe_items')
    .upsert(inserts, { onConflict: 'user_id, item_id' })

  if (error) {
    throw new Error('Failed to save wardrobe selection')
  }

  return { success: true }
}
