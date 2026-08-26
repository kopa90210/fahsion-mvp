import { getUserDraftItems, getUserWardrobeItems } from '@/src/app/actions/wardrobe'
import { getWishlistItems } from '@/src/app/actions/wishlist'
import { WARDROBE_CATEGORIES } from '@/src/lib/wardrobe/normalize'
import WardrobeScreen from './WardrobeScreen'

export default async function WardrobePage() {
  const [items, drafts, wishlistItems] = await Promise.all([getUserWardrobeItems(), getUserDraftItems(), getWishlistItems()])
  return <WardrobeScreen items={items} drafts={drafts} wishlistItems={wishlistItems} categories={WARDROBE_CATEGORIES} />
}