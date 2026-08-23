'use client'

import { motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import type { ImageSet } from '@/src/lib/quiz/imageSet'

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
}

// ---------------------------------------------------------------------------
// Card data
// ---------------------------------------------------------------------------

interface CardDef {
  imageSet: ImageSet
  label: string
  sublabel: string
  icon: string
  accent: string
}

const CARDS: CardDef[] = [
  {
    imageSet: 'masculine',
    label: 'Menswear-leaning',
    sublabel: 'Show menswear photography',
    icon: '◈',
    accent: 'from-slate-700/60 to-slate-800/60 hover:from-slate-600/70 hover:to-slate-700/70',
  },
  {
    imageSet: 'feminine',
    label: 'Womenswear-leaning',
    sublabel: 'Show womenswear photography',
    icon: '◇',
    accent: 'from-rose-900/50 to-slate-800/60 hover:from-rose-800/60 hover:to-slate-700/70',
  },
  {
    imageSet: 'neutral',
    label: 'Show me both',
    sublabel: 'Alternate between the two',
    icon: '◉',
    accent: 'from-violet-900/50 to-slate-800/60 hover:from-violet-800/60 hover:to-slate-700/70',
  },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImageSetIntroScreenProps {
  /** Called when the user picks a card or clicks Skip. */
  onSelect: (imageSet: ImageSet) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Lead-in screen shown before Q1.
 *
 * - Selecting a card or tapping Skip sets imageSet and advances to Q1.
 * - The imageSet value never leaves StyleQuiz component state.
 * - This screen is NOT counted in the "N / 12" progress indicator.
 */
export default function ImageSetIntroScreen({ onSelect }: ImageSetIntroScreenProps) {
  return (
    <motion.div
      className="flex w-full max-w-lg flex-col items-center px-5 pb-10"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Heading */}
      <motion.div variants={itemVariants} className="mb-2 mt-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Which imagery fits you best?
        </h2>
      </motion.div>

      {/* Sub-text */}
      <motion.p
        variants={itemVariants}
        className="mb-8 text-center text-sm text-white/45 leading-relaxed max-w-xs"
      >
        This only affects the photos shown during the quiz — it doesn&apos;t
        change your results or get stored anywhere.
      </motion.p>

      {/* Cards */}
      <motion.div variants={itemVariants} className="flex w-full flex-col gap-3">
        {CARDS.map((card) => (
          <motion.button
            key={card.imageSet}
            onClick={() => onSelect(card.imageSet)}
            whileTap={{ scale: 0.97 }}
            className={`
              group relative flex items-center gap-4 rounded-2xl border border-white/[0.07]
              bg-gradient-to-r ${card.accent}
              px-5 py-4 text-left outline-none
              transition-all duration-250
              focus-visible:ring-2 focus-visible:ring-white/40
              hover:border-white/20
            `}
            id={`intro-card-${card.imageSet}`}
            aria-label={card.label}
          >
            {/* Icon */}
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-xl text-white/70 transition-colors duration-250 group-hover:bg-white/[0.13] group-hover:text-white/90">
              {card.icon}
            </span>

            {/* Text */}
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-white">
                {card.label}
              </span>
              <span className="text-xs text-white/40 group-hover:text-white/55 transition-colors duration-250">
                {card.sublabel}
              </span>
            </div>

            {/* Chevron */}
            <span className="ml-auto text-white/25 transition-all duration-250 group-hover:translate-x-0.5 group-hover:text-white/50">
              →
            </span>
          </motion.button>
        ))}
      </motion.div>

      {/* Skip link */}
      <motion.div variants={itemVariants} className="mt-6">
        <button
          onClick={() => onSelect('neutral')}
          className="text-sm text-white/35 underline-offset-4 transition-colors duration-200 hover:text-white/60 focus-visible:text-white/60 focus-visible:outline-none"
          id="intro-skip"
          aria-label="Skip imagery preference, use alternating images"
        >
          Skip
        </button>
      </motion.div>
    </motion.div>
  )
}
