import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from '@progress/jszip-esm';

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

test('manifest without spec.version remains readable', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('manifest.json', JSON.stringify({ title: 'Hello world', unknownField: true }));

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const archive = await MdzArchiveCore.open(raw);
  const manifest = await archive.readManifest();

  assert.ok(manifest);
  assert.equal(manifest.title, 'Hello world');
});

test('manifest mode defaults to document when omitted', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('manifest.json', JSON.stringify({ title: 'Hello world' }));

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const archive = await MdzArchiveCore.open(raw);

  assert.equal(await archive.resolveMode(), 'document');
});

test('manifest project mode is accepted and reported', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('manifest.json', JSON.stringify({ spec: { version: '1.1.0' }, mode: 'project', entryPoint: 'index.md' }));

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const archive = await MdzArchiveCore.open(raw);
  const manifest = await archive.readManifest();

  assert.ok(manifest);
  assert.equal(manifest.mode, 'project');
  assert.equal(await archive.resolveMode(), 'project');
});

test('manifest with unsupported mode is rejected', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('manifest.json', JSON.stringify({ spec: { version: '1.1.0' }, mode: 'Document' }));

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const archive = await MdzArchiveCore.open(raw);

  await assert.rejects(() => archive.readManifest(), /ERR_MODE_UNSUPPORTED/);
});

test('manifest with unsupported spec.version major is rejected', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('manifest.json', JSON.stringify({ spec: { name: 'mdzip-spec', version: '2.0.0' } }));

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const archive = await MdzArchiveCore.open(raw);
  await assert.rejects(() => archive.readManifest(), /ERR_VERSION_UNSUPPORTED/);
});

test('manifest accepts draft dual timestamp forms', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file(
    'manifest.json',
    JSON.stringify({
      spec: { version: '1.0.1' },
      created: '2026-03-16T10:00:00Z',
      modified: {
        when: '2026-03-17T10:00:00Z',
        by: { name: 'Doc Bot' }
      }
    })
  );

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const archive = await MdzArchiveCore.open(raw);
  const manifest = await archive.readManifest();

  assert.ok(manifest);
  assert.equal(manifest.created, '2026-03-16T10:00:00Z');
  assert.equal(manifest.modified.when, '2026-03-17T10:00:00Z');
});

test('manifest cover is ignored when file is missing', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file(
    'manifest.json',
    JSON.stringify({
      spec: { version: '1.0.1' },
      cover: 'assets/images/missing.png'
    })
  );

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const archive = await MdzArchiveCore.open(raw);
  const manifest = await archive.readManifest();

  assert.ok(manifest);
  assert.equal(manifest.cover, undefined);
});

test('manifest cover is ignored when it points to a directory entry', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.folder('assets/images/cover-dir');
  zip.file(
    'manifest.json',
    JSON.stringify({
      spec: { version: '1.0.1' },
      cover: 'assets/images/cover-dir/'
    })
  );

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const archive = await MdzArchiveCore.open(raw);
  const manifest = await archive.readManifest();

  assert.ok(manifest);
  assert.equal(manifest.cover, undefined);
});

test('generated producer manifest includes spec.version', () => {
  const manifest = MdzPackagerCore.buildManifestFromOptions('Sample', {
    createIndex: false,
    mapFiles: false,
    filters: [],
    title: 'Sample'
  });

  assert.ok(manifest);
  assert.equal(manifest.spec.version, '1.1.0');
  assert.equal(manifest.spec.name, 'mdzip-spec');
  assert.equal(manifest.producer.core.version, '1.2.0');
  assert.equal(manifest.producer.core.url, 'https://github.com/mdzip-project/mdzip-core-js');
  assert.equal(typeof manifest.created, 'string');
  assert.equal(typeof manifest.modified, 'string');
});

