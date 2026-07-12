'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, ThumbsDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  submitCalibrationFeedback,
  type CalibrationOutfit,
} from '@/src/app/actions/outfit'
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

function getChangedTags(outfit: CalibrationOutfit) {
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

export default function OutfitCalibrationScreen({
  outfits,
}: {
  outfits: CalibrationOutfit[]
}) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [lastFeedback, setLastFeedback] = useState<boolean | null>(null)
  const [vector, setVector] = useState(outfits[0].vector)
  const [isFinishing, setIsFinishing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const feedbackQueue = useRef<Promise<unknown>>(Promise.resolve())

  const outfit = outfits[currentIndex]
  const topVectorEntries = useMemo(
    () =>
      Object.entries(vector)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4),
    [vector],
  )

  function handleFeedback(liked: boolean) {
    if (!visible || isFinishing) return

    const activeOutfit = outfit
    const activeIndex = currentIndex
    const isFinalOutfit = activeIndex === outfits.length - 1
    const changedTags = getChangedTags(activeOutfit)

    setLastFeedback(liked)
    setErrorMessage(null)
    setVisible(false)
    setVector((current) => getOptimisticVector(current, changedTags, liked))

    const feedbackPromise = feedbackQueue.current.then(() =>
      submitCalibrationFeedback(
        activeOutfit.id,
        liked,
        activeOutfit.items,
        isFinalOutfit,
      ),
    )

    feedbackQueue.current = feedbackPromise.catch(() => undefined)

    window.setTimeout(() => {
      if (!isFinalOutfit) {
        setCurrentIndex(activeIndex + 1)
        setLastFeedback(null)
        setVisible(true)
        return
      }

      setIsFinishing(true)
      startTransition(async () => {
        try {
          const result = await feedbackPromise
          setVector(result.vector)
          router.replace('/outfits')
          router.refresh()
        } catch (error) {
          setIsFinishing(false)
          setVisible(true)
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Calibration could not be saved. Try that last response again.',
          )
        }
      })
    }, 300)
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-6 text-[#1d1b18] sm:px-6 lg:py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#7a6f62]">
                Outfit calibration
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                Tune your first looks
              </h1>
            </div>
            <Badge variant="outline" className="border-[#b9aa99] bg-white/45 text-[#4f463d]">
              {Math.min(currentIndex + 1, outfits.length)} of {outfits.length}
            </Badge>
          </div>

          <AnimatePresence mode="wait">
            {visible && !isFinishing ? (
              <motion.div
                key={outfit.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: lastFeedback ? 52 : -52, scale: 0.98 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <Card className="rounded-lg border-[#d8cec2] bg-white/70 shadow-sm">
                  <CardHeader className="gap-2">
                    <CardTitle className="text-xl">Would you wear this?</CardTitle>
                    <CardDescription>
                      React to three generated outfits before your first daily recommendation.
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
                                unoptimized
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
                      <p className="text-sm leading-6 text-[#6d6257]">
                        Your response updates Fashion DNA immediately.
                      </p>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-lg"
                          aria-label="Dislike this calibration outfit"
                          onClick={() => handleFeedback(false)}
                        >
                          <ThumbsDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-lg"
                          aria-label="Like this calibration outfit"
                          onClick={() => handleFeedback(true)}
                        >
                          <Heart className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="finishing"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="flex min-h-[520px] items-center justify-center rounded-lg border border-[#d8cec2] bg-white/65 p-8 text-center shadow-sm"
              >
                <div className="max-w-md">
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#7a6f62]">
                    Calibrating
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                    Preparing your first daily outfit.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[#6d6257]">
                    Your three reactions are being folded into Fashion DNA now.
                  </p>
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
              <CardDescription>Visible preference weights after each response.</CardDescription>
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
