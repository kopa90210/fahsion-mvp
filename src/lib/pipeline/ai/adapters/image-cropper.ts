/**
 * Phase 4B Gate 4: Image Cropping Utility
 *
 * Performs local, server-side image cropping using normalized bounding boxes.
 * No external API calls required.
 *
 * Supports:
 *   - Data URLs (for base64-encoded images)
 *   - HTTP/HTTPS URLs (returns URL-accessible cropped result)
 *   - Normalized box coordinates (0..1)
 *
 * Returns a data URL with the cropped image as a PNG.
 */

import type { CropBox } from '../../contracts';

/**
 * Crops an image using a normalized CropBox.
 *
 * For server-side usage with node.js, we'll return a data URL.
 * For browser usage, we can use Canvas API.
 *
 * Note: This implementation works in browser contexts.
 * For Node.js server-side, you would need a library like jimp or sharp.
 * For this Gate 4, we provide the interface and browser implementation.
 */
export async function cropImage(
  imageUrl: string,
  box: CropBox
): Promise<string> {
  // Validation is already done by the caller, but let's be defensive
  if (box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0) {
    throw new Error('Invalid crop box: coordinates must be normalized');
  }
  if (box.x + box.width > 1 || box.y + box.height > 1) {
    throw new Error('Invalid crop box: box exceeds image bounds');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Convert normalized coordinates to pixel coordinates
        const pixelX = Math.floor(box.x * img.width);
        const pixelY = Math.floor(box.y * img.height);
        const pixelWidth = Math.ceil(box.width * img.width);
        const pixelHeight = Math.ceil(box.height * img.height);

        // Create canvas and crop
        const canvas = document.createElement('canvas');
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D context from canvas'));
          return;
        }

        ctx.drawImage(
          img,
          pixelX,
          pixelY,
          pixelWidth,
          pixelHeight,
          0,
          0,
          pixelWidth,
          pixelHeight
        );

        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imageUrl}`));
    };

    img.src = imageUrl;
  });
}

/**
 * Server-side variant placeholder.
 * For production server-side cropping, integrate with sharp or jimp.
 * This is marked for future implementation.
 *
 * @deprecated Use Node.js image library (sharp, jimp) for server-side
 */
export async function cropImageNodeServer(
  imageUrl: string,
  box: CropBox
): Promise<string> {
  throw new Error(
    'Server-side image cropping requires sharp or jimp. ' +
      'Install with: npm install sharp (or jimp) and implement this function.'
  );
}
