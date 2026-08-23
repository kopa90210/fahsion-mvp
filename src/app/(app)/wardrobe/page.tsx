import { getUserDraftItems, getUserWardrobeItems } from '@/src/app/actions/wardrobe'
import { WARDROBE_CATEGORIES } from '@/src/lib/wardrobe/normalize'
import WardrobeScreen from './WardrobeScreen'

export default async function WardrobePage() {
  const [items, drafts] = await Promise.all([getUserWardrobeItems(), getUserDraftItems()])
  return <WardrobeScreen items={items} drafts={drafts} categories={WARDROBE_CATEGORIES} />
}