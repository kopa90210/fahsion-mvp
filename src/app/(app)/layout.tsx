import BottomNav from '@/src/components/nav/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="min-h-screen pb-28">{children}</div>
      <BottomNav />
    </>
  )
}