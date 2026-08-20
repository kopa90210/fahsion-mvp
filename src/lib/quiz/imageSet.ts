/**
 * imageSet.ts
 *
 * Display-only image-set preference for the style quiz.
 *
 * This module is intentionally free of React, Supabase, and any analytics.
 * The ImageSet value lives only in StyleQuiz component state and is never
 * persisted, never stored as "gender", and never included in QuizAnswer[].
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Which imagery variant the user prefers for outfit-photography questions.
 *
 * - 'masculine'  → always show the menswear-leaning photo.
 * - 'feminine'   → always show the womenswear-leaning photo.
 * - 'neutral'    → alternate deterministically by question index
 *                  (even index → masculine, odd index → feminine).
 */
export type ImageSet = 'masculine' | 'feminine' | 'neutral';

/**
 * A quiz option that carries a single image URL.
 * Used by the 6 gender-neutral questions (colour swatches, icon illustrations,
 * close-up garment details).
 */
export interface SingleImageOption {
  imageUrl: string;
  [key: string]: unknown;
}

/**
 * A quiz option that carries two image variants.
 * Used by the 5 outfit-photography questions.
 */
export interface GenderedImageOption {
  images: { masculine: string; feminine: string };
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

export function isSingleImageOption(
  option: SingleImageOption | GenderedImageOption,
): option is SingleImageOption {
  return 'imageUrl' in option && typeof (option as SingleImageOption).imageUrl === 'string';
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Resolve the correct image URL for a quiz option given the current imageSet
 * and the (0-based) index of the question in the full question list.
 *
 * Rules:
 *   - SingleImageOption   → always returns `imageUrl`, regardless of imageSet.
 *   - GenderedImageOption + 'masculine' → `images.masculine`.
 *   - GenderedImageOption + 'feminine'  → `images.feminine`.
 *   - GenderedImageOption + 'neutral'   → deterministic alternation:
 *       even questionIndex → images.masculine
 *       odd  questionIndex → images.feminine
 *
 * Pure function — no side effects, no hooks.
 * The neutral alternation depends only on `questionIndex` (no randomness)
 * so it is stable across re-renders.
 *
 * @param option        - The quiz option to resolve an image for.
 * @param imageSet      - The user's display preference.
 * @param questionIndex - 0-based index of the question in the quiz sequence.
 * @returns             The resolved image URL string.
 */
export function getOptionImage(
  option: SingleImageOption | GenderedImageOption,
  imageSet: ImageSet,
  questionIndex: number,
): string {
  if (isSingleImageOption(option)) {
    return option.imageUrl;
  }

  // GenderedImageOption
  const { masculine, feminine } = option.images;

  if (imageSet === 'masculine') return masculine;
  if (imageSet === 'feminine') return feminine;

  // 'neutral' — deterministic alternation by question index
  return questionIndex % 2 === 0 ? masculine : feminine;
}
