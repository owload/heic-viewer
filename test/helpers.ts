import { answer, createDecoder, type WorkerRequest } from '../src/lib/heif-core';
import type { DecoderWorker } from '../src/lib/decode';

const startLibheif = () => import('libheif-js/libheif-wasm/libheif-bundle.mjs').then((m) => m.default({ print: () => undefined, printErr: () => undefined }));

/** The decoder of the worker, run in the test's own thread. */
export const directDecoder = () => createDecoder(startLibheif);

/** A stand-in for the worker: the same decoder and the same messages, in this thread (happy-dom has no Worker). */
export function fakeWorker(decode = directDecoder()): DecoderWorker & { terminated: boolean; requests: WorkerRequest[] } {
  const worker = {
    terminated: false,
    requests: [] as WorkerRequest[],
    onmessage: null as DecoderWorker['onmessage'],
    onerror: null as DecoderWorker['onerror'],
    postMessage(message: unknown) {
      const request = message as WorkerRequest;
      worker.requests.push(request);
      void answer(decode, request).then((response) => worker.onmessage?.({ data: response }));
    },
    terminate() { worker.terminated = true; },
  };
  return worker;
}
