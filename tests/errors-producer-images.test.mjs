// Error codes on MdzError (#5), producer.application (#6), and validate()
// warnings for images that aren't in the archive (#7).
import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from '@progress/jszip-esm';

import { MdzArchiveCore, MdzError, MdzPackagerCore, mdzErrorCode } from '../dist/index.js';

const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
const PACK = { createIndex: false, mapFiles: false, filters: ['**/*'] };

async function pack(files, options = {}) {
  const { blob } = await MdzPackagerCore.buildArchive(files, 'Test', { ...PACK, title: 'Test', entryPoint: 'index.md', ...options });
  return new Uint8Array(await blob.arrayBuffer());
}

async function zip(entries) {
  const z = new JSZip();
  for (const [name, content] of Object.entries(entries)) z.file(name, content);
  return new Uint8Array(await z.generateAsync({ type: 'uint8array' }));
}

// --- #5: error codes -------------------------------------------------------

test('errors are MdzErrors with a code, and the message still starts with it', async () => {
  const bytes = await zip({ 'manifest.json': JSON.stringify({ spec: { version: '1.2.0' }, entryPoint: 'gone.md' }), 'notes.md': '# N\n' });
  const archive = await MdzArchiveCore.open(bytes);
  await assert.rejects(archive.resolveEntryPoint(), (error) => {
    assert.ok(error instanceof MdzError);
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'MdzError');
    assert.equal(error.code, 'ERR_ENTRYPOINT_MISSING');
    assert.match(error.message, /^ERR_ENTRYPOINT_MISSING: /);
    assert.equal(mdzErrorCode(error), 'ERR_ENTRYPOINT_MISSING');
    return true;
  });
});

test('a file that is not a ZIP gives a short ERR_ZIP_INVALID, with the ZIP library\'s text as the cause', async () => {
  await assert.rejects(MdzArchiveCore.open(new TextEncoder().encode('this is not a zip file')), (error) => {
    assert.ok(error instanceof MdzError);
    assert.equal(error.code, 'ERR_ZIP_INVALID');
    assert.equal(error.message, 'ERR_ZIP_INVALID: The file is not a valid ZIP archive.');
    assert.doesNotMatch(error.message, /stuk\.github\.io|is this a zip file/);
    assert.ok(error.cause instanceof Error);
    return true;
  });
});

test('mutation errors carry codes too', async () => {
  const bytes = await pack([{ path: 'index.md', text: '# A\n' }]);
  await assert.rejects(MdzArchiveCore.updateFiles(bytes, [{ path: '../escape.md', content: 'x' }]), (error) => {
    assert.ok(error instanceof MdzError);
    assert.equal(error.code, 'ERR_PATH_INVALID');
    return true;
  });
});

test('MdzError.fromMessage splits a "CODE: message" string', () => {
  const error = MdzError.fromMessage('ERR_NOT_FOUND: entry "x.md" is not in the archive');
  assert.equal(error.code, 'ERR_NOT_FOUND');
  assert.equal(error.message, 'ERR_NOT_FOUND: entry "x.md" is not in the archive');
});

// --- #6: producer.application ---------------------------------------------

test('buildArchive records producer.application next to producer.core', async () => {
  const bytes = await pack([{ path: 'index.md', text: '# A\n' }], {
    application: { name: 'Tiny MD', version: '0.3.0', url: 'https://example.com', extra: 'ignored', empty: '' }
  });
  const manifest = await (await MdzArchiveCore.open(bytes)).readManifest();
  assert.deepEqual(manifest.producer.application, { name: 'Tiny MD', version: '0.3.0', url: 'https://example.com' });
  assert.equal(manifest.producer.core.name, 'mdzip-core-js');
  assert.deepEqual((await MdzArchiveCore.validate(bytes)).warnings, []);
});

test('no application, or one with no usable fields, writes only producer.core', async () => {
  for (const application of [undefined, null, {}, { name: '  ' }]) {
    const bytes = await pack([{ path: 'index.md', text: '# A\n' }], { application });
    const manifest = await (await MdzArchiveCore.open(bytes)).readManifest();
    assert.equal(manifest.producer.application, undefined);
    assert.ok(manifest.producer.core);
  }
});

test('buildWorkspace records producer.application', async () => {
  const workspace = await MdzArchiveCore.openWorkspace(await pack([{ path: 'index.md', text: '# A\n' }]));
  const { blob } = await MdzPackagerCore.buildWorkspace(workspace, { application: { name: 'Studio', version: '1.6.0' } });
  const manifest = await (await MdzArchiveCore.open(new Uint8Array(await blob.arrayBuffer()))).readManifest();
  assert.deepEqual(manifest.producer.application, { name: 'Studio', version: '1.6.0' });
});

// --- #7: missing images ----------------------------------------------------

test('validate warns about images a document uses that are not in the archive', async () => {
  const bytes = await pack([
    { path: 'index.md', text: '# A\n\n![ok](images/a.png)\n\n![gone](images/gone.png)\n\n<img src="images/also-gone.png" alt="x">\n\n![twice](images/gone.png)\n' },
    { path: 'docs/guide.md', text: '![up](../images/a.png) ![case](../Images/A.png)\n' },
    { path: 'images/a.png', data: PNG }
  ]);
  const { isValid, errors, warnings } = await MdzArchiveCore.validate(bytes);
  assert.equal(isValid, true);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, [
    'docs/guide.md uses image "../Images/A.png", which is not in the archive. (Did you mean "images/a.png"? Paths are case-sensitive.)',
    'index.md uses image "images/gone.png", which is not in the archive.',
    'index.md uses image "images/also-gone.png", which is not in the archive.'
  ]);
});

test('web, data: and outside-the-archive images are not reported as missing', async () => {
  const bytes = await pack([
    { path: 'index.md', text: '![w](https://example.com/x.png) ![d](data:image/png;base64,AA==) ![o](../outside.png) ![r](/root.png)\n' }
  ]);
  assert.deepEqual((await MdzArchiveCore.validate(bytes)).warnings, []);
});

test('an archive with every image present has no image warnings', async () => {
  const bytes = await pack([
    { path: 'index.md', text: '![a](images/my%20photo.png) <img src="images/my photo.png">\n' },
    { path: 'images/my photo.png', data: PNG }
  ]);
  assert.deepEqual((await MdzArchiveCore.validate(bytes)).warnings, []);
});

test('validate({ checkImages: false }) and openWorkspace skip the image check', async () => {
  const bytes = await pack([{ path: 'index.md', text: '![gone](images/gone.png)\n' }]);
  assert.equal((await MdzArchiveCore.validate(bytes)).warnings.length, 1);
  assert.deepEqual((await MdzArchiveCore.validate(bytes, undefined, { checkImages: false })).warnings, []);
  const workspace = await MdzArchiveCore.openWorkspace(bytes);
  assert.deepEqual(workspace.validation.warnings, []);
});