test('generated producer manifest supports explicit project mode', () => {
  const manifest = MdzPackagerCore.buildManifestFromOptions('Project Sample', {
    createIndex: false,
    mapFiles: false,
    filters: [],
    mode: 'project'
  });

  assert.ok(manifest);
  assert.equal(manifest.mode, 'project');
  assert.equal(manifest.spec.version, '1.1.0');
});

test('buildArchive warns when multiple markdown files rely on implicit document mode', async () => {
  const result = await MdzPackagerCore.buildArchive(
    [
      { path: 'chapter-01.md', text: '# One\n' },
      { path: 'chapter-02.md', text: '# Two\n' }
    ],
    'Sample',
    {
      createIndex: true,
      mapFiles: false,
      filters: ['**/*.md']
    }
  );

  assert.ok(
    result.warnings.messages.some((message) => /multiple Markdown files/i.test(message) && /mode: "project"/i.test(message))
  );
  assert.equal(result.resolvedEntryPoint, 'index.md');
});

test('buildArchive does not warn when multiple markdown files explicitly use project mode', async () => {
  const result = await MdzPackagerCore.buildArchive(
    [
      { path: 'guide/intro.md', text: '# Intro\n' },
      { path: 'reference/api.md', text: '# API\n' }
    ],
    'Project Sample',
    {
      createIndex: false,
      mapFiles: false,
      filters: ['**/*.md'],
      mode: 'project',
      entryPoint: 'guide/intro.md'
    }
  );

  assert.deepEqual(result.warnings.messages, []);
  assert.equal(result.manifest?.mode, 'project');
});

test('buildArchive honors a valid user-supplied manifest.json', async () => {
  const result = await MdzPackagerCore.buildArchive(
    [
      {
        path: 'manifest.json',
        text: JSON.stringify({
          spec: { version: '1.1.0' },
          mode: 'project',
          entryPoint: 'guide/intro.md'
        })
      },
      { path: 'guide/intro.md', text: '# Intro\n' },
      { path: 'reference/api.md', text: '# API\n' }
    ],
    'Project Sample',
    {
      createIndex: false,
      mapFiles: false,
      filters: ['**/*.md', 'manifest.json']
    }
  );

  assert.equal(result.manifest?.mode, 'project');
  assert.equal(result.resolvedEntryPoint, 'guide/intro.md');
  assert.deepEqual(result.warnings.messages, []);
});

test('buildArchive rejects an invalid user-supplied manifest.json', async () => {
  await assert.rejects(
    () => MdzPackagerCore.buildArchive(
      [
        { path: 'manifest.json', text: '{ invalid json' },
        { path: 'index.md', text: '# Hello\n' }
      ],
      'Sample',
      {
        createIndex: false,
        mapFiles: false,
        filters: ['**/*.md', 'manifest.json']
      }
    ),
    /ERR_MANIFEST_INVALID/
  );
});

test('validate warns when manifest cover target is missing', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('manifest.json', JSON.stringify({ spec: { version: '1.1.0' }, cover: 'assets/images/cover.png' }));

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const result = await MdzArchiveCore.validate(raw);

  assert.equal(result.isValid, true);
  assert.ok(result.warnings.some((w) => /cover/i.test(w)));
});

test('validate rejects unsupported manifest mode', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('manifest.json', JSON.stringify({ spec: { version: '1.1.0' }, mode: 'PROJECT' }));

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const result = await MdzArchiveCore.validate(raw);

  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => /ERR_MODE_UNSUPPORTED/.test(e)));
});

test('validate warns when manifest spec.version major is lower', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('manifest.json', JSON.stringify({ spec: { version: '0.9.0' }, entryPoint: 'index.md' }));

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const result = await MdzArchiveCore.validate(raw);

  assert.equal(result.isValid, true);
  assert.ok(result.warnings.some((w) => /spec\.version/i.test(w)));
});

test('validate rejects higher unsupported spec.version major', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('manifest.json', JSON.stringify({ spec: { version: '2.0.0' }, entryPoint: 'index.md' }));

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const result = await MdzArchiveCore.validate(raw);

  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => /ERR_VERSION_UNSUPPORTED/.test(e)));
});

