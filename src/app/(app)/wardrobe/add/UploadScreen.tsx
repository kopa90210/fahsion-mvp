'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { uploadDraftWardrobeItem } from '@/src/app/actions/wardrobe'
import PhotoUploadForm from './PhotoUploadForm'

export default function UploadScreen() {
  const router = useRouter()
  return <main className="min-h-screen bg-[#f7f4ef] px-4 py-7 text-[#1d1b18] sm:px-6"><div className="mx-auto max-w-xl"><button type="button" onClick={() => router.back()} aria-label="Go back" className="mb-10 flex size-10 items-center justify-center rounded-full border border-[#d8cec2] bg-white/60"><ArrowLeft className="size-4" /></button><p className="text-sm uppercase tracking-[0.18em] text-[#7a6f62]">Add to closet</p><h1 className="mt-2 text-3xl font-semibold">Photograph a piece</h1><div className="mt-8"><PhotoUploadForm onUpload={async (file) => { await uploadDraftWardrobeItem(file); setTimeout(() => router.back(), 900) }} submitLabel="Add to drafts" /></div></div></main>
}