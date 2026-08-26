'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Shirt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ClosetItem } from '@/src/app/actions/closet'
import { WARDROBE_CATEGORIES } from '@/src/lib/wardrobe/normalize'
import ItemEditModal from './ItemEditModal'

// ---------------------------------------------------------------------------
// ItemCard
// ---------------------------------------------------------------------------

function ItemCard({
  item,
  onSelect,
}: {
  item: ClosetItem
  onSelect: (item: ClosetItem) => void
}) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      id={`item-card-${item.id}`}
      className="group w-full cursor-pointer overflow-hidden rounded-lg border border-[#d8cec2] bg-white/70 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9aa99]"
      onClick={() => onSelect(item)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[3/4] w-full bg-[#ebe3d8]">
        {item.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.image_url}
            alt={item.display_name ?? 'Wardrobe item'}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Shirt className="size-10 text-[#c5b8a9]" />
          </div>
        )}

        {/* Owned indicator */}
        {item.isOwned && (
          <span className="absolute left-2 top-2 rounded-full bg-[#1d1b18]/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
            Mine
          </span>
        )}
      </div>

      {/* Info */}
      <div className="space-y-1 p-3">
        {item.brand && (
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-[#7a6f62]">
            {item.brand}
          </p>
        )}
        <p className="line-clamp-2 text-sm font-medium leading-5 text-[#1d1b18]">
          {item.display_name ?? 'Unnamed item'}
        </p>
        <Badge
          variant="outline"
          className="mt-1 rounded-full border-[#d8cec2] bg-[#f7f4ef] text-[10px] capitalize text-[#6d6257]"
        >
          {item.category}
        </Badge>
      </div>
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// WardrobeScreen
// ---------------------------------------------------------------------------

const ALL = 'all' as const
type FilterValue = typeof ALL | (typeof WARDROBE_CATEGORIES)[number]

export default function WardrobeScreen({ initialItems }: { initialItems: ClosetItem[] }) {
  const [items, setItems] = useState<ClosetItem[]>(initialItems)
  const [activeFilter, setActiveFilter] = useState<FilterValue>(ALL)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<ClosetItem | null>(null)

  // ---------- Filter + search ----------

  const filtered = items.filter((item) => {
    const matchesCategory = activeFilter === ALL || item.category === activeFilter
    const q = searchQuery.trim().toLowerCase()
    if (!matchesCategory) return false
    if (!q) return true
    return (
      item.display_name?.toLowerCase().includes(q) ||
      item.brand?.toLowerCase().includes(q) ||
      item.subcategory?.toLowerCase().includes(q)
    )
  })

  // ---------- Callbacks from modal ----------

  const handleSaved = (updated: Partial<ClosetItem> & { id: string }) => {
    setItems((prev) =>
      prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it)),
    )
    setSelectedItem(null)
  }

  const handleRemoved = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
    setSelectedItem(null)
  }

  // ---------- Render ----------

  const filterLabels: { value: FilterValue; label: string }[] = [
    { value: ALL, label: 'All' },
    ...WARDROBE_CATEGORIES.map((c) => ({
      value: c as FilterValue,
      label: c.charAt(0).toUpperCase() + c.slice(1),
    })),
  ]

  return (
    <>
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-6 text-[#1d1b18] sm:px-6 lg:py-10">
        <div className="mx-auto max-w-6xl">
          {/* Page header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#7a6f62]">
                Your wardrobe
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                My Closet
              </h1>
            </div>
            <Link
              href="/upload"
              id="wardrobe-add-item-btn"
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium',
                'bg-[#1d1b18] text-white transition-colors hover:bg-[#3d3a36]',
              )}
            >
              <Plus className="size-4" />
              Add item
            </Link>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#a79a8f]" />
            <Input
              id="wardrobe-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, brand, or type…"
              className="h-10 rounded-full border-[#d8cec2] bg-white pl-9 text-[#1d1b18] placeholder:text-[#a79a8f] focus-visible:ring-[#b9aa99]/40"
            />
          </div>

          {/* Category filter bar */}
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter by category">
            {filterLabels.map(({ value, label }) => (
              <button
                key={value}
                id={`wardrobe-filter-${value}`}
                role="tab"
                aria-selected={activeFilter === value}
                onClick={() => setActiveFilter(value)}
                className={cn(
                  'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                  activeFilter === value
                    ? 'border-[#1d1b18] bg-[#1d1b18] text-white'
                    : 'border-[#d8cec2] bg-white/70 text-[#4f463d] hover:border-[#b9aa99]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Item count */}
          <p className="mb-4 text-sm text-[#7a6f62]">
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
            {activeFilter !== ALL && ` in ${activeFilter}`}
          </p>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl border border-[#d8cec2] bg-white">
                <Shirt className="size-7 text-[#b9aa99]" />
              </div>
              <p className="text-lg font-semibold text-[#4f463d]">
                {searchQuery ? 'No items match your search' : 'No items yet'}
              </p>
              <p className="text-sm text-[#7a6f62]">
                {searchQuery
                  ? 'Try a different query or clear your search.'
                  : 'Add your first wardrobe piece to get started.'}
              </p>
              {!searchQuery && (
                <Link
                  href="/upload"
                  className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#1d1b18] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3d3a36]"
                >
                  <Plus className="size-4" />
                  Add first item
                </Link>
              )}
            </div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((item) => (
                  <ItemCard key={item.id} item={item} onSelect={setSelectedItem} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </main>

      {/* Edit modal */}
      <AnimatePresence>
        {selectedItem && (
          <ItemEditModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onSaved={handleSaved}
            onRemoved={handleRemoved}
          />
        )}
      </AnimatePresence>
    </>
  )
}
