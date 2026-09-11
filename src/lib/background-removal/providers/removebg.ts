import type { BackgroundRemovalInput, BackgroundRemovalProvider, BackgroundRemovalResult } from '../types'

const REMOVE_BG_ENDPOINT = 'https://api.remove.bg/v1.0/removebg'
const REMOVE_BG_TIMEOUT_MS = 60_000

export class RemoveBgProvider implements BackgroundRemovalProvider {
  async removeBackground({ file }: BackgroundRemovalInput): Promise<BackgroundRemovalResult> {
    const apiKey = process.env.REMOVE_BG_API_KEY
    if (!apiKey) throw new Error('Background removal is not configured')

    const formData = new FormData()
    formData.append('image_file', new Blob([await file.arrayBuffer()], { type: file.type }), file.name)
    formData.append('size', 'auto')
    formData.append('type', 'product')

    let response: Response
    try {
      response = await fetch(REMOVE_BG_ENDPOINT, {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: formData,
        signal: AbortSignal.timeout(REMOVE_BG_TIMEOUT_MS),
      })
    } catch (error) {
      console.error('Background removal request failed', error)
      throw new Error('Image processing failed. Please try again.')
    }

    if (!response.ok) {
      console.error('Background removal provider returned an error', response.status)
      throw new Error('Image processing failed. Please try again.')
    }

    const processed = await response.blob()
    return {
      file: new File([processed], `${file.name.replace(/\.[^.]+$/, '')}.png`, { type: 'image/png' }),
    }
  }
}