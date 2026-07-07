/**
 * Deterministic style-quiz scoring engine.
 *
 * Pure function — no React, no Supabase, no LLM.
 * Takes an array of answers + the question bank and returns a
 * normalised StyleVector with every dimension in [0, 1].
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A style vector maps dimension names to weights ∈ [0, 1]. */
export type StyleVector = Record<string, number>;

/** One answer: which option the user picked for a given question. */
export interface QuizAnswer {
  questionId: string;
  optionId: string;
}

/** An individual option within a question. */
export interface QuizOption {
  id: string;
  imageUrl: string;
  label: string;
  /** Partial weight map — only dimensions this option contributes to. */
  weights: Partial<StyleVector>;
}

/** A single quiz question. */
export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
}

// ---------------------------------------------------------------------------
// All style dimensions the quiz can produce.
// ---------------------------------------------------------------------------

export const STYLE_DIMENSIONS = [
  'minimal',
  'streetwear',
  'formal',
  'bohemian',
  'edgy',
  'earth_tones',
] as const;

export type StyleDimension = (typeof STYLE_DIMENSIONS)[number];

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Compute a style vector from the user's quiz answers.
 *
 * Algorithm:
 *   1. For each answered question find the selected option.
 *   2. Collect the option's weight map.
 *   3. For every style dimension, average the contributions across all
 *      answered questions (missing dimension in an option → 0 contribution).
 *   4. Clamp to [0, 1], round to 2 dp.
 *
 * @returns A full StyleVector with every dimension present.
 */
export function computeStyleVector(
  answers: QuizAnswer[],
  questions: QuizQuestion[],
): StyleVector {
  if (answers.length === 0) {
    return Object.fromEntries(STYLE_DIMENSIONS.map((d) => [d, 0]));
  }

  // Build a lookup: questionId → QuizQuestion
  const questionMap = new Map<string, QuizQuestion>(
    questions.map((q) => [q.id, q]),
  );

  // Collect the weight maps for each answered question.
  const selectedWeights: Partial<StyleVector>[] = [];

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    if (!question) continue;

    const option = question.options.find((o) => o.id === answer.optionId);
    if (!option) continue;

    selectedWeights.push(option.weights);
  }

  if (selectedWeights.length === 0) {
    return Object.fromEntries(STYLE_DIMENSIONS.map((d) => [d, 0]));
  }

  const count = selectedWeights.length;

  const vector: StyleVector = {};
  for (const dim of STYLE_DIMENSIONS) {
    const sum = selectedWeights.reduce(
      (acc, w) => acc + (w[dim] ?? 0),
      0,
    );
    const avg = sum / count;
    // Clamp [0, 1] and round to 2 decimal places.
    vector[dim] = Math.round(Math.min(1, Math.max(0, avg)) * 100) / 100;
  }

  return vector;
}
