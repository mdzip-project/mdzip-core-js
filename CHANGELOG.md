# Changelog

## [2.0.0] - 2026-10-14

Implements MDZip spec **1.2.0** (issue #4) and runs all of its shared fixtures,
synced to the `v1.2.0` tag. A major version because several changes alter
behaviour callers may rely on; see the README's "Spec 1.2.0 behaviour" section.

### Migrating from 1.x
- Path lookups (`findEntry`, `hasEntry`, `read*`, `removeFiles`) are now
  case-sensitive. Use the exact stored path; `findCaseOnlyMatch()` can suggest it.
- `open()` can throw `ERR_DUPLICATE_PATH`, `ERR_PATH_CONFLICT` or `ERR_ZIP_INVALID`.
- Archives written by `buildArchive`/`buildWorkspace`/`updateFiles` always contain
  `manifest.json`.
- `updateFiles` can throw `ERR_ENTRYPOINT_CHANGED`; pass a manifest with the new
  `entryPoint` to move the entry point on purpose.
- `readManifest()` leaves out descriptive fields with invalid values instead of
  throwing; `"entryPoint": null` now throws `ERR_ENTRYPOINT_INVALID`.
- Non-Markdown text files keep their line endings when written.

### Added
- `src/spec.ts`, exported: `pathProblem`, `entrySetProblem`, `samePath`,
  `findPath`, `checkManifest`, `parseManifestText`, `findDuplicateMembers`,
  `entryPointProblem`, `coverProblem`, `resolveLink` (§9.3–9.6, including the
  trust boundary and embeds) and `mdzErrorCode`.
- `MdzArchiveCore`: `resolveLink()`, `listSpecialFiles()`, `findCaseOnlyMatch()`,
  `pathProblem()`.
- `MdzUpdateFilesOptions.dropSpecialFiles`.
- Tests for manifest cases (T-012), entry sets (T-013), path matching (T-009),
  link resolution (T-011), round trips (P-004, P-005) and the archive cases
  (T-014, T-015, T-017, P-008).

### Changed
- Paths are compared case-sensitively after NFC normalization everywhere
  (lookups, removals, writes, orphan analysis, cover, workspace) (§5.4.1).
- `open()` throws `ERR_DUPLICATE_PATH` / `ERR_PATH_CONFLICT` (§5.4, §13.1) and
  `ERR_ZIP_INVALID` for compression methods other than 0 and 8 or an unreadable
  ZIP (§4).
- Symbolic link entries are skipped, never followed, and reported (§4, §13.1).
- Manifest validation follows §6.4: critical fields throw; invalid descriptive
  fields are ignored (left out of `readManifest()`, reported by `validate()`);
  `null` is a wrong type (`"entryPoint": null` is `ERR_ENTRYPOINT_INVALID`);
  duplicate members are reported. Timestamps must be RFC 3339; `spec.version`
  uses the semver.org grammar.
- Path validation rejects empty and `.` segments (`ERR_PATH_INVALID`).
- Producers always write `manifest.json` with `spec.version` `1.2.0`,
  `entryPoint`, `title` and `mode`; no `null` placeholders, and no default
  `language: "en"` (§6.2: an omitted language is unspecified).
- `updateFiles()` keeps the existing manifest as read (unknown and ignored fields
  survive, §6.3), adds a manifest to an archive without one, and throws
  `ERR_ENTRYPOINT_CHANGED` if a change would move the entry point (§14.1).
- Paths are written in NFC.
- Line endings are normalized only for Markdown files and `manifest.json` (§12.2).

## [1.5.0] - 2026-09-07

### Added
- `MdzArchiveCore.extractImageReferences(markdown)` is now a **public** static
  method — the single canonical extractor for image targets referenced from a
  block of Markdown, covering both `![alt](target)` syntax and raw
  `<img src="target">` tags. Other MDZip packages should call this instead of
  keeping their own copy of the regexes (a previous raw-`<img src>` fix,
  mdzip-editor#24, had to be applied in several independent copies). Targets are
  returned raw and unresolved, with surrounding `<...>` and Markdown title text
  stripped.

### Changed
- `MdzArchiveCore.deflateRawBytes()` now compresses with `fflate`
  (`deflateSync`) instead of the browser's `CompressionStream('deflate-raw')`.
  In a VS Code webview (Electron/Chromium) each `CompressionStream` call carried
  a fixed ~2s overhead — invisible under Node/jsdom, where it silently no-op'd —
  adding up to ~24s to build a single 88KB `.mdz` from an 11-file workspace.
  `fflate`'s path is synchronous pure JS with no per-call environment overhead
  and needs no feature detection. Adds `fflate` as a runtime dependency.
- `MdzArchiveCore` derives per-entry uncompressed sizes lazily on the first
  `listEntries()` call instead of rescanning the ZIP central directory on every
  `open()`. The constructor's optional second argument is now the raw archive
  bytes (`rawBytes`) rather than a precomputed size map; `MdzArchiveCore.open()`
  — the supported entry point — is unchanged.

## [1.4.0] - 2026-08-02

### Added
- Browser IIFE bundle (`dist/mdzip-core.iife.min.js`, global `MdzipCore`) built
  with esbuild (`npm run build:browser`), for consumers that need the library
  outside an ESM bundler pipeline (e.g. a Tampermonkey userscript loading it
  via `@require` from a CDN). Same public API as the ESM `dist/index.js`
  entry; no changes to existing exports or consumers.

## [1.3.3] - 2026-07-03

### Fixed
- `findOrphanedAssets()` now recognizes images referenced only via raw HTML
  `<img src>` tags, not just markdown `![]()` syntax, so they're no longer
  misreported as orphaned.

## [1.3.2] - 2026-06-19

### Added
- `MdzPackagerCore.buildArchive()` accepts an optional `onProgress` callback for
  best-effort archive-generation progress from the underlying ZIP writer, plus a
  new exported `MdzPackProgress` type (`percent`, optional `currentFile`). Lets
  hosts surface packing progress for large archives (issue #17).

## [1.3.1] - 2026-06-14

### Performance
- `openWorkspace()` now reads uncompressed asset sizes from ZIP central
  directory metadata instead of extracting every asset during open.
- `MdzArchiveEntryInfo.byteSize` exposes that metadata when available while
  preserving extraction fallback support for custom ZIP loaders.

## [1.3.0] - 2026-06-11

Consolidates the previously unreleased 1.2.7–1.2.9 working-tree changes and
aligns the version with `@mdzip/editor` 1.3.0.

### Added
- Lazy document readers: `openWorkspace(bytes, { includeLazyDocumentReaders: true })`
  defers non-entry-point document text behind a `readText()` closure, with an
  `isLazy` flag that survives serialization boundaries so a dropped reader can
  be distinguished from a genuinely empty document. `buildWorkspace` resolves
  lazy readers instead of writing empty files, and throws when a lazy document
  lost its reader.
- Byte-level archive patching: `MdzArchiveCore.updateFiles(bytes, writes,
  removals, { manifest })` applies writes, removals, and an optional manifest
  override in a single pass that copies unchanged entries verbatim —
  serializing large archives in milliseconds instead of recompressing every
  document. `MdzArchiveCore.removeFiles()` covers the removal-only case.
  Both enforce path validity and entry-point integrity.
- `MdzArchiveWriteSpec` / `MdzUpdateFilesOptions` types for the new mutation
  APIs.
- STORE-aware ZIP writing for image assets (skips DEFLATE overhead on
  already-compressed formats), with raw-entry parsing, CRC-32, and DOS
  date-time helpers supporting the byte-level patcher.
- Producer manifests now include `spec.version`; `CORE_LIBRARY_VERSION` is
  asserted against `package.json` in the test suite.

## [1.2.6] - 2026-06-08

Last release published from a committed tree; see git history for 1.x
details (STORE compression for images, `isImagePath` helper, entry-point
resolution and validation work).
