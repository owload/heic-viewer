import { decodeHeic, looksLikeHeif } from './decode';

/** The size of a picture of `width` × `height` that fits `size` pixels on its longer side (never larger than the picture). */
export function fitSize(width: number, height: number, size: number): { width: number; height: number } {
  const scale = Math.min(1, size / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * The photo scaled to `size` pixels on its longer side, as a PNG (owload-docs/decisions/0020). Returns null where there
 * is no canvas, or for a file that cannot be decoded; it never throws for a bad file.
 */
export async function renderHeicPreview(data: Uint8Array, size: number): Promise<Uint8Array | null> {
  if (typeof OffscreenCanvas === 'undefined' || !looksLikeHeif(data)) return null;
  try {
    const picture = await decodeHeic(data);
    const full = new OffscreenCanvas(picture.width, picture.height);
    const fullContext = full.getContext('2d');
    if (!fullContext) return null;
    fullContext.putImageData(new ImageData(picture.data, picture.width, picture.height), 0, 0);
    const target = fitSize(picture.width, picture.height, size);
    const small = new OffscreenCanvas(target.width, target.height);
    const context = small.getContext('2d');
    if (!context) return null;
    context.imageSmoothingQuality = 'high';
    context.drawImage(full, 0, 0, target.width, target.height);
    const blob = await small.convertToBlob({ type: 'image/png' });
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}
