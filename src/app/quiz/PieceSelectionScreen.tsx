'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'
import { CuratedItem, saveWardrobeSelection } from '../actions/wardrobe'

export default function PieceSelectionScreen({
  curatedItems,
}: {
  curatedItems: Record<string, CuratedItem[]>
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Track selection count per category
  const getSelectedCountForCategory = (category: string) => {
    return curatedItems[category]?.filter((item) => selectedIds.has(item.id)).length || 0
  }

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const categories = Object.keys(curatedItems).filter((cat) => curatedItems[cat].length > 0)

  const isSubmitEnabled = categories.every(
    (cat) => getSelectedCountForCategory(cat) >= 2
  )

  const handleSubmit = async () => {
    if (!isSubmitEnabled) return
    setIsSubmitting(true)
    
    // Save to DB
    await saveWardrobeSelection(Array.from(selectedIds))
    
    // Animate for 2 seconds then redirect
    setTimeout(() => {
      router.push('/outfits')
    }, 2500)
  }

  // Animation for "Building your wardrobe..."
  if (isSubmitting) {
    const selectedItemsList = categories
      .flatMap((cat) => curatedItems[cat])
      .filter((item) => selectedIds.has(item.id))

    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#0a0a0a] px-6 text-white overflow-hidden">
        <h1 className="mb-8 text-2xl font-bold tracking-tight">
          Building your wardrobe...
        </h1>
        <div className="flex flex-wrap justify-center gap-4 max-w-2xl">
          {selectedItemsList.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="h-20 w-20 overflow-hidden rounded-xl border border-white/20 bg-white/5 relative"
            >
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={item.display_name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full bg-white/10" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-32 pt-12 text-white px-4 sm:px-6 md:px-8">
      <div className="mx-auto max-w-4xl space-y-12">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Curate Your Foundation
          </h1>
          <p className="text-white/50 max-w-md mx-auto">
            Select the timeless pieces that will build your virtual wardrobe. 
            Choose at least 2 items per category.
          </p>
        </div>

        {categories.map((category) => (
          <div key={category} className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h2 className="text-xl font-semibold capitalize tracking-wide text-white/90">
                {category}
              </h2>
              <span className="text-sm text-white/40">
                {getSelectedCountForCategory(category)} / 2+ selected
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {curatedItems[category].map((item) => {
                const isSelected = selectedIds.has(item.id)
                return (
                  <motion.div
                    key={item.id}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => toggleSelection(item.id)}
                    className="relative cursor-pointer"
                  >
                    <Card
                      className={`overflow-hidden rounded-2xl bg-white/5 border-2 transition-colors ${
                        isSelected ? 'border-primary' : 'border-transparent'
                      }`}
                    >
                      <div className="relative aspect-[3/4] w-full">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.display_name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          // Fallback placeholder
                          <div className="flex h-full w-full items-center justify-center bg-white/10 text-xs text-white/30">
                            No Image
                          </div>
                        )}
                        
                        {/* Selected Checkmark Badge */}
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              className="absolute right-2 top-2"
                            >
                              <Badge variant="default" className="h-6 w-6 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground shadow-sm">
                                <Check className="h-3 w-3" strokeWidth={3} />
                              </Badge>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-medium text-white/90">
                          {item.display_name}
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0a0a0a]/80 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="text-sm font-medium text-white/80">
            {selectedIds.size} items selected
          </div>
          <button
            onClick={handleSubmit}
            disabled={!isSubmitEnabled}
            className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-all ${
              isSubmitEnabled
                ? 'bg-white text-black hover:bg-white/90'
                : 'cursor-not-allowed bg-white/10 text-white/30'
            }`}
          >
            Build Wardrobe
          </button>
        </div>
      </div>
    </div>
  )
}
