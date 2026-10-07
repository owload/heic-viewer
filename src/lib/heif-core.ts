import type { HeifModule } from 'libheif-js/libheif-wasm/libheif-bundle.mjs';

/** The file is not a HEIC/HEIF photo, or it is damaged, or it is too big to decode here. The message is for the user. */
export class DecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecodeError';
  }
}

export interface Picture {
  width: number;
  height: number;
  /** RGBA, four bytes a pixel, rows from the top. */
  data: Uint8ClampedArray;
}

/** A photo of this many pixels takes 4 bytes each in memory (a 48 megapixel phone photo takes about 190 MB). */
export const MAX_PIXELS = 64_000_000;

const BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'mif2']);

/** The first bytes of a HEIF file: a box `ftyp` with a brand that is a HEIC/HEIF one. Cheap, so garbage never starts the decoder. */
export function looksLikeHeif(data: Uint8Array): boolean {
  if (data.length < 12) return false;
  if (String.fromCharCode(data[4], data[5], data[6], data[7]) !== 'ftyp') return false;
  const size = Math.min(((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0, 64, data.length);
  for (let at = 8; at + 4 <= size; at += 4) {
    if (at === 12) continue; // the minor version
    if (BRANDS.has(String.fromCharCode(data[at], data[at + 1], data[at + 2], data[at + 3]))) return true;
  }
  return false;
}

/**
 * Makes a decoder around a function that starts libheif. libheif is started once and reused; after a failure it is
 * started afresh (libheif reports a damaged file by throwing, or by stopping the module). The decoder decodes the first
 * picture of a HEIC/HEIF file to RGBA pixels. The rotation and mirroring stored in the file are applied by libheif;
 * colour profiles are not. It throws DecodeError, with a message the user can read, for anything it cannot decode.
 */
export function createDecoder(start: () => Promise<HeifModule>): (bytes: Uint8Array) => Promise<Picture> {
  let loading: Promise<HeifModule> | null = null;
  return async (bytes) => {
    if (!looksLikeHeif(bytes)) throw new DecodeError('This is not a HEIC photo.');
    let heif: HeifModule;
    try {
      loading ??= start();
      heif = await loading;
    } catch {
      loading = null;
      throw new DecodeError('The photo decoder could not be started.');
    }
    try {
      const images = new heif.HeifDecoder().decode(bytes);
      const image = images?.[0];
      if (!image) throw new DecodeError('The file holds no photo that can be decoded.');
      const width = image.get_width();
      const height = image.get_height();
      if (!(width > 0 && height > 0)) throw new DecodeError('The photo has no size.');
      if (width * height > MAX_PIXELS) throw new DecodeError(`The photo is too large to show here (${width} × ${height}).`);
      const target = { data: new Uint8ClampedArray(width * height * 4), width, height };
      const filled = await new Promise<typeof target | null>((resolve) => image.display(target, resolve));
      for (const each of images) each.free?.();
      if (!filled) throw new DecodeError('The photo could not be decoded.');
      return { width, height, data: filled.data };
    } catch (e) {
      if (e instanceof DecodeError) throw e;
      loading = null;
      throw new DecodeError('The photo is damaged or uses a format that cannot be decoded.');
    }
  };
}

/** What the page sends to the decoder worker, and what comes back. */
export interface WorkerRequest { bytes: Uint8Array }
export type WorkerResponse = ({ ok: true } & Picture) | { ok: false; message: string };

/** The work of the worker, apart from the plumbing, so that it can be tested without a real Worker. */
export async function answer(decode: (bytes: Uint8Array) => Promise<Picture>, request: WorkerRequest): Promise<WorkerResponse> {
  try {
    const picture = await decode(request.bytes);
    return { ok: true, ...picture };
  } catch (e) {
    return { ok: false, message: e instanceof DecodeError ? e.message : 'The photo could not be decoded.' };
  }
}
