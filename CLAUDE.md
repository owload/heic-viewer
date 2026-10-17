# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

`@owload/heic-viewer` — the HEIC photo viewer of Owload, a **view-only extension** that follows the contract of
`@owload/editor-sdk` (`owload-docs/decisions/0019-editor-extensions.md`, `0026-view-only-extensions-and-avi-viewer.md` and `0027-third-party-code-in-extensions-and-heic-viewer.md`).
It decodes HEIC/HEIF photos with libheif (WebAssembly), in a worker of its own, and draws them on a canvas. The host (`owload-frontend`) is separate; never edit it
from here. See `README.md`.

## Rules

- **Do not commit or push unless the owner explicitly asks** (each time; a past instruction does not carry over).
  Leave the work uncommitted and report.
- **English only** in code, comments, UI strings, docs and commit messages.
- Commit identity is `Owload <info@owload.com>` only — no `Co-Authored-By` or generated-by lines; pass it per
  commit: `git -c user.name=Owload -c user.email=info@owload.com commit ...`.
- **Before every push check the diff:** no sensitive data (secrets, tokens, keys, `.env` values, real hostnames or
  IPs, personal data, machine paths), and security does not get worse. The viewer sees the plaintext of the user's
  files, and the photo is untrusted input: the first bytes are checked before libheif starts, and every failure of the
  decoder becomes a `DecodeError` (never a hang or another error); the decoder is started afresh after a failure.
- **Security comes first:** the only runtime dependency is `libheif-js`, an exact version (1.23.2), bundled (decision 0027,
  `THIRD-PARTY.md`); a bump is deliberate and its diff is reviewed, because libheif has had security fixes. No other
  dependency may be added without the same decision. No network access, no storage, no logging of content (the output of the
  WebAssembly module is switched off; the wrapper's short diagnostics about an unreadable file, which hold no content, are
  known and accepted, see `THIRD-PARTY.md`); nothing leaves the viewer; the contract's rules are checked by the SDK's conformance
  suite in `test/conformance.test.tsx` and must keep passing.
- libheif is imported only in `src/lib/decode-worker.ts`: nothing else may import it, and the decoder never runs in the page
  (if the worker cannot be started the viewer reports it).
- It is view-only: never dirty, never calls `onSave`. It has a close control in its own bar (`aria-label="Close"`,
  calls `onClose`).
- Keep it self-contained: no imports from the host app, no global CSS; every class is prefixed `hv-` and every
  selector is scoped under `.hv`.
- The SDK is pinned to an exact commit like in the other extensions; a bump is deliberate and its diff is reviewed.

## Commands

```bash
npm test | npm run lint | npm run typecheck | npm run build
```

Use Node >= 20 (`.nvmrc` = 22). The default `node` on this machine may be older; `/opt/homebrew/bin/node` is newer.

## Layout

```
src/extension.ts     the descriptor (plain object, type-only import from the SDK); load() and preview() are lazy chunks
src/heic-viewer.tsx  the component; src/heic-viewer.css its scoped styles
src/lib/             heif-core.ts (the decoder), decode-worker.ts (the only import of libheif), decode.ts (starts the
                     worker), preview.ts; src/libheif.d.ts the types of the part of libheif-js in use
test/                fixtures/ (two synthetic HEIC files), decoding and damage tests, the SDK conformance suite
```
