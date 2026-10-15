# Notes for AI Agents

Read `README.md` before looking at source or type files.

## Key facts that are easy to miss

**Two main classes: `MdzArchiveCore` and `MdzPackagerCore`**

- `MdzArchiveCore`: Read and validate existing `.mdz` archives. Operate on archive bytes.
- `MdzPackagerCore`: Build new archives, manage paths, create manifests, pack directories into `.mdz` format.

**Static vs Instance methods**

Most operations are static (e.g., `MdzArchiveCore.open()`, `MdzArchiveCore.addFile()`). Instance methods operate on an already-opened `MdzArchiveCore` object. Static methods accept archive bytes; instance methods work with the open archive.

**Paths are case-sensitive (spec 1.2.0 §5.4.1)**

Archive paths are compared case-sensitively after Unicode NFC normalization. `index.md` and `Index.md` are different entries; `findCaseOnlyMatch()` suggests the near match for an error message. Never fall back to a case-insensitive match silently.

**Entry point resolution**

Consumers don't require `manifest.json`, but producers always write one with `entryPoint`. Resolution (§5.5): manifest `entryPoint` (an invalid value is `ERR_ENTRYPOINT_INVALID`, a missing file `ERR_ENTRYPOINT_MISSING`, never a fallback); else `index.md`; else the single root Markdown file once support files (README, AGENTS, LICENSE, CHANGELOG, CONTRIBUTING) are set aside. Call `resolveEntryPoint()`.

**Spec rules live in `src/spec.ts`**

Path validation/matching, manifest checks and link resolution are pure functions there, ported from (and kept in step with) `mdzip-core-python`. `tests/spec-1.2-fixtures.test.mjs` runs the spec's shared fixtures against them.

**Mutation returns new bytes, not mutated archives**

`MdzArchiveCore.addFile()`, `removeFile()`, etc. return new archive bytes. They do NOT mutate the input. This is important for immutable workflows.

**Workspace shape**

`openWorkspace()` returns a flattened `MdzWorkspace` object with `documents` and `assets` arrays, not the nested directory structure of the archive. Assets expose `readBytes` and `readDataUri` for lazy loading.

**Validation is lax by default**

`validate()` returns warnings but not errors for common issues (missing manifest, missing entry point). Check `getValidationStatus()` to convert to a single status value.

**Orphaned asset detection is O(n²)**

`findOrphanedAssets()` scans all markdown files against all images. For large archives with many assets, this is slow. Cache the result if needed across multiple calls.
