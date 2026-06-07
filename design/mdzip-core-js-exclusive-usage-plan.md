# mdzip-core-js Enhancement Plan For JSZip-Free Extension Usage

## Goal
Enable the VS Code extension to use mdzip-core-js exclusively for archive I/O, removing direct JSZip imports from extension source code.

## Current Gap Summary
The extension currently relies on mdzip-core-js for:
- archive open, manifest parsing, and entry-point resolution
- archive mutation (add or replace file)

The extension still uses JSZip directly for:
- listing non-directory archive entries
- reading text, binary, and base64 content from arbitrary archive paths
- fallback case-insensitive path lookup when direct key lookup fails

This creates duplicated archive logic and leaks ZIP-level implementation concerns into the extension layer.

## Required mdzip-core-js Additions

### 1) Public Entry Listing API
Add a stable API to enumerate all non-directory archive entries.

Proposed API:
- instance method: `listPaths(options?) => string[]`
- optional richer method: `listEntries(options?) => MdzArchiveEntryInfo[]`

Proposed types:
- `interface MdzArchiveEntryInfo {`
- `  path: string;`
- `  isMarkdown: boolean;`
- `  isImage: boolean;`
- `}`

Options can include:
- `includeDirectories?: boolean` (default false)
- `normalize?: boolean` (default true)
- `sort?: boolean` (default true)

Rationale:
- removes need for external traversal of zip.files
- preserves a single source of truth for path normalization

### 2) Public File Read API
Add direct read helpers on MdzArchiveCore.

Proposed APIs:
- `readText(path: string): Promise<string>`
- `readBytes(path: string): Promise<Uint8Array>`
- `readBase64(path: string): Promise<string>`

Behavior:
- path normalization handled internally
- case-insensitive fallback supported
- reject with clear not-found error when missing or directory

Rationale:
- removes repeated lookup logic in extension
- centralizes path handling and consistent error semantics

### 3) Optional MIME-Aware Data URI Helper
Add helper for image embedding use cases.

Proposed API:
- `readDataUri(path: string, fallbackMime?: string): Promise<string>`

Behavior:
- infer MIME using extension and MDZ image map
- fallback to provided or default MIME

Rationale:
- simplifies editor workflows that embed in-memory images
- keeps MIME logic in one place

### 4) Explicit Path Existence Helper (Optional)
Proposed API:
- `hasEntry(path: string): boolean`

Rationale:
- avoids exception-driven checks in clients
- useful for efficient branch logic in editor integrations

## Non-Goals
- replacing JSZip inside mdzip-core-js internals in this phase
- changing archive format behavior
- introducing breaking API changes to existing consumers

## API Design Principles
- additive, backwards-compatible changes only
- stable, documented error messages for common failure cases
- normalized archive-relative paths in all public return values
- no leakage of JSZip-specific entry objects in public types

## Implementation Plan In mdzip-core-js

### Phase 1: Core Read/Enumerate Surface
- add listPaths/listEntries implementation using existing zip structure
- add readText/readBytes/readBase64 with shared internal lookup
- expose typed not-found or invalid-entry errors
- add unit tests for case-insensitive lookup and normalization

### Phase 2: Ergonomic Helpers
- add readDataUri helper with extension-to-MIME map support
- optionally add hasEntry helper
- document best practices for extension consumers

### Phase 3: Consumer Migration Support
- update README with migration snippets
- publish a minor release with changelog examples
- validate against mdzip-vscode use cases

## mdzip-vscode Migration Plan

### Step 1: Upgrade Dependency
- bump mdzip-core-js to the first version containing new APIs
- keep JSZip temporarily during transition

### Step 2: Refactor mdzArchiveUtils
- replace JSZip load and zip.files traversal with listEntries/listPaths
- replace raw entry async reads with readText/readBytes/readBase64
- remove duplicate case-insensitive fallback logic

### Step 3: Remove Direct JSZip Dependency
- remove JSZip imports from extension source
- remove jszip package dependency from extension package.json
- run build/test/packaging verification

### Step 4: Validate Behavior
- open existing .mdz files with mixed case paths
- verify entry-point markdown load
- verify image embedding map generation
- verify binary reads and manifest edits still work

## Test Matrix For mdzip-core-js

### Functional
- listPaths excludes directories by default
- listPaths returns normalized forward-slash paths
- readText reads UTF-8 content correctly
- readBytes returns exact bytes for binary assets
- readBase64 matches historical JSZip output semantics

### Edge Cases
- case mismatch between requested and stored path
- leading slash and backslash path variants
- missing entry path
- entry path points to directory
- non-UTF-8 bytes in readText path should fail clearly

### Regression
- manifest read and resolveEntryPoint unchanged
- addFile/removeFile behavior unchanged
- validation output unchanged

## Acceptance Criteria
- mdzip-vscode has zero direct JSZip imports in src
- mdzip-vscode archive helpers compile and pass existing tests
- mdzip-core-js README documents new APIs
- mdzip-core-js release includes changelog entries and versioned docs
- manual open/edit/save workflows in mdzip-vscode remain stable

## Risks And Mitigations
- Risk: subtle behavior drift in case-insensitive lookup
- Mitigation: golden tests against existing extension fixtures

- Risk: MIME inference inconsistency for uncommon extensions
- Mitigation: preserve existing image MIME map and fallback rules

- Risk: rollout coupling between extension and core release timing
- Mitigation: ship additive APIs first, migrate extension second

## Suggested Release Sequence
1. Implement and test mdzip-core-js APIs on a feature branch.
2. Publish mdzip-core-js minor version.
3. Upgrade mdzip-vscode to new core version.
4. Remove extension JSZip usage and dependency.
5. Package and smoke test VSIX.

## Ownership And Tracking
- Create one mdzip-core-js issue per phase.
- Track migration in one mdzip-vscode integration issue.
- Use a short checklist in both repos for release readiness.
