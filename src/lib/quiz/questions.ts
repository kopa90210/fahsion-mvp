/**
 * Static quiz data — 5 questions × 4 image options.
 *
 * Each option's `weights` is a partial style vector.
 * Dimensions not listed default to 0 during scoring.
 *
 * `gradient` is a CSS gradient string used as a fallback / overlay
 * on the image card to ensure the label is always readable.
 */

export interface QuizOptionDisplay {
  id: string;
  imageUrl: string;
  label: string;
  weights: Record<string, number>;
  /** CSS gradient used as card overlay for legibility. */
  gradient: string;
}

export interface QuizQuestionDisplay {
  id: string;
  prompt: string;
  options: QuizOptionDisplay[];
}

export const QUIZ_QUESTIONS: QuizQuestionDisplay[] = [
  // -----------------------------------------------------------------------
  // Q1 — Core style identity
  // -----------------------------------------------------------------------
  {
    id: 'core-style',
    prompt: 'Pick the outfit that feels most you',
    options: [
      {
        id: 'cs-minimal',
        imageUrl: '/quiz/q1-minimal.jpg',
        label: 'Clean & minimal',
        weights: { minimal: 0.95, formal: 0.3, earth_tones: 0.2 },
        gradient: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
      },
      {
        id: 'cs-streetwear',
        imageUrl: '/quiz/q1-streetwear.jpg',
        label: 'Bold streetwear',
        weights: { streetwear: 0.95, edgy: 0.35, minimal: 0.05 },
        gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      },
      {
        id: 'cs-formal',
        imageUrl: '/quiz/q1-formal.jpg',
        label: 'Sharp & tailored',
        weights: { formal: 0.95, minimal: 0.4, edgy: 0.1 },
        gradient: 'linear-gradient(135deg, #2c3e50 0%, #4a6741 100%)',
      },
      {
        id: 'cs-bohemian',
        imageUrl: '/quiz/q1-bohemian.jpg',
        label: 'Free-spirited boho',
        weights: { bohemian: 0.95, earth_tones: 0.6, minimal: 0.05 },
        gradient: 'linear-gradient(135deg, #d4a574 0%, #c2956b 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q2 — Mood / aesthetic vibe
  // -----------------------------------------------------------------------
  {
    id: 'vibe',
    prompt: 'Which vibe draws you in?',
    options: [
      {
        id: 'vb-dark',
        imageUrl: '/quiz/q2-dark.jpg',
        label: 'Dark & moody',
        weights: { edgy: 0.9, streetwear: 0.3, formal: 0.2 },
        gradient: 'linear-gradient(135deg, #0d0d0d 0%, #2d1f3d 100%)',
      },
      {
        id: 'vb-warm',
        imageUrl: '/quiz/q2-warm.jpg',
        label: 'Warm & earthy',
        weights: { earth_tones: 0.95, bohemian: 0.5, minimal: 0.2 },
        gradient: 'linear-gradient(135deg, #8b6914 0%, #6b8e23 100%)',
      },
      {
        id: 'vb-clean',
        imageUrl: '/quiz/q2-clean.jpg',
        label: 'Clean & bright',
        weights: { minimal: 0.85, formal: 0.3, earth_tones: 0.05 },
        gradient: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
      },
      {
        id: 'vb-eclectic',
        imageUrl: '/quiz/q2-eclectic.jpg',
        label: 'Eclectic & colorful',
        weights: { bohemian: 0.7, streetwear: 0.4, edgy: 0.2 },
        gradient: 'linear-gradient(135deg, #e74c3c 0%, #f39c12 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q3 — Weekend / casual preferences
  // -----------------------------------------------------------------------
  {
    id: 'weekend',
    prompt: 'Your ideal weekend look?',
    options: [
      {
        id: 'wk-athleisure',
        imageUrl: '/quiz/q3-athleisure.jpg',
        label: 'Athleisure street',
        weights: { streetwear: 0.85, minimal: 0.3, edgy: 0.15 },
        gradient: 'linear-gradient(135deg, #495057 0%, #adb5bd 100%)',
      },
      {
        id: 'wk-linen',
        imageUrl: '/quiz/q3-linen.jpg',
        label: 'Relaxed linen',
        weights: { bohemian: 0.8, earth_tones: 0.7, minimal: 0.25 },
        gradient: 'linear-gradient(135deg, #d4a574 0%, #f0e6d3 100%)',
      },
      {
        id: 'wk-smart',
        imageUrl: '/quiz/q3-smart.jpg',
        label: 'Smart casual',
        weights: { formal: 0.7, minimal: 0.5, earth_tones: 0.2 },
        gradient: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
      },
      {
        id: 'wk-denim',
        imageUrl: '/quiz/q3-denim.jpg',
        label: 'Classic denim',
        weights: { minimal: 0.6, streetwear: 0.3, earth_tones: 0.3 },
        gradient: 'linear-gradient(135deg, #1a5276 0%, #5dade2 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q4 — Color palette preference
  // -----------------------------------------------------------------------
  {
    id: 'palette',
    prompt: 'Pick a color palette',
    options: [
      {
        id: 'pl-mono',
        imageUrl: '/quiz/q4-mono.jpg',
        label: 'Black, white & grey',
        weights: { minimal: 0.8, edgy: 0.4, formal: 0.3 },
        gradient: 'linear-gradient(135deg, #1a1a1a 0%, #e0e0e0 100%)',
      },
      {
        id: 'pl-earth',
        imageUrl: '/quiz/q4-earth.jpg',
        label: 'Terracotta & olive',
        weights: { earth_tones: 0.95, bohemian: 0.5, minimal: 0.1 },
        gradient: 'linear-gradient(135deg, #8b4513 0%, #6b8e23 100%)',
      },
      {
        id: 'pl-navy',
        imageUrl: '/quiz/q4-navy.jpg',
        label: 'Navy & burgundy',
        weights: { formal: 0.8, minimal: 0.3, earth_tones: 0.3 },
        gradient: 'linear-gradient(135deg, #1a2a4a 0%, #722f37 100%)',
      },
      {
        id: 'pl-neon',
        imageUrl: '/quiz/q4-neon.jpg',
        label: 'Neon & bold',
        weights: { streetwear: 0.8, edgy: 0.5, bohemian: 0.2 },
        gradient: 'linear-gradient(135deg, #ff00ff 0%, #00ff88 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q5 — Texture / detail preference
  // -----------------------------------------------------------------------
  {
    id: 'detail',
    prompt: 'Which detail do you love?',
    options: [
      {
        id: 'dt-tailored',
        imageUrl: '/quiz/q5-tailored.jpg',
        label: 'Tailored stitching',
        weights: { formal: 0.9, minimal: 0.4, edgy: 0.1 },
        gradient: 'linear-gradient(135deg, #2c3e50 0%, #95a5a6 100%)',
      },
      {
        id: 'dt-graphic',
        imageUrl: '/quiz/q5-graphic.jpg',
        label: 'Graphic prints',
        weights: { streetwear: 0.9, edgy: 0.35, bohemian: 0.15 },
        gradient: 'linear-gradient(135deg, #e74c3c 0%, #f39c12 100%)',
      },
      {
        id: 'dt-raw',
        imageUrl: '/quiz/q5-raw.jpg',
        label: 'Raw edges & leather',
        weights: { edgy: 0.95, streetwear: 0.3, minimal: 0.1 },
        gradient: 'linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%)',
      },
      {
        id: 'dt-embroidery',
        imageUrl: '/quiz/q5-embroidery.jpg',
        label: 'Embroidery & texture',
        weights: { bohemian: 0.9, earth_tones: 0.5, formal: 0.15 },
        gradient: 'linear-gradient(135deg, #8e44ad 0%, #d4a574 100%)',
      },
    ],
  },
];

/**
 * Re-export as QuizQuestion[] for use by the scoring engine.
 * The scoring engine doesn't need the `gradient` field.
 */
export const QUIZ_QUESTIONS_FOR_SCORING = QUIZ_QUESTIONS as unknown as import('./scoring').QuizQuestion[];
