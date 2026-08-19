export default function Loading() {
  return (
    <main className="min-h-screen bg-[#0d0b0a] px-4 py-8 text-[#f5eee7] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl animate-pulse space-y-8">
        <div className="h-7 w-36 rounded-full bg-white/10" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.18fr)_380px]">
          <div className="space-y-6">
            <div className="h-[520px] rounded-[28px] border border-white/10 bg-white/5" />
            <div className="h-40 rounded-[24px] border border-white/10 bg-white/5" />
          </div>
          <div className="space-y-6">
            <div className="h-[260px] rounded-[28px] border border-white/10 bg-white/5" />
            <div className="h-[220px] rounded-[28px] border border-white/10 bg-white/5" />
          </div>
        </div>
      </div>
    </main>
  )
}
