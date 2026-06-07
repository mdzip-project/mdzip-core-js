# Plan: Unified Core API and Orphaned Asset Cleanup

Deliver one additive mdzip-core-js release stream that removes extension-side ZIP traversal needs, adds safe orphaned-image cleanup primitives, and requires migration from jszip to @progress/jszip-esm for the next release. Keep mutation and validation semantics stable while making the dependency migration a release gate.

## Steps

1. Phase 1: Lock scope and contracts (blocks all later steps)
2. Define exact public API signatures and result/error contracts for:
3. MdzArchiveCore.listPaths(options?)
4. MdzArchiveCore.listEntries(options?) returning entry metadata (path, isMarkdown, isImage)
5. MdzArchiveCore.hasEntry(path)
6. MdzArchiveCore.readText(path), readBytes(path), readBase64(path)
7. MdzArchiveCore.readDataUri(path, fallbackMime?)
8. MdzArchiveCore.findOrphanedAssets(input, options?)
9. MdzArchiveCore.removeFiles(input, archiveEntryPaths)
10. Resolve and document error-code behavior unambiguously:
11. ERR_NOT_FOUND for missing path
12. ERR_IS_DIRECTORY for directory path when file content is required
13. ERR_ENTRYPOINT_MISSING behavior for mutations that break entry point integrity
14. Define MdzOrphanedAssetsResult shape explicitly (recommended: referencedAssetPaths, orphanedAssetPaths, scannedMarkdownPaths, unresolvedReferences)
15. Phase 2: Required ZIP dependency migration (release-gating; depends on Phase 1)
16. Replace jszip with @progress/jszip-esm in runtime dependency and update runtime/test imports accordingly.
17. Validate build and test parity immediately after migration before feature work continues.
18. Block release until migration pass criteria are satisfied.
19. Phase 3: Implement listing/read surface (depends on Phases 1 and 2)
20. Promote current internal archive path enumeration logic into public listPaths/listEntries while preserving normalized, non-directory defaults.
21. Implement readText/readBytes/readBase64 via shared internal path resolution based on existing case-insensitive lookup behavior.
22. Implement hasEntry as a lightweight entry existence check aligned with normalization and case-insensitivity.
23. Implement readDataUri using existing image MIME map and fallback MIME logic.
24. Keep all additions backward-compatible and avoid exposing ZIP-library-specific entry objects.
25. Phase 4: Implement orphaned-image analysis and batch deletion (depends on Phases 1 and 2; can start in parallel with late Phase 3 test writing)
26. Implement findOrphanedAssets using:
27. resolved entry point as starting markdown context
28. markdown image reference extraction
29. path resolution using existing relative resolution rules
30. manifest.cover as a keep-alive reference when valid
31. v1 asset scope restricted to image extensions defined by MDZ_IMAGE_MIME_TYPES
32. Implement removeFiles as one-pass normalization/validation + case-insensitive removal + single archive finalization.
33. Preserve existing removeFile behavior; removeFiles is additive, not replacement.
34. Re-run post-mutation integrity checks so resulting archive still has valid entry-point semantics.
35. Phase 5: Testing and docs hardening (depends on Phases 2, 3, and 4)
36. Add conformance tests for new read/list APIs including normalization and case-insensitive path matching.
37. Add orphan-analysis tests: referenced image retained, stale image detected, nested relative references resolved, missing references tolerated, manifest.cover retention behavior.
38. Add removeFiles tests: mixed-case path deletion, invalid path rejection, entry-point protection, single-finalization behavior.
39. Update README API usage and behavior notes for new methods and two-step orphan cleanup workflow.
40. Add release notes describing additive APIs, migration guidance, and non-goals.
41. Execute dedicated compatibility regression for open/build/mutation/packaging behavior before release approval.

## Relevant files

- f:/Code/1 Projects/mdzip-project/mdzip-core-js/src/mdz-core.ts - primary implementation point for public read/list APIs, orphan analysis, and batch mutation logic.
- f:/Code/1 Projects/mdzip-project/mdzip-core-js/src/index.ts - export surface validation for new public types and methods.
- f:/Code/1 Projects/mdzip-project/mdzip-core-js/tests/spec-conformance.test.mjs - conformance and regression expansion for new APIs.
- f:/Code/1 Projects/mdzip-project/mdzip-core-js/README.md - API documentation and migration guidance.
- f:/Code/1 Projects/mdzip-project/mdzip-core-js/package.json - required dependency/version/script touchpoint for jszip to @progress/jszip-esm migration.
- f:/Code/1 Projects/mdzip-project/mdzip-core-js/design/mdzip-core-js-exclusive-usage-plan.md - source plan to supersede/merge.
- f:/Code/1 Projects/mdzip-project/mdzip-core-js/design/mdzip-core-js-orphaned-assets-plan.md - source plan to merge.

## Verification

1. Run npm run build and npm test with new APIs covered by deterministic tests.
2. Validate that listPaths/listEntries output normalized paths and expected file classification.
3. Validate readText/readBytes/readBase64/readDataUri for happy paths and error-code paths (missing and directory entries).
4. Validate findOrphanedAssets returns exactly expected referenced/orphaned sets on fixture archives.
5. Validate removeFiles removes only requested entries, preserves non-target entries, and maintains archive validity and entry-point resolution.
6. Confirm README examples compile conceptually against actual exported types and method names.
7. Compare behavior before/after the required dependency change using the full test suite and at least one manual open-mutate-validate scenario.
8. Verify there are zero remaining jszip imports and imports resolve to @progress/jszip-esm for runtime and tests.

## Decisions

- Included scope: additive core APIs for listing/reading entries, orphan-image analysis, and batch deletion.
- Included scope: repo-local docs/tests updates needed to ship those APIs safely.
- Excluded scope: extension UI workflow implementation and direct extension code migration (only contract guidance retained).
- Included scope: required migration from jszip to @progress/jszip-esm in the next release, with release blocked until migration verification passes.

## Further considerations

1. Orphan analysis breadth recommendation: Option A entry-point graph only (faster, safer first release), Option B all markdown files in archive (broader cleanup), Option C configurable mode (most flexible, highest complexity). Recommended: Option C with default A.
2. removeFiles failure policy recommendation: Option A fail-fast on first invalid/missing path, Option B best-effort with per-path report, Option C configurable strictness. Recommended: Option A for v1 consistency with existing mutation error semantics.
3. Migration breadth recommendation: Option A runtime imports only, Option B runtime and test imports in same release, Option C staged follow-up for tests. Recommended: Option B so the release fully standardizes on @progress/jszip-esm.
