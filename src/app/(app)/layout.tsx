import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import AppNavbar from '@/src/components/layout/AppNavbar'

/**
 * Auth-guard layout shared by all (app) routes (/wardrobe, /wishlist, /outfits).
 * Unauthenticated visitors are redirected to /login.
 * Authenticated users receive the children as-is.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/login')
  }
  return (
    <>
      <AppNavbar />
      {children}
    </>
  )
}
