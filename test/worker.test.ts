import { afterEach, describe, expect, it } from 'vitest';
import { DecodeError, decodeHeic, setWorkerFactory, type DecoderWorker } from '../src/lib/decode';
import { fakeWorker } from './helpers';
import { small } from './fixtures';

afterEach(() => setWorkerFactory(null));

describe('decoding in a worker', () => {
  it('sends the photo to a worker, gets the pixels back and stops the worker', async () => {
    const worker = fakeWorker();
    setWorkerFactory(() => worker);
    const picture = await decodeHeic(small());
    expect([picture.width, picture.height]).toEqual([640, 480]);
    expect(worker.requests).toHaveLength(1);
    expect(worker.terminated).toBe(true);
    expect(worker.onmessage).toBeNull();
  });

  it('does not start a worker for something that is not a HEIC file', async () => {
    let started = 0;
    setWorkerFactory(() => { started++; return fakeWorker(); });
    await expect(decodeHeic(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]))).rejects.toThrow(DecodeError);
    expect(started).toBe(0);
  });

  it('turns an error of the decoder into a message and still stops the worker', async () => {
    const worker = fakeWorker();
    setWorkerFactory(() => worker);
    await expect(decodeHeic(small().subarray(0, 200))).rejects.toThrow(DecodeError);
    expect(worker.terminated).toBe(true);
  });

  it('reports a worker that cannot be started, and does not decode in the page instead', async () => {
    setWorkerFactory(() => { throw new Error('blocked'); });
    await expect(decodeHeic(small())).rejects.toThrow('The photo decoder could not be started.');
  });

  it('reports a worker that dies, and stops it', async () => {
    let dying!: DecoderWorker & { terminated?: boolean };
    setWorkerFactory(() => {
      const w: DecoderWorker & { terminated?: boolean } = {
        onmessage: null,
        onerror: null,
        postMessage() { queueMicrotask(() => w.onerror?.(new Error('crash'))); },
        terminate() { w.terminated = true; },
      };
      dying = w;
      return w;
    });
    await expect(decodeHeic(small())).rejects.toThrow('The photo decoder stopped working.');
    expect(dying.terminated).toBe(true);
  });

  it('leaves the bytes it was given alone', async () => {
    setWorkerFactory(() => fakeWorker());
    const bytes = small();
    const copy = Uint8Array.from(bytes);
    await decodeHeic(bytes);
    expect([...bytes]).toEqual([...copy]);
  });
});
