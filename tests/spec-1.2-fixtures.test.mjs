// The spec 1.2.0 shared fixtures not covered by spec-conformance.test.mjs:
// manifest validation (T-012), entry sets (T-013), path matching (T-009),
// link resolution (T-011), round trips (P-004, P-005) and the generated
// archives (T-014, T-015, T-017, P-008).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from '@progress/jszip-esm';

import {
  MdzArchiveCore,
  checkManifest,
  entrySetProblem,
  findPath,
  mdzErrorCode,
  parseManifestText,
  resolveLink,
  samePath
} from '../dist/index.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const load = async (name) => JSON.parse(await fs.readFile(path.join(fixturesDir, name), 'utf8'));
const readFixture = (name) => fs.readFile(path.join(fixturesDir, name));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytesOf = async (result) => new Uint8Array(await result.blob.arrayBuffer());

test('T-012 manifest-cases.json', async () => {
  for (const c of (await load('manifest-cases.json')).cases) {
    const expected = c.expected;
    if (!expected.valid) {
      assert.throws(
        () => checkManifest(parseManifestText(c.manifestJson).manifest),
        (error) => mdzErrorCode(error) === expected.errorCode,
        c.name
      );
      continue;
    }
    const { manifest, duplicateMembers } = parseManifestText(c.manifestJson);
    assert.deepEqual(checkManifest(manifest).sort(), [...(expected.ignoredFields ?? [])].sort(), c.name);
    assert.equal(duplicateMembers.length > 0, expected.duplicateMembers ?? false, c.name);
    for (const [pointer, value] of Object.entries(expected.values ?? {})) {
      const actual = pointer.split('/').slice(1).reduce((node, key) => node[key], manifest);
      assert.deepEqual(actual, value, `${c.name}: ${pointer}`);
    }
  }
});

test('T-012 readManifest drops ignored fields and validate() reports them', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hi\n');
  zip.file('manifest.json', '{"title": 5, "language": "en", "title": "", "x-tool": {"keep": true}}');
  const archive = await MdzArchiveCore.open(await zip.generateAsync({ type: 'uint8array' }));
  const manifest = await archive.readManifest();
  assert.equal(manifest.title, undefined);
  assert.equal(manifest.language, 'en');
  assert.deepEqual(manifest['x-tool'], { keep: true });
  const { warnings, isValid } = await archive.validate();
  assert.equal(isValid, true);
  assert.ok(warnings.some((w) => w.includes("'title'") && w.includes('ignored')));
  assert.ok(warnings.some((w) => w.includes('repeats')));
});

test('T-013 entry-set-cases.json', async () => {
  const fixture = await load('entry-set-cases.json');
  for (const c of fixture.cases) {
    const problem = entrySetProblem(c.entries);
    assert.equal(problem === null, c.valid, c.name);
    if (!c.valid) assert.equal(problem.code, c.errorCode, c.name);
  }
});

test('T-013 opening an archive with those entries applies the same checks', async () => {
  for (const c of (await load('entry-set-cases.json')).cases) {
    const zip = new JSZip();
    for (const name of c.entries) {
      if (name.endsWith('/')) zip.folder(name.slice(0, -1));
      else zip.file(name, '# x\n');
    }
    zip.file(c.entries.includes('index.md') ? 'other.md' : 'index.md', '# i\n');
    const raw = await zip.generateAsync({ type: 'uint8array' });
    if (c.valid) {
      await assert.doesNotReject(() => MdzArchiveCore.open(raw), c.name);
    } else {
      await assert.rejects(() => MdzArchiveCore.open(raw), (error) => mdzErrorCode(error) === c.errorCode, c.name);
    }
  }
});

test('T-009 path-matching-cases.json', async () => {
  for (const c of await load('path-matching-cases.json')) {
    assert.equal(samePath(c.entry, c.lookup), c.matches, c.name);
  }
});

test('T-009 archive lookups are case-sensitive after NFC', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hi\n');
  zip.file('Café.md', '# nfd\n');
  const archive = await MdzArchiveCore.open(await zip.generateAsync({ type: 'uint8array' }));
  assert.equal(await archive.readText('Café.md'), '# nfd\n');
  assert.equal(archive.hasEntry('INDEX.md'), false);
  assert.equal(archive.findCaseOnlyMatch('INDEX.md'), 'index.md');
});

