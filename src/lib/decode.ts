import DecodeWorker from './decode-worker?worker&inline';
import { DecodeError, looksLikeHeif, type Picture, type WorkerResponse } from './heif-core';

export { DecodeError, MAX_PIXELS, looksLikeHeif, type Picture } from './heif-core';

/** What the viewer needs of a worker: the part of `Worker` that is used (tests give it a stand-in). */
export interface DecoderWorker {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: WorkerResponse }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

let makeWorker: () => DecoderWorker = () => new DecodeWorker() as unknown as DecoderWorker;

/** For tests only: replaces the way the worker is started. */
export function setWorkerFactory(factory: (() => DecoderWorker) | null): void {
  makeWorker = factory ?? (() => new DecodeWorker() as unknown as DecoderWorker);
}

/** A photo that takes longer than this to decode is given up on (the worker is stopped). */
const TIMEOUT_MS = 60_000;

/**
 * Decodes the first picture of a HEIC/HEIF file to RGBA pixels, with libheif, in a worker of its own that is started for
 * the photo and stopped after it: the decoder has no access to the page (its DOM or its localStorage) and its memory is
 * given back. Throws DecodeError, with a message the user can read, for anything that cannot be decoded, and also when
 * the worker cannot be started: it never falls back to decoding in the page.
 */
export async function decodeHeic(bytes: Uint8Array): Promise<Picture> {
  if (!looksLikeHeif(bytes)) throw new DecodeError('This is not a HEIC photo.');
  let worker: DecoderWorker;
  try {
    worker = makeWorker();
  } catch {
    throw new DecodeError('The photo decoder could not be started.');
  }
  try {
    return await new Promise<Picture>((resolve, reject) => {
      const timer = setTimeout(() => reject(new DecodeError('The photo took too long to decode.')), TIMEOUT_MS);
      worker.onmessage = ({ data }) => {
        clearTimeout(timer);
        if (data.ok) resolve({ width: data.width, height: data.height, data: data.data });
        else reject(new DecodeError(data.message));
      };
      worker.onerror = () => {
        clearTimeout(timer);
        reject(new DecodeError('The photo decoder stopped working.'));
      };
      // The photo is copied to the worker: the bytes the host gave to the viewer stay as they are.
      worker.postMessage({ bytes });
    });
  } finally {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  }
}
