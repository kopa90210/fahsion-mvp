/**
 * Shared data contract for Fashion DNA signals.
 *
 * This type is intentionally extensible: Phase 2/3 can add new
 * categories (e.g. "season", "occasion") without changing the
 * component props shape — just pass differently-shaped DnaSignal[]
 * arrays into the same panel.
 */

/** A single dimension of the user's Fashion DNA. */
export type DnaSignal = {
  /** Stable machine key, e.g. "minimal". */
  key: string
  /** Human-readable label, e.g. "Minimal". */
  label: string
  /** Weight ∈ [0, 1]. */
  weight: number
  /**
   * Optional grouping for future phases.
   * Current Phase 1 values: "style".
   * Phase 2/3 could add: "season", "occasion", "wardrobe", etc.
   */
  category?: string
}
