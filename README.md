# mdzip-core-js

Core TypeScript/JavaScript library for MDZip (`.mdz`) archives.

Current scope (core only):
- open/unpack archive data
- public archive listing/read APIs (`listPaths`, `listEntries`, `readText`, `readBytes`, `readBase64`, `readDataUri`)
- manifest validation (MDZip spec `1.1.0` aligned, including `manifest.mode`)
- entry-point resolution
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

## Build

```bash
npm install
npm run build
```
