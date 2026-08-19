'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { motion } from 'framer-motion'
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileImage,
  ScanSearch,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Stage = 'idle' | 'uploading' | 'extracting' | 'accepting' | 'done'

type ResultSnapshot = {
  itemName: string
  category: string
  confidence: string
  tags: string[]
}

const workflow = [
  { key: 'uploading', label: 'Upload', icon: UploadCloud },
  { key: 'extracting', label: 'Extract', icon: ScanSearch },
  { key: 'accepting', label: 'Accept', icon: CheckCircle2 },
  { key: 'done', label: 'Ready', icon: BadgeCheck },
] as const

function prettifyFileName(name: string) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function inferCategory(label: string) {
  const value = label.toLowerCase()
  if (/(shoe|sneaker|boot|loafer|heel|sandal)/.test(value)) return 'Footwear'
  if (/(coat|jacket|blazer|hoodie|shirt|tee|top|sweater)/.test(value)) return 'Top layer'
  if (/(pant|jean|trouser|short|skirt)/.test(value)) return 'Bottoms'
  if (/(dress|gown|jumpsuit|romper)/.test(value)) return 'One-piece'
  return 'Apparel'
}

function inferConfidence(file: File) {
  const normalized = Math.min(0.98, Math.max(0.68, 1 - file.size / 22_000_000))
  return `${Math.round(normalized * 100)}%`
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadPhotoScreen() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const timersRef = useRef<number[]>([])
  const previewUrlRef = useRef<string | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<ResultSnapshot | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const activeStep = useMemo(() => {
    if (stage === 'idle') return null
    return workflow.find((step) => step.key === stage) ?? null
  }, [stage])

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current = []
  }

  const setPreviewFromFile = (file: File) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }

    const nextPreview = URL.createObjectURL(file)
    previewUrlRef.current = nextPreview
    setPreviewUrl(nextPreview)
  }

  const saveFileToProject = async (file: File) => {
    setSaveStatus('saving')
    setSavedPath(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/dev-upload', {
        method: 'POST',
        body: formData,
      })

      const payload = (await response.json()) as
        | { ok: true; path: string; name: string }
        | { error?: string }

      if (!response.ok || !('ok' in payload)) {
        const errorMessage = 'error' in payload ? payload.error : undefined
        throw new Error(errorMessage ?? 'Could not save the uploaded file.')
      }

      setSavedPath(payload.path)
      setSaveStatus('saved')
    } catch (error) {
      console.error(error)
      setSaveStatus('error')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not save the uploaded file.',
      )
    }
  }

  const commitFile = (file: File | null) => {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please choose an image file.')
      return
    }

    setErrorMessage(null)
    setResult(null)
    setSelectedFile(file)
    setCustomName(prettifyFileName(file.name))
    setStage('idle')
    setProgress(12)
    setPreviewFromFile(file)
    void saveFileToProject(file)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    commitFile(event.target.files?.[0] ?? null)
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    commitFile(event.dataTransfer.files?.[0] ?? null)
  }

  const startProcessing = () => {
    if (!selectedFile) {
      setErrorMessage('Upload a photo first.')
      return
    }

    clearTimers()
    setErrorMessage(null)
    setResult(null)
    setStage('uploading')
    setProgress(20)

    const uploadingTimer = window.setTimeout(() => {
      setStage('extracting')
      setProgress(52)
    }, 850)

    const extractingTimer = window.setTimeout(() => {
      setStage('accepting')
      setProgress(78)
    }, 1700)

    const acceptingTimer = window.setTimeout(() => {
      const label = customName.trim() || prettifyFileName(selectedFile.name)
      const category = inferCategory(label)

      setStage('done')
      setProgress(100)
      setResult({
        itemName: label,
        category,
        confidence: inferConfidence(selectedFile),
        tags: [category, 'Ready for wardrobe'],
      })
    }, 2550)

    timersRef.current = [uploadingTimer, extractingTimer, acceptingTimer]
  }

  const removeSelection = () => {
    clearTimers()
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    setSelectedFile(null)
    setPreviewUrl(null)
    setCustomName('')
    setResult(null)
    setErrorMessage(null)
    setStage('idle')
    setProgress(0)
    setSavedPath(null)
    setSaveStatus('idle')
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-6 text-[#1d1b18] sm:px-6 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#7a6f62]">
            Upload photo
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Add a clothing photo
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="overflow-hidden rounded-lg border border-[#d8cec2] bg-white/70 shadow-sm">
            <CardHeader className="border-b border-[#e4dbd0] px-6 py-5">
              <CardTitle className="text-xl">Upload</CardTitle>
              <CardDescription className="text-[#6d6257]">
                Select one garment photo.
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.05fr)_320px]">
              <div className="space-y-4">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragActive(true)
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  className={cn(
                    'group relative flex min-h-[340px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors',
                    dragActive
                      ? 'border-[#b9aa99] bg-[#f8f2ea]'
                      : 'border-[#d8cec2] bg-[#fbfaf7] hover:border-[#b9aa99]',
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {previewUrl ? (
                    <div className="absolute inset-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={selectedFile?.name ?? 'Selected garment preview'}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                      <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
                        <Badge className="bg-[#efe6db] text-[#4f463d] shadow-sm">
                          Local preview
                        </Badge>
                        <Badge variant="outline" className="border-white/20 bg-black/20 text-white">
                          {selectedFile ? formatBytes(selectedFile.size) : 'Ready'}
                        </Badge>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-white/80 backdrop-blur">
                          <Camera className="size-3.5" />
                          {selectedFile?.type || 'image'}
                        </div>
                        <p className="mt-3 text-lg font-medium text-white">
                          {customName || selectedFile?.name || 'Untitled garment'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-md px-6 py-10 text-center">
                      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-[#d8cec2] bg-white">
                        <UploadCloud className="size-7 text-[#7a6f62]" />
                      </div>
                      <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                        Drop a photo here
                      </h2>
                      <p className="mt-3 text-sm leading-6 text-[#6d6257]">
                        JPG, PNG, or WebP.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" size="lg" className="h-11 rounded-full px-5" onClick={startProcessing}>
                    {stage === 'done' ? 'Run again' : 'Start'}
                    <ChevronRight className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-11 rounded-full border-[#b9aa99] bg-white/60 px-5 text-[#4f463d] hover:bg-white"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose file
                  </Button>
                  {selectedFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="h-11 rounded-full px-4 text-[#6d6257] hover:bg-white/70 hover:text-[#1d1b18]"
                      onClick={removeSelection}
                    >
                      <Trash2 className="size-4" />
                      Clear
                    </Button>
                  )}
                </div>

                {errorMessage && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                )}

                <div className="rounded-2xl border border-[#e4dbd0] bg-[#fbfaf7] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[#7a6f62]">
                        Status
                      </p>
                      <p className="mt-1 text-sm text-[#6d6257]">
                        {activeStep ? activeStep.label : 'Waiting for a file'}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-[#b9aa99] bg-white/60 text-[#4f463d]">
                      {stage === 'done' ? 'Done' : 'Draft'}
                    </Badge>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e7ded4]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#7a6f62] via-[#b9aa99] to-[#d8cec2] transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {workflow.map((step, index) => {
                      const Icon = step.icon
                      const isActive = index === workflow.findIndex((item) => item.key === stage)
                      const isComplete =
                        workflow.findIndex((item) => item.key === stage) > index || stage === 'done'

                      return (
                        <div
                          key={step.key}
                          className={cn(
                            'flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors',
                            isActive || isComplete
                              ? 'border-[#d1c4b4] bg-white'
                              : 'border-[#e4dbd0] bg-[#fbfaf7]',
                          )}
                        >
                          <div
                            className={cn(
                              'flex size-9 shrink-0 items-center justify-center rounded-xl',
                              isActive || isComplete
                                ? 'bg-[#efe6db] text-[#4f463d]'
                                : 'bg-[#f1ede8] text-[#7a6f62]',
                            )}
                          >
                            <Icon className="size-4" />
                          </div>
                          <p className="text-sm font-medium text-[#1d1b18]">{step.label}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Card className="rounded-lg border border-[#d8cec2] bg-white/70">
                  <CardHeader className="border-b border-[#e4dbd0] px-5 py-5">
                    <CardTitle className="text-lg">Name</CardTitle>
                    <CardDescription className="text-[#6d6257]">
                      Keep it short.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5">
                    <Input
                      value={customName}
                      onChange={(event) => setCustomName(event.target.value)}
                      placeholder="Cream knit sweater"
                      className="h-11 rounded-xl border-[#d8cec2] bg-white text-[#1d1b18] placeholder:text-[#a79a8f] focus-visible:ring-[#b9aa99]/40"
                    />

                    {selectedFile ? (
                      <div className="rounded-2xl border border-[#e4dbd0] bg-[#fbfaf7] p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 items-center justify-center rounded-xl bg-[#efe6db] text-[#4f463d]">
                            <FileImage className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#1d1b18]">
                              {selectedFile.name}
                            </p>
                            <p className="mt-1 text-xs text-[#6d6257]">
                              {selectedFile.type || 'image'} - {formatBytes(selectedFile.size)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-[#7a6f62]">
                            Save status
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              'border-transparent',
                              saveStatus === 'saved'
                                ? 'bg-emerald-50 text-emerald-700'
                                : saveStatus === 'saving'
                                  ? 'bg-[#f3f1ee] text-[#4f463d]'
                                  : saveStatus === 'error'
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-white text-[#4f463d]',
                            )}
                          >
                            {saveStatus === 'saved'
                              ? 'Saved to project'
                              : saveStatus === 'saving'
                                ? 'Saving...'
                                : saveStatus === 'error'
                                  ? 'Save failed'
                                  : 'Not saved yet'}
                          </Badge>
                        </div>
                        {savedPath && (
                          <p className="mt-2 break-all text-xs text-[#6d6257]">
                            {savedPath}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#d8cec2] bg-[#fbfaf7] p-4 text-sm text-[#6d6257]">
                        No file selected.
                      </div>
                    )}

                    {result && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
                      >
                        <div className="flex items-center gap-2 text-emerald-700">
                          <BadgeCheck className="size-4" />
                          <p className="text-sm font-medium">Ready</p>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-emerald-800">
                          <p>
                            <span className="text-emerald-700">Item:</span> {result.itemName}
                          </p>
                          <p>
                            <span className="text-emerald-700">Category:</span> {result.category}
                          </p>
                          <p>
                            <span className="text-emerald-700">Confidence:</span> {result.confidence}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-lg border border-[#d8cec2] bg-white/70">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-[#4f463d]">
                      <Sparkles className="size-4" />
                      <p className="text-sm font-medium">Wardrobe flow</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#6d6257]">
                      Upload one item at a time and keep moving.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
