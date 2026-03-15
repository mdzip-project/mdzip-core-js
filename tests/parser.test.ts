import { describe, it, expect } from 'vitest';
import { parseManifest, createArchive } from '../src/parser.js';
import type { MdzManifest } from '../src/types.js';

// ---------------------------------------------------------------------------
// parseManifest
// ---------------------------------------------------------------------------

describe('parseManifest', () => {
  it('parses a minimal valid manifest', () => {
    const json = JSON.stringify({ version: '1', entries: [] });
    const manifest = parseManifest(json);
    expect(manifest.version).toBe('1');
    expect(manifest.entries).toHaveLength(0);
  });

  it('parses all optional fields', () => {
    const json = JSON.stringify({
      version: '1',
      title: 'My Doc',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
      entries: [{ path: 'index.md', mimeType: 'text/markdown', size: 512 }],
    });
    const manifest = parseManifest(json);
    expect(manifest.title).toBe('My Doc');
    expect(manifest.createdAt).toBe('2024-01-01T00:00:00Z');
    expect(manifest.updatedAt).toBe('2024-06-01T00:00:00Z');
    expect(manifest.entries[0]).toMatchObject({
      path: 'index.md',
      mimeType: 'text/markdown',
      size: 512,
    });
  });

  it('ignores unknown optional fields gracefully', () => {
    const json = JSON.stringify({
      version: '2',
      entries: [{ path: 'doc.md', unknown: true }],
    });
    const manifest = parseManifest(json);
    expect(manifest.version).toBe('2');
    expect(manifest.entries[0]?.path).toBe('doc.md');
  });

  it('throws on non-JSON input', () => {
    expect(() => parseManifest('not json')).toThrow('not valid JSON');
  });

  it('throws when version is missing', () => {
    const json = JSON.stringify({ entries: [] });
    expect(() => parseManifest(json)).toThrow('version');
  });

  it('throws when entries is missing', () => {
    const json = JSON.stringify({ version: '1' });
    expect(() => parseManifest(json)).toThrow('entries');
  });

  it('throws when an entry is missing path', () => {
    const json = JSON.stringify({ version: '1', entries: [{ mimeType: 'text/plain' }] });
    expect(() => parseManifest(json)).toThrow('path');
  });

  it('throws on a non-object manifest', () => {
    expect(() => parseManifest('"string"')).toThrow('JSON object');
  });
});

// ---------------------------------------------------------------------------
// createArchive
// ---------------------------------------------------------------------------

describe('createArchive', () => {
  const manifest: MdzManifest = {
    version: '1',
    entries: [{ path: 'index.md', mimeType: 'text/markdown' }],
  };

  it('exposes the manifest on the archive object', () => {
    const archive = createArchive(manifest);
    expect(archive.manifest).toBe(manifest);
  });

  it('returns undefined for missing entries', () => {
    const archive = createArchive(manifest);
    expect(archive.readEntry('missing.md')).toBeUndefined();
    expect(archive.readEntryText('missing.md')).toBeUndefined();
  });

  it('reads raw bytes for a stored entry', () => {
    const bytes = new TextEncoder().encode('# Hello');
    const entries = new Map([['index.md', bytes]]);
    const archive = createArchive(manifest, entries);
    expect(archive.readEntry('index.md')).toBe(bytes);
  });

  it('reads text content for a stored entry', () => {
    const bytes = new TextEncoder().encode('# Hello world');
    const entries = new Map([['index.md', bytes]]);
    const archive = createArchive(manifest, entries);
    expect(archive.readEntryText('index.md')).toBe('# Hello world');
  });
});