test('validate warns when manifest is missing', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');

  const raw = await zip.generateAsync({ type: 'uint8array' });
  const result = await MdzArchiveCore.validate(raw);

  assert.equal(result.isValid, true);
  assert.ok(result.warnings.some((w) => /No manifest\.json present/i.test(w)));
});

test('addFile adds a new entry', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const result = await MdzArchiveCore.addFile(raw, 'assets/note.txt', 'line1\r\nline2\r\n');
  assert.equal(result.resolvedEntryPoint, 'index.md');

  const outZip = await new JSZip().loadAsync(await result.blob.arrayBuffer());
  const added = outZip.file('assets/note.txt');
  assert.ok(added);
  assert.equal(await added.async('text'), 'line1\nline2\n');
});

test('addFile replaces existing entry', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# old\n');
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const result = await MdzArchiveCore.addFile(raw, 'index.md', '# new\n');
  const outZip = await new JSZip().loadAsync(await result.blob.arrayBuffer());
  const entry = outZip.file('index.md');
  assert.ok(entry);
  assert.equal(await entry.async('text'), '# new\n');
});

test('addFile manifest replacement with invalid JSON throws', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('manifest.json', JSON.stringify({ entryPoint: 'index.md' }));
  const raw = await zip.generateAsync({ type: 'uint8array' });

  await assert.rejects(
    () => MdzArchiveCore.addFile(raw, 'manifest.json', '{ invalid json'),
    /ERR_MANIFEST_INVALID: Replacement manifest\.json is invalid JSON/
  );
});

test('addFile manifest replacement injects spec.version and refreshes modified', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('manifest.json', JSON.stringify({ entryPoint: 'index.md' }));
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const replacement = JSON.stringify({
    entryPoint: 'index.md',
    created: {
      when: '2026-01-01T00:00:00Z',
      by: { name: 'Author' }
    }
  });

  const result = await MdzArchiveCore.addFile(raw, 'manifest.json', replacement);
  const outZip = await new JSZip().loadAsync(await result.blob.arrayBuffer());
  const manifestRaw = await outZip.file('manifest.json').async('text');
  const manifest = JSON.parse(manifestRaw);

  assert.equal(manifest.spec.version, '1.1.0');
  assert.equal(manifest.created.by.name, 'Author');
  assert.ok(typeof manifest.modified === 'string' || typeof manifest.modified?.when === 'string');
});

test('addFile refreshes manifest modified and injects missing spec.version', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('manifest.json', JSON.stringify({ entryPoint: 'index.md', modified: '2000-01-01T00:00:00.0000000Z' }));
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const result = await MdzArchiveCore.addFile(raw, 'assets/new.txt', 'new');
  assert.ok(result.manifest);
  assert.equal(result.manifest.spec.version, '1.1.0');
  assert.notEqual(result.manifest.modified, '2000-01-01T00:00:00.0000000Z');
});

test('removeFile removes entry and keeps archive valid', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('assets/one.txt', '1');
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const result = await MdzArchiveCore.removeFile(raw, 'assets/one.txt');
  assert.equal(result.resolvedEntryPoint, 'index.md');

  const outZip = await new JSZip().loadAsync(await result.blob.arrayBuffer());
  assert.equal(outZip.file('assets/one.txt'), null);
  assert.ok(outZip.file('index.md'));
});

test('removeFile throws for missing entry', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  const raw = await zip.generateAsync({ type: 'uint8array' });

  await assert.rejects(
    () => MdzArchiveCore.removeFile(raw, 'missing.txt'),
    /ERR_NOT_FOUND/
  );
});

test('removeFile rejects when entrypoint becomes unresolved', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  const raw = await zip.generateAsync({ type: 'uint8array' });

  await assert.rejects(
    () => MdzArchiveCore.removeFile(raw, 'index.md'),
    /ERR_ENTRYPOINT_UNRESOLVED/
  );
});

