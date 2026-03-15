/**
 * Smoke test for the public API barrel (src/index.ts).
 * Ensures all expected symbols are exported and accessible.
 */
import { describe, it, expect } from 'vitest';
import * as api from '../src/index.js';

describe('public API barrel', () => {
  it('exports parseManifest', () => {
    expect(typeof api.parseManifest).toBe('function');
  });

  it('exports createArchive', () => {
    expect(typeof api.createArchive).toBe('function');
  });

  it('exports render', () => {
    expect(typeof api.render).toBe('function');
  });

  it('round-trips a manifest through the public API', () => {
    const json = JSON.stringify({
      version: '1',
      title: 'Test',
      entries: [{ path: 'index.md' }],
    });
    const manifest = api.parseManifest(json);
    const bytes = new TextEncoder().encode('# Hello from barrel');
    const archive = api.createArchive(manifest, new Map([['index.md', bytes]]));
    const { html } = api.render(archive);
    expect(html).toContain('<h1>Hello from barrel</h1>');
  });
});
