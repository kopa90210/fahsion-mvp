'use server'

import { createClient } from '@/src/lib/supabase/server'

// ---------------------------------------------------------------------------
// Public types — the only shape the frontend ever sees
// ---------------------------------------------------------------------------

export type CuratedItem = {
  id: string
  category: string
  image_url: string | null
  display_name: string
}

export type RankedPiecesResult = {
  items: CuratedItem[]
  hasMore: boolean
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const CATEGORY_ORDER = ['top', 'bottom', 'footwear', 'outerwear', 'accessory'] as const

/** Relative threshold — include items scoring ≥ this fraction of the top score. */
const THRESHOLD_RATIO = 0.70

/** UX guardrails for items per batch. */
const BATCH_FLOOR = 4
const BATCH_CEILING = 14

/** Maximum number of pagination batches per category. */
const MAX_BATCHES = 3

// ---------------------------------------------------------------------------
// Category mapping — single source of truth
// ---------------------------------------------------------------------------

function mapWardrobeCategory(item: {
  category: string | null
  subcategory?: string | null
  display_name?: string | null
  layer_role?: string | null
}) {
  const explicitCategory = item.category?.trim().toLowerCase()
  if (
    explicitCategory === 'top' ||
    explicitCategory === 'bottom' ||
    explicitCategory === 'outerwear' ||
    explicitCategory === 'footwear' ||
    explicitCategory === 'accessory'
  ) {
    return explicitCategory
  }

  const text = [
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

// ---------------------------------------------------------------------------
// Scoring helper
// ---------------------------------------------------------------------------

function scoreItem(
  styleTags: Record<string, number>,
  userVector: Record<string, number>,
): number {
  let score = 0
  for (const tag in userVector) {
    if (styleTags[tag]) {
      score += userVector[tag] * styleTags[tag]
    }
  }
  return score
}

// ---------------------------------------------------------------------------
// getRankedPieces — threshold-ranked, paginated, single-category
// ---------------------------------------------------------------------------

/**
 * Returns threshold-ranked items for a single category.
 *
 * Scoring: dot product of item.style_tags against fashion_dna.vector.
 * Inclusion: any item scoring ≥ 70% of that category's top score.
 * Clamped to [BATCH_FLOOR, BATCH_CEILING] per batch as a UX guardrail.
 *
 * Pagination: batch 0 = threshold items, batch 1-2 = next-best items
 * below the threshold. Max 3 total batches per category.
 *
 * @param category  One of the mapped category keys (top, bottom, etc.)
 * @param batch     Pagination batch index (0, 1, or 2). Default 0.
 */
export async function getRankedPieces(
  category: string,
  batch = 0,
   excludeIds: string[] = [],
): Promise<RankedPiecesResult> {
  if (batch < 0 || batch >= MAX_BATCHES) {
    return { items: [], hasMore: false }
  }

  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) {
    throw new Error('Not authenticated')
  }

  // 1. Fetch fashion DNA
  const { data: dna, error: dnaError } = await supabase
    .from('fashion_dna')
    .select('vector')
    .eq('user_id', userData.user.id)
    .single()

  if (dnaError || !dna) {
    throw new Error('Fashion DNA not found')
  }

  const userVector = dna.vector as Record<string, number>

  // 2. Fetch all wardrobe items
  const { data: items, error: itemsError } = await supabase
    .from('wardrobe_items')
    .select('id, category, subcategory, image_url, display_name, layer_role, style_tags')

  if (itemsError || !items) {
    throw new Error('Could not fetch wardrobe items')
  }

  // 3. Filter to requested category and score; dedupe by stable item id.
  const seenIds = new Set<string>()
  const excludeSet = new Set(excludeIds)
  const categoryItems = items
    .filter((item) => mapWardrobeCategory(item) === category)
     .filter((item) => !excludeSet.has(item.id))
    .filter((item) => {
      if (seenIds.has(item.id)) return false
      seenIds.add(item.id)
      return true
    })
    .map((item) => ({
      id: item.id,
      image_url: item.image_url,
      display_name: item.display_name,
      score: scoreItem(item.style_tags as Record<string, number>, userVector),
    }))
    .sort((a, b) => b.score - a.score)

  if (categoryItems.length === 0) {
    return { items: [], hasMore: false }
  }

  // 4. Compute threshold
  const topScore = categoryItems[0].score
  const threshold = topScore * THRESHOLD_RATIO

  // 5. Split into threshold items and below-threshold items
  const aboveThreshold = categoryItems.filter((item) => item.score >= threshold)
  const belowThreshold = categoryItems.filter((item) => item.score < threshold)

  // 6. Build batches
  //    Batch 0: threshold items (clamped to [BATCH_FLOOR, BATCH_CEILING])
  //    Batch 1+: below-threshold items split into equal-ish chunks
  if (batch === 0) {
    // Clamp batch 0 to guardrails
    const clamped = aboveThreshold.slice(0, BATCH_CEILING)
    // If threshold produced fewer than floor, pad from below-threshold
    while (clamped.length < BATCH_FLOOR && belowThreshold.length > 0) {
      clamped.push(belowThreshold.shift()!)
    }

    const remainingBelowCount = belowThreshold.length
    return {
      items: clamped.map((item) => ({
        id: item.id,
        category,
        image_url: item.image_url,
        display_name: item.display_name,
      })),
      hasMore: remainingBelowCount > 0,
    }
  }

  // For batch 1 and 2, split below-threshold items evenly
  const chunkSize = Math.ceil(belowThreshold.length / (MAX_BATCHES - 1))
  const batchStart = (batch - 1) * chunkSize
  const batchEnd = Math.min(batchStart + chunkSize, belowThreshold.length)

  if (batchStart >= belowThreshold.length) {
    return { items: [], hasMore: false }
  }

  const batchItems = belowThreshold.slice(batchStart, batchEnd)
  const hasMore = batchEnd < belowThreshold.length

  return {
    items: batchItems.map((item) => ({
      id: item.id,
      category,
      image_url: item.image_url,
      display_name: item.display_name,
    })),
    hasMore,
  }
}

// ---------------------------------------------------------------------------
// searchPieces — category-scoped text search
// ---------------------------------------------------------------------------

/**
 * Search for items by display_name or subcategory within a single
 * mapped category. Case-insensitive ILIKE matching.
 *
 * Returns the same CuratedItem shape — never exposes scores or
 * internal fields.
 */
export async function searchPieces(
  category: string,
  query: string,
): Promise<CuratedItem[]> {
  if (!query || query.trim().length === 0) {
    return []
  }

  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) {
    throw new Error('Not authenticated')
  }

  // Fetch all items and filter client-side by mapped category + text match
  // (Supabase PostgREST doesn't support ILIKE on computed/mapped categories,
  // so we fetch the full set and filter. Acceptable for MVP catalog sizes.)
  const { data: items, error: itemsError } = await supabase
    .from('wardrobe_items')
    .select('id, category, subcategory, image_url, display_name, layer_role')

  if (itemsError || !items) {
    throw new Error('Could not fetch wardrobe items')
  }

  const lowerQuery = query.trim().toLowerCase()

  const seenIds = new Set<string>()

  return items
    .filter((item) => {
      if (mapWardrobeCategory(item) !== category) return false
      const nameMatch = item.display_name?.toLowerCase().includes(lowerQuery)
      const subMatch = item.subcategory?.toLowerCase().includes(lowerQuery)
      return nameMatch || subMatch
    })
    .filter((item) => {
      if (seenIds.has(item.id)) return false
      seenIds.add(item.id)
      return true
    })
    .map((item) => ({
      id: item.id,
      category,
      image_url: item.image_url,
      display_name: item.display_name,
    }))
}

// ---------------------------------------------------------------------------
// saveWardrobeSelection — unchanged, single atomic write
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// getCuratedPieces — kept for backward compatibility
// ---------------------------------------------------------------------------

export async function getCuratedPieces(): Promise<Record<string, CuratedItem[]>> {
  const supabase = await createClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) {
    throw new Error('Not authenticated')
  }

  const { data: dna, error: dnaError } = await supabase
    .from('fashion_dna')
    .select('vector')
    .eq('user_id', userData.user.id)
    .single()

  if (dnaError || !dna) {
    throw new Error('Fashion DNA not found')
  }

  const userVector = dna.vector as Record<string, number>

  const { data: items, error: itemsError } = await supabase
    .from('wardrobe_items')
    .select('id, category, subcategory, image_url, display_name, layer_role, style_tags')

  if (itemsError || !items) {
    throw new Error('Could not fetch wardrobe items')
  }

  const scoredItems = items.map((item) => ({
    id: item.id,
    category: item.category,
    subcategory: item.subcategory,
    image_url: item.image_url,
    display_name: item.display_name,
    layer_role: item.layer_role,
    score: scoreItem(item.style_tags as Record<string, number>, userVector),
  }))

  const grouped: Record<string, CuratedItem[]> = Object.fromEntries(
    CATEGORY_ORDER.map((category) => [category, []]),
  )

  scoredItems.sort((a, b) => b.score - a.score)

  for (const item of scoredItems) {
    const mappedCat = mapWardrobeCategory(item)

    if (!grouped[mappedCat]) {
      grouped[mappedCat] = []
    }

    if (grouped[mappedCat].length < 5) {
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