test('listPaths defaults to sorted non-directory paths', async () => {
  const zip = new JSZip();
  zip.file('b.md', '# b\n');
  zip.file('a.md', '# a\n');
  zip.folder('assets/images');
  zip.file('assets/images/p.png', new Uint8Array([1, 2, 3]));
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const archive = await MdzArchiveCore.open(raw);
  assert.deepEqual(archive.listPaths(), ['a.md', 'assets/images/p.png', 'b.md']);
});

test('listEntries reports markdown/image/directory metadata', async () => {
  const zip = new JSZip();
  zip.folder('assets');
  zip.file('index.md', '# hello\n');
  zip.file('assets/pic.PNG', new Uint8Array([1, 2, 3]));
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const archive = await MdzArchiveCore.open(raw);
  const entries = archive.listEntries({ includeDirectories: true });
  const byPath = Object.fromEntries(entries.map((e) => [e.path, e]));
  const assetsDir = entries.find((e) => e.isDirectory && (e.path === 'assets' || e.path === 'assets/'));

  assert.ok(assetsDir);
  assert.equal(byPath['index.md'].isMarkdown, true);
  assert.equal(byPath['assets/pic.PNG'].isImage, true);
});

test('hasEntry supports file, directory, and case-insensitive lookup', async () => {
  const zip = new JSZip();
  zip.folder('assets');
  zip.file('assets/one.txt', '1');
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const archive = await MdzArchiveCore.open(raw);
  assert.equal(archive.hasEntry('assets/one.txt'), true);
  assert.equal(archive.hasEntry('ASSETS/ONE.TXT'), true);
  assert.equal(archive.hasEntry('assets'), true);
  assert.equal(archive.hasEntry('missing.txt'), false);
});

test('readText/readBytes/readBase64/readDataUri work for file entries', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('assets/logo.png', new Uint8Array([0x01, 0x02, 0x03, 0x04]));
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const archive = await MdzArchiveCore.open(raw);

  assert.equal(await archive.readText('index.md'), '# hello\n');
  assert.deepEqual(Array.from(await archive.readBytes('assets/logo.png')), [1, 2, 3, 4]);
  assert.equal(await archive.readBase64('assets/logo.png'), 'AQIDBA==');
  assert.equal(await archive.readDataUri('assets/logo.png'), 'data:image/png;base64,AQIDBA==');
  assert.equal(await archive.readDataUri('index.md'), 'data:application/octet-stream;base64,IyBoZWxsbwo=');
});

test('read* APIs reject missing and directory paths with typed errors', async () => {
  const zip = new JSZip();
  zip.folder('assets');
  zip.file('index.md', '# hello\n');
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const archive = await MdzArchiveCore.open(raw);

  await assert.rejects(() => archive.readText('missing.md'), /ERR_NOT_FOUND/);
  await assert.rejects(() => archive.readText('assets'), /ERR_IS_DIRECTORY/);
});

test('removeFiles removes multiple entries case-insensitively', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  zip.file('assets/one.txt', '1');
  zip.file('assets/two.txt', '2');
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const result = await MdzArchiveCore.removeFiles(raw, ['ASSETS/ONE.TXT', 'assets/two.txt']);
  const outZip = await new JSZip().loadAsync(await result.blob.arrayBuffer());

  assert.equal(outZip.file('assets/one.txt'), null);
  assert.equal(outZip.file('assets/two.txt'), null);
  assert.ok(outZip.file('index.md'));
});

test('removeFiles rejects when any target does not exist', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  const raw = await zip.generateAsync({ type: 'uint8array' });

  await assert.rejects(
    () => MdzArchiveCore.removeFiles(raw, ['missing.txt']),
    /ERR_NOT_FOUND/
  );
});

test('removeFiles rejects when entrypoint becomes unresolved', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hello\n');
  const raw = await zip.generateAsync({ type: 'uint8array' });

  await assert.rejects(
    () => MdzArchiveCore.removeFiles(raw, ['index.md']),
    /ERR_ENTRYPOINT_UNRESOLVED/
  );
});

