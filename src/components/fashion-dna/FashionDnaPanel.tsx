'use client'

import { motion } from 'framer-motion'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { DnaSignal } from '@/src/lib/fashion-dna/types'

export interface FashionDnaPanelProps {
  /** Sorted DnaSignal[] to render as weight bars. */
  signals: DnaSignal[]
  /**
   * When true, signals are grouped under sub-headers by their
   * `category` field (e.g. "Style", "Season"). Default: false.
   * Phase 1 only has "style", so this is a no-op for now.
   */
  groupByCategory?: boolean
  /**
   * Total feedback rows the user has submitted. When below the
   * LEARNING_THRESHOLD, a "still learning" caption is shown to
   * frame the weights as provisional, not settled facts.
   */
  feedbackCount?: number
}

/** Below this many swipes, show the "still learning" qualifier. */
const LEARNING_THRESHOLD = 5

export default function FashionDnaPanel({
  signals,
  groupByCategory = false,
  feedbackCount,
}: FashionDnaPanelProps) {
  const isStillLearning =
    typeof feedbackCount === 'number' && feedbackCount < LEARNING_THRESHOLD

  // Group signals by category when requested
  const groups: [string, DnaSignal[]][] = groupByCategory
    ? Array.from(
        signals.reduce<Map<string, DnaSignal[]>>((acc, signal) => {
          const cat = signal.category ?? 'other'
          const list = acc.get(cat) ?? []
          list.push(signal)
          acc.set(cat, list)
          return acc
        }, new Map()),
      )
    : [['', signals]]

  return (
    <Card className="rounded-lg border-[#d8cec2] bg-white/70 shadow-sm">
      <CardHeader>
        <CardTitle>Fashion DNA</CardTitle>
        <CardDescription>
          Visible preference weights after this response.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.map(([category, categorySignals]) => (
          <div key={category} className="space-y-4">
            {groupByCategory && category && (
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#7a6f62]">
                {category}
              </p>
            )}
            {categorySignals.map((signal) => (
              <div key={signal.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>{signal.label}</span>
                  <span className="font-mono text-xs text-[#6d6257]">
                    {Math.round(signal.weight * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#e6ddd2]">
                  <motion.div
                    className="h-full rounded-full bg-[#2f4237]"
                    initial={false}
                    animate={{ width: `${Math.round(signal.weight * 100)}%` }}
                    transition={{ duration: 0.22 }}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}

        {isStillLearning && (
          <p className="pt-1 text-xs leading-5 text-[#8c7f72]">
            Still learning your style — these weights are provisional and
            will settle as you rate more outfits.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
