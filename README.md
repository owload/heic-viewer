# @owload/heic-viewer

A **view-only** HEIC/HEIF photo viewer for Owload, an extension that follows the contract of
[`@owload/editor-sdk`](https://github.com/owload/editor-sdk) (decisions
[0026](https://github.com/owload/owload-docs/blob/main/decisions/0026-view-only-extensions-and-avi-viewer.md) and
[0027](https://github.com/owload/owload-docs/blob/main/decisions/0027-third-party-code-in-extensions-and-heic-viewer.md)).
Chrome and Firefox cannot open `.heic` files (the format of iPhone photos), so the viewer decodes the photo with
**libheif** (WebAssembly) in a worker of its own and draws it on a canvas, scaled to fit the window. Nothing leaves the page.

## What it does

- Opens `.heic` and `.heif`: the first picture of the file, including big photos stored as tiles. Rotation and mirroring
  from the file are applied; colour profiles are not (the picture is shown as sRGB).
- Shows the size of the photo in its title bar, and a message (with a hint to download the file) for a file that is not
  HEIC, is damaged, or is larger than 64 megapixels.
- `preview()` draws the photo scaled to the thumbnail size, as a PNG; it returns `null` where there is no canvas or the file
  cannot be decoded.
- `maxFileBytes` is 100 MiB. The decoder is loaded only when a HEIC file is opened or its thumbnail is made (about 2 MB,
  700 KB compressed).
- **The decoder runs in a dedicated worker**, started for the photo and stopped after it: it cannot reach the DOM or the
  `localStorage` of the page. If the worker cannot be started the viewer says so; it never decodes in the page instead.
  (A Content-Security-Policy, if the application gets one, must allow `worker-src blob:`.)

## Third-party code

libheif-js 1.23.2 (LGPL-3.0), pinned to an exact version and bundled; see [THIRD-PARTY.md](THIRD-PARTY.md).

## Layout

```
src/extension.ts      the descriptor (viewOnly, maxFileBytes, lazy load and preview)
src/heic-viewer.tsx   the viewer: title bar with Close, the canvas, the messages; src/heic-viewer.css its scoped styles
src/lib/heif-core.ts   the decoder (libheif, first picture to RGBA, every failure becomes a DecodeError) and the worker's answer
src/lib/decode-worker.ts the worker entry: the only place libheif is imported
src/lib/decode.ts     starts a worker for a photo, gets the pixels back, stops the worker
src/lib/preview.ts    the thumbnail
src/libheif.d.ts      the types of the part of libheif-js that is used
test/                 two real HEIC files (test/fixtures), decoding, damaged files, the SDK conformance suite
```

## Development

```bash
npm install
npm test | npm run lint | npm run typecheck | npm run build
```

Needs Node 20 or newer (`.nvmrc` = 22). The test photos are synthetic gradients made on a Mac with
`sips -s format heic`; they hold nothing personal.
