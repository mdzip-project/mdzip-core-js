# Synced with Spec v1.2.0

MDZip Core JS `v2.0.0` implements MDZip spec [`1.2.0`](https://github.com/mdzip-project/mdzip-spec/releases/tag/v1.2.0) and passes all of its shared conformance fixtures. It's a major release because several behaviours change; see **Migrating from 1.x** below.

## Highlights

- **Spec rules as functions** (`src/spec.ts`, exported): path validation and matching, manifest checks (§6.4) and link resolution inside, out of and into archives (§9.3–9.6, with a trust boundary).
- **Case-sensitive paths** after Unicode NFC normalization (§5.4.1), with `findCaseOnlyMatch()` for "did you mean" messages.
- **Safer reading**: NFC-duplicate entries, file/directory conflicts and unsupported compression methods are rejected; symbolic link entries are skipped, never followed, and reported (`listSpecialFiles()`).
- **Manifests**: invalid critical fields are errors, invalid descriptive fields are ignored and reported, duplicate members are reported.
- **Conforming producer**: every archive gets `manifest.json` with `spec.version` `1.2.0`, `entryPoint`, `title` and `mode`; edits keep every existing manifest field and every untouched entry, add a manifest when missing, and never silently move the entry point.

## Migrating from 1.x

- Path lookups (`findEntry`, `hasEntry`, `read*`, `removeFiles`) are case-sensitive. Use the exact stored path.
- `open()` can throw `ERR_DUPLICATE_PATH`, `ERR_PATH_CONFLICT` or `ERR_ZIP_INVALID`.
- Written archives always contain `manifest.json`.
- `updateFiles` can throw `ERR_ENTRYPOINT_CHANGED`; pass a manifest with the new `entryPoint` to move it on purpose.
- `readManifest()` leaves out invalid descriptive fields instead of throwing; `"entryPoint": null` is `ERR_ENTRYPOINT_INVALID`.
- Only Markdown files and `manifest.json` get LF line endings when written.

Full list: [CHANGELOG.md](CHANGELOG.md).
