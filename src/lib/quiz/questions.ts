/**
 * Static quiz data — 11 questions × 4 image options each.
 * Q12 (forced-pair) is generated dynamically at runtime by buildForcedPairQuestion.
 *
 * Each option's `weights` is a partial style vector.
 * Dimensions not listed default to 0 during scoring.
 *
 * `gradient` is a CSS gradient string used as a fallback / overlay
 * on the image card to ensure the label is always readable.
 *
 * Image paths:
 *   - Gender-neutral questions: /quiz/q{N}-{slug}.jpg  (single `imageUrl`)
 *   - Outfit-photography questions: /quiz/q{N}-{slug}-m.jpg  and
 *     /quiz/q{N}-{slug}-f.jpg  stored as `images.masculine` / `images.feminine`
 * Missing images fall back to the gradient via the onError handler in StyleQuiz.tsx.
 */

import type { SingleImageOption, GenderedImageOption } from './imageSet';

/** Base fields shared by every display option. */
interface QuizOptionBase {
  id: string;
  label: string;
  weights: Record<string, number>;
  /** CSS gradient used as card overlay for legibility. */
  gradient: string;
}

/**
 * An option that shows a single gender-neutral image.
 * Used by colour-palette, fit-preference, detail-preference,
 * shopping-behavior, outfit-risk, and layering-preference.
 */
export type QuizOptionDisplay = QuizOptionBase & SingleImageOption;

/**
 * An option that carries two outfit-photography variants.
 * Used by everyday-look, going-out-look, work-study-look,
 * weekend-look, and travel-look.
 */
export type GenderedQuizOptionDisplay = QuizOptionBase & GenderedImageOption;

export interface QuizQuestionDisplay {
  id: string;
  prompt: string;
  options: (QuizOptionDisplay | GenderedQuizOptionDisplay)[];
}

