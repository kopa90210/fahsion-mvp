'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Heart, ThumbsDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { DailyOutfit } from '@/src/app/actions/outfit'
import { submitOutfitFeedback } from '@/src/app/actions/outfit'
import type { StyleVector } from '@/src/lib/quiz/scoring'

const TAG_LABELS: Record<string, string> = {
  minimal: 'Minimal',
  streetwear: 'Streetwear',
  formal: 'Polished',
  bohemian: 'Bohemian',
  edgy: 'Edgy',
  earth_tones: 'Earth tones',
}

function formatRole(role: string) {
  return role.replaceAll('_', ' ')
}

function getChangedTags(outfit: DailyOutfit) {
  return Array.from(
    new Set(
      outfit.items.flatMap((item) =>
        Object.entries(item.style_tags)
          .filter(([, weight]) => typeof weight === 'number' && weight > 0)
          .map(([tag]) => tag),
      ),
    ),
  )
}

function getOptimisticVector(
  vector: StyleVector,
  changedTags: string[],
  liked: boolean,
) {
  const delta = liked ? 0.05 : -0.05
  const nextVector = { ...vector }

  for (const tag of changedTags) {
    nextVector[tag] = Math.min(
      1,
      Math.max(0, Math.round(((nextVector[tag] ?? 0) + delta) * 100) / 100),
    )
  }

  return nextVector
}

export default function DailyOutfitScreen({ outfit }: { outfit: DailyOutfit }) {
  const [visible, setVisible] = useState(true)
  const [selectedFeedback, setSelectedFeedback] = useState<boolean | null>(null)
  const [vector, setVector] = useState(outfit.vector)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [whyOpen, setWhyOpen] = useState(false)
  const [, startTransition] = useTransition()

  const changedTags = useMemo(() => getChangedTags(outfit), [outfit])
  const topVectorEntries = useMemo(
    () =>
      Object.entries(vector)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4),
    [vector],
  )

  function handleFeedback(liked: boolean) {
    if (selectedFeedback !== null) return

    setSelectedFeedback(liked)
    setErrorMessage(null)
    setPendingMessage('Updating your style DNA...')
    setVisible(false)
    setVector((current) => getOptimisticVector(current, changedTags, liked))

    startTransition(async () => {
      try {
        const result = await submitOutfitFeedback(outfit.id, liked, outfit.items)
        setVector(result.vector)
        setPendingMessage('Style DNA updated.')
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Feedback saved locally, but the style update failed.',
        )
        setPendingMessage(null)
      }
    })
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-6 text-[#1d1b18] sm:px-6 lg:py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#7a6f62]">
                Today&apos;s outfit
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                One look for today
              </h1>
            </div>
            <Badge variant="outline" className="border-[#b9aa99] bg-white/45 text-[#4f463d]">
              Recommended from your wardrobe
            </Badge>
          </div>

          <AnimatePresence mode="wait">
            {visible ? (
              <motion.div
                key={outfit.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: selectedFeedback ? 52 : -52, scale: 0.98 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <Card className="rounded-lg border-[#d8cec2] bg-white/70 shadow-sm">
                  <CardHeader className="gap-2">
                    <CardTitle className="text-xl">Wear this combination</CardTitle>
                    <CardDescription>
                      Built from pieces you already selected, with the strongest style match first.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {outfit.items.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04, duration: 0.22 }}
                          className="overflow-hidden rounded-lg border border-[#ded5ca] bg-[#fbfaf7]"
                        >
                          <div className="relative aspect-[4/5] bg-[#ebe3d8]">
                            {item.image_url ? (
                              <Image
                                src={item.image_url}
                                alt={item.display_name}
                                fill
                                sizes="(min-width: 1024px) 160px, (min-width: 640px) 30vw, 90vw"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center px-4 text-center text-xs text-[#7a6f62]">
                                No image
                              </div>
                            )}
                          </div>
                          <div className="min-h-20 space-y-2 p-3">
                            <Badge variant="secondary" className="capitalize">
                              {formatRole(item.layer_role)}
                            </Badge>
                            <p className="line-clamp-2 text-sm font-medium leading-5">
                              {item.display_name}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4dbd0] pt-4">
                      <button
                        type="button"
                        onClick={() => setWhyOpen((open) => !open)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#574d43] transition hover:text-[#1d1b18]"
                        aria-expanded={whyOpen}
                      >
                        Why this
                        <ChevronDown
                          className={`size-4 transition ${whyOpen ? 'rotate-180' : ''}`}
                          aria-hidden="true"
                        />
                      </button>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-lg"
                          aria-label="Dislike this outfit"
                          onClick={() => handleFeedback(false)}
                        >
                          <ThumbsDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-lg"
                          aria-label="Like this outfit"
                          onClick={() => handleFeedback(true)}
                        >
                          <Heart className="size-4" />
                        </Button>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {whyOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="rounded-lg border border-[#e2d8cc] bg-[#faf7f2] p-4 text-sm leading-6 text-[#5d5349]">
                            {outfit.reasons.length > 0
                              ? outfit.reasons.join(', ')
                              : 'because these pieces line up with the preferences you saved earlier'}
                            .
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="tomorrow"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="flex min-h-[520px] items-center justify-center rounded-lg border border-[#d8cec2] bg-white/65 p-8 text-center shadow-sm"
              >
                <div className="max-w-md">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#7a6f62]">
                    Thanks
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                    Tomorrow&apos;s outfit will use what you just told me.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[#6d6257]">
                    Come back tomorrow for one fresh look, tuned a little more to your taste.
                  </p>
                  {pendingMessage && (
                    <p className="mt-5 text-sm font-medium text-[#4f463d]">{pendingMessage}</p>
                  )}
                  {errorMessage && (
                    <p className="mt-5 text-sm font-medium text-red-700">{errorMessage}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <aside className="lg:pt-[88px]">
          <Card className="rounded-lg border-[#d8cec2] bg-white/70 shadow-sm">
            <CardHeader>
              <CardTitle>Fashion DNA</CardTitle>
              <CardDescription>Visible preference weights after this response.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {topVectorEntries.map(([tag, weight]) => (
                <div key={tag} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{TAG_LABELS[tag] ?? tag.replaceAll('_', ' ')}</span>
                    <span className="font-mono text-xs text-[#6d6257]">
                      {Math.round(weight * 100)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#e6ddd2]">
                    <motion.div
                      className="h-full rounded-full bg-[#2f4237]"
                      initial={false}
                      animate={{ width: `${Math.round(weight * 100)}%` }}
                      transition={{ duration: 0.22 }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  )
}
