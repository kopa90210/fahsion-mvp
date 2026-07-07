'use server'

import { createClient } from '@/src/lib/supabase/server'
import {
  recommendOutfits,
  type Outfit,
  type WardrobeItem,
  type LayerRole,
} from '@/src/lib/outfit/engine'
import type { StyleVector } from '@/src/lib/quiz/scoring'

export type DailyOutfit = Outfit & {
  id: string
  vector: StyleVector
  reasons: string[]
}

const STYLE_LABELS: Record<string, string> = {
  minimal: 'clean, simple pieces',
  streetwear: 'relaxed streetwear',
  formal: 'polished shapes',
  bohemian: 'easy bohemian details',
  edgy: 'sharper pieces',
  earth_tones: 'earth tones',
}

type WardrobeJoinItem = {
  id: string
  display_name: string
  image_url: string | null
  layer_role: string | null
  style_tags: Partial<StyleVector> | null
}

type UserWardrobeJoinRow = {
  wardrobe_items: WardrobeJoinItem | WardrobeJoinItem[] | null
}

function clampStyleWeight(value: number) {
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100))
}

function buildReasons(outfit: Outfit, dna: StyleVector) {
  const outfitTags = new Set(
    outfit.items.flatMap((item) =>
      Object.entries(item.style_tags)
        .filter(([, weight]) => typeof weight === 'number' && weight > 0)
        .map(([tag]) => tag),
    ),
  )

  return Object.entries(dna)
    .filter(([tag, weight]) => outfitTags.has(tag) && weight >= 0.45)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => `because you liked ${STYLE_LABELS[tag] ?? tag.replaceAll('_', ' ')}`)
}

async function getAuthedUserId() {
  const supabase = await createClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    throw new Error('Not authenticated')
  }

  return { supabase, userId: userData.user.id }
}

async function getUserDnaAndWardrobe() {
  const { supabase, userId } = await getAuthedUserId()

  const { data: dnaRow, error: dnaError } = await supabase
    .from('fashion_dna')
    .select('vector')
    .eq('user_id', userId)
    .single()

  if (dnaError || !dnaRow) {
    console.error('outfit action - DNA fetch error:', dnaError)
    throw new Error('Fashion DNA not found')
  }

  const { data: rows, error: itemsError } = await supabase
    .from('user_wardrobe_items')
    .select(
      `
      wardrobe_items (
        id,
        display_name,
        image_url,
        layer_role,
        style_tags
      )
    `,
    )
    .eq('user_id', userId)

  if (itemsError || !rows) {
    console.error('outfit action - wardrobe fetch error:', itemsError)
    throw new Error('Could not fetch wardrobe items')
  }

  const items: WardrobeItem[] = (rows as UserWardrobeJoinRow[])
    .map((row) =>
      Array.isArray(row.wardrobe_items)
        ? row.wardrobe_items[0]
        : row.wardrobe_items,
    )
    .filter(
      (item): item is NonNullable<typeof item> =>
        item !== null && item.layer_role !== null,
    )
    .map((item) => ({
      id: item.id,
      display_name: item.display_name,
      image_url: item.image_url ?? null,
      layer_role: item.layer_role as LayerRole,
      style_tags: (item.style_tags as Partial<StyleVector>) ?? {},
    }))

  return {
    supabase,
    userId,
    dna: dnaRow.vector as StyleVector,
    items,
  }
}

/**
 * Fetch the calling user's wardrobe items + fashion DNA, run the
 * recommendation engine, and return the top N outfits.
 *
 * Scoped exclusively to user_wardrobe_items; never queries the full catalog.
 */
export async function getRecommendedOutfits(topN = 5): Promise<Outfit[]> {
  const { dna, items } = await getUserDnaAndWardrobe()
  return recommendOutfits(items, dna, { topN })
}

export async function getDailyOutfit(): Promise<DailyOutfit | null> {
  const { supabase, userId, dna, items } = await getUserDnaAndWardrobe()
  const [outfit] = recommendOutfits(items, dna, { topN: 1 })

  if (!outfit) {
    return null
  }

  const itemIds = outfit.items.map((item) => item.id)
  const { data: savedOutfit, error: outfitError } = await supabase
    .from('outfits')
    .insert({
      user_id: userId,
      item_ids: itemIds,
    })
    .select('id')
    .single()

  if (outfitError || !savedOutfit) {
    throw new Error(`Failed to save daily outfit: ${outfitError?.message ?? 'unknown error'}`)
  }

  return {
    ...outfit,
    id: savedOutfit.id,
    vector: dna,
    reasons: buildReasons(outfit, dna),
  }
}

export async function submitOutfitFeedback(
  outfitId: string,
  liked: boolean,
  items: WardrobeItem[],
): Promise<{ vector: StyleVector; changedTags: string[] }> {
  const { supabase, userId } = await getAuthedUserId()

  const { error: feedbackError } = await supabase.from('feedback').insert({
    user_id: userId,
    outfit_id: outfitId,
    liked,
  })

  if (feedbackError) {
    throw new Error(`Failed to save feedback: ${feedbackError.message}`)
  }

  const { data: dnaRow, error: dnaError } = await supabase
    .from('fashion_dna')
    .select('vector')
    .eq('user_id', userId)
    .single()

  if (dnaError || !dnaRow) {
    throw new Error('Fashion DNA not found')
  }

  const delta = liked ? 0.05 : -0.05
  const currentVector = (dnaRow.vector ?? {}) as StyleVector
  const changedTags = Array.from(
    new Set(
      items.flatMap((item) =>
        Object.entries(item.style_tags)
          .filter(([, weight]) => typeof weight === 'number' && weight > 0)
          .map(([tag]) => tag),
      ),
    ),
  )

  const nextVector: StyleVector = { ...currentVector }
  for (const tag of changedTags) {
    nextVector[tag] = clampStyleWeight((nextVector[tag] ?? 0) + delta)
  }

  const { error: updateError } = await supabase
    .from('fashion_dna')
    .update({
      vector: nextVector,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (updateError) {
    throw new Error(`Failed to update fashion DNA: ${updateError.message}`)
  }

  return { vector: nextVector, changedTags }
}
