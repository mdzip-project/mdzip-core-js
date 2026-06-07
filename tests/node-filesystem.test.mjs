import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { MdzArchiveCore } from '../dist/index.js';
import { extractArchive, packDirectory } from '../dist/node.js';

async function withTempDirectory(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mdzip-core-js-'));
  try {
    await run(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

test('packDirectory recursively packages a folder and writes an MDZ file', async () => {
  await withTempDirectory(async (root) => {
    const source = path.join(root, 'source');
    const output = path.join(root, 'packed.mdz');
    await fs.mkdir(path.join(source, 'assets'), { recursive: true });
    await fs.writeFile(path.join(source, 'index.md'), '# Packed\n');
    await fs.writeFile(path.join(source, 'assets', 'data.bin'), Uint8Array.from([1, 2, 3]));

    const result = await packDirectory(source, output);
    const archive = await MdzArchiveCore.open(await fs.readFile(output));

    assert.deepEqual(result.archivePaths, ['assets/data.bin', 'index.md']);
    assert.equal(await archive.readText('index.md'), '# Packed\n');
    assert.deepEqual(Array.from(await archive.readBytes('assets/data.bin')), [1, 2, 3]);
  });
});

test('extractArchive recreates archive files and protects existing targets', async () => {
  await withTempDirectory(async (root) => {
    const source = path.join(root, 'source');
    const archivePath = path.join(root, 'packed.mdz');
    const destination = path.join(root, 'extracted');
    await fs.mkdir(path.join(source, 'docs'), { recursive: true });
    await fs.writeFile(path.join(source, 'docs', 'guide.md'), '# Guide\n');
    await fs.writeFile(path.join(source, 'raw.bin'), Uint8Array.from([9, 8, 7]));
    await packDirectory(source, archivePath);

    const result = await extractArchive(archivePath, destination);
    assert.deepEqual(result.extractedPaths, ['docs/guide.md', 'index.md', 'raw.bin']);
    assert.equal(await fs.readFile(path.join(destination, 'docs', 'guide.md'), 'utf8'), '# Guide\n');
    assert.match(await fs.readFile(path.join(destination, 'index.md'), 'utf8'), /docs\/guide\.md/);
    assert.deepEqual(Array.from(await fs.readFile(path.join(destination, 'raw.bin'))), [9, 8, 7]);

    await assert.rejects(
      () => extractArchive(archivePath, destination),
      /ERR_EXTRACT_TARGET_EXISTS/
    );
    await assert.doesNotReject(
      () => extractArchive(archivePath, destination, { overwrite: true })
    );
  });
});

test('packDirectory rejects symbolic links', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Creating symbolic links may require elevated Windows privileges.');
    return;
  }
  await withTempDirectory(async (root) => {
    const source = path.join(root, 'source');
    await fs.mkdir(source);
    await fs.writeFile(path.join(root, 'outside.md'), '# Outside\n');
    await fs.symlink(path.join(root, 'outside.md'), path.join(source, 'linked.md'));

    await assert.rejects(
      () => packDirectory(source),
      /ERR_PACK_SYMLINK/
    );
  });
});

test('extractArchive refuses to traverse destination symbolic links', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Creating symbolic links may require elevated Windows privileges.');
    return;
  }
  await withTempDirectory(async (root) => {
    const source = path.join(root, 'source');
    const destination = path.join(root, 'destination');
    const outside = path.join(root, 'outside');
    await fs.mkdir(path.join(source, 'docs'), { recursive: true });
    await fs.mkdir(destination);
    await fs.mkdir(outside);
    await fs.writeFile(path.join(source, 'docs', 'guide.md'), '# Guide\n');
    const packed = await packDirectory(source);
    const packedBytes = new Uint8Array(await packed.blob.arrayBuffer());
    await fs.symlink(outside, path.join(destination, 'docs'));

    await assert.rejects(
      () => extractArchive(packedBytes, destination),
      /ERR_EXTRACT_SYMLINK/
    );
    await assert.rejects(
      () => fs.access(path.join(outside, 'guide.md'))
    );
  });
});
