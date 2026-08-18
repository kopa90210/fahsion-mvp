import { describe, it, expect } from 'vitest'
import {
  computeStyleVector,
  extractQuizMetadata,
  STYLE_DIMENSIONS,
  type QuizAnswer,
  type QuizQuestion,
} from './scoring'
import { QUIZ_QUESTIONS } from './questions'
import { buildForcedPairQuestion } from './buildForcedPair'

// ---------------------------------------------------------------------------
// Minimal fixture: 3 questions × 2 options each
// Uses real dimensions from the new 12-dimension taxonomy.
// ---------------------------------------------------------------------------

const FIXTURE_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    prompt: 'Question 1',
    options: [
      {
        id: 'q1-a',
        imageUrl: '/test/a.png',
        label: 'Minimal pick',
        weights: { minimal: 0.9, classic: 0.3 },
      },
      {
        id: 'q1-b',
        imageUrl: '/test/b.png',
        label: 'Street pick',
        weights: { streetwear: 0.9, edgy: 0.4 },
      },
    ],
  },
  {
    id: 'q2',
    prompt: 'Question 2',
    options: [
      {
        id: 'q2-a',
        imageUrl: '/test/c.png',
        label: 'Relaxed pick',
        weights: { relaxed: 0.8, casual: 0.6 },
      },
      {
        id: 'q2-b',
        imageUrl: '/test/d.png',
        label: 'Formal pick',
        weights: { formal: 0.85, minimal: 0.5 },
      },
    ],
  },
  {
    id: 'q3',
    prompt: 'Question 3',
    options: [
      {
        id: 'q3-a',
        imageUrl: '/test/e.png',
        label: 'Edgy pick',
        weights: { edgy: 0.95, streetwear: 0.3 },
      },
      {
        id: 'q3-b',
        imageUrl: '/test/f.png',
        label: 'Vintage pick',
        weights: { vintage: 0.85, relaxed: 0.7 },
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// computeStyleVector
// ---------------------------------------------------------------------------

describe('computeStyleVector', () => {
  it('returns all zeros for empty answers', () => {
    const result = computeStyleVector([], FIXTURE_QUESTIONS)
    for (const dim of STYLE_DIMENSIONS) {
      expect(result[dim]).toBe(0)
    }
  })

  it('returns every style dimension in the vector', () => {
    const answers: QuizAnswer[] = [{ questionId: 'q1', optionId: 'q1-a' }]
    const result = computeStyleVector(answers, FIXTURE_QUESTIONS)
    for (const dim of STYLE_DIMENSIONS) {
      expect(result).toHaveProperty(dim)
    }
  })

  it('all values are between 0 and 1', () => {
    const answers: QuizAnswer[] = [
      { questionId: 'q1', optionId: 'q1-a' },
      { questionId: 'q2', optionId: 'q2-a' },
      { questionId: 'q3', optionId: 'q3-a' },
    ]
    const result = computeStyleVector(answers, FIXTURE_QUESTIONS)
    for (const dim of STYLE_DIMENSIONS) {
      expect(result[dim]).toBeGreaterThanOrEqual(0)
      expect(result[dim]).toBeLessThanOrEqual(1)
    }
  })

  it('all-minimal answers → minimal ≥ 0.8', () => {
    // q1-a has minimal: 0.9 — using alone gives avg of 0.9
    const answers: QuizAnswer[] = [{ questionId: 'q1', optionId: 'q1-a' }]
    const result = computeStyleVector(answers, FIXTURE_QUESTIONS)
    expect(result.minimal).toBeGreaterThanOrEqual(0.8)
  })

  it('mixed answers produce blended vector', () => {
    // Pick minimal in q1, relaxed in q2, edgy in q3
    const answers: QuizAnswer[] = [
      { questionId: 'q1', optionId: 'q1-a' }, // minimal:0.9, classic:0.3
      { questionId: 'q2', optionId: 'q2-a' }, // relaxed:0.8, casual:0.6
      { questionId: 'q3', optionId: 'q3-a' }, // edgy:0.95, streetwear:0.3
    ]
    const result = computeStyleVector(answers, FIXTURE_QUESTIONS)

    // minimal: avg(0.9, 0, 0) = 0.30
    expect(result.minimal).toBeCloseTo(0.3, 1)
    // relaxed: avg(0, 0.8, 0) = 0.27
    expect(result.relaxed).toBeCloseTo(0.27, 1)
    // edgy: avg(0, 0, 0.95) = 0.32
    expect(result.edgy).toBeCloseTo(0.32, 1)
    // classic: avg(0.3, 0, 0) = 0.1
    expect(result.classic).toBeCloseTo(0.1, 1)
    // casual: avg(0, 0.6, 0) = 0.2
    expect(result.casual).toBeCloseTo(0.2, 1)
    // streetwear: avg(0, 0, 0.3) = 0.1
    expect(result.streetwear).toBeCloseTo(0.1, 1)
  })

  it('values are rounded to 2 decimal places', () => {
    const answers: QuizAnswer[] = [
      { questionId: 'q1', optionId: 'q1-a' },
      { questionId: 'q2', optionId: 'q2-a' },
      { questionId: 'q3', optionId: 'q3-a' },
    ]
    const result = computeStyleVector(answers, FIXTURE_QUESTIONS)
    for (const dim of STYLE_DIMENSIONS) {
      const str = result[dim].toString()
      const decimalPart = str.split('.')[1]
      if (decimalPart) {
        expect(decimalPart.length).toBeLessThanOrEqual(2)
      }
    }
  })

  it('ignores answers for non-existent questions', () => {
    const answers: QuizAnswer[] = [
      { questionId: 'non-existent', optionId: 'nope' },
    ]
    const result = computeStyleVector(answers, FIXTURE_QUESTIONS)
    for (const dim of STYLE_DIMENSIONS) {
      expect(result[dim]).toBe(0)
    }
  })

  it('ignores answers with non-existent option ids', () => {
    const answers: QuizAnswer[] = [
      { questionId: 'q1', optionId: 'non-existent' },
    ]
    const result = computeStyleVector(answers, FIXTURE_QUESTIONS)
    for (const dim of STYLE_DIMENSIONS) {
      expect(result[dim]).toBe(0)
    }
  })

  it('single strong streetwear answer → streetwear dominant', () => {
    const answers: QuizAnswer[] = [{ questionId: 'q1', optionId: 'q1-b' }]
    const result = computeStyleVector(answers, FIXTURE_QUESTIONS)
    expect(result.streetwear).toBeGreaterThanOrEqual(0.8)
    expect(result.streetwear).toBeGreaterThan(result.minimal)
  })
})

// ---------------------------------------------------------------------------
// extractQuizMetadata
// ---------------------------------------------------------------------------

describe('extractQuizMetadata', () => {
  it('returns shoppingMotivation from a shopping-behavior answer', () => {
    const answers: QuizAnswer[] = [
      { questionId: 'shopping-behavior', optionId: 'matches-wardrobe' },
    ]
    const meta = extractQuizMetadata(answers)
    expect(meta.shoppingMotivation).toBe('matches-wardrobe')
    expect(meta.riskTolerance).toBeUndefined()
  })

  it('returns riskTolerance from an outfit-risk answer', () => {
    const answers: QuizAnswer[] = [
      { questionId: 'outfit-risk', optionId: 'love-experimenting' },
    ]
    const meta = extractQuizMetadata(answers)
    expect(meta.riskTolerance).toBe('love-experimenting')
    expect(meta.shoppingMotivation).toBeUndefined()
  })

  it('returns both fields when both questions are answered', () => {
    const answers: QuizAnswer[] = [
      { questionId: 'shopping-behavior', optionId: 'quality-worth-it' },
      { questionId: 'outfit-risk', optionId: 'safe-combinations' },
    ]
    const meta = extractQuizMetadata(answers)
    expect(meta.shoppingMotivation).toBe('quality-worth-it')
    expect(meta.riskTolerance).toBe('safe-combinations')
  })

  it('returns undefined fields gracefully when neither question is answered', () => {
    const meta = extractQuizMetadata([])
    expect(meta.shoppingMotivation).toBeUndefined()
    expect(meta.riskTolerance).toBeUndefined()
  })

  it('returns undefined fields when unrelated questions are answered', () => {
    const answers: QuizAnswer[] = [
      { questionId: 'everyday-look', optionId: 'minimal-casual' },
    ]
    const meta = extractQuizMetadata(answers)
    expect(meta.shoppingMotivation).toBeUndefined()
    expect(meta.riskTolerance).toBeUndefined()
  })

  it('price-is-right is a valid ShoppingMotivation', () => {
    const answers: QuizAnswer[] = [
      { questionId: 'shopping-behavior', optionId: 'price-is-right' },
    ]
    const meta = extractQuizMetadata(answers)
    expect(meta.shoppingMotivation).toBe('price-is-right')
  })

  it('depends-on-mood is a valid RiskTolerance', () => {
    const answers: QuizAnswer[] = [
      { questionId: 'outfit-risk', optionId: 'depends-on-mood' },
    ]
    const meta = extractQuizMetadata(answers)
    expect(meta.riskTolerance).toBe('depends-on-mood')
  })
})

// ---------------------------------------------------------------------------
// Structural: QUIZ_QUESTIONS option counts
// ---------------------------------------------------------------------------

describe('QUIZ_QUESTIONS structure', () => {
  it('every static question has exactly 4 options', () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(
        q.options.length,
        `Question "${q.id}" must have exactly 4 options`,
      ).toBe(4)
    }
  })

  it('there are exactly 11 static questions', () => {
    expect(QUIZ_QUESTIONS).toHaveLength(11)
  })
})

// ---------------------------------------------------------------------------
// buildForcedPairQuestion
// ---------------------------------------------------------------------------

describe('buildForcedPairQuestion', () => {
  /** Fixture: answers for Q1 (minimal) + Q4 (vintage) */
  const FIXTURE_ANSWERS: QuizAnswer[] = [
    { questionId: 'everyday-look', optionId: 'minimal-casual' },
    { questionId: 'weekend-look', optionId: 'vintage-inspired' },
  ]

  it('returns a question with exactly 2 options', () => {
    const q = buildForcedPairQuestion(FIXTURE_ANSWERS, QUIZ_QUESTIONS)
    expect(q.options).toHaveLength(2)
  })

  it('returns a question with id "forced-pair"', () => {
    const q = buildForcedPairQuestion(FIXTURE_ANSWERS, QUIZ_QUESTIONS)
    expect(q.id).toBe('forced-pair')
  })

  it('returns two distinct options (no duplicate ids)', () => {
    const q = buildForcedPairQuestion(FIXTURE_ANSWERS, QUIZ_QUESTIONS)
    expect(q.options[0].id).not.toBe(q.options[1].id)
  })

  it('each option has imageUrl, label, gradient, and weights', () => {
    const q = buildForcedPairQuestion(FIXTURE_ANSWERS, QUIZ_QUESTIONS)
    for (const opt of q.options) {
      expect(opt).toHaveProperty('imageUrl')
      expect(opt).toHaveProperty('label')
      expect(opt).toHaveProperty('gradient')
      expect(opt).toHaveProperty('weights')
    }
  })

  it('does not throw for empty answers (graceful fallback)', () => {
    expect(() =>
      buildForcedPairQuestion([], QUIZ_QUESTIONS),
    ).not.toThrow()
  })

  it('returns 2 options even with empty answers (uses fallback from question bank)', () => {
    const q = buildForcedPairQuestion([], QUIZ_QUESTIONS)
    expect(q.options).toHaveLength(2)
  })

  it('does not throw when only 1 question is answered', () => {
    const singleAnswer: QuizAnswer[] = [
      { questionId: 'everyday-look', optionId: 'minimal-casual' },
    ]
    expect(() =>
      buildForcedPairQuestion(singleAnswer, QUIZ_QUESTIONS),
    ).not.toThrow()
  })

  it('still returns 2 options when only 1 question is answered', () => {
    const singleAnswer: QuizAnswer[] = [
      { questionId: 'everyday-look', optionId: 'minimal-casual' },
    ]
    const q = buildForcedPairQuestion(singleAnswer, QUIZ_QUESTIONS)
    expect(q.options).toHaveLength(2)
  })

  it('picks top dimensions from a full 11-answer fixture', () => {
    // Build a full set of answers strongly favouring minimal + classic
    const fullAnswers: QuizAnswer[] = [
      { questionId: 'everyday-look',       optionId: 'minimal-casual' },      // minimal:0.9
      { questionId: 'going-out-look',      optionId: 'elevated-casual' },     // smart_casual:0.8, classic:0.3
      { questionId: 'work-study-look',     optionId: 'smart-casual' },        // smart_casual:0.85, classic:0.3
      { questionId: 'weekend-look',        optionId: 'denim-classic' },       // classic:0.7
      { questionId: 'color-palette',       optionId: 'monochrome' },          // minimal:0.7
      { questionId: 'fit-preference',      optionId: 'regular-fit' },         // classic:0.5
      { questionId: 'detail-preference',   optionId: 'tailored-stitching' },  // formal:0.7
      { questionId: 'shopping-behavior',   optionId: 'matches-wardrobe' },    // no weights
      { questionId: 'outfit-risk',         optionId: 'safe-combinations' },   // no weights
      { questionId: 'layering-preference', optionId: 'single-piece' },        // minimal:0.4
      { questionId: 'travel-look',         optionId: 'pack-light-neutral' },  // minimal:0.5
    ]
    const q = buildForcedPairQuestion(fullAnswers, QUIZ_QUESTIONS)
    // Must not throw and must produce exactly 2 options
    expect(q.options).toHaveLength(2)
    expect(q.options[0].id).not.toBe(q.options[1].id)
  })
})
