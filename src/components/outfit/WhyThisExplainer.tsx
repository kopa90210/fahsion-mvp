'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

export interface WhyThisExplainerProps {
  reasons?: string[]
}

export default function WhyThisExplainer({ reasons = [] }: WhyThisExplainerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const text =
    reasons.length > 0
      ? reasons.join(', ')
      : 'because these pieces line up with the preferences you saved earlier'

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#574d43] transition hover:text-[#1d1b18]"
        aria-expanded={isOpen}
      >
        Why this
        <ChevronDown
          className={`size-4 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-[#e2d8cc] bg-[#faf7f2] p-4 text-sm leading-6 text-[#5d5349]">
              {text}.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
