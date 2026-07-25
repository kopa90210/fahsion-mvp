import type { StyleVector } from '@/src/lib/quiz/scoring'

export interface OutfitWithStyleTags {
  items: Array<{
    style_tags?: Partial<StyleVector> | null
  }>
}

export function getChangedTags(outfit: OutfitWithStyleTags): string[] {
  return Array.from(
    new Set(
      outfit.items.flatMap((item) =>
        Object.entries(item.style_tags ?? {})
          .filter(([, weight]) => typeof weight === 'number' && weight > 0)
          .map(([tag]) => tag),
      ),
    ),
  )
}

export function getOptimisticVector(
  vector: StyleVector,
  changedTags: string[],
  liked: boolean,
): StyleVector {
  const delta = liked ? 0.05 : -0.05
  const nextVector = { ...vector }

  for (const tag of changedTags) {
    nextVector[tag] = Math.min(
      1,
      Math.max(0, Math.round(((nextVector[tag] ?? 0) + delta) * 100) / 100),
    )
  }

  return nextVector
}
