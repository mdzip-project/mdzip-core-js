# Plan: Core Support for Removing Orphaned MDZip Assets

## Summary

The VS Code extension can currently add or replace embedded image assets, but it has no way to remove assets that are no longer referenced by the Markdown. Users can accumulate stale files inside `.mdz` archives after editing or replacing images.

`mdzip-core-js` already exposes `MdzArchiveCore.removeFile(input, archiveEntryPath)`, which is the right low-level primitive for deleting one archive entry. To support reliable orphan cleanup across clients, core should add the missing reusable pieces: batch removal and archive-aware asset reference analysis. The VS Code extension should own the UI/confirmation flow.

## Core Changes

- Add a batch mutation API:

  ```ts
  MdzArchiveCore.removeFiles(input, archiveEntryPaths): Promise<MdzArchiveMutationResult>
  ```

  It should normalize paths, reject invalid paths, remove entries case-insensitively like `removeFile`, preserve existing mutation behavior, and finalize the archive once instead of rezipping per file.

- Add an archive analysis API:

  ```ts
  MdzArchiveCore.findOrphanedAssets(input, options?): Promise<MdzOrphanedAssetsResult>
  ```

  It should identify asset entries, find Markdown references from the selected entry point by default, resolve relative paths with existing `resolvePath`, and return referenced vs orphaned asset paths.

- Treat these as assets for v1 orphan detection: image paths recognized by `MDZ_IMAGE_MIME_TYPES`. Do not delete Markdown, manifest, or arbitrary binary files in the first version.

- Count these as references: Markdown image syntax, including relative paths from the Markdown entry location, plus `manifest.cover` when present and valid.

- Do not make core delete anything automatically from analysis. Cleanup should remain a two-step caller flow: analyze, then remove selected orphan paths.

## Extension Follow-Up

- VS Code should call `findOrphanedAssets`, show the orphan list to the user, confirm deletion, then call `removeFiles`.
- The extension should mark the document dirty, refresh archive contents/images, and require normal Save to persist the cleanup.
- The extension should not implement its own independent orphan detection once core provides this.

## Test Plan

- Core unit tests for `removeFiles`: remove multiple image entries, preserve remaining entries, handle case-insensitive matches, reject invalid paths, and prevent deleting the resolved entry point.
- Core unit tests for orphan analysis: referenced image remains referenced, unreferenced image is orphaned, relative paths resolve from nested Markdown, missing references are ignored, and `manifest.cover` keeps an otherwise unreferenced image.
- Integration scenario: archive with `index.md`, two images, and one stale image returns exactly the stale image as orphaned; passing that path to `removeFiles` removes it while archive validation still passes.

## Assumptions

- `mdzip-core-js` remains UI-agnostic; no prompts, confirmations, or editor state live in core.
- Initial orphan cleanup is image-only because that matches current extension asset behavior.
- Existing `removeFile` stays public for single-entry callers; `removeFiles` is additive.
