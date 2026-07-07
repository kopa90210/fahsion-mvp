import { describe, it, expect } from 'vitest'
import {
  computeStyleVector,
  STYLE_DIMENSIONS,
  type QuizAnswer,
  type QuizQuestion,
} from './scoring'

// ---------------------------------------------------------------------------
// Minimal fixture: 3 questions × 2 options each
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
        weights: { minimal: 0.9, formal: 0.3 },
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
        label: 'Earth pick',
        weights: { earth_tones: 0.8, bohemian: 0.6 },
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
        label: 'Boho pick',
        weights: { bohemian: 0.85, earth_tones: 0.7 },
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Tests
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
    // q1-a has minimal: 0.9, q2-b has minimal: 0.5, q3 has neither option with high minimal
    // Let's just use q1-a alone:
    const answers: QuizAnswer[] = [{ questionId: 'q1', optionId: 'q1-a' }]
    const result = computeStyleVector(answers, FIXTURE_QUESTIONS)
    expect(result.minimal).toBeGreaterThanOrEqual(0.8)
  })

  it('mixed answers produce blended vector', () => {
    // Pick minimal in q1, earth in q2, edgy in q3
    const answers: QuizAnswer[] = [
      { questionId: 'q1', optionId: 'q1-a' }, // minimal:0.9, formal:0.3
      { questionId: 'q2', optionId: 'q2-a' }, // earth_tones:0.8, bohemian:0.6
      { questionId: 'q3', optionId: 'q3-a' }, // edgy:0.95, streetwear:0.3
    ]
    const result = computeStyleVector(answers, FIXTURE_QUESTIONS)

    // minimal: avg(0.9, 0, 0) = 0.30
    expect(result.minimal).toBeCloseTo(0.3, 1)
    // earth_tones: avg(0, 0.8, 0) = 0.27
    expect(result.earth_tones).toBeCloseTo(0.27, 1)
    // edgy: avg(0, 0, 0.95) = 0.32
    expect(result.edgy).toBeCloseTo(0.32, 1)
    // formal: avg(0.3, 0, 0) = 0.1
    expect(result.formal).toBeCloseTo(0.1, 1)
    // bohemian: avg(0, 0.6, 0) = 0.2
    expect(result.bohemian).toBeCloseTo(0.2, 1)
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
