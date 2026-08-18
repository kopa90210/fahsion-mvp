/**
 * buildForcedPairQuestion
 *
 * Generates the dynamic Q12 "forced-pair" question after the user has
 * answered Q1–Q11. It:
 *   1. Computes the current style vector from the running answers.
 *   2. Finds the top-2 non-zero dimensions.
 *   3. Picks one already-used option from earlier answers whose highest
 *      weight matches each of those two dimensions.
 *   4. Falls back gracefully if fewer than 2 non-zero dimensions exist.
 *
 * Pure function — no side effects, no React, no Supabase.
 */

import { computeStyleVector } from './scoring';
import type { QuizAnswer, QuizQuestion } from './scoring';
import type { QuizQuestionDisplay } from './questions';

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Return the dimension key with the highest value in a weight map.
 * Returns undefined when the map is empty.
 */
function topDimension(weights: Record<string, number>): string | undefined {
  let best: string | undefined;
  let bestVal = -Infinity;
  for (const [dim, val] of Object.entries(weights)) {
    if (val > bestVal) {
      bestVal = val;
      best = dim;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the forced-pair question (Q12) dynamically from the user's answers.
 *
 * @param answers  - The answers collected so far (Q1–Q11).
 * @param questions - The static question bank (QUIZ_QUESTIONS).
 * @returns A QuizQuestionDisplay with exactly 2 options, ready to render.
 */
export function buildForcedPairQuestion(
  answers: QuizAnswer[],
  questions: QuizQuestionDisplay[],
): QuizQuestionDisplay {
  // ------------------------------------------------------------------
  // 1. Find the top-2 non-zero dimensions from the current style vector.
  // ------------------------------------------------------------------
  const styleVec = computeStyleVector(
    answers,
    questions as unknown as QuizQuestion[],
  );

  const rankedDims = Object.entries(styleVec)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([d]) => d);

  const dim1 = rankedDims[0];
  const dim2 = rankedDims[1];

  // ------------------------------------------------------------------
  // 2. Build a flat list of all answered options we can pick from.
  // ------------------------------------------------------------------
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const usedOptions = answers
    .flatMap((ans) => {
      const q = questionMap.get(ans.questionId);
      if (!q) return [];
      const opt = q.options.find((o) => o.id === ans.optionId);
      return opt ? [opt] : [];
    });

  // ------------------------------------------------------------------
  // 3. For each of the 2 top dimensions, find the best matching option.
  //    "Best match" = option whose top-weight dimension equals dim.
  //    Fallback: option with the highest value for that dimension.
  // ------------------------------------------------------------------
  function bestOptionForDim(
    dim: string | undefined,
    exclude: string | undefined,
  ) {
    if (!dim) {
      // No dimension available — just return first option that isn't excluded
      return usedOptions.find((o) => o.id !== exclude) ?? usedOptions[0];
    }

    // Exact top-weight match
    const exactMatch = usedOptions.find(
      (o) => o.id !== exclude && topDimension(o.weights) === dim,
    );
    if (exactMatch) return exactMatch;

    // Fallback: highest value for dim (among non-excluded options)
    let best = usedOptions.find((o) => o.id !== exclude) ?? usedOptions[0];
    let bestVal = best?.weights[dim] ?? -Infinity;
    for (const opt of usedOptions) {
      if (opt.id === exclude) continue;
      const val = opt.weights[dim] ?? 0;
      if (val > bestVal) {
        bestVal = val;
        best = opt;
      }
    }
    return best;
  }

  const opt1 = bestOptionForDim(dim1, undefined);
  const opt2 = bestOptionForDim(dim2, opt1?.id);

  // ------------------------------------------------------------------
  // 4. Assemble. Guard against degenerate cases (< 2 answered options).
  // ------------------------------------------------------------------
  const fallbackOpts = questions.flatMap((q) => q.options);

  const resolvedOpt1 = opt1 ?? fallbackOpts[0];
  const resolvedOpt2 =
    opt2 ??
    fallbackOpts.find((o) => o.id !== resolvedOpt1?.id) ??
    fallbackOpts[1];

  return {
    id: 'forced-pair',
    prompt: 'Which one would you actually wear?',
    options: [
      { ...resolvedOpt1, id: `fp-${resolvedOpt1.id}-a` },
      { ...resolvedOpt2, id: `fp-${resolvedOpt2.id}-b` },
    ],
  };
}
