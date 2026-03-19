# mdz-core-js

Core TypeScript/JavaScript library for MarkdownZip (`.mdz`) archives.

Current scope (core only):
- open/unpack archive data
- manifest validation (MarkdownZip spec `1.0.1-draft` aligned)
- entry-point resolution
- archive conformance validation (`errors` + `warnings`)
- archive mutation helpers (`addFile`, `removeFile`) with entry-point safety
- path validation + resolution
- package build helpers

## Install

```bash
npm install mdz-core-js
```

## Usage

```ts
import { MdzArchiveCore } from 'mdz-core-js';

const archive = await MdzArchiveCore.open(fileOrArrayBuffer);
const entryPoint = await archive.resolveEntryPoint();
const manifest = await archive.readManifest();
```

## Build

```bash
npm install
npm run build
```