function fixtureHost(model, context = {}) {
  return {
    kind: (p) => (p in model.archives ? 'archive' : model.files.includes(p) ? 'file' : model.directories.includes(p) ? 'directory' : null),
    findEntry: (archive, entry) => (model.archives[archive] ? findPath(model.archives[archive].entries, entry) : null),
    entryPoint: (archive) => model.archives[archive]?.entryPoint ?? null,
    hostLocation: context.hostLocation ?? true,
    outsideLinks: context.outsideLinks ?? true,
    intoArchiveLinks: context.intoArchiveLinks ?? true,
    trustRoot: 'trustRoot' in context ? context.trustRoot : (model.trustRoot ?? ''),
    allowedPaths: context.allowedPaths ?? [],
    loadOutsideResources: context.loadOutsideResources ?? false
  };
}

test('T-011 link-resolution-cases.json', async () => {
  const fixture = await load('link-resolution-cases.json');
  for (const c of fixture.cases) {
    const source = 'archive' in c.from ? { archive: c.from.archive, path: c.from.path } : { host: c.from.host };
    const target = resolveLink(source, c.link, fixtureHost(fixture.host, c.context), c.use ?? 'navigate');
    assert.deepEqual(target, c.expected, c.name);
  }
});

test('T-011 archive.resolveLink resolves inside the archive without a host', async () => {
  const zip = new JSZip();
  zip.file('index.md', '# hi\n');
  zip.file('docs/a b.md', '# a\n');
  const archive = await MdzArchiveCore.open(await zip.generateAsync({ type: 'uint8array' }));
  assert.deepEqual(archive.resolveLink('index.md', 'docs/a%20b.md#top'), { kind: 'internal', entry: 'docs/a b.md', fragment: 'top' });
  assert.deepEqual(archive.resolveLink('docs/a b.md', '../../Notes.md'), { kind: 'unresolved', reason: 'no-host-location' });
  assert.deepEqual(archive.resolveLink('index.md', 'https://example.com'), { kind: 'url' });
});

test('P-004 / P-005 round-trip-expectations.json: every flow, saved twice', async () => {
  const exp = await load('round-trip-expectations.json');
  const original = new Uint8Array(await readFixture('round-trip.mdz'));

  const flows = {
    'open and save without an edit': async (data) => bytesOf(await MdzArchiveCore.updateFiles(data, [])),
    'change a recognized manifest field': async (data) => {
      const manifest = await (await MdzArchiveCore.open(data)).readManifest();
      return bytesOf(await MdzArchiveCore.updateFiles(data, [], [], { manifest: { ...manifest, title: 'Edited title' } }));
    },
    'edit document content': async (data) => {
      const text = await (await MdzArchiveCore.open(data)).readText('index.md');
      return bytesOf(await MdzArchiveCore.addFile(data, 'index.md', `${text}\nEdited.\n`));
    },
    'add a resource': async (data, round) =>
      bytesOf(await MdzArchiveCore.addFile(data, `images/added-${round}.png`, new Uint8Array([0x89, 0x50, 0x4e, 0x47]))),
    'remove a recognized resource': async (data, round) => {
      if (round === 2) {
        const manifest = await (await MdzArchiveCore.open(data)).readManifest();
        return bytesOf(await MdzArchiveCore.updateFiles(data, [], [], { manifest: { ...manifest, title: 'Second save' } }));
      }
      // Remove the file and its link, as a tool would (the flow lists index.md in changes).
      const text = (await (await MdzArchiveCore.open(data)).readText('index.md')).replace('See [the guide](docs/guide.md).', '');
      return bytesOf(await MdzArchiveCore.updateFiles(data, [{ path: 'index.md', content: text }], ['docs/guide.md']));
    }
  };

  for (const flow of exp.flows) {
    let data = original;
    for (const round of [1, 2]) {
      data = await flows[flow.name](data, round);
      const archive = await MdzArchiveCore.open(data);
      const manifest = JSON.parse(await archive.readText('manifest.json'));
      for (const item of exp.preservedManifestValues) {
        const value = item.pointer
          .split('/')
          .slice(1)
          .reduce((node, key) => node?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], manifest);
        assert.deepEqual(value, item.value, `${flow.name} (save ${round}): ${item.pointer}`);
      }
      for (const removed of flow.removes ?? []) {
        assert.equal(archive.hasEntry(removed), false, `${flow.name}: ${removed} should be removed`);
      }
      for (const entry of exp.preservedEntries) {
        if ((flow.changes ?? []).includes(entry.path) || (flow.removes ?? []).includes(entry.path)) continue;
        const bytes = await archive.readBytes(entry.path);
        assert.equal(bytes.length, entry.bytes, `${flow.name} (save ${round}): ${entry.path}`);
        assert.equal(sha256(bytes), entry.sha256, `${flow.name} (save ${round}): ${entry.path}`);
      }
    }
  }
});