test('findOrphanedAssets finds stale image assets with relative references and cover retention', async () => {
  const zip = new JSZip();
  zip.file('docs/start.md', [
    '![one](../assets/one.png)',
    '![bad](../assets/missing.png)',
    '![external](https://example.com/logo.png)',
    '![notasset](../docs/notes.txt)'
  ].join('\n'));
  zip.file('docs/notes.txt', 'note');
  zip.file('assets/one.png', new Uint8Array([1]));
  zip.file('assets/cover.png', new Uint8Array([2]));
  zip.file('assets/orphan.png', new Uint8Array([3]));
  zip.file('manifest.json', JSON.stringify({ spec: { version: '1.1.0' }, entryPoint: 'docs/start.md', cover: 'assets/cover.png' }));
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const result = await MdzArchiveCore.findOrphanedAssets(raw);

  assert.deepEqual(result.scannedMarkdownPaths, ['docs/start.md']);
  assert.deepEqual(result.assetPaths, ['assets/cover.png', 'assets/one.png', 'assets/orphan.png']);
  assert.deepEqual(result.referencedAssetPaths, ['assets/cover.png', 'assets/one.png']);
  assert.deepEqual(result.orphanedAssetPaths, ['assets/orphan.png']);
  assert.ok(result.unresolvedReferences.some((r) => r.reason === 'not-found'));
  assert.ok(result.unresolvedReferences.some((r) => r.reason === 'unsupported-scheme'));
  assert.ok(result.unresolvedReferences.some((r) => r.reason === 'not-asset'));
});

test('findOrphanedAssets all-markdown mode scans beyond entrypoint', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# root\n');
  zip.file('guide/extra.md', '![g](../assets/guide.png)');
  zip.file('assets/guide.png', new Uint8Array([9]));
  zip.file('manifest.json', JSON.stringify({ spec: { version: '1.1.0' }, entryPoint: 'index.md' }));
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const result = await MdzArchiveCore.findOrphanedAssets(raw, { scanMode: 'all-markdown' });

  assert.deepEqual(result.referencedAssetPaths, ['assets/guide.png']);
  assert.deepEqual(result.orphanedAssetPaths, []);
});

test('openWorkspace returns documents, assets, validation, and lazy asset readers', async () => {
  const zip = new JSZip();
  zip.file('docs/start.md', '# Start\n');
  zip.file('docs/extra.md', '# Extra\n');
  zip.file('assets/logo.png', new Uint8Array([1, 2, 3]));
  zip.file('manifest.json', JSON.stringify({
    spec: { version: '1.1.0' },
    title: 'Workspace Sample',
    mode: 'project',
    entryPoint: 'docs/start.md',
    files: [{ path: 'docs/extra.md', originalPath: 'docs/extra.md', title: 'Extra Doc' }]
  }));
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const workspace = await MdzArchiveCore.openWorkspace(raw, { includeOrphanedAssetAnalysis: true });

  assert.equal(workspace.title, 'Workspace Sample');
  assert.equal(workspace.mode, 'project');
  assert.equal(workspace.entryPoint, 'docs/start.md');
  assert.equal(workspace.validation.isValid, true);
  assert.equal(workspace.documents.length, 2);
  assert.equal(workspace.documents.find((doc) => doc.path === 'docs/start.md').isEntryPoint, true);
  assert.equal(workspace.documents.find((doc) => doc.path === 'docs/extra.md').title, 'Extra Doc');
  assert.equal(workspace.assets.length, 1);
  assert.equal(workspace.assets[0].path, 'assets/logo.png');
  assert.equal(workspace.assets[0].byteSize, 3);
  assert.equal(workspace.assets[0].mimeType, 'image/png');
  assert.equal(workspace.assets[0].kind, 'image');
  assert.equal(workspace.assets[0].isPreviewable, true);
  assert.deepEqual(Array.from(await workspace.assets[0].readBytes()), [1, 2, 3]);
  assert.equal(await workspace.assets[0].readDataUri(), 'data:image/png;base64,AQID');
  assert.ok(workspace.orphanedAssets);
  assert.deepEqual(workspace.orphanedAssets.orphanedAssetPaths, ['assets/logo.png']);
});

