import type { MdzArchive, RenderOptions, RenderResult } from './types.js';

const DEFAULT_OPTIONS: Required<RenderOptions> = {
  baseUrl: '',
  sanitize: true,
};

/**
 * Renders the primary content entry of an {@link MdzArchive} to HTML.
 *
 * The renderer looks for an entry named `index.md` (or the first `.md` entry
 * in the manifest) and converts its Markdown source to HTML.
 *
 * **Note:** A full Markdown-to-HTML pipeline will be wired in once the core
 * code is migrated.  This placeholder returns a clearly-labelled HTML
 * fragment so the public API contract is exercisable today.
 *
 * @param archive - The archive to render.
 * @param options - Optional render configuration.
 * @returns A {@link RenderResult} containing the produced HTML.
 * @throws {Error} When no renderable entry is found in the archive.
 */
export function render(archive: MdzArchive, options: RenderOptions = {}): RenderResult {
  const opts: Required<RenderOptions> = { ...DEFAULT_OPTIONS, ...options };

  const entryPath = resolveEntryPath(archive);
  if (entryPath === undefined) {
    throw new Error('MdzRenderer: no renderable entry found in archive');
  }

  const source = archive.readEntryText(entryPath);
  if (source === undefined) {
    throw new Error(`MdzRenderer: entry "${entryPath}" has no content`);
  }

  const html = convertMarkdown(source, opts);
  return { html };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveEntryPath(archive: MdzArchive): string | undefined {
  const { entries } = archive.manifest;

  const indexEntry = entries.find((e) => e.path === 'index.md');
  if (indexEntry) return indexEntry.path;

  const firstMd = entries.find((e) => e.path.endsWith('.md'));
  return firstMd?.path;
}

/**
 * Minimal Markdown→HTML converter used as a placeholder until the full
 * pipeline is migrated.  Handles headings, paragraphs, and Markdown image
 * syntax (`![alt](src)`).
 */
function convertMarkdown(source: string, opts: Required<RenderOptions>): string {
  const html = source
    .split('\n')
    .map((line) => {
      const h6 = line.match(/^#{6}\s+(.*)/);
      if (h6) return `<h6>${escapeHtml(h6[1] ?? '')}</h6>`;
      const h5 = line.match(/^#{5}\s+(.*)/);
      if (h5) return `<h5>${escapeHtml(h5[1] ?? '')}</h5>`;
      const h4 = line.match(/^#{4}\s+(.*)/);
      if (h4) return `<h4>${escapeHtml(h4[1] ?? '')}</h4>`;
      const h3 = line.match(/^#{3}\s+(.*)/);
      if (h3) return `<h3>${escapeHtml(h3[1] ?? '')}</h3>`;
      const h2 = line.match(/^#{2}\s+(.*)/);
      if (h2) return `<h2>${escapeHtml(h2[1] ?? '')}</h2>`;
      const h1 = line.match(/^#\s+(.*)/);
      if (h1) return `<h1>${escapeHtml(h1[1] ?? '')}</h1>`;
      if (line.trim() === '') return '';

      // Convert Markdown image syntax before general escaping
      const imgLine = line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, src: string) => {
        const resolvedSrc =
          opts.baseUrl && !/^https?:\/\//.test(src) ? `${opts.baseUrl}/${src}` : src;
        return `<img src="${resolvedSrc}" alt="${escapeHtml(alt)}">`;
      });

      // If the line was fully consumed by image tags, return as-is without paragraph wrapping
      if (imgLine !== line) {
        return `<p>${imgLine}</p>`;
      }

      return `<p>${escapeHtml(line)}</p>`;
    })
    .filter((line) => line !== '')
    .join('\n');

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
