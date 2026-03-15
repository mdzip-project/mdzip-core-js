import JSZip from 'jszip';

type MdzCoreZipAsyncKind = 'text' | 'base64' | 'arraybuffer';

export type MdzCoreArchiveBinary = Blob | ArrayBuffer | Uint8Array;

interface ZipEntry {
  name: string;
  dir: boolean;
  async(kind: MdzCoreZipAsyncKind): Promise<string | ArrayBuffer>;
}

interface ZipLike {
  files: Record<string, ZipEntry>;
}

interface ZipFactoryLike {
  loadAsync(data: MdzCoreArchiveBinary): Promise<ZipLike>;
}

interface ZipWriterLike {
  file(path: string, data: string | ArrayBuffer): void;
  generateAsync(options: { type: 'blob'; compression: 'DEFLATE'; compressionOptions: { level: number } }): Promise<Blob>;
}

interface ZipWriterFactoryLike {
  create(): ZipWriterLike;
}

export interface MdzManifestAuthor {
  name: string;
}

export interface MdzManifestFileMapEntry {
  path: string;
  originalPath: string;
  title: string;
}

export interface MdzManifest {
  mdz: string;
  title: string;
  entryPoint?: string | null;
  language?: string | null;
  authors?: MdzManifestAuthor[] | null;
  description?: string | null;
  version?: string | null;
  files?: MdzManifestFileMapEntry[];
}

export interface MdzPackOptions {
  createIndex: boolean;
  mapFiles: boolean;
  filters: string[];
  title?: string | null;
  entryPoint?: string | null;
  language?: string | null;
  author?: string | null;
  description?: string | null;
  docVersion?: string | null;
}

export interface MdzPackInputFile {
  path: string;
  file?: File;
  text?: string;
}

export interface MdzSelectedFile {
  archivePath: string;
  originalPath: string;
  file?: File;
  text?: string;
}

export interface MdzPackWarnings {
  invalidPathCount: number;
  sanitizedPathCount: number;
  skippedByReason: Record<string, number>;
  unresolvedEntry: boolean;
}

export interface MdzPackBuildResult {
  blob: Blob;
  manifest: MdzManifest | null;
  resolvedEntryPoint: string | null;
  archivePaths: string[];
  selected: MdzSelectedFile[];
  warnings: MdzPackWarnings;
}

export const MDZ_IMAGE_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon'
};

export class MdzArchiveCore {
  public static readonly IMAGE_MIME_TYPES = MDZ_IMAGE_MIME_TYPES;
  private static readonly SUPPORTED_MDZ_MAJOR = 1;
  private static readonly SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  private static readonly entriesCache = new WeakMap<ZipLike, Record<string, ZipEntry>>();
  private static readonly manifestCache = new WeakMap<ZipLike, MdzManifest | null>();

  public constructor(private readonly zip: ZipLike) {}

  public static async open(input: MdzCoreArchiveBinary, zipFactory?: ZipFactoryLike): Promise<MdzArchiveCore> {
    const factory = zipFactory ?? MdzArchiveCore.getDefaultZipFactory();
    const zip = await factory.loadAsync(input);
    return new MdzArchiveCore(zip);
  }

  private static getDefaultZipFactory(): ZipFactoryLike {
    return {
      async loadAsync(data: MdzCoreArchiveBinary): Promise<ZipLike> {
        const zip = await JSZip.loadAsync(data as unknown as Parameters<typeof JSZip.loadAsync>[0]);
        return zip as unknown as ZipLike;
      }
    };
  }

  public static normalizePath(path: string): string {
    return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
  }

  public static isMarkdownFile(path: string): boolean {
    return /\.(md|markdown)$/i.test(path);
  }

