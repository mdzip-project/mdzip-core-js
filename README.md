# mdz-core-js

[![CI](https://github.com/kylemwhite/mdz-core-js/actions/workflows/ci.yml/badge.svg)](https://github.com/kylemwhite/mdz-core-js/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/mdz-core-js.svg)](https://www.npmjs.com/package/mdz-core-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A TypeScript library for reading and rendering `.mdz` archives.

## Features

- 📦 Read and parse `.mdz` archive manifests
- 🖥️ Render archive content to HTML
- 🌲 Tree-shake friendly — import only what you use
- 📝 Full TypeScript types included
- ⚡ ESM-first with CJS compatibility

## Installation

```bash
npm install mdz-core-js
```

```bash
yarn add mdz-core-js
```

```bash
pnpm add mdz-core-js
```

## Usage

### ESM

```ts
import { parseManifest, createArchive, render } from 'mdz-core-js';

// 1. Parse an archive manifest
const manifest = parseManifest(JSON.stringify({
  version: '1',
  title: 'My Document',
  entries: [{ path: 'index.md', mimeType: 'text/markdown' }],
}));

// 2. Create an archive with entry content
const content = new TextEncoder().encode('# Hello, world!');
const archive = createArchive(manifest, new Map([['index.md', content]]));

// 3. Render to HTML
const { html } = render(archive);
console.log(html); // <h1>Hello, world!</h1>
```

### CJS (Node.js)

```js
const { parseManifest, createArchive, render } = require('mdz-core-js');
```

### Render options

```ts
const { html } = render(archive, {
  baseUrl: 'https://cdn.example.com/assets', // resolves relative src attributes
  sanitize: true,                             // default: true
});
```

## API

### `parseManifest(json: string): MdzManifest`

Parses a raw JSON manifest string and returns a validated `MdzManifest` object.
Throws on invalid JSON or missing required fields.

### `createArchive(manifest, entries?): MdzArchive`

Creates an `MdzArchive` from a parsed manifest and an optional `Map<string, Uint8Array>`
of entry paths to their raw byte content.

### `render(archive, options?): RenderResult`

Renders the primary Markdown entry of an archive to an HTML string.  Looks for
`index.md` first, then falls back to the first `.md` entry in the manifest.

### Types

```ts
interface MdzManifest {
  version: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  entries: MdzEntry[];
}

interface MdzEntry {
  path: string;
  mimeType?: string;
  size?: number;
}

interface RenderOptions {
  baseUrl?: string;
  sanitize?: boolean;
}

interface RenderResult {
  html: string;
}
```

## Development

### Prerequisites

- Node.js ≥ 18
- npm ≥ 8

### Setup

```bash
git clone https://github.com/kylemwhite/mdz-core-js.git
cd mdz-core-js
npm install
```

### Commands

| Command | Description |
|---|---|
| `npm run build` | Compile TypeScript → `dist/` (ESM + CJS) |
| `npm run dev` | Watch-mode build |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run format` | Format source with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm run clean` | Remove `dist/` |

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Releasing

See [RELEASING.md](RELEASING.md) for the full release process using Changesets.

## License

[MIT](LICENSE)
