/**
 * Tests for src/app/actions/fashion-dna.ts
 *
 * Run with:  npx vitest run src/app/actions/fashion-dna.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

let tableResponses: Record<
  string,
  { data: unknown; error: unknown; count?: number }
> = {}

function createQueryBuilder(tableName: string) {
  const response = () =>
    tableResponses[tableName] ?? { data: null, error: null }

  const builder: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockImplementation(() => {
      const resp = response()
      const eqBuilder: Record<string, unknown> = {
        single: vi.fn().mockImplementation(() => resp),
      }
      eqBuilder.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: resp.data, error: resp.error, count: resp.count ?? 0 })
      return eqBuilder
    }),
    single: vi.fn().mockImplementation(() => response()),
  }

  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: response().data, error: response().error, count: response().count ?? 0 })
  return builder
}

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn().mockImplementation((table: string) => createQueryBuilder(table)),
}

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}))

const { getFashionDnaSummary } = await import('@/src/app/actions/fashion-dna')

const TEST_USER_ID = 'user-abc-123'

function mockAuthenticatedUser() {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: TEST_USER_ID } },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  tableResponses = {}
})

describe('getFashionDnaSummary', () => {
  it('reads fashion_dna.vector, maps through label dictionary, sorts by weight descending, and returns DnaSignal[]', async () => {
    mockAuthenticatedUser()

    tableResponses['fashion_dna'] = {
      data: {
        vector: {
          minimal: 0.8,
          streetwear: 0.2,
          earth_tones: 0.6,
          formal: 0.4,
        },
      },
      error: null,
    }

    tableResponses['feedback'] = {
      data: null,
      error: null,
      count: 3,
    }

    const summary = await getFashionDnaSummary(4)

    expect(summary.feedbackCount).toBe(3)
    expect(summary.signals).toHaveLength(4)

    // Should be sorted by weight descending: minimal (0.8), earth_tones (0.6), formal (0.4), streetwear (0.2)
    expect(summary.signals[0]).toEqual({
      key: 'minimal',
      label: 'Minimal',
      weight: 0.8,
      category: 'style',
    })
    expect(summary.signals[1]).toEqual({
      key: 'earth_tones',
      label: 'Earth tones',
      weight: 0.6,
      category: 'style',
    })
    expect(summary.signals[2]).toEqual({
      key: 'formal',
      label: 'Polished',
      weight: 0.4,
      category: 'style',
    })
    expect(summary.signals[3]).toEqual({
      key: 'streetwear',
      label: 'Streetwear',
      weight: 0.2,
      category: 'style',
    })
  })
})