  public static validateArchivePath(path: string): string | null {
    const raw = String(path || '');
    if (!raw) return 'empty path';
    if (raw.startsWith('/')) return 'leading slash';
    if (raw.includes('\\')) return 'reserved character';

    const normalized = raw;
    if (normalized.split('/').includes('..')) return 'path traversal';
    for (const c of normalized) {
      const code = c.charCodeAt(0);
      if (c === '\0' || (code >= 1 && code <= 31) || code === 127) return 'control char';
    }
    if (/[\\:*?"<>|]/.test(normalized)) return 'reserved character';
    return null;
  }

  private static dirOf(filePath: string): string {
    const i = filePath.lastIndexOf('/');
    return i >= 0 ? filePath.slice(0, i + 1) : '';
  }

  public static resolvePath(base: string, relative: string): string {
    let target = String(relative || '').trim();
    if (target.startsWith('<') && target.endsWith('>')) {
      target = target.slice(1, -1).trim();
    }
    const q = target.indexOf('?');
    if (q >= 0) target = target.slice(0, q);
    const h = target.indexOf('#');
    if (h >= 0) target = target.slice(0, h);

    try {
      target = decodeURI(target);
    } catch {
      // keep original
    }

    target = target.replace(/\\/g, '/');
    if (target.startsWith('/')) throw new Error('Path must be relative');

    const parts = (MdzArchiveCore.dirOf(base) + target).split('/');
    const out: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        if (out.length === 0) throw new Error('Path escapes archive root');
        out.pop();
        continue;
      }
      if (part === '.') continue;
      out.push(part);
    }

    return out.join('/');
  }

  public findEntry(path: string): ZipEntry | null {
    const normalized = MdzArchiveCore.normalizePath(path);
    if (this.zip.files[normalized]) return this.zip.files[normalized];

    if (!MdzArchiveCore.entriesCache.has(this.zip)) {
      MdzArchiveCore.entriesCache.set(
        this.zip,
        Object.fromEntries(Object.entries(this.zip.files).map(([k, v]) => [MdzArchiveCore.normalizePath(k).toLowerCase(), v]))
      );
    }

    return MdzArchiveCore.entriesCache.get(this.zip)?.[normalized.toLowerCase()] ?? null;
  }

  private static validateManifest(manifest: unknown): asserts manifest is MdzManifest {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json must be a JSON object.');
    }
    const candidate = manifest as Partial<MdzManifest>;
    if (typeof candidate.mdz !== 'string' || !MdzArchiveCore.SEMVER_RE.test(candidate.mdz)) {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json must include a valid semver "mdz" field.');
    }
    if (candidate.title != null && (typeof candidate.title !== 'string' || candidate.title.trim() === '')) {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json "title" must be a non-empty string when provided.');
    }

    const major = Number.parseInt(candidate.mdz.split('.')[0] ?? '0', 10);
    if (major > MdzArchiveCore.SUPPORTED_MDZ_MAJOR) {
      throw new Error(`ERR_VERSION_UNSUPPORTED: manifest.json targets mdz ${candidate.mdz}, but this viewer supports major ${MdzArchiveCore.SUPPORTED_MDZ_MAJOR}.x only.`);
    }

