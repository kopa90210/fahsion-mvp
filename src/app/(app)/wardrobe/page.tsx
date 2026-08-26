import { getUserWardrobeItems } from '@/src/app/actions/closet'
import WardrobeScreen from './WardrobeScreen'

export const metadata = {
  title: 'My Closet — StyleGraph',
  description: 'View and edit all the wardrobe pieces in your personal closet.',
}

export default async function WardrobePage() {
  const items = await getUserWardrobeItems()
  return <WardrobeScreen initialItems={items} />
}
