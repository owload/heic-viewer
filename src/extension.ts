import type { EditorExtension } from '@owload/editor-sdk';

/**
 * The descriptor the host loads eagerly (owload-docs/decisions/0019, 0026, 0027). It is a plain object and only the type
 * comes from the SDK; the host validates it. The viewer and the photo decoder (libheif, about 2 MB with its WebAssembly
 * binary) are separate chunks, loaded when a HEIC file is opened or its thumbnail is made.
 */
export const extension = {
  apiVersion: 1,
  id: 'heic',
  label: 'HEIC photo',
  fileExtensions: ['heic', 'heif'],
  // It only shows the photo.
  viewOnly: true,
  // The decoded picture takes four bytes a pixel on top of the file.
  maxFileBytes: 100 * 1024 * 1024,
  load: () => import('./heic-viewer').then((m) => ({ default: m.HeicViewer })),
  // The photo scaled to the thumbnail size; null where there is no canvas or the file cannot be decoded.
  preview: (data: Uint8Array, options: { size: number }) =>
    import('./lib/preview').then((m) => m.renderHeicPreview(data, options.size)),
} satisfies EditorExtension;
