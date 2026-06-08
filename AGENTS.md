# Notes for AI Agents

Read `README.md` before looking at source or type files.

## Key facts that are easy to miss

**Two main classes: `MdzArchiveCore` and `MdzPackagerCore`**

- `MdzArchiveCore`: Read and validate existing `.mdz` archives. Operate on archive bytes.
- `MdzPackagerCore`: Build new archives, manage paths, create manifests, pack directories into `.mdz` format.

**Static vs Instance methods**

Most operations are static (e.g., `MdzArchiveCore.open()`, `MdzArchiveCore.addFile()`). Instance methods operate on an already-opened `MdzArchiveCore` object. Static methods accept archive bytes; instance methods work with the open archive.

**Paths are case-insensitive**

Archive paths are normalized and compared case-insensitively. `index.md` and `Index.md` refer to the same entry.

**Entry point resolution**

Manifest `entryPoint` is optional. If missing, the library infers it: first `.md` file in root, or `index.md` if present. Call `resolveEntryPoint()` to get the inferred path.

**Mutation returns new bytes, not mutated archives**

`MdzArchiveCore.addFile()`, `removeFile()`, etc. return new archive bytes. They do NOT mutate the input. This is important for immutable workflows.

**Workspace shape**

`openWorkspace()` returns a flattened `MdzWorkspace` object with `documents` and `assets` arrays, not the nested directory structure of the archive. Assets expose `readBytes` and `readDataUri` for lazy loading.

**Validation is lax by default**

`validate()` returns warnings but not errors for common issues (missing manifest, missing entry point). Check `getValidationStatus()` to convert to a single status value.

**Orphaned asset detection is O(n²)**

`findOrphanedAssets()` scans all markdown files against all images. For large archives with many assets, this is slow. Cache the result if needed across multiple calls.