test('buildWorkspace round-trips opened binary assets and applies manifest helpers', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# Old\n');
  zip.file('assets/logo.png', new Uint8Array([7, 8, 9]));
  zip.file('manifest.json', JSON.stringify({ spec: { version: '1.1.0' }, title: 'Old', entryPoint: 'index.md' }));
  const raw = await zip.generateAsync({ type: 'uint8array' });

  const workspace = await MdzArchiveCore.openWorkspace(raw);
  workspace.documents[0].text = '# New\n';

  const result = await MdzPackagerCore.buildWorkspace(workspace, {
    metadata: {
      author: 'Ada',
      description: 'Updated description',
      keywords: ['sample']
    },
    title: 'New Title'
  });
  const outZip = await new JSZip().loadAsync(await result.blob.arrayBuffer());
  const manifest = JSON.parse(await outZip.file('manifest.json').async('text'));

  assert.equal(await outZip.file('index.md').async('text'), '# New\n');
  assert.deepEqual(Array.from(await outZip.file('assets/logo.png').async('uint8array')), [7, 8, 9]);
  assert.equal(manifest.title, 'New Title');
  assert.equal(manifest.author.name, 'Ada');
  assert.equal(manifest.description, 'Updated description');
  assert.deepEqual(manifest.keywords, ['sample']);
  assert.equal(manifest.spec.version, '1.1.0');
  assert.equal(manifest.producer.core.name, 'mdzip-core-js');
});

test('workspace asset import/export and manifest metadata helpers work', async () => {
  const asset = await MdzPackagerCore.createWorkspaceAssetFromFile(new Uint8Array([4, 5]), 'media/data.bin');
  const blob = await MdzPackagerCore.exportWorkspaceAsset(asset);
  const manifest = MdzPackagerCore.updateManifest(null, {
    title: 'Meta',
    author: { name: 'Author' },
    language: 'en',
    cover: 'media/data.bin',
    mode: 'project',
    entryPoint: 'index.md'
  });
  const split = MdzPackagerCore.splitManifestMetadata(manifest);

  assert.equal(asset.path, 'media/data.bin');
  assert.equal(asset.byteSize, 2);
  assert.equal(asset.kind, 'other');
  assert.deepEqual(Array.from(new Uint8Array(await blob.arrayBuffer())), [4, 5]);
  assert.equal(split.editable.title, 'Meta');
  assert.equal(split.reserved.mode, 'project');
  assert.equal(MdzArchiveCore.getValidationStatus({ isValid: true, errors: [], warnings: [] }), 'valid');
  assert.equal(MdzArchiveCore.getValidationStatus({ isValid: true, errors: [], warnings: ['warn'] }), 'warning');
  assert.equal(MdzArchiveCore.getValidationStatus({ isValid: false, errors: ['err'], warnings: [] }), 'error');
});

test('path utilities sort and build an inferred tree', () => {
  assert.deepEqual(MdzArchiveCore.sortArchivePaths(['b.md', 'A.md']), ['A.md', 'b.md']);
  assert.equal(MdzArchiveCore.dirname('docs/start.md'), 'docs');
  assert.equal(MdzArchiveCore.basename('docs/start.md'), 'start.md');

  const tree = MdzArchiveCore.buildPathTree(['docs/start.md', 'assets/logo.png', 'readme.md']);
  assert.deepEqual(tree.map((node) => [node.name, node.isDirectory]), [
    ['assets', true],
    ['docs', true],
    ['readme.md', false]
  ]);
  assert.equal(tree[0].children[0].path, 'assets/logo.png');
});
