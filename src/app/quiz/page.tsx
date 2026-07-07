import { createClient } from '@/src/lib/supabase/server'
import { redirect } from 'next/navigation'
import StyleQuiz from './StyleQuiz'

export const metadata = {
  title: 'Style Quiz — AutoFashion',
  description: 'Discover your fashion DNA in 5 quick taps.',
}

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>
}) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/login')
  }

  const params = await searchParams
  const isDone = params?.done === 'true'

  if (isDone) {
    const { getCuratedPieces } = await import('../actions/wardrobe')
    
    try {
      const curatedItems = await getCuratedPieces()
      const PieceSelectionScreen = (await import('./PieceSelectionScreen')).default
      
      return <PieceSelectionScreen curatedItems={curatedItems} />
    } catch (e) {
      // Fallback if no dna/items found
      console.error(e)
      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#0a0a0a] px-6 text-white">
          <p>Failed to load curated pieces.</p>
        </div>
      )
    }
  }

  return <StyleQuiz />
}
