# Roadmap & Migration Notes

## Current status

The library scaffold is in place.  Core reading and rendering logic is being migrated
from an existing private repository.

## Near-term goals (v0.x)

### Archive unpacking
- [ ] Zip extraction using the Web Streams / `DecompressionStream` API
- [ ] Manifest discovery and validation (`manifest.json` inside zip)
- [ ] Path resolution helpers for entries

### Rendering helpers
- [ ] Full Markdown-to-HTML pipeline (likely via `markdown-it` or similar)
- [ ] Asset URL rewriting
- [ ] Inline SVG and image handling

## Medium-term goals (v1.0)

- [ ] Streaming archive reads for large files
- [ ] Stable public API v1 with full documentation
- [ ] Browser-native bundle size < 20 kB (gzipped)
- [ ] Integration tests using real `.mdz` fixtures

## Longer-term / ecosystem goals

- [ ] **Angular service/component split** — `@mdz/angular` peer package consuming this library
- [ ] **React helpers** — hooks/utilities for rendering `.mdz` content in React
- [ ] **CLI tool** — `mdz` command-line reader

## Code migration notes

The core parsing and rendering logic currently lives in the `mdz-viewer` repository.
The migration plan is:

1. Copy `src/parser/` → `src/parser.ts` (consolidate to a single file for now)
2. Copy `src/renderer/` → `src/renderer.ts`
3. Adjust imports and ensure ESM compatibility
4. Add/migrate existing unit tests
5. Validate against real `.mdz` archives in `tests/fixtures/`

## Breaking-change policy

Until v1.0 is released, minor versions **may** contain breaking changes.
From v1.0 onward the project follows strict Semantic Versioning.
