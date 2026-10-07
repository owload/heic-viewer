import { describe, expect, it } from 'vitest';
import { DecodeError, MAX_PIXELS, looksLikeHeif } from '../src/lib/decode';
import { directDecoder } from './helpers';
import { fitSize } from '../src/lib/preview';
import { large, pixel, small } from './fixtures';

const near = (actual: number[], expected: number[], tolerance = 12) =>
  expected.forEach((value, i) => expect(Math.abs(actual[i] - value), `channel ${i}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance));

const decodeHeic = directDecoder();

describe('decoding', () => {
  it('decodes a small photo to its size and colours', async () => {
    const picture = await decodeHeic(small());
    expect([picture.width, picture.height]).toEqual([640, 480]);
    expect(picture.data.length).toBe(640 * 480 * 4);
    near(pixel(picture, 320, 240), [250, 219, 88]); // the yellow disc
    near(pixel(picture, 100, 80), [27, 27, 26]); // the dark block
    near(pixel(picture, 4, 470), [1, 252, 252]); // bottom left: no red, much green, much blue
    near(pixel(picture, 635, 470), [252, 252, 3]); // bottom right: much red, much green, no blue
    expect(pixel(picture, 10, 10)[3]).toBe(255);
  });

  it('decodes a phone-sized photo made of tiles', async () => {
    const picture = await decodeHeic(large());
    expect([picture.width, picture.height]).toEqual([4032, 3024]);
    near(pixel(picture, 4, 4), [1, 1, 254]);
    near(pixel(picture, 4028, 4), [253, 1, 2]);
    near(pixel(picture, 2016, 1512), [127, 127, 128], 14);
    near(pixel(picture, 4028, 3020), [253, 253, 2]);
  });

  it('can decode again and again (the decoder is reused)', async () => {
    for (let i = 0; i < 3; i++) expect((await decodeHeic(small())).width).toBe(640);
  });
});

describe('what is not a photo', () => {
  it('recognises a HEIF file by its first bytes', () => {
    expect(looksLikeHeif(small())).toBe(true);
    expect(looksLikeHeif(large())).toBe(true);
    expect(looksLikeHeif(new Uint8Array(0))).toBe(false);
    expect(looksLikeHeif(new TextEncoder().encode('plain text, not a photo at all'))).toBe(false);
    expect(looksLikeHeif(Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50, 0, 0, 0, 0, 109, 112, 52, 50]))).toBe(false); // an MP4
  });

  it('refuses garbage with a message, without starting the decoder', async () => {
    await expect(decodeHeic(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]))).rejects.toThrow(DecodeError);
  });

  it('refuses a photo that is cut short', async () => {
    const data = small();
    for (const length of [20, 60, 200, Math.floor(data.length / 2), data.length - 100]) {
      await expect(decodeHeic(data.subarray(0, length)), `cut at ${length}`).rejects.toThrow(DecodeError);
    }
  });

  it('ends in a DecodeError, never another error, for random damage, and keeps working afterwards', async () => {
    let seed = 987654;
    const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 2 ** 32; };
    const source = small();
    let decoded = 0;
    for (let round = 0; round < 120; round++) {
      const data = Uint8Array.from(source);
      const hits = 1 + Math.floor(rnd() * 12);
      for (let i = 0; i < hits; i++) data[40 + Math.floor(rnd() * (data.length - 40))] = Math.floor(rnd() * 256);
      try {
        await decodeHeic(data);
        decoded++;
      } catch (e) {
        expect(e, `round ${round}: ${String(e)}`).toBeInstanceOf(DecodeError);
      }
    }
    expect(decoded).toBeLessThan(120);
    expect((await decodeHeic(small())).width).toBe(640); // an undamaged file still decodes
  }, 60000);

  it('limits the size of a photo it will decode', () => {
    expect(MAX_PIXELS).toBeGreaterThanOrEqual(48_000_000); // a 48 megapixel phone photo
  });
});

describe('preview sizes', () => {
  it('fits the longer side and never enlarges', () => {
    expect(fitSize(4032, 3024, 360)).toEqual({ width: 360, height: 270 });
    expect(fitSize(3024, 4032, 360)).toEqual({ width: 270, height: 360 });
    expect(fitSize(200, 100, 360)).toEqual({ width: 200, height: 100 });
    expect(fitSize(10000, 1, 360)).toEqual({ width: 360, height: 1 });
  });
});

describe('no network', () => {
  it('starts and runs the decoder without any request', async () => {
    const { vi } = await import('vitest');
    vi.resetModules(); // a cold start, as the first photo of a page
    const calls: string[] = [];
    const g = globalThis as unknown as Record<string, unknown>;
    const saved = { fetch: g.fetch, XMLHttpRequest: g.XMLHttpRequest, WebSocket: g.WebSocket, sendBeacon: (navigator as unknown as Record<string, unknown>).sendBeacon };
    g.fetch = (...args: unknown[]) => { calls.push(`fetch ${String(args[0])}`); return Promise.reject(new Error('blocked')); };
    g.XMLHttpRequest = class { constructor() { calls.push('XMLHttpRequest'); } };
    g.WebSocket = class { constructor() { calls.push('WebSocket'); } };
    (navigator as unknown as Record<string, unknown>).sendBeacon = () => { calls.push('sendBeacon'); return false; };
    try {
      const fresh = (await import('./helpers')).directDecoder();
      const picture = await fresh(small());
      expect(picture.width).toBe(640);
    } finally {
      Object.assign(g, { fetch: saved.fetch, XMLHttpRequest: saved.XMLHttpRequest, WebSocket: saved.WebSocket });
      (navigator as unknown as Record<string, unknown>).sendBeacon = saved.sendBeacon;
    }
    expect(calls).toEqual([]);
  }, 30000);
});
