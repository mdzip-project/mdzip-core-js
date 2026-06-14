# Changelog

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
