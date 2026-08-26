'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Heart, X, UploadCloud, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { WishlistItem } from '@/src/app/actions/wishlist'
import { addWishlistItem } from '@/src/app/actions/wishlist'
import { WARDROBE_CATEGORIES } from '@/src/lib/wardrobe/normalize'
import WishlistItemEditModal from './WishlistItemEditModal'

// ---------------------------------------------------------------------------
// WishlistItemCard
// ---------------------------------------------------------------------------

function WishlistItemCard({
  item,
  onSelect,
}: {
  item: WishlistItem
  onSelect: (item: WishlistItem) => void
}) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      id={`wishlist-card-${item.id}`}
      className="group w-full cursor-pointer overflow-hidden rounded-lg border border-[#d8cec2] bg-white/70 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9aa99]"
      onClick={() => onSelect(item)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[3/4] w-full bg-[#ebe3d8]">
        {item.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.image_url}
            alt={item.display_name ?? 'Wishlist item'}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Heart className="size-10 text-[#c5b8a9]" />
          </div>
        )}
        {/* Wishlist heart badge */}
        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm">
          <Heart className="size-3.5 fill-[#c5b8a9] text-[#c5b8a9]" />
        </span>
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
        {item.notes && (
          <p className="truncate text-[11px] leading-4 text-[#a79a8f]">{item.notes}</p>
        )}
      </div>
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// AddWishlistItemPanel — inline add panel
// ---------------------------------------------------------------------------

