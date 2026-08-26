import { getWishlistItems } from '@/src/app/actions/wishlist'
import WishlistScreen from './WishlistScreen'

export const metadata = {
  title: 'Wishlist — StyleGraph',
  description: 'Items you want to own — build your wishlist and track desired pieces.',
}

export default async function WishlistPage() {
  const items = await getWishlistItems()
  return <WishlistScreen initialItems={items} />
}
