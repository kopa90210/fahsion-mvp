import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import { getRecommendedOutfits } from '@/src/app/actions/outfit'
import OutfitRecommendationsShelf from './OutfitRecommendationsShelf'

export const metadata = {
  title: 'Recommendations - AutoFashion',
  description: 'Browse minimal outfit recommendations from your wardrobe.',
}

export default async function OutfitRecommendationsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    redirect('/login')
  }

  const outfits = await getRecommendedOutfits(6)

  return <OutfitRecommendationsShelf outfits={outfits} />
}