export const QUIZ_QUESTIONS: QuizQuestionDisplay[] = [
  // -----------------------------------------------------------------------
  // Q1 — Everyday look  [outfit photography — gendered variants]
  // -----------------------------------------------------------------------
  {
    id: 'everyday-look',
    prompt: 'Which look feels most like you?',
    options: [
      {
        id: 'minimal-casual',
        images: {
          masculine: '/quiz/q1-minimal-casual-m.jpg',
          feminine:  '/quiz/q1-minimal-casual-f.jpg',
        },
        label: 'Clean & minimal',
        weights: { minimal: 0.9, casual: 0.4 },
        gradient: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
      },
      {
        id: 'streetwear',
        images: {
          masculine: '/quiz/q1-streetwear-m.jpg',
          feminine:  '/quiz/q1-streetwear-f.jpg',
        },
        label: 'Bold streetwear',
        weights: { streetwear: 0.9, trend_forward: 0.3 },
        gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      },
      {
        id: 'classic',
        images: {
          masculine: '/quiz/q1-classic-m.jpg',
          feminine:  '/quiz/q1-classic-f.jpg',
        },
        label: 'Timeless classic',
        weights: { classic: 0.9, smart_casual: 0.3 },
        gradient: 'linear-gradient(135deg, #2c3e50 0%, #4a5568 100%)',
      },
      {
        id: 'relaxed',
        images: {
          masculine: '/quiz/q1-relaxed-m.jpg',
          feminine:  '/quiz/q1-relaxed-f.jpg',
        },
        label: 'Easy & relaxed',
        weights: { relaxed: 0.9, casual: 0.4 },
        gradient: 'linear-gradient(135deg, #d4a574 0%, #c2956b 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q2 — Going-out look  [outfit photography — gendered variants]
  // -----------------------------------------------------------------------
  {
    id: 'going-out-look',
    prompt: 'What would you wear on a night out?',
    options: [
      {
        id: 'sharp-tailored',
        images: {
          masculine: '/quiz/q2-sharp-tailored-m.jpg',
          feminine:  '/quiz/q2-sharp-tailored-f.jpg',
        },
        label: 'Sharp & tailored',
        weights: { formal: 0.85, classic: 0.4 },
        gradient: 'linear-gradient(135deg, #1a2a4a 0%, #2c3e50 100%)',
      },
      {
        id: 'bold-streetwear',
        images: {
          masculine: '/quiz/q2-bold-streetwear-m.jpg',
          feminine:  '/quiz/q2-bold-streetwear-f.jpg',
        },
        label: 'Bold streetwear',
        weights: { streetwear: 0.85, trend_forward: 0.4 },
        gradient: 'linear-gradient(135deg, #0d0d0d 0%, #2d1f3d 100%)',
      },
      {
        id: 'elevated-casual',
        images: {
          masculine: '/quiz/q2-elevated-casual-m.jpg',
          feminine:  '/quiz/q2-elevated-casual-f.jpg',
        },
        label: 'Elevated casual',
        weights: { smart_casual: 0.8, classic: 0.3 },
        gradient: 'linear-gradient(135deg, #4a4e69 0%, #9a8c98 100%)',
      },
      {
        id: 'edgy',
        images: {
          masculine: '/quiz/q2-edgy-m.jpg',
          feminine:  '/quiz/q2-edgy-f.jpg',
        },
        label: 'Edgy & dark',
        weights: { edgy: 0.9, streetwear: 0.2 },
        gradient: 'linear-gradient(135deg, #1a1a1a 0%, #4a1942 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q3 — Work / study look  [outfit photography — gendered variants]
  // -----------------------------------------------------------------------
  {
    id: 'work-study-look',
    prompt: 'Which look feels right for work or school?',
    options: [
      {
        id: 'smart-casual',
        images: {
          masculine: '/quiz/q3-smart-casual-m.jpg',
          feminine:  '/quiz/q3-smart-casual-f.jpg',
        },
        label: 'Smart casual',
        weights: { smart_casual: 0.85, classic: 0.3 },
        gradient: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
      },
      {
        id: 'formal-tailored',
        images: {
          masculine: '/quiz/q3-formal-tailored-m.jpg',
          feminine:  '/quiz/q3-formal-tailored-f.jpg',
        },
        label: 'Formal & tailored',
        weights: { formal: 0.9, old_money: 0.3 },
        gradient: 'linear-gradient(135deg, #1a2a4a 0%, #722f37 100%)',
      },
      {
        id: 'relaxed-casual',
        images: {
          masculine: '/quiz/q3-relaxed-casual-m.jpg',
          feminine:  '/quiz/q3-relaxed-casual-f.jpg',
        },
        label: 'Relaxed & casual',
        weights: { casual: 0.8, relaxed: 0.4 },
        gradient: 'linear-gradient(135deg, #6b8e23 0%, #d4a574 100%)',
      },
      {
        id: 'streetwear-leaning',
        images: {
          masculine: '/quiz/q3-streetwear-leaning-m.jpg',
          feminine:  '/quiz/q3-streetwear-leaning-f.jpg',
        },
        label: 'Streetwear-leaning',
        weights: { streetwear: 0.6, smart_casual: 0.3 },
        gradient: 'linear-gradient(135deg, #495057 0%, #adb5bd 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q4 — Weekend look  [outfit photography — gendered variants]
  // -----------------------------------------------------------------------
  {
    id: 'weekend-look',
    prompt: 'Your ideal weekend look?',
    options: [
      {
        id: 'athleisure',
        images: {
          masculine: '/quiz/q4-athleisure-m.jpg',
          feminine:  '/quiz/q4-athleisure-f.jpg',
        },
        label: 'Athleisure street',
        weights: { sporty: 0.9, streetwear: 0.3 },
        gradient: 'linear-gradient(135deg, #0f3460 0%, #533483 100%)',
      },
      {
        id: 'relaxed-linen',
        images: {
          masculine: '/quiz/q4-relaxed-linen-m.jpg',
          feminine:  '/quiz/q4-relaxed-linen-f.jpg',
        },
        label: 'Relaxed linen',
        weights: { relaxed: 0.85, casual: 0.4 },
        gradient: 'linear-gradient(135deg, #d4a574 0%, #f0e6d3 100%)',
      },
      {
        id: 'denim-classic',
        images: {
          masculine: '/quiz/q4-denim-classic-m.jpg',
          feminine:  '/quiz/q4-denim-classic-f.jpg',
        },
        label: 'Classic denim',
        weights: { classic: 0.7, casual: 0.4 },
        gradient: 'linear-gradient(135deg, #1a5276 0%, #5dade2 100%)',
      },
      {
        id: 'vintage-inspired',
        images: {
          masculine: '/quiz/q4-vintage-inspired-m.jpg',
          feminine:  '/quiz/q4-vintage-inspired-f.jpg',
        },
        label: 'Vintage-inspired',
        weights: { vintage: 0.85, relaxed: 0.3 },
        gradient: 'linear-gradient(135deg, #8b4513 0%, #d2691e 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q5 — Color palette
  // -----------------------------------------------------------------------
  {
    id: 'color-palette',
    prompt: 'Which colors do you naturally reach for?',
    options: [
      {
        id: 'monochrome',
        imageUrl: '/quiz/q5-monochrome.jpg',
        label: 'Black, white & grey',
        weights: { minimal: 0.7, edgy: 0.2 },
        gradient: 'linear-gradient(135deg, #1a1a1a 0%, #e0e0e0 100%)',
      },
      {
        id: 'earthy-neutrals',
        imageUrl: '/quiz/q5-earthy-neutrals.jpg',
        label: 'Earthy neutrals',
        weights: { relaxed: 0.5, old_money: 0.3 },
        gradient: 'linear-gradient(135deg, #8b6914 0%, #6b8e23 100%)',
      },
      {
        id: 'navy-jewel',
        imageUrl: '/quiz/q5-navy-jewel.jpg',
        label: 'Navy & jewel tones',
        weights: { classic: 0.6, old_money: 0.4 },
        gradient: 'linear-gradient(135deg, #1a2a4a 0%, #722f37 100%)',
      },
      {
        id: 'bright-bold',
        imageUrl: '/quiz/q5-bright-bold.jpg',
        label: 'Bright & bold',
        weights: { trend_forward: 0.6, streetwear: 0.3 },
        gradient: 'linear-gradient(135deg, #e74c3c 0%, #f39c12 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q6 — Fit preference
  // -----------------------------------------------------------------------
  {
    id: 'fit-preference',
    prompt: 'How do you like your clothes to fit?',
    options: [
      {
        id: 'relaxed-fit',
        imageUrl: '/quiz/q6-relaxed-fit.jpg',
        label: 'Relaxed & roomy',
        weights: { relaxed: 0.8, casual: 0.3 },
        gradient: 'linear-gradient(135deg, #d4a574 0%, #c2956b 100%)',
      },
      {
        id: 'regular-fit',
        imageUrl: '/quiz/q6-regular-fit.jpg',
        label: 'Regular fit',
        weights: { classic: 0.5, smart_casual: 0.3 },
        gradient: 'linear-gradient(135deg, #2c3e50 0%, #4a5568 100%)',
      },
      {
        id: 'oversized-fit',
        imageUrl: '/quiz/q6-oversized-fit.jpg',
        label: 'Oversized & loose',
        weights: { streetwear: 0.7, trend_forward: 0.3 },
        gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      },
      {
        id: 'slim-fit',
        imageUrl: '/quiz/q6-slim-fit.jpg',
        label: 'Slim & tailored',
        weights: { formal: 0.4, smart_casual: 0.4 },
        gradient: 'linear-gradient(135deg, #1a2a4a 0%, #2c3e50 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q7 — Detail preference
  // -----------------------------------------------------------------------
  {
    id: 'detail-preference',
    prompt: 'Which detail do you love?',
    options: [
      {
        id: 'tailored-stitching',
        imageUrl: '/quiz/q7-tailored-stitching.jpg',
        label: 'Tailored stitching',
        weights: { formal: 0.7, old_money: 0.3 },
        gradient: 'linear-gradient(135deg, #2c3e50 0%, #95a5a6 100%)',
      },
      {
        id: 'graphic-prints',
        imageUrl: '/quiz/q7-graphic-prints.jpg',
        label: 'Graphic prints',
        weights: { streetwear: 0.8, trend_forward: 0.3 },
        gradient: 'linear-gradient(135deg, #e74c3c 0%, #f39c12 100%)',
      },
      {
        id: 'raw-edges-hardware',
        imageUrl: '/quiz/q7-raw-edges-hardware.jpg',
        label: 'Raw edges & hardware',
        weights: { edgy: 0.85, streetwear: 0.2 },
        gradient: 'linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%)',
      },
      {
        id: 'embroidery-texture',
        imageUrl: '/quiz/q7-embroidery-texture.jpg',
        label: 'Embroidery & texture',
        weights: { vintage: 0.6, relaxed: 0.3 },
        gradient: 'linear-gradient(135deg, #8e44ad 0%, #d4a574 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q8 — Shopping behavior (non-style signal; weights intentionally empty)
  // -----------------------------------------------------------------------
  {
    id: 'shopping-behavior',
    prompt: "When you find something you love, what usually makes you buy it?",
    options: [
      {
        id: 'matches-wardrobe',
        imageUrl: '/quiz/q8-matches-wardrobe.jpg',
        label: 'It matches my wardrobe',
        weights: {},
        gradient: 'linear-gradient(135deg, #2c3e50 0%, #4a5568 100%)',
      },
      {
        id: 'looks-unique',
        imageUrl: '/quiz/q8-looks-unique.jpg',
        label: 'It looks unique',
        weights: {},
        gradient: 'linear-gradient(135deg, #8e44ad 0%, #3498db 100%)',
      },
      {
        id: 'quality-worth-it',
        imageUrl: '/quiz/q8-quality-worth-it.jpg',
        label: 'Quality worth the price',
        weights: {},
        gradient: 'linear-gradient(135deg, #8b6914 0%, #6b8e23 100%)',
      },
      {
        id: 'price-is-right',
        imageUrl: '/quiz/q8-price-is-right.jpg',
        label: 'The price is right',
        weights: {},
        gradient: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q9 — Outfit risk (non-style signal; weights intentionally empty)
  // -----------------------------------------------------------------------
  {
    id: 'outfit-risk',
    prompt: 'Which one sounds more like you?',
    options: [
      {
        id: 'safe-combinations',
        imageUrl: '/quiz/q9-safe-combinations.jpg',
        label: 'I stick to safe combinations',
        weights: {},
        gradient: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
      },
      {
        id: 'sometimes-different',
        imageUrl: '/quiz/q9-sometimes-different.jpg',
        label: 'I sometimes try something different',
        weights: {},
        gradient: 'linear-gradient(135deg, #4a5568 0%, #718096 100%)',
      },
      {
        id: 'love-experimenting',
        imageUrl: '/quiz/q9-love-experimenting.jpg',
        label: 'I love experimenting',
        weights: {},
        gradient: 'linear-gradient(135deg, #e74c3c 0%, #f39c12 100%)',
      },
      {
        id: 'depends-on-mood',
        imageUrl: '/quiz/q9-depends-on-mood.jpg',
        label: 'It depends on my mood',
        weights: {},
        gradient: 'linear-gradient(135deg, #8e44ad 0%, #2980b9 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q10 — Layering preference
  // -----------------------------------------------------------------------
  {
    id: 'layering-preference',
    prompt: 'How do you feel about layering?',
    options: [
      {
        id: 'light-layers',
        imageUrl: '/quiz/q10-light-layers.jpg',
        label: 'Light layers for comfort',
        weights: { casual: 0.3, sporty: 0.2 },
        gradient: 'linear-gradient(135deg, #d4a574 0%, #f0e6d3 100%)',
      },
      {
        id: 'removable-layer',
        imageUrl: '/quiz/q10-removable-layer.jpg',
        label: 'A removable layer for versatility',
        weights: { smart_casual: 0.3, classic: 0.2 },
        gradient: 'linear-gradient(135deg, #2c3e50 0%, #4a5568 100%)',
      },
      {
        id: 'layering-for-look',
        imageUrl: '/quiz/q10-layering-for-look.jpg',
        label: 'Layering is part of the look',
        weights: { trend_forward: 0.4, streetwear: 0.3 },
        gradient: 'linear-gradient(135deg, #1a1a2e 0%, #533483 100%)',
      },
      {
        id: 'single-piece',
        imageUrl: '/quiz/q10-single-piece.jpg',
        label: 'I prefer a single statement piece',
        weights: { minimal: 0.4, classic: 0.2 },
        gradient: 'linear-gradient(135deg, #f5f5f5 0%, #718096 100%)',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Q11 — Travel look  [outfit photography — gendered variants]
  // -----------------------------------------------------------------------
  {
    id: 'travel-look',
    prompt: 'Your go-to travel outfit?',
    options: [
      {
        id: 'comfortable-practical',
        images: {
          masculine: '/quiz/q11-comfortable-practical-m.jpg',
          feminine:  '/quiz/q11-comfortable-practical-f.jpg',
        },
        label: 'Comfortable & practical',
        weights: { casual: 0.6, sporty: 0.3 },
        gradient: 'linear-gradient(135deg, #495057 0%, #adb5bd 100%)',
      },
      {
        id: 'effortlessly-stylish',
        images: {
          masculine: '/quiz/q11-effortlessly-stylish-m.jpg',
          feminine:  '/quiz/q11-effortlessly-stylish-f.jpg',
        },
        label: 'Effortlessly stylish',
        weights: { classic: 0.5, smart_casual: 0.3 },
        gradient: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
      },
      {
        id: 'statement-pieces',
        images: {
          masculine: '/quiz/q11-statement-pieces-m.jpg',
          feminine:  '/quiz/q11-statement-pieces-f.jpg',
        },
        label: 'Statement pieces',
        weights: { trend_forward: 0.7, streetwear: 0.3 },
        gradient: 'linear-gradient(135deg, #e74c3c 0%, #8e44ad 100%)',
      },
      {
        id: 'pack-light-neutral',
        images: {
          masculine: '/quiz/q11-pack-light-neutral-m.jpg',
          feminine:  '/quiz/q11-pack-light-neutral-f.jpg',
        },
        label: 'Pack light, stay neutral',
        weights: { minimal: 0.5, classic: 0.2 },
        gradient: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
      },
    ],
  },
];

/**
 * Re-export as QuizQuestion[] for use by the scoring engine.
 * The scoring engine doesn't need the `gradient` field.
 */
export const QUIZ_QUESTIONS_FOR_SCORING = QUIZ_QUESTIONS as unknown as import('./scoring').QuizQuestion[];
