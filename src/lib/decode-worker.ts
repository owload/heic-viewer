/// <reference lib="webworker" />
// The entry of the decoder worker (built into the extension and started from a blob: URL; see decode.ts). libheif lives
// only here: a worker has no access to the page, its DOM, or its localStorage.
import startLibheif from 'libheif-js/libheif-wasm/libheif-bundle.mjs';
import { answer, createDecoder, type WorkerRequest } from './heif-core';

// The output of the WebAssembly module itself is dropped. The JavaScript wrapper of libheif-js still writes a short
// diagnostic to the console when a file cannot be read ("Could not parse HEIF file ..."): the reason, never content.
const decode = createDecoder(() => startLibheif({ print: () => undefined, printErr: () => undefined }));

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const response = await answer(decode, event.data);
  if (response.ok) self.postMessage(response, [response.data.buffer]);
  else self.postMessage(response);
};
