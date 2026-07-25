import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  getCalibrationOutfits,
  shouldShowOutfitCalibration,
} from '@/src/app/actions/outfit'
import { getFashionDnaSummary } from '@/src/app/actions/fashion-dna'
import { buttonVariants } from '@/components/ui/button'
import OutfitCalibrationScreen from './OutfitCalibrationScreen'

export default async function OutfitCalibrationPage() {
  if (!(await shouldShowOutfitCalibration())) {
    redirect('/outfits')
  }

  const outfits = await getCalibrationOutfits()

  if (outfits.length !== 3) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-10 text-[#1d1b18] sm:px-6">
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#7a6f62]">
            Outfit calibration
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Add a few more wardrobe pieces.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#6d6257]">
            I need enough top, bottom, and footwear combinations before calibration can begin.
          </p>
          <Link href="/quiz?done=true" className={buttonVariants({ className: 'mt-6' })}>
            Choose wardrobe pieces
          </Link>
        </div>
      </main>
    )
  }

  const { signals, feedbackCount } = await getFashionDnaSummary()

  return (
    <OutfitCalibrationScreen
      outfits={outfits}
      initialSignals={signals}
      feedbackCount={feedbackCount}
    />
  )
}
