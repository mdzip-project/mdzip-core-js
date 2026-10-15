// Entry point discovery per MDZip spec 1.2.0 §5.5 (support files, invalid vs missing
// entryPoint, NFC case-sensitive matching).
//
// The vendored spec fixtures (tests/fixtures) stay pinned to the released spec. To also run
// the 1.2.0 draft's shared cases, point MDZIP_SPEC_FIXTURES at a copy of its fixtures, e.g.
//   node ../mdzip-spec/tools/sync-fixtures.mjs <dir> --working-tree
//   MDZIP_SPEC_FIXTURES=<dir> node --test tests/entry-point-1.2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import JSZip from '@progress/jszip-esm';

import { MdzArchiveCore, MdzPackagerCore } from '../dist/index.js';

const codeOf = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return String(err.message).split(':')[0];
  }
};
const resolve = (files, manifest = null) => MdzArchiveCore.resolveEntryPointStrict(files, manifest);

test('support files are set aside (rule 3)', () => {
  assert.equal(resolve(['notes.md', 'AGENTS.md']), 'notes.md');
  assert.equal(resolve(['notes.md', 'README.md', 'LICENSE.md', 'CHANGELOG.md', 'CONTRIBUTING.markdown']), 'notes.md');
  assert.equal(resolve(['NOTES.MD', 'readme.MD', 'Agents.markdown']), 'NOTES.MD');
  assert.equal(resolve(['notes.md', 'docs/README.md']), 'notes.md');
});

test('a lone support file is still the entry point; two are ambiguous', () => {
  assert.equal(resolve(['README.md', 'images/a.png']), 'README.md');
  assert.equal(codeOf(() => resolve(['README.md', 'AGENTS.md'])), 'ERR_ENTRYPOINT_UNRESOLVED');
  assert.equal(codeOf(() => resolve(['notes.md', 'README-draft.md'])), 'ERR_ENTRYPOINT_UNRESOLVED');
});

test('invalid entryPoint: ERR_ENTRYPOINT_INVALID, no fallback', () => {
  for (const value of [42, '', '/index.md', '../index.md', 'docs\\a.md', 'chapters/', 'images/cover.png']) {
    assert.equal(codeOf(() => resolve(['index.md', 'images/cover.png'], { entryPoint: value })), 'ERR_ENTRYPOINT_INVALID', String(value));
  }
});

test('missing entryPoint: ERR_ENTRYPOINT_MISSING, no fallback, case-sensitive', () => {
  assert.equal(codeOf(() => resolve(['index.md'], { entryPoint: 'missing.md' })), 'ERR_ENTRYPOINT_MISSING');
  assert.equal(codeOf(() => resolve(['README.md'], { entryPoint: 'index.md' })), 'ERR_ENTRYPOINT_MISSING');
  assert.equal(codeOf(() => resolve(['index.md'], { entryPoint: 'Index.md' })), 'ERR_ENTRYPOINT_MISSING');
});

test('entryPoint matches after NFC normalization and allows ./', () => {
  assert.equal(resolve(['café.md'], { entryPoint: 'café.md' }), 'café.md');
  assert.equal(resolve(['start.md'], { entryPoint: './start.md' }), 'start.md');
});

test('Turkish locale does not affect support-file detection', () => {
  assert.equal(MdzArchiveCore.asciiLower('LICENSE'), 'license');
  assert.ok(MdzArchiveCore.isSupportFile('LICENSE.md'));
});

test('MdzPackagerCore.resolveEntryPoint returns null instead of throwing', () => {
  assert.equal(MdzPackagerCore.resolveEntryPoint(['index.md'], { entryPoint: 'missing.md' }), null);
  assert.equal(MdzPackagerCore.resolveEntryPoint(['notes.md', 'AGENTS.md'], null), 'notes.md');
});

test('archive without a manifest resolves with support files set aside', async () => {
  const { blob } = await MdzPackagerCore.buildArchive(
    [
      { path: 'recipes.md', text: '# Recipes' },
      { path: 'README.md', text: '# About' },
      { path: 'AGENTS.md', text: '# Agents' },
    ],
    'recipes',
    { createIndex: false, mapFiles: false, filters: ['**/*'], mode: 'document', entryPoint: 'recipes.md' }
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const archive = await MdzArchiveCore.open(bytes);
  assert.equal(await archive.resolveEntryPoint(), 'recipes.md');
});

async function zipOf(entries) {
  const zip = new JSZip();
  for (const [name, text] of Object.entries(entries)) zip.file(name, text);
  return zip.generateAsync({ type: 'uint8array' });
}

test('saving records the entry point in a manifest that lacks one (§14.1)', async () => {
  const before = await zipOf({ 'notes.md': '# Notes\n', 'manifest.json': '{"title": "t", "x-tool": 1}' });

  // Adding a second root Markdown file would make discovery ambiguous; the entry point stays put.
  const added = await MdzArchiveCore.updateFiles(before, [{ path: 'other.md', content: '# Other\n' }]);
  assert.equal(added.resolvedEntryPoint, 'notes.md');
  assert.equal(added.manifest.entryPoint, 'notes.md');

  // Same when the caller passes a manifest without entryPoint (as an editor saving its model does).
  const passed = await MdzArchiveCore.updateFiles(before, [{ path: 'other.md', content: '# Other\n' }], [], { manifest: { title: 't' } });
  assert.equal(passed.resolvedEntryPoint, 'notes.md');

  // Removing the entry file doesn't record a name that's gone.
  const two = await zipOf({ 'a.md': '# A\n', 'b.md': '# B\n', 'index.md': '# I\n', 'manifest.json': '{"title": "t"}' });
  await assert.rejects(MdzArchiveCore.updateFiles(two, [], ['index.md']), /ERR_ENTRYPOINT_UNRESOLVED/);
});

const draftDir = process.env.MDZIP_SPEC_FIXTURES;
test('spec draft entrypoint-cases.json', { skip: !draftDir && 'set MDZIP_SPEC_FIXTURES to run' }, async () => {
  const cases = JSON.parse(await fs.readFile(path.join(draftDir, 'entrypoint-cases.json'), 'utf8'));
  for (const c of cases) {
    const manifest = c.manifestJson !== undefined ? JSON.parse(c.manifestJson) : c.manifest;
    const files = c.files.filter((f) => f !== 'manifest.json');
    if (c.expectedEntryPoint === null) {
      const code = codeOf(() => resolve(files, manifest));
      assert.ok(code, `${c.name}: expected an error`);
      if (c.expectedError) assert.equal(code, c.expectedError, c.name);
    } else {
      assert.equal(resolve(files, manifest), c.expectedEntryPoint, c.name);
    }
  }
});
