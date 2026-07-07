'use server'

import { createClient } from '@/src/lib/supabase/server'

export type CuratedItem = {
  id: string
  category: string
  image_url: string | null
  display_name: string
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
    .select('id, category, image_url, display_name, style_tags')

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
      image_url: item.image_url,
      display_name: item.display_name,
      score,
    }
  })

  // 4. Group by category and take top 10
  const grouped: Record<string, CuratedItem[]> = {
    top: [],
    bottom: [],
    footwear: [],
    accessory: [],
  }

  // Sort globally first, then push to categories to keep highest scored first
  scoredItems.sort((a, b) => b.score - a.score)

  for (const item of scoredItems) {
    const cat = item.category.toLowerCase()
    let mappedCat = cat
    if (cat.includes('top') || cat.includes('shirt') || cat.includes('jacket') || cat.includes('sweater')) mappedCat = 'top'
    else if (cat.includes('bottom') || cat.includes('pant') || cat.includes('skirt') || cat.includes('jeans')) mappedCat = 'bottom'
    else if (cat.includes('shoe') || cat.includes('footwear') || cat.includes('sneaker') || cat.includes('boot')) mappedCat = 'footwear'
    else mappedCat = 'accessory'

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
