import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RemoveBgProvider } from './removebg'

describe('RemoveBgProvider', () => {
  beforeEach(() => {
    vi.stubEnv('REMOVE_BG_API_KEY', 'test-remove-bg-key')
    vi.restoreAllMocks()
  })

  it('sends the original image server-side and returns a PNG file', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['transparent-image'], { type: 'image/png' }), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    )

    const result = await new RemoveBgProvider().removeBackground({
      file: new File(['original-image'], 'shirt.jpg', { type: 'image/jpeg' }),
    })

    expect(result.file.name).toBe('shirt.png')
    expect(result.file.type).toBe('image/png')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.remove.bg/v1.0/removebg',
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-Api-Key': 'test-remove-bg-key' },
        body: expect.any(FormData),
      }),
    )
  })

  it('returns a safe error when the provider rejects the image', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('failed', { status: 400 }))

    await expect(new RemoveBgProvider().removeBackground({
      file: new File(['original-image'], 'shirt.jpg', { type: 'image/jpeg' }),
    })).rejects.toThrow('Image processing failed. Please try again.')
  })
})