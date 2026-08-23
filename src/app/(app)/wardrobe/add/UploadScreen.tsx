'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArrowLeft, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadDraftWardrobeItem } from '@/src/app/actions/wardrobe'

export default function UploadScreen() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!file) return; startTransition(async () => { await uploadDraftWardrobeItem(file); setMessage('Added to drafts'); setTimeout(() => router.back(), 900) }) }
  return <main className="min-h-screen bg-[#f7f4ef] px-4 py-7 text-[#1d1b18] sm:px-6"><div className="mx-auto max-w-xl"><button type="button" onClick={() => router.back()} aria-label="Go back" className="mb-10 flex size-10 items-center justify-center rounded-full border border-[#d8cec2] bg-white/60"><ArrowLeft className="size-4" /></button><p className="text-sm uppercase tracking-[0.18em] text-[#7a6f62]">Add to closet</p><h1 className="mt-2 text-3xl font-semibold">Photograph a piece</h1><form onSubmit={submit} className="mt-8 space-y-5"><label className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#b9aa99] bg-white/45 p-6 text-center"><Upload className="size-8 text-[#7a6f62]" /><span className="mt-3 text-sm font-medium">Choose a photo</span><span className="mt-1 text-xs text-[#7a6f62]">The item will stay in drafts until you confirm it.</span><input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>{file && <p className="text-sm text-[#6d6257]">{file.name}</p>}<Button type="submit" className="w-full" disabled={!file || isPending}>{isPending ? 'Uploading...' : 'Add to drafts'}</Button>{message && <p role="status" className="text-center text-sm font-medium">{message}</p>}</form></div></main>
}