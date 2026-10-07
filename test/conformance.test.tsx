import { runConformanceTests } from '@owload/editor-sdk/testing';
import { beforeAll } from 'vitest';
import { extension } from '../src/extension';
import { setWorkerFactory } from '../src/lib/decode';
import { small } from './fixtures';
import { fakeWorker } from './helpers';

// happy-dom has no canvas drawing: stand in for the two pieces the viewer calls.
beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.ImageData ??= class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} };
  // no Worker in happy-dom: a stand-in that runs the same decoder with the same messages
  setWorkerFactory(() => fakeWorker());
  HTMLCanvasElement.prototype.getContext = (() => ({ putImageData: () => undefined })) as unknown as HTMLCanvasElement['getContext'];
});

runConformanceTests(extension, {
  sample: small(),
  // Ready once the viewer has stopped decoding (it shows the picture, or why there is none).
  ready: (container) => !!container.querySelector('.hv') && !container.querySelector('[role="status"]'),
  timeoutMs: 15000,
});