test('archive-cases.json', async () => {
  const cases = Object.fromEntries((await load('archive-cases.json')).cases.map((c) => [c.id, c]));

  // T-017: symbolic links are skipped, never followed, and reported.
  const symlinks = cases['symlink-entries'];
  const linkBytes = await readFixture(symlinks.archive);
  const archive = await MdzArchiveCore.open(linkBytes);
  assert.equal(await archive.resolveEntryPoint(), symlinks.expectedEntryPoint);
  assert.deepEqual(archive.listSpecialFiles().sort(), Object.keys(symlinks.symlinks).sort());
  assert.equal(archive.listPaths().some((p) => p in symlinks.symlinks), false);
  for (const link of symlinks.links) {
    const target = archive.resolveLink(archive.listPaths().includes('index.md') ? 'index.md' : '', link.href);
    if (link.expected === 'resolved') {
      assert.deepEqual(target, { kind: 'internal', entry: link.target }, link.href);
    } else {
      assert.equal(target.kind, 'unresolved', link.href);
    }
  }
  await assert.rejects(() => archive.readText('shortcut.md'), /ERR_NOT_FOUND/);
  const { warnings } = await archive.validate();
  for (const name of Object.keys(symlinks.symlinks)) {
    assert.ok(warnings.some((w) => w.includes(`'${name}'`)), `reports ${name}`);
  }

  // P-008: saving keeps the links unless the caller drops them; never a silent drop.
  const kept = await MdzArchiveCore.open(await bytesOf(await MdzArchiveCore.addFile(linkBytes, 'notes.md', '# Notes\n\nEdited.\n')));
  assert.deepEqual(kept.listSpecialFiles().sort(), Object.keys(symlinks.symlinks).sort());
  const dropped = await MdzArchiveCore.open(
    await bytesOf(await MdzArchiveCore.updateFiles(linkBytes, [{ path: 'notes.md', content: '# Notes\n' }], [], { dropSpecialFiles: true }))
  );
  assert.deepEqual(dropped.listSpecialFiles(), []);

  // T-014: a method other than 0 or 8 is ERR_ZIP_INVALID.
  await assert.rejects(
    async () => MdzArchiveCore.open(await readFixture(cases['unsupported-compression'].archive)),
    (error) => mdzErrorCode(error) === 'ERR_ZIP_INVALID'
  );

  // T-015: project mode, each document addressable on its own.
  const project = cases['project-mode'];
  const projectArchive = await MdzArchiveCore.open(await readFixture(project.archive));
  assert.equal(await projectArchive.resolveMode(), 'project');
  assert.equal(await projectArchive.resolveEntryPoint(), project.expectedEntryPoint);
  const workspace = await projectArchive.openWorkspace();
  assert.deepEqual(workspace.documents.map((d) => d.path).sort(), [...project.documents].sort());
});

test('producers always write a manifest with spec.version and entryPoint, and no nulls (§6.4, §14.1)', async () => {
  const { MdzPackagerCore } = await import('../dist/index.js');
  const built = await MdzPackagerCore.buildArchive(
    [{ path: 'notes.md', text: '# Notes\n' }, { path: 'AGENTS.md', text: '# Agents\n' }],
    'Notes',
    { createIndex: false, mapFiles: false, filters: ['**/*'] }
  );
  const archive = await MdzArchiveCore.open(new Uint8Array(await built.blob.arrayBuffer()));
  const manifest = JSON.parse(await archive.readText('manifest.json'));
  assert.equal(manifest.spec.version, '1.2.0');
  assert.equal(manifest.entryPoint, 'notes.md');
  assert.equal(manifest.mode, 'document');
  assert.equal(manifest.title, 'Notes');
  assert.equal(Object.values(manifest).includes(null), false);
  assert.equal('language' in manifest, false);

  // Modifying a manifest-less archive adds one that keeps the same entry point.
  const zip = new JSZip();
  zip.file('notes.md', '# Notes\n');
  const updated = await MdzArchiveCore.addFile(await zip.generateAsync({ type: 'uint8array' }), 'AGENTS.md', '# Agents\n');
  assert.equal(updated.resolvedEntryPoint, 'notes.md');
  assert.equal(updated.manifest.entryPoint, 'notes.md');

  // ...and refuses a change that would silently move it.
  const two = new JSZip();
  two.file('index.md', '# i\n');
  two.file('other.md', '# o\n');
  await assert.rejects(
    async () => MdzArchiveCore.removeFile(await two.generateAsync({ type: 'uint8array' }), 'index.md'),
    /ERR_ENTRYPOINT_/
  );
});
