# Synced with Spec v1.1.0

MDZip Core JS `v1.1.0` aligns the library with MDZip spec `1.1.0` and adds explicit archive mode support for both reading and packaging workflows.

## Highlights

- Syncs generated and validated manifests to spec `1.1.0`.
- Adds `manifest.mode` support with `document` and `project` handling.
- Exposes `resolveMode()` for archive consumers.
- Preserves valid user-supplied `manifest.json` data during archive builds.
- Adds advisory packaging warnings when multiple Markdown files rely on implicit document mode.
- Normalizes generated text-file line endings during packaging.
- Updates producer metadata to identify `mdzip-core-js` and the canonical GitHub repository URL.

## What Changed

- `MdzArchiveCore.validateManifest()` is now public.
- Manifest validation now rejects unsupported `mode` values.
- Generated manifests now use `mdzip-spec` and include core producer `name`, `version`, and `url`.
- `MdzPackagerCore.buildManifestFromOptions()` now supports explicit `mode`.
- `MdzPackagerCore.buildArchive()` now reads and validates a provided `manifest.json` when no generated manifest is needed.
- `MdzPackagerCore.buildArchive()` now warns when multi-Markdown archives omit `manifest.mode`.
- `MdzPackagerCore.buildArchive()` now writes text-based files with normalized LF line endings.
- README and package metadata now consistently use `mdzip-core-js`.

## Upgrade Notes

- If your archive contains multiple Markdown files that represent a project, set `manifest.mode` to `project`.
- If you previously relied on `markdownzip-spec`, generated manifests now emit `mdzip-spec`.
- Consumers providing custom `manifest.json` content should ensure `mode`, when present, is exactly `document` or `project`.

## Verification

- Local test coverage was expanded for mode resolution, provided manifest handling, packaging warnings, and `1.1.0` manifest metadata.
