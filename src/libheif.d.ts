/** The parts of libheif-js (the WebAssembly bundle) that the viewer uses. */
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  export interface HeifImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  }
  export interface HeifImage {
    get_width(): number;
    get_height(): number;
    /** Writes the pixels (RGBA) into `target` and calls back with it, or with a falsy value on failure. */
    display(target: HeifImageData, callback: (result: HeifImageData | null) => void): void;
    free?(): void;
  }
  export interface HeifModule {
    HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] };
  }
  /** Starts the WebAssembly module (the binary is embedded in the script: nothing is fetched). */
  const factory: (options?: Record<string, unknown>) => Promise<HeifModule>;
  export default factory;
}