    if (candidate.entryPoint != null && typeof candidate.entryPoint !== 'string') {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json "entryPoint" must be a string when provided.');
    }
  }

  public async readManifest(): Promise<MdzManifest | null> {
    if (MdzArchiveCore.manifestCache.has(this.zip)) {
      return MdzArchiveCore.manifestCache.get(this.zip) ?? null;
    }

    const entry = this.zip.files['manifest.json'];
    if (!entry) {
      MdzArchiveCore.manifestCache.set(this.zip, null);
      return null;
    }

    const raw = await entry.async('text');
    let manifest: unknown;
    try {
      manifest = JSON.parse(String(raw));
    } catch {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json is not valid JSON');
    }

    MdzArchiveCore.validateManifest(manifest);
    MdzArchiveCore.manifestCache.set(this.zip, manifest);
    return manifest;
  }

  public async resolveEntryPoint(): Promise<string> {
    const manifest = await this.readManifest();
    const archivePaths = Object.keys(this.zip.files)
      .filter((p) => !this.zip.files[p]?.dir)
      .map((p) => MdzArchiveCore.normalizePath(p));

    if (manifest?.entryPoint && !archivePaths.some((p) => p.toLowerCase() === manifest.entryPoint!.toLowerCase())) {
      throw new Error(`ERR_ENTRYPOINT_MISSING: manifest.json references "${manifest.entryPoint}" which is not in the archive`);
    }

    const resolved = MdzPackagerCore.resolveEntryPoint(archivePaths, manifest);

    if (resolved) return resolved;

    const rootMd = archivePaths.filter((p) => !p.includes('/') && MdzArchiveCore.isMarkdownFile(p));
    if (rootMd.length > 1) {
      throw new Error('ERR_ENTRYPOINT_UNRESOLVED: Multiple Markdown files at the archive root and no manifest.json entryPoint. Add an index.md or manifest.json entryPoint.');
    }
    throw new Error('ERR_ENTRYPOINT_UNRESOLVED: No Markdown file found at the archive root.');
  }
}

export class MdzPackagerCore {
  public static readonly DEFAULT_FILTERS = [
    '**/*.md',
    '**/*.markdown',
    '**/*.png',
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.gif',
    '**/*.webp',
    '**/*.svg',
    '**/*.avif'
  ];

