import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (name: string) => new Uint8Array(readFileSync(resolve(process.cwd(), 'test', 'fixtures', name)));

/**
 * Two synthetic pictures made on a Mac with `sips -s format heic` (no photograph, nothing personal):
 * - gradient.heic, 640 × 480: red grows to the right, green downwards, blue falls to the right; a yellow disc in the
 *   middle (250, 219, 88) and a dark block (27, 27, 26) near the top left.
 * - gradient-large.heic, 4032 × 3024 (the size of a phone photo, stored as tiles): the same gradient, no shapes.
 */
export const small = () => read('gradient.heic');
export const large = () => read('gradient-large.heic');

export function pixel(picture: { width: number; data: Uint8ClampedArray }, x: number, y: number): number[] {
  const at = (y * picture.width + x) * 4;
  return [...picture.data.slice(at, at + 4)];
}
