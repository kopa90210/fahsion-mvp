export default function Loading() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-6 text-[#1d1b18] sm:px-6 lg:py-10">
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <div className="h-8 w-56 rounded-full bg-[#e7ded4]" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <div className="flex gap-4 overflow-hidden">
              <div className="h-[420px] w-[320px] rounded-lg bg-[#e7ded4]" />
              <div className="h-[420px] w-[320px] rounded-lg bg-[#e7ded4]" />
            </div>
          </div>
          <div className="h-[520px] rounded-lg bg-[#e7ded4]" />
        </div>
      </div>
    </main>
  )
}