  public static normalizePath(path: string): string {
    return MdzArchiveCore.normalizePath(path).replace(/^\.\//, '');
  }

  public static validateArchivePath(path: string): string | null {
    return MdzArchiveCore.validateArchivePath(path);
  }

  public static sanitisePathSegment(segment: string): string {
    let out = '';
    for (const c of segment) {
      const code = c.charCodeAt(0);
      if (/[\\:*?"<>|]/.test(c) || c === '\0' || (code >= 1 && code <= 31) || code === 127) out += '_';
      else out += c;
    }
    out = out.trim();
    if (!out) return '_';
    if (out === '.' || out === '..') return out.replace(/\./g, '_');
    return out;
  }

  public static sanitiseArchivePath(path: string): string {
    return MdzPackagerCore.normalizePath(path)
      .split('/')
      .filter(Boolean)
      .map(MdzPackagerCore.sanitisePathSegment)
      .join('/');
  }

  public static makeUniqueArchivePath(candidate: string, usedPaths: Set<string>): string {
    if (!usedPaths.has(candidate.toLowerCase())) {
      usedPaths.add(candidate.toLowerCase());
      return candidate;
    }

    const slash = candidate.lastIndexOf('/');
    const dir = slash >= 0 ? candidate.slice(0, slash + 1) : '';
    const name = slash >= 0 ? candidate.slice(slash + 1) : candidate;
    const dot = name.lastIndexOf('.');
    const base = dot >= 0 ? name.slice(0, dot) : name;
    const ext = dot >= 0 ? name.slice(dot) : '';

    let n = 2;
    while (true) {
      const next = `${dir}${base}-${n}${ext}`;
      if (!usedPaths.has(next.toLowerCase())) {
        usedPaths.add(next.toLowerCase());
        return next;
      }
      n += 1;
    }
  }

  public static globMatch(path: string, pattern: string): boolean {
    const pathParts = path.split('/').filter(Boolean);
    const patternParts = pattern.replace(/\\/g, '/').split('/').filter(Boolean);

    const segmentMatch = (segment: string, pat: string): boolean => {
      let si = 0;
      let pi = 0;
      let star = -1;
      let match = 0;

      while (si < segment.length) {
        const patChar = pat.charAt(pi);
        const segChar = segment.charAt(si);
        if (pi < pat.length && (patChar === '?' || patChar.toLowerCase() === segChar.toLowerCase())) {
          si += 1;
          pi += 1;
        } else if (pi < pat.length && patChar === '*') {
          star = pi;
          pi += 1;
          match = si;
        } else if (star !== -1) {
          pi = star + 1;
          match += 1;
          si = match;
        } else {
          return false;
        }
      }

      while (pi < pat.length && pat[pi] === '*') pi += 1;
      return pi === pat.length;
    };

    const matchParts = (pi: number, gi: number): boolean => {
      if (gi === patternParts.length) return pi === pathParts.length;
      const part = patternParts[gi];
      if (part == null) return false;
      if (part === '**') {
        if (gi === patternParts.length - 1) return true;
        for (let skip = pi; skip <= pathParts.length; skip += 1) {
          if (matchParts(skip, gi + 1)) return true;
        }
        return false;
      }
      if (pi >= pathParts.length) return false;
      const pathPart = pathParts[pi];
      if (pathPart == null) return false;
      return segmentMatch(pathPart, part) && matchParts(pi + 1, gi + 1);
    };

    return matchParts(0, 0);
  }

  public static matchesAnyFilter(path: string, filters: string[]): boolean {
    return filters.some((pattern) => MdzPackagerCore.globMatch(path, pattern));
  }

  public static buildManifestFromOptions(rootName: string, options: MdzPackOptions): MdzManifest | null {
    const hasManifestOption =
      options.mapFiles
      || !!options.title
      || !!options.entryPoint
      || !!options.language
      || !!options.author
      || !!options.description
      || !!options.docVersion;

    if (!hasManifestOption) return null;

    return {
      mdz: '1.0.0',
      title: options.title || rootName,
      entryPoint: options.entryPoint || null,
      language: options.language || 'en',
      authors: options.author ? [{ name: options.author }] : null,
      description: options.description || null,
      version: options.docVersion || null
    };
  }

  public static resolveEntryPoint(archivePaths: string[], manifest?: Pick<MdzManifest, 'entryPoint'> | null): string | null {
    if (manifest?.entryPoint && archivePaths.some((p) => p.toLowerCase() === manifest.entryPoint!.toLowerCase())) {
      return manifest.entryPoint;
    }
    if (archivePaths.some((p) => p.toLowerCase() === 'index.md')) return 'index.md';

    const rootMarkdown = archivePaths.filter((p) => !p.includes('/') && MdzArchiveCore.isMarkdownFile(p));
    return rootMarkdown.length === 1 ? (rootMarkdown[0] ?? null) : null;
  }

  public static buildGeneratedIndex(markdownPaths: string[], title?: string | null): string {
    const pageTitle = title && title.trim() ? title.trim() : 'Index';
    const lines = [`# ${pageTitle}`, ''];

    if (!markdownPaths.length) {
      lines.push('No Markdown files were found.');
      return lines.join('\n');
    }

    const sorted = markdownPaths.slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    for (const p of sorted) {
      const fileName = p.split('/').pop() || p;
      const encoded = p.split('/').map(encodeURIComponent).join('/');
      lines.push(`- [${fileName}](<${encoded}>)`);
    }

    lines.push('', '---', '', 'Generated by `mdz-core`', '', 'More info: [markdownzip.org](https://markdownzip.org)');
    return lines.join('\n');
  }

  public static async buildArchive(
    files: MdzPackInputFile[],
    rootName: string,
    options: MdzPackOptions,
    zipWriterFactory?: ZipWriterFactoryLike
  ): Promise<MdzPackBuildResult> {
    const cleanInput = files
      .map((f) => ({ path: MdzPackagerCore.normalizePath(f.path), file: f.file, text: f.text }))
      .filter((f) => f.path && !f.path.endsWith('/'));

    if (!cleanInput.length) {
      throw new Error('ERR_PACK_NO_INPUT: No files found to package.');
    }

    const manifest = MdzPackagerCore.buildManifestFromOptions(rootName, options);
    const skipMap = new Map<string, number>();
    const usedPaths = new Set<string>();
    const selected: MdzSelectedFile[] = [];
    const manifestFiles: MdzManifestFileMapEntry[] = [];

    let invalidPathCount = 0;
    let sanitizedPathCount = 0;

    const addSkip = (reason: string): void => {
      skipMap.set(reason, (skipMap.get(reason) || 0) + 1);
    };

    for (const item of cleanInput) {
      const originalPath = item.path;
      let archivePath = originalPath;

      if (!MdzPackagerCore.matchesAnyFilter(originalPath, options.filters)) {
        addSkip('excluded by filter');
        continue;
      }

      if (manifest && archivePath.toLowerCase() === 'manifest.json') {
        addSkip('manifest.json replaced by generated manifest');
        continue;
      }

      const pathError = MdzPackagerCore.validateArchivePath(archivePath);
      if (pathError) {
        invalidPathCount += 1;
        if (!options.mapFiles) {
          addSkip('invalid path for MDZ rules');
          continue;
        }
        archivePath = MdzPackagerCore.makeUniqueArchivePath(MdzPackagerCore.sanitiseArchivePath(archivePath), usedPaths);
        sanitizedPathCount += 1;
      } else {
        archivePath = MdzPackagerCore.makeUniqueArchivePath(archivePath, usedPaths);
      }

      const selectedItem: MdzSelectedFile = { archivePath, originalPath };
      if (item.file) selectedItem.file = item.file;
      if (item.text != null) selectedItem.text = item.text;
      selected.push(selectedItem);

      if (options.mapFiles && manifest && MdzArchiveCore.isMarkdownFile(archivePath)) {
        const base = originalPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || originalPath;
        manifestFiles.push({ path: archivePath, originalPath, title: base.replace(/[_-]+/g, ' ').trim() || originalPath });
      }
    }

    let archivePaths = selected.map((f) => f.archivePath);
    let resolvedEntryPoint = MdzPackagerCore.resolveEntryPoint(archivePaths, manifest);

    if (options.createIndex && !resolvedEntryPoint) {
      if (manifest?.entryPoint) {
        throw new Error(`ERR_PACK_ENTRYPOINT_MISSING: Manifest entry-point "${manifest.entryPoint}" does not exist.`);
      }
      const markdownPaths = archivePaths.filter(MdzArchiveCore.isMarkdownFile).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      const generated = MdzPackagerCore.buildGeneratedIndex(markdownPaths, options.title || rootName);
      selected.push({ archivePath: 'index.md', originalPath: '[generated]', text: generated });
      archivePaths = selected.map((f) => f.archivePath);
      resolvedEntryPoint = 'index.md';
      if (manifest) manifest.entryPoint = 'index.md';
    }

    if (manifest?.entryPoint && !archivePaths.some((p) => p.toLowerCase() === manifest.entryPoint!.toLowerCase())) {
      throw new Error(`ERR_PACK_ENTRYPOINT_MISSING: Manifest entry-point "${manifest.entryPoint}" does not exist in archive.`);
    }

    if (options.mapFiles && manifest) {
      manifest.files = manifestFiles;
    }

    const factory = zipWriterFactory ?? MdzPackagerCore.getDefaultZipWriterFactory();
    const zip = factory.create();

    for (const item of selected) {
      if (item.file) {
        const buffer = await item.file.arrayBuffer();
        zip.file(item.archivePath, buffer);
      } else {
        zip.file(item.archivePath, item.text || '');
      }
    }

    if (manifest) {
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });

    return {
      blob,
      manifest,
      resolvedEntryPoint,
      archivePaths,
      selected,
      warnings: {
        invalidPathCount,
        sanitizedPathCount,
        skippedByReason: Object.fromEntries(skipMap.entries()),
        unresolvedEntry: !resolvedEntryPoint
      }
    };
  }

  private static getDefaultZipWriterFactory(): ZipWriterFactoryLike {
    return {
      create(): ZipWriterLike {
        return new JSZip() as unknown as ZipWriterLike;
      }
    };
  }
}

