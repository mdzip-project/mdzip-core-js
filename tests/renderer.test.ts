import { describe, it, expect } from 'vitest';
import { render } from '../src/renderer.js';
import { createArchive } from '../src/parser.js';
import type { MdzManifest } from '../src/types.js';

function makeArchive(source: string, entryPath = 'index.md') {
  const manifest: MdzManifest = {
    version: '1',
    entries: [{ path: entryPath, mimeType: 'text/markdown' }],
  };
  const bytes = new TextEncoder().encode(source);
  return createArchive(manifest, new Map([[entryPath, bytes]]));
}

describe('render', () => {
  it('renders a heading', () => {
    const archive = makeArchive('# Hello');
    const { html } = render(archive);
    expect(html).toContain('<h1>Hello</h1>');
  });

  it('renders multiple heading levels', () => {
    const archive = makeArchive('## Two\n### Three\n#### Four\n##### Five\n###### Six');
    const { html } = render(archive);
    expect(html).toContain('<h2>Two</h2>');
    expect(html).toContain('<h3>Three</h3>');
    expect(html).toContain('<h4>Four</h4>');
    expect(html).toContain('<h5>Five</h5>');
    expect(html).toContain('<h6>Six</h6>');
  });

  it('wraps plain text in a paragraph', () => {
    const archive = makeArchive('Hello world');
    const { html } = render(archive);
    expect(html).toContain('<p>Hello world</p>');
  });

  it('escapes HTML in source', () => {
    const archive = makeArchive('# <script>alert(1)</script>');
    const { html } = render(archive);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('resolves relative src attributes when baseUrl is provided', () => {
    const archive = makeArchive('![photo](image.png)');
    const { html } = render(archive, { baseUrl: 'https://cdn.example.com' });
    expect(html).toContain('src="https://cdn.example.com/image.png"');
  });

  it('falls back to first .md entry when index.md is absent', () => {
    const manifest: MdzManifest = {
      version: '1',
      entries: [{ path: 'doc.md', mimeType: 'text/markdown' }],
    };
    const bytes = new TextEncoder().encode('# Fallback');
    const archive = createArchive(manifest, new Map([['doc.md', bytes]]));
    const { html } = render(archive);
    expect(html).toContain('<h1>Fallback</h1>');
  });

  it('throws when no renderable entry is found', () => {
    const manifest: MdzManifest = { version: '1', entries: [] };
    const archive = createArchive(manifest);
    expect(() => render(archive)).toThrow('no renderable entry');
  });

  it('throws when the entry has no content', () => {
    const manifest: MdzManifest = {
      version: '1',
      entries: [{ path: 'index.md' }],
    };
    // archive without bytes for index.md
    const archive = createArchive(manifest, new Map());
    expect(() => render(archive)).toThrow('"index.md"');
  });
});
