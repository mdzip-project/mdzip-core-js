import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

import { MdzArchiveCore, MdzPackagerCore } from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures');

async function openFixtureArchive(fileName) {
  const raw = await fs.readFile(path.join(fixturesDir, fileName));
  return MdzArchiveCore.open(raw);
}

function toFixturePathError(validationError) {
  const map = {
    'leading slash': 'ERR_PATH_LEADING_SLASH',
    'path traversal': 'ERR_PATH_TRAVERSAL',
    'reserved character': 'ERR_PATH_RESERVED_CHAR',
    'control char': 'ERR_PATH_CONTROL_CHAR'
  };
  return map[validationError] ?? 'ERR_PATH_UNKNOWN';
}

test('T-001 minimal fixture resolves index.md', async () => {
  const archive = await openFixtureArchive('minimal.mdz');
  await assert.doesNotReject(() => archive.readManifest());
  const entry = await archive.resolveEntryPoint();
  assert.equal(entry, 'index.md');
});

test('T-002 with-manifest fixture uses manifest entryPoint', async () => {
  const archive = await openFixtureArchive('with-manifest.mdz');
  const manifest = await archive.readManifest();
  assert.ok(manifest);
  assert.equal(manifest.entryPoint, 'index.md');
  const entry = await archive.resolveEntryPoint();
  assert.equal(entry, 'index.md');
});

test('T-003 invalid-missing-index fixture rejects unresolved entry point', async () => {
  const archive = await openFixtureArchive('invalid-missing-index.mdz');
  await assert.rejects(() => archive.resolveEntryPoint(), /ERR_ENTRYPOINT_UNRESOLVED|ERR_ENTRYPOINT_MISSING/);
});

test('T-004 invalid-bad-entrypoint fixture rejects missing manifest entry point', async () => {
  const archive = await openFixtureArchive('invalid-bad-entrypoint.mdz');
  await assert.rejects(() => archive.resolveEntryPoint(), /ERR_ENTRYPOINT_MISSING/);
});

test('T-005 line-endings-crlf fixture is accepted and readable', async () => {
  const archive = await openFixtureArchive('line-endings-crlf.mdz');
  const entryPoint = await archive.resolveEntryPoint();
  assert.equal(entryPoint, 'index.md');

  const entry = archive.findEntry('index.md');
  assert.ok(entry);
  const text = String(await entry.async('text'));
  assert.match(text, /\r\n|\n/);
});

test('machine fixture: entrypoint-cases.json', async () => {
  const fixture = JSON.parse(await fs.readFile(path.join(fixturesDir, 'entrypoint-cases.json'), 'utf8'));
  for (const c of fixture) {
    const actual = MdzPackagerCore.resolveEntryPoint(c.files, c.manifest);
    assert.equal(actual, c.expectedEntryPoint, c.name);
  }
});

test('machine fixture: path-validation-cases.json', async () => {
  const fixture = JSON.parse(await fs.readFile(path.join(fixturesDir, 'path-validation-cases.json'), 'utf8'));
  for (const c of fixture) {
    const validationError = MdzArchiveCore.validateArchivePath(c.path);
    const isValid = validationError == null;
    assert.equal(isValid, c.valid, c.name);

    if (!c.valid) {
      assert.equal(toFixturePathError(validationError), c.errorCode, c.name);
    }
  }
});

test('machine fixture: create-filter-cases.json', async () => {
  const fixture = JSON.parse(await fs.readFile(path.join(fixturesDir, 'create-filter-cases.json'), 'utf8'));
  for (const c of fixture) {
    const included = c.inputPaths.filter((p) => MdzPackagerCore.matchesAnyFilter(p, c.filters));
    const excluded = c.inputPaths.filter((p) => !MdzPackagerCore.matchesAnyFilter(p, c.filters));

    assert.deepEqual(included, c.expectedIncluded, `${c.name} included`);
    assert.deepEqual(excluded, c.expectedExcluded, `${c.name} excluded`);
  }
});

test('manifest with only required mdz field is accepted', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('manifest.json', JSON.stringify({ mdz: '1.0.0' }));

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const archive = await MdzArchiveCore.open(raw);
  const manifest = await archive.readManifest();

  assert.ok(manifest);
  assert.equal(manifest.mdz, '1.0.0');
});
