'use client'

import { useRef, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, Camera, Save, Loader2, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ClosetItem, UpdateWardrobeItemPayload } from '@/src/app/actions/closet'
import {
  updateWardrobeItemAttributes,
  removeWardrobeItem,
  replaceWardrobeItemPhoto,
} from '@/src/app/actions/closet'
import { WARDROBE_CATEGORIES } from '@/src/lib/wardrobe/normalize'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  item: ClosetItem
  onClose: () => void
  onSaved: (updatedItem: Partial<ClosetItem> & { id: string }) => void
  onRemoved: (id: string) => void
}

// ---------------------------------------------------------------------------
// ItemEditModal
// ---------------------------------------------------------------------------

export default function ItemEditModal({ item, onClose, onSaved, onRemoved }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [displayName, setDisplayName] = useState(item.display_name ?? '')
  const [brand, setBrand] = useState(item.brand ?? '')
  const [category, setCategory] = useState(item.category)
  const [subcategory, setSubcategory] = useState(item.subcategory ?? '')
  const [colorPrimary, setColorPrimary] = useState(
    (item.color as Record<string, string>)?.primary ?? '',
  )
  const [styleTags, setStyleTags] = useState(
    Object.keys(item.style_tags).join(', '),
  )

  const [previewUrl, setPreviewUrl] = useState<string | null>(item.image_url)
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  // ----------
  // Photo pick
  // ----------

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    setPendingPhoto(file)
    setPreviewUrl(URL.createObjectURL(file))
    setError(null)
  }

  // ----------
  // Save
  // ----------

  const handleSave = () => {
    if (!item.isOwned) return

    startTransition(async () => {
      setError(null)
      try {
        // 1. Replace photo if a new one was chosen
        let newImageUrl = item.image_url
        if (pendingPhoto) {
          const result = await replaceWardrobeItemPhoto(item.id, pendingPhoto)
          newImageUrl = result.image_url
        }

        // 2. Build style_tags object from comma-separated string
        const tagsRecord: Record<string, number> = {}
        styleTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((tag) => {
            tagsRecord[tag] = 1
          })

        const payload: UpdateWardrobeItemPayload = {
          display_name: displayName || undefined,
          brand: brand || undefined,
          category,
          subcategory: subcategory || undefined,
          color: colorPrimary ? { primary: colorPrimary } : undefined,
          style_tags: Object.keys(tagsRecord).length ? tagsRecord : undefined,
        }

        await updateWardrobeItemAttributes(item.id, payload)

        onSaved({
          id: item.id,
          display_name: displayName || null,
          brand: brand || null,
          category,
          subcategory: subcategory || null,
          image_url: newImageUrl,
          style_tags: tagsRecord,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed. Try again.')
      }
    })
  }

  // ----------
  // Remove
  // ----------

  const handleRemove = () => {
    startTransition(async () => {
      setError(null)
      try {
        await removeWardrobeItem(item.id)
        onRemoved(item.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Remove failed. Try again.')
      }
    })
  }

  // ----------
  // Render
  // ----------

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <motion.div
        key="panel"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-xl rounded-t-2xl bg-[#f7f4ef] shadow-2xl sm:inset-0 sm:m-auto sm:max-h-[90vh] sm:rounded-2xl sm:overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${item.display_name ?? 'item'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e4dbd0] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#7a6f62]">
              {item.isOwned ? 'Edit item' : 'Item details'}
            </p>
            <h2 className="mt-0.5 truncate text-lg font-semibold leading-snug text-[#1d1b18]">
              {item.display_name ?? 'Unnamed item'}
            </h2>
          </div>
          <button
            id="item-edit-modal-close"
            onClick={onClose}
            className="ml-3 flex size-8 shrink-0 items-center justify-center rounded-full text-[#7a6f62] transition-colors hover:bg-[#e4dbd0] hover:text-[#1d1b18]"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Photo */}
          <Card className="overflow-hidden rounded-lg border border-[#d8cec2] bg-white/70">
            <CardContent className="p-0">
              <div className="relative aspect-[4/3] w-full bg-[#ebe3d8]">
                {previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewUrl}
                    alt={item.display_name ?? 'Item photo'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[#7a6f62]">
                    No photo
                  </div>
                )}

                {item.isOwned && (
                  <button
                    id="item-edit-replace-photo-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-xs text-white backdrop-blur transition-colors hover:bg-black/60"
                  >
                    <Camera className="size-3.5" />
                    Replace photo
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Read-only badge for curated items */}
          {!item.isOwned && (
            <div className="flex items-center gap-2 rounded-lg border border-[#e4dbd0] bg-[#fbfaf7] px-3 py-2 text-sm text-[#7a6f62]">
              <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
              This is a curated catalog item — attributes cannot be edited.
            </div>
          )}

          {/* Fields */}
          <div className={cn('space-y-3', !item.isOwned && 'pointer-events-none opacity-60')}>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#7a6f62]">Name</label>
              <Input
                id="item-edit-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Cream knit sweater"
                className="h-9 rounded-lg border-[#d8cec2] bg-white text-[#1d1b18] placeholder:text-[#a79a8f]"
                disabled={!item.isOwned}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#7a6f62]">Brand</label>
              <Input
                id="item-edit-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Arket"
                className="h-9 rounded-lg border-[#d8cec2] bg-white text-[#1d1b18] placeholder:text-[#a79a8f]"
                disabled={!item.isOwned}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#7a6f62]">Category</label>
                <select
                  id="item-edit-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as typeof category)}
                  disabled={!item.isOwned}
                  className="h-9 w-full rounded-lg border border-[#d8cec2] bg-white px-2 text-sm text-[#1d1b18] focus:outline-none focus:ring-2 focus:ring-[#b9aa99]/40 disabled:opacity-60"
                >
                  {WARDROBE_CATEGORIES.map((c) => (
                    <option key={c} value={c} className="capitalize">
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#7a6f62]">Subcategory</label>
                <Input
                  id="item-edit-subcategory"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="Shirt"
                  className="h-9 rounded-lg border-[#d8cec2] bg-white text-[#1d1b18] placeholder:text-[#a79a8f]"
                  disabled={!item.isOwned}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#7a6f62]">
                Primary colour
              </label>
              <Input
                id="item-edit-color"
                value={colorPrimary}
                onChange={(e) => setColorPrimary(e.target.value)}
                placeholder="Cream"
                className="h-9 rounded-lg border-[#d8cec2] bg-white text-[#1d1b18] placeholder:text-[#a79a8f]"
                disabled={!item.isOwned}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#7a6f62]">
                Style tags{' '}
                <span className="normal-case font-normal text-[#a79a8f]">(comma separated)</span>
              </label>
              <Input
                id="item-edit-style-tags"
                value={styleTags}
                onChange={(e) => setStyleTags(e.target.value)}
                placeholder="minimal, relaxed, monochrome"
                className="h-9 rounded-lg border-[#d8cec2] bg-white text-[#1d1b18] placeholder:text-[#a79a8f]"
                disabled={!item.isOwned}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          {item.isOwned && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                id="item-edit-save-btn"
                type="button"
                className="h-9 flex-1 rounded-full"
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {isPending ? 'Saving…' : 'Save changes'}
              </Button>

              {!confirmDelete ? (
                <Button
                  id="item-edit-remove-btn"
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full border-[#d8cec2] px-4 text-[#7a6f62] hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isPending}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    id="item-edit-remove-confirm-btn"
                    type="button"
                    className="h-9 rounded-full bg-red-600 px-4 text-white hover:bg-red-700"
                    onClick={handleRemove}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Confirm remove'}
                  </Button>
                  <Button
                    id="item-edit-remove-cancel-btn"
                    type="button"
                    variant="ghost"
                    className="h-9 rounded-full px-3 text-[#7a6f62]"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Category badge always visible */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge
              variant="outline"
              className="rounded-full border-[#d8cec2] bg-white/60 capitalize text-[#4f463d]"
            >
              {item.category}
            </Badge>
            {item.subcategory && (
              <Badge
                variant="outline"
                className="rounded-full border-[#d8cec2] bg-white/60 text-[#6d6257]"
              >
                {item.subcategory}
              </Badge>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
