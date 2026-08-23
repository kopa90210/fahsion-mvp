export type PipelineStep = {
  category: string
  label: string
  required: boolean
  minSelections: number
}

/**
 * The 5-step build-your-wardrobe pipeline.
 *
 * Order: required categories first (Tops, Bottoms, Footwear),
 * then optional categories (Outerwear, Accessories).
 */
export const SELECTION_STEPS: PipelineStep[] = [
  { category: 'top', label: 'Tops', required: true, minSelections: 2 },
  { category: 'bottom', label: 'Bottoms', required: true, minSelections: 2 },
  { category: 'footwear', label: 'Footwear', required: true, minSelections: 2 },
  { category: 'outerwear', label: 'Outerwear', required: false, minSelections: 0 },
  { category: 'accessory', label: 'Accessories', required: false, minSelections: 0 },
]
