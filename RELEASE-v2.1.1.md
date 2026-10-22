Fixes a slowdown in 2.1.0. Install with `npm install @mdzip/core-js@2.1.1`.

### Fixed
- **`openWorkspace()` is fast again on large archives.** 2.1.0's new missing-image check
  in `validate()` read every Markdown file, and `openWorkspace()` runs `validate()`, so
  opening a workspace no longer left documents unread until opened. On a 120 MB archive,
  `@mdzip/editor`'s open, save and edits took about 20 s each instead of under 1 s.
  `openWorkspace()` now skips the image check.

### Added
- `validate()` and `MdzArchiveCore.validate()` take `{ checkImages: false }` to skip the
  image check (it's on by default).
