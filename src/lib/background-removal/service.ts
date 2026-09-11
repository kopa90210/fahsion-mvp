import { getBackgroundRemovalProvider } from './factory'

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export async function removeImageBackground(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file')
  if (file.size === 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Image must be smaller than 10 MB')
  }

  const result = await getBackgroundRemovalProvider().removeBackground({ file })
  return result.file
}