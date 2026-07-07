/**
 * Outfit Recommendation Engine
 *
 * Pure module — no Supabase, no React, no model calls.
 * Takes a user's wardrobe items + their fashion DNA vector and returns
 * the top N ranked outfit combinations.
 *
 * Outfit validity rules (layer_role):
 *   Required : exactly one 'base_layer'  (tops, shirts, blouses, etc.)
 *   Required : exactly one 'bottom'      (pants, skirts, shorts, etc.)
 *   Required : exactly one 'footwear'
 *   Optional : zero or one 'outerwear'   (jacket, coat, etc.)
 *   Optional : zero or one 'accessory'
 *
 * Scoring: normalised dot-product of each item's style_tags against the
 * user's fashion DNA vector, averaged across all items in the outfit.
 * Result ∈ [0, 1].
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { StyleVector } from '@/src/lib/quiz/scoring';

/** The layer_role values stored on wardrobe_items. */
export type LayerRole =
  | 'base_layer'
  | 'bottom'
  | 'footwear'
  | 'outerwear'
  | 'accessory';

/** Minimal wardrobe item shape required by the engine. */
export interface WardrobeItem {
  id: string;
  display_name: string;
  image_url: string | null;
  layer_role: LayerRole;
  /** Partial style vector — only dimensions this item expresses. */
  style_tags: Partial<StyleVector>;
}

/** A valid outfit and its score. */
export interface Outfit {
  /** The items that make up this outfit, in slot order. */
  items: WardrobeItem[];
  /**
   * Normalised aggregate style score ∈ [0, 1], rounded to 4 dp.
   * This is a numeric measure only — all interpretive copy lives in the UI.
   */
  score: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Score a single item against a fashion DNA vector.
 *
 * Uses a normalised dot product (cosine similarity) so that items with
 * more style_tags do not automatically outscore sparse items.
 *
 * score = dot(item.style_tags, dna) / (|item.style_tags| * |dna|)
 *
 * If either vector has zero magnitude, returns 0.
 */
export function scoreItem(item: WardrobeItem, dna: StyleVector): number {
  const tags = item.style_tags;

  let dot = 0;
  let tagMagSq = 0;
  let dnaMagSq = 0;

  // Collect all dimension keys from both vectors
  const dims = new Set([...Object.keys(tags), ...Object.keys(dna)]);

  for (const dim of dims) {
    const t = tags[dim] ?? 0;
    const d = dna[dim] ?? 0;
    dot += t * d;
    tagMagSq += t * t;
    dnaMagSq += d * d;
  }

  const mag = Math.sqrt(tagMagSq) * Math.sqrt(dnaMagSq);
  return mag === 0 ? 0 : dot / mag;
}

/**
 * Score an outfit as the arithmetic mean of its constituent item scores.
 * Returns a value in [0, 1], rounded to 4 decimal places.
 */
export function scoreOutfit(items: WardrobeItem[], dna: StyleVector): number {
  if (items.length === 0) return 0;
  const sum = items.reduce((acc, item) => acc + scoreItem(item, dna), 0);
  return Math.round((sum / items.length) * 10_000) / 10_000;
}

/**
 * Produce a stable string key for an outfit to detect duplicates.
 * Sorted so that slot order doesn't create phantom duplicates.
 */
function outfitKey(items: WardrobeItem[]): string {
  return items
    .map((i) => i.id)
    .sort()
    .join('|');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RecommendOutfitsOptions {
  /** Max number of outfits to return. Default: 5. */
  topN?: number;
}

/**
 * Given a list of the user's wardrobe items and their fashion DNA vector,
 * return the top N valid outfit combinations ranked by score descending.
 *
 * @param items - The user's own wardrobe items (NOT the global catalog).
 * @param dna   - The user's fashion DNA vector from fashion_dna.vector.
 * @param opts  - Optional configuration.
 * @returns     Array of up to `topN` distinct, valid outfits sorted by
 *              score descending. Each outfit is { items, score }.
 */
export function recommendOutfits(
  items: WardrobeItem[],
  dna: StyleVector,
  opts: RecommendOutfitsOptions = {},
): Outfit[] {
  const topN = opts.topN ?? 5;

  // Partition items by layer role.
  const byRole: Record<LayerRole, WardrobeItem[]> = {
    base_layer: [],
    bottom: [],
    footwear: [],
    outerwear: [],
    accessory: [],
  };

  for (const item of items) {
    const role = item.layer_role as LayerRole;
    if (role in byRole) {
      byRole[role].push(item);
    }
    // Items with an unrecognised layer_role are silently skipped.
  }

  const bases = byRole['base_layer'];
  const bottoms = byRole['bottom'];
  const footwearItems = byRole['footwear'];
  const outerwear = byRole['outerwear'];
  const accessories = byRole['accessory'];

  // Optional slots get a null sentinel so we can iterate "no item" without
  // duplicating the inner loop body.
  const outerwearSlots: (WardrobeItem | null)[] = [null, ...outerwear];
  const accessorySlots: (WardrobeItem | null)[] = [null, ...accessories];

  const seenKeys = new Set<string>();
  const outfits: Outfit[] = [];

  // Enumerate all valid combinations.
  // Worst-case: |bases| × |bottoms| × |footwear| × (|outerwear|+1) × (|accessories|+1)
  // For a typical personal wardrobe this is well under 10 k iterations.
  for (const base of bases) {
    for (const bottom of bottoms) {
      for (const shoe of footwearItems) {
        for (const outer of outerwearSlots) {
          for (const accessory of accessorySlots) {
            const slotItems: WardrobeItem[] = [base, bottom, shoe];
            if (outer) slotItems.push(outer);
            if (accessory) slotItems.push(accessory);

            const key = outfitKey(slotItems);
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);

            outfits.push({ items: slotItems, score: scoreOutfit(slotItems, dna) });
          }
        }
      }
    }
  }

  // Sort descending by score, then take the top N.
  outfits.sort((a, b) => b.score - a.score);
  return outfits.slice(0, topN);
}
