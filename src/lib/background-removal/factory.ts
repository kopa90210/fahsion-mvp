import type { BackgroundRemovalProvider } from './types'
import { RemoveBgProvider } from './providers/removebg'

export function getBackgroundRemovalProvider(): BackgroundRemovalProvider {
  const providerName = process.env.BACKGROUND_REMOVAL_PROVIDER ?? 'removebg'
  if (providerName === 'removebg') return new RemoveBgProvider()
  throw new Error(`Unsupported background removal provider: ${providerName}`)
}