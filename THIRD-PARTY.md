# Third-party code

The only runtime dependency of `@owload/heic-viewer` is **libheif-js**, bundled into the extension's build as
`dist/decode-*.js`, inside the script of a **dedicated worker** that is started from a `blob:` URL for each photo and stopped
after it (a worker has no access to the page: its DOM, its `localStorage`). Nothing is loaded from the network: the
WebAssembly binary is embedded in that script.

| Component | Version | Licence | Source |
|---|---|---|---|
| libheif-js (an Emscripten build of libheif) | 1.23.2 (exact, in `package.json`) | LGPL-3.0 | https://github.com/catdad-experiments/libheif-js |
| libheif (inside the build) | the one libheif-js 1.23.2 ships | LGPL-3.0 | https://github.com/strukturag/libheif |
| libde265 (the HEVC decoder inside libheif) | the one libheif-js 1.23.2 ships | LGPL-3.0 | https://github.com/strukturag/libde265 |

The libraries are used unmodified. The LGPL lets anyone replace them: the extension's source is public and the library is
a separate chunk with its own licence text (`node_modules/libheif-js/LICENSE`). The reasoning is in
[owload-docs/decisions/0027](https://github.com/owload/owload-docs/blob/main/decisions/0027-third-party-code-in-extensions-and-heic-viewer.md).

Known behaviour: when a file cannot be read, the JavaScript wrapper of libheif-js writes a short diagnostic with
`console.log` ("Could not parse HEIF file" and the reason libheif gives). It never contains pixels or other content of
the file. The library is not patched, so this stays; the output of the WebAssembly module itself is switched off.

Why 1.23.2 and not the newest: 1.23.5 was published three days before this was chosen; 1.23.2 is a month older and has the
same libheif and libde265 versions inside (1.0.15 for libde265). The binary and the glue of the two differ, and neither can be
read as a diff, so the choice is about time in public use. Raise it on purpose, not automatically.

Rules for a version bump: change the exact version on purpose, read the changes of libheif-js and libheif since the last
version (libheif has had security fixes), look at the diff of the built script, and run the tests (they decode real files and
damaged ones) and the SDK conformance suite.
