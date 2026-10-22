Implements MDZip spec 1.2.0. Install with `npm install @mdzip/core-js@2.1.0`.

### Added
- **`MdzError`**: every error with a spec code is now an `MdzError` (a subclass of
  `Error`) with the code in `code` (#5). Messages are unchanged and still start with the
  code, so code that reads the message keeps working; `mdzErrorCode()` prefers `code`.
- **`application` option** on `buildArchive` and `buildWorkspace`: records the app writing
  the archive as `producer.application` (`name`, `version`, `url`; §6.2) next to
  `producer.core` (#6).
- **`validate()` warns about missing images**: an image a Markdown document uses
  (`![](…)` or `<img src>`) that isn't in the archive is a warning, with a suggestion when
  only the case differs (#7). Web, `data:` and outside-the-archive images aren't checked.

### Changed
- `ERR_ZIP_INVALID` for a file that isn't a ZIP now reads "The file is not a valid ZIP
  archive." The ZIP library's own message moved to `error.cause` (#5).

### Fixed
- `updateFiles` (and so `removeFile`/`removeFiles`) can remove directory entries
  (`folder/`). Before, removing one failed with `ERR_NOT_FOUND`, because removals were
  checked against file paths only, although writing a directory entry worked.

### Documentation
- README: the package is `@mdzip/core-js` (install and import examples said
  `mdzip-core-js`). New sections on showing a document with its images
  (`resolveLink` kinds, `use: 'embed'`, `readDataUri`), building an archive with
  `buildArchive` (required options, `filters`), and reading error codes.
