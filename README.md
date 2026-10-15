# mdzip-core-js

[![npm](https://img.shields.io/npm/v/@mdzip/core-js)](https://www.npmjs.com/package/@mdzip/core-js)

Core TypeScript/JavaScript library for MDZip (`.mdz`) archives.

Current scope (core only):
- open/unpack archive data
- public archive listing/read APIs (`listPaths`, `listEntries`, `readText`, `readBytes`, `readBase64`, `readDataUri`)
- manifest validation per MDZip spec `1.2.0` (critical vs. descriptive fields, duplicate members)
- entry-point resolution (`ERR_ENTRYPOINT_INVALID` vs `ERR_ENTRYPOINT_MISSING`, support files set aside)
- link resolution inside, out of and into archives (`resolveLink`)
- archive conformance validation (`errors` + `warnings`)
- archive mutation helpers (`addFile`, `removeFile`, `removeFiles`) with entry-point safety
- orphaned image analysis (`findOrphanedAssets`) for cleanup workflows
- path validation + resolution
- package build helpers, including explicit `mode` support and advisory packaging warnings

ZIP runtime note:
- This release line uses `@progress/jszip-esm` for ESM-compatible ZIP operations.

## Install

```bash
npm install mdzip-core-js
```

## Usage

```ts
import { MdzArchiveCore } from 'mdzip-core-js';

const archive = await MdzArchiveCore.open(fileOrArrayBuffer);
const entryPoint = await archive.resolveEntryPoint();
const manifest = await archive.readManifest();
const paths = archive.listPaths();
const markdown = await archive.readText(entryPoint);

const orphaned = await MdzArchiveCore.findOrphanedAssets(fileOrArrayBuffer);
if (orphaned.orphanedAssetPaths.length > 0) {
	await MdzArchiveCore.removeFiles(fileOrArrayBuffer, orphaned.orphanedAssetPaths);
}
```

## Spec 1.2.0 behaviour

This release implements MDZip spec [1.2.0](https://github.com/mdzip-project/mdzip-spec/releases/tag/v1.2.0) and runs its shared fixtures (`tests/fixtures`, synced with `mdzip-spec/tools/sync-fixtures.mjs --ref v1.2.0`). Things to know when upgrading:

- **Paths are case-sensitive** after Unicode NFC normalization (§5.4.1): `Index.md` no longer finds `index.md`. Use `archive.findCaseOnlyMatch(path)` to suggest the near match after a failed lookup.
- **Entry names are checked on open**: two entries equal after NFC (`ERR_DUPLICATE_PATH`) or a file that is also a directory (`ERR_PATH_CONFLICT`) make `open()` throw; a compression method other than stored/DEFLATE is `ERR_ZIP_INVALID`.
- **Symbolic link entries** are skipped and never followed: they're not in `listPaths()`, can't be read, are listed by `listSpecialFiles()` and reported by `validate()`. Mutations keep them unless `dropSpecialFiles: true`.
- **Manifests**: an invalid critical field (`spec`, `spec.version`, `mode`, `entryPoint`) throws; an invalid descriptive field is left out of `readManifest()` and reported by `validate()`. `null` counts as a wrong type.
- **Producers always write `manifest.json`** with `spec.version` `1.2.0`, `entryPoint`, `title` and `mode`, and never write `null` placeholders. `updateFiles()` adds a manifest to an archive without one, keeps every existing manifest field, and throws `ERR_ENTRYPOINT_CHANGED` if a change would move the entry point (set `entryPoint` in the manifest to move it on purpose).
- **Line endings**: only Markdown files and `manifest.json` are normalized to LF when written (§12.2); other files are stored as given.
- The pure rules are exported too: `pathProblem`, `entrySetProblem`, `samePath`, `checkManifest`, `parseManifestText`, `resolveLink`.

## Workspace API

App shells and embedded editors can open an archive as a normalized workspace model:

```ts
import { MdzArchiveCore, MdzPackagerCore } from 'mdzip-core-js';

const workspace = await MdzArchiveCore.openWorkspace(fileOrArrayBuffer, {
	includeOrphanedAssetAnalysis: true
});

workspace.documents[0].text = '# Updated\n';
const saved = await MdzPackagerCore.buildWorkspace(workspace, {
	title: 'Updated document'
});
```

Workspace assets include byte size, MIME type, broad asset kind, previewability, and lazy byte/data-URI readers. `buildWorkspace()` can round-trip assets opened through `openWorkspace()` or assets created with `MdzPackagerCore.createWorkspaceAssetFromFile()`.

Manifest helpers are also available for app-safe metadata editing:

```ts
const manifest = MdzPackagerCore.updateManifest(workspace.manifest, {
	author: 'Ada',
	description: 'Project notes'
});

const { editable, reserved } = MdzPackagerCore.splitManifestMetadata(manifest);
```

## Node Filesystem API

Node applications can package a directory or extract an archive using the
Node-only export. Files are processed recursively and archive-relative paths are
preserved.

```ts
import { extractArchive, packDirectory } from 'mdzip-core-js/node';

await packDirectory('./my-document', './my-document.mdz');
await extractArchive('./my-document.mdz', './my-document');
```

Both functions also return details for programmatic use:

```ts
import fs from 'node:fs/promises';

const packed = await packDirectory('./project');
await fs.writeFile('project.mdz', new Uint8Array(await packed.blob.arrayBuffer()));

const extracted = await extractArchive(archiveBytes, './output', {
	overwrite: true
});
console.log(extracted.extractedPaths);
```

`packDirectory()` rejects symbolic links and includes all regular files by
default. Core packaging behavior can be customized with `packOptions`:

```ts
await packDirectory('./project', './project.mdz', {
	rootName: 'Project',
	packOptions: {
		mode: 'project',
		entryPoint: 'docs/index.md',
		createIndex: false,
		filters: ['**/*.md', '**/*.png']
	}
});
```

`extractArchive()` rejects absolute paths, path traversal, normalized path
collisions, and attempts to write through symbolic links. Existing files are
preserved unless `overwrite: true` is supplied.

## Build

```bash
npm install
npm run build
```