function AddWishlistItemPanel({
  onClose,
  onAdded,
}: {
  onClose: () => void
  onAdded: (item: WishlistItem) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState<(typeof WARDROBE_CATEGORIES)[number]>('top')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Please choose an image.'); return }
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setError(null)
  }

  const handleSubmit = () => {
    if (!displayName.trim() && !file) {
      setError('Add a name or photo.')
      return
    }
    startTransition(async () => {
      setError(null)
      try {
        const formData = new FormData()
        if (file) formData.append('file', file)
        formData.append('display_name', displayName.trim())
        formData.append('brand', brand.trim())
        formData.append('category', category)
        formData.append('notes', notes.trim())

        const { id } = await addWishlistItem(formData)

        // Build optimistic item to push into list immediately
        const newItem: WishlistItem = {
          id,
          user_id: '',
          category,
          layer_role: '',
          subcategory: null,
          display_name: displayName || null,
          brand: brand || null,
          image_url: previewUrl,
          color: {},
          fit: {},
          style_tags: {},
          notes: notes || null,
          created_at: new Date().toISOString(),
        }
        onAdded(newItem)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add item.')
      }
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        key="add-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        key="add-panel"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-2xl bg-[#f7f4ef] shadow-2xl sm:inset-0 sm:m-auto sm:max-h-[85vh] sm:overflow-y-auto sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Add wishlist item"
      >
        <div className="flex items-center justify-between border-b border-[#e4dbd0] px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#7a6f62]">Wishlist</p>
            <h2 className="mt-0.5 text-lg font-semibold text-[#1d1b18]">Add a desired item</h2>
          </div>
          <button id="add-wishlist-close" onClick={onClose} className="flex size-8 items-center justify-center rounded-full text-[#7a6f62] hover:bg-[#e4dbd0]" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Photo drop */}
          <label
            id="add-wishlist-photo-label"
            htmlFor="add-wishlist-file-input"
            className={cn(
              'flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors',
              previewUrl ? 'border-[#b9aa99]' : 'border-[#d8cec2] bg-[#fbfaf7] hover:border-[#b9aa99]',
            )}
          >
            {previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={previewUrl} alt="Preview" className="h-[180px] w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl border border-[#d8cec2] bg-white">
                  <UploadCloud className="size-5 text-[#7a6f62]" />
                </div>
                <p className="text-sm text-[#7a6f62]">Upload a photo of the item</p>
                <p className="text-xs text-[#a79a8f]">Optional — JPG, PNG, or WebP</p>
              </div>
            )}
            <input id="add-wishlist-file-input" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#7a6f62]">Name</label>
            <Input id="add-wishlist-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Camel overcoat" className="h-9 rounded-lg border-[#d8cec2] bg-white text-[#1d1b18] placeholder:text-[#a79a8f]" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#7a6f62]">Brand</label>
            <Input id="add-wishlist-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Margaret Howell" className="h-9 rounded-lg border-[#d8cec2] bg-white text-[#1d1b18] placeholder:text-[#a79a8f]" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#7a6f62]">Category</label>
            <select
              id="add-wishlist-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="h-9 w-full rounded-lg border border-[#d8cec2] bg-white px-2 text-sm text-[#1d1b18] focus:outline-none focus:ring-2 focus:ring-[#b9aa99]/40"
            >
              {WARDROBE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#7a6f62]">Notes</label>
            <Input id="add-wishlist-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="For autumn, budget £150" className="h-9 rounded-lg border-[#d8cec2] bg-white text-[#1d1b18] placeholder:text-[#a79a8f]" />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button id="add-wishlist-submit-btn" type="button" className="h-10 w-full rounded-full" onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Heart className="size-4" />}
            {isPending ? 'Adding…' : 'Add to wishlist'}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// WishlistScreen
// ---------------------------------------------------------------------------

const ALL = 'all' as const
type FilterValue = typeof ALL | (typeof WARDROBE_CATEGORIES)[number]

export default function WishlistScreen({ initialItems }: { initialItems: WishlistItem[] }) {
  const [items, setItems] = useState<WishlistItem[]>(initialItems)
  const [activeFilter, setActiveFilter] = useState<FilterValue>(ALL)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)

  const filtered = items.filter((item) => {
    const matchesCategory = activeFilter === ALL || item.category === activeFilter
    const q = searchQuery.trim().toLowerCase()
    if (!matchesCategory) return false
    if (!q) return true
    return (
      item.display_name?.toLowerCase().includes(q) ||
      item.brand?.toLowerCase().includes(q) ||
      item.notes?.toLowerCase().includes(q)
    )
  })

  const handleItemSaved = (updated: Partial<WishlistItem> & { id: string }) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it)))
    setSelectedItem(null)
  }

  const handleItemRemoved = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
    setSelectedItem(null)
  }

  const handleAdded = (newItem: WishlistItem) => {
    setItems((prev) => [newItem, ...prev])
    setShowAddPanel(false)
  }

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
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#7a6f62]">
                Items you want
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                My Wishlist
              </h1>
            </div>
            <button
              id="wishlist-add-item-btn"
              onClick={() => setShowAddPanel(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#1d1b18] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3d3a36]"
            >
              <Plus className="size-4" />
              Add item
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#a79a8f]" />
            <Input
              id="wishlist-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, brand, or notes…"
              className="h-10 rounded-full border-[#d8cec2] bg-white pl-9 text-[#1d1b18] placeholder:text-[#a79a8f] focus-visible:ring-[#b9aa99]/40"
            />
          </div>

          {/* Filter bar */}
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter wishlist by category">
            {filterLabels.map(({ value, label }) => (
              <button
                key={value}
                id={`wishlist-filter-${value}`}
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

          <p className="mb-4 text-sm text-[#7a6f62]">
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
            {activeFilter !== ALL && ` in ${activeFilter}`}
          </p>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl border border-[#d8cec2] bg-white">
                <Heart className="size-7 text-[#b9aa99]" />
              </div>
              <p className="text-lg font-semibold text-[#4f463d]">
                {searchQuery ? 'No items match your search' : 'Your wishlist is empty'}
              </p>
              <p className="text-sm text-[#7a6f62]">
                {searchQuery
                  ? 'Try a different query or clear your search.'
                  : 'Save items you want to own — great for gap-finding later.'}
              </p>
              {!searchQuery && (
                <button
                  id="wishlist-empty-add-btn"
                  onClick={() => setShowAddPanel(true)}
                  className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#1d1b18] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3d3a36]"
                >
                  <Plus className="size-4" />
                  Add first item
                </button>
              )}
            </div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((item) => (
                  <WishlistItemCard key={item.id} item={item} onSelect={setSelectedItem} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </main>

      {/* Edit modal */}
      <AnimatePresence>
        {selectedItem && (
          <WishlistItemEditModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onSaved={handleItemSaved}
            onRemoved={handleItemRemoved}
          />
        )}
      </AnimatePresence>

      {/* Add panel */}
      <AnimatePresence>
        {showAddPanel && (
          <AddWishlistItemPanel
            onClose={() => setShowAddPanel(false)}
            onAdded={handleAdded}
          />
        )}
      </AnimatePresence>
    </>
  )
}
