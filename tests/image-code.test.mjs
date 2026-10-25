import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from '@progress/jszip-esm';
import { MdzArchiveCore } from '../dist/index.js';

test('image extraction ignores code examples and keeps real images', () => {
  const markdown = [
    '`![inline](inline.png)` and `<img src="inline-html.png">`',
    '``a ` ![nested](nested.png)``',
    '`multi-line',
    '![multiline](multiline.png)`',
    '',
    '````markdown',
    '![fenced](fenced.png)',
    '```',
    '<img src="fenced-html.png">',
    '`````',
    '~~~html',
    '<img src="tilde.png">',
    '~~~~',
    '',
    '    ![indented](indented.png)',
    '',
    '\t<img src="tab.png">',
    '',
    '![real](real.png)',
    '<img src="real-html.png" title="a `backtick`">',
    '<img src="`literal`.png">',
  ].join('\r\n');
  assert.deepEqual(MdzArchiveCore.extractImageReferences(markdown), ['real.png', 'real-html.png', '`literal`.png']);
});

test('fences need matching markers and close only on a fence-only line', () => {
  for (const markdown of [
    '```\n![a](a.png)\n~~~\n![b](b.png)',
    '~~~~\n![a](a.png)\n~~~\n![b](b.png)',
    '```\n![a](a.png)\n``` trailing text\n![b](b.png)',
    '```\n![a](a.png)',
  ]) assert.deepEqual(MdzArchiveCore.extractImageReferences(markdown), []);
});

test('unmatched and escaped backticks do not swallow real images', () => {
  assert.deepEqual(MdzArchiveCore.extractImageReferences('` unmatched ![a](a.png)'), ['a.png']);
  assert.deepEqual(MdzArchiveCore.extractImageReferences('\\`![a](a.png)\\`'), ['a.png']);
  assert.deepEqual(MdzArchiveCore.extractImageReferences('`` ![a](a.png) `'), ['a.png']);
  assert.deepEqual(MdzArchiveCore.extractImageReferences('Paragraph\n    ![a](a.png)'), ['a.png']);
});

test('validation and orphan analysis ignore code but still report actual missing images', async () => {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify({ spec: { version: '1.2.0' }, entryPoint: 'index.md' }));
  zip.file('index.md', '`![example](missing.png)`\n\n```\n<img src="example.png">\n```\n\n![real](used.png)\n![broken](broken.png)');
  zip.file('example.png', new Uint8Array([1]));
  zip.file('used.png', new Uint8Array([2]));
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const archive = await MdzArchiveCore.open(bytes);
  const validation = await archive.validate();
  assert.ok(validation.warnings.some(w => w.includes('broken.png')));
  assert.ok(!validation.warnings.some(w => w.includes('missing.png')));
  const analysis = await archive.findOrphanedAssets({ scanMode: 'all-markdown' });
  assert.deepEqual(analysis.referencedAssetPaths, ['used.png']);
  assert.deepEqual(analysis.orphanedAssetPaths, ['example.png']);
  assert.equal(analysis.unresolvedReferences.length, 1);
});
