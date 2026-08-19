import { redirect } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/server'
import UploadPhotoScreen from './UploadPhotoScreen'

export const metadata = {
  title: 'Upload Photo - AutoFashion',
  description: 'Upload a clothing photo and preview the extraction flow.',
}

export default async function UploadPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/login')
  }

  return <UploadPhotoScreen />
}
