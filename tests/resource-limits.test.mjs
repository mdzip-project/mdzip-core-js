// Spec test T-018: ZIP-bomb limits (§13.1, resource-limit-cases.json), and checked reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from '@progress/jszip-esm';

import {
  MDZ_MAX_COMPRESSION_RATIO,
  MDZ_MAX_ENTRIES,
  MDZ_MAX_ENTRY_UNCOMPRESSED_BYTES,
  MDZ_MAX_TOTAL_UNCOMPRESSED_BYTES,
  MdzArchiveCore,
  MdzPackagerCore,
  mdzErrorCode
} from '../dist/index.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const data = JSON.parse(await fs.readFile(path.join(fixturesDir, 'resource-limit-cases.json'), 'utf8'));
const cases = Object.fromEntries(data.cases.map((c) => [c.id, c]));
const fixture = async (id) => new Uint8Array(await fs.readFile(path.join(fixturesDir, cases[id].archive)));
const STABLE = ['ERR_ZIP_INVALID', 'ERR_LIMIT_EXCEEDED'];
const hasCode = (codes) => (error) => codes.includes(mdzErrorCode(error));

test('T-018 defaults are no looser than the reference limits', () => {
  const ref = data.referenceLimits;
  assert.ok(MDZ_MAX_ENTRY_UNCOMPRESSED_BYTES <= ref.maxEntryUncompressedBytes);
  assert.ok(MDZ_MAX_TOTAL_UNCOMPRESSED_BYTES <= ref.maxTotalUncompressedBytes);
  assert.ok(MDZ_MAX_COMPRESSION_RATIO <= ref.maxCompressionRatio);
  assert.ok(MDZ_MAX_ENTRIES <= ref.maxEntries);
});

test('T-018 forged size: the read fails with a stable code, other entries stay readable', async () => {
  const archive = await MdzArchiveCore.open(await fixture('limit-forged-size'));
  assert.ok((await archive.readText('index.md')).length > 0);
  await assert.rejects(() => archive.readBytes(cases['limit-forged-size'].entry), hasCode(STABLE));
  await assert.rejects(() => archive.readBase64(cases['limit-forged-size'].entry), hasCode(STABLE));
});

test('T-018 high ratio: rejected at open', async () => {
  await assert.rejects(async () => MdzArchiveCore.open(await fixture('limit-high-ratio')), hasCode(['ERR_LIMIT_EXCEEDED']));
});

test('T-018 overlapping entries: rejected at open, never hidden', async () => {
  await assert.rejects(async () => MdzArchiveCore.open(await fixture('limit-overlapping-entries')), hasCode(STABLE));
});

test('a corrupted checksum fails the read with ERR_ZIP_INVALID', async () => {
  const result = await MdzPackagerCore.buildArchive(
    [{ path: 'index.md', file: new Blob(['# Hello\n\nSome text to compress.\n']) }],
    'checksum',
    { createIndex: false, mapFiles: false, filters: ['**/*'] }
  );
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  // Flip the CRC-32 of index.md in both its local header and the central directory.
  const view = new DataView(bytes.buffer);
  for (let i = 0; i + 4 <= bytes.length; i++) {
    const sig = view.getUint32(i, true);
    const nameAt = sig === 0x04034b50 ? i + 30 : sig === 0x02014b50 ? i + 46 : -1;
    if (nameAt < 0) continue;
    const nameLen = view.getUint16(sig === 0x04034b50 ? i + 26 : i + 28, true);
    if (new TextDecoder().decode(bytes.subarray(nameAt, nameAt + nameLen)) !== 'index.md') continue;
    const crcAt = sig === 0x04034b50 ? i + 14 : i + 16;
    view.setUint32(crcAt, view.getUint32(crcAt, true) ^ 1, true);
  }
  const archive = await MdzArchiveCore.open(bytes);
  await assert.rejects(() => archive.readText('index.md'), hasCode(['ERR_ZIP_INVALID']));
  assert.ok((await archive.readText('manifest.json')).includes('entryPoint'));
});

test('stored and deflated entries round-trip through checked reads', async () => {
  const binary = new Uint8Array(4096).map((_, i) => (i * 31) & 0xff);
  const zip = new JSZip();
  zip.file('index.md', new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('# Hello\n')]), { compression: 'DEFLATE' });
  zip.file('images/a.png', binary, { compression: 'STORE' });
  zip.file('empty.txt', '', { compression: 'DEFLATE' });
  const archive = await MdzArchiveCore.open(await zip.generateAsync({ type: 'uint8array' }));
  assert.deepEqual(await archive.readBytes('images/a.png'), binary);
  assert.equal(await archive.readText('index.md'), '﻿# Hello\n'); // a stored BOM is kept, as before
  assert.equal(await archive.readText('empty.txt'), '');
  assert.equal(await archive.readBase64('images/a.png'), Buffer.from(binary).toString('base64'));
});
