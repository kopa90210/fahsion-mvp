"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PhotoUploadForm({
  onUpload,
  submitLabel = "Upload photo",
}: {
  onUpload: (file: File) => Promise<unknown>;
  submitLabel?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    startTransition(async () => {
      setMessage(null);
      setError(null);
      try {
        await onUpload(file);
        setMessage("Photo uploaded");
        setFile(null);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Could not upload photo. Please try again.",
        );
      }
    });
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#b9aa99] bg-white/45 p-6 text-center">
        <Upload className="size-8 text-[#7a6f62]" />
        <span className="mt-3 text-sm font-medium">Choose a photo</span>
        <span className="mt-1 text-xs text-[#7a6f62]">
          Use a clear photo of the item.
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {file && <p className="text-sm text-[#6d6257]">{file.name}</p>}
      <Button type="submit" className="w-full" disabled={!file || isPending}>
        {isPending ? "Uploading..." : submitLabel}
      </Button>
      {error && (
        <p
          role="alert"
          className="text-center text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-center text-sm font-medium">
          {message}
        </p>
      )}
    </form>
  );
}
