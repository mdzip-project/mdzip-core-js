# mdzip-core-js

Core TypeScript/JavaScript library for MDZip (`.mdz`) archives.

Current scope (core only):
- open/unpack archive data
- manifest validation (MDZip spec `1.1.0` aligned, including `manifest.mode`)
- entry-point resolution
- archive conformance validation (`errors` + `warnings`)
- archive mutation helpers (`addFile`, `removeFile`) with entry-point safety
- path validation + resolution
- package build helpers, including explicit `mode` support and advisory packaging warnings

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
```

## Build

```bash
npm install
npm run build
```
