import JSZip from '@progress/jszip-esm';

type MdzCoreZipAsyncKind = 'text' | 'base64' | 'arraybuffer';
const PRODUCER_SPEC_VERSION = '1.1.0';
const CORE_LIBRARY_VERSION = '1.1.0';
const CORE_LIBRARY_URL = 'https://github.com/mdzip-project/mdzip-core-js';

/**
 * Binary input accepted for opening an existing `.mdz` archive.
 */
export type MdzCoreArchiveBinary = Blob | ArrayBuffer | Uint8Array;
/**
 * Content input accepted when mutating archive entries.
 *
 * String values are written as UTF-8 text; binary values are written as raw bytes.
 */
export type MdzArchiveMutationInput = File | Blob | ArrayBuffer | Uint8Array | string;

interface ZipEntry {
  name: string;
  dir: boolean;
  async(kind: MdzCoreZipAsyncKind): Promise<string | ArrayBuffer>;
}

interface ZipLike {
  files: Record<string, ZipEntry>;
}

interface MutableZipLike extends ZipLike {
  file(path: string, data: string | ArrayBuffer | Uint8Array): void;
  remove(path: string): void;
  generateAsync(options: { type: 'blob'; compression: 'DEFLATE'; compressionOptions: { level: number } }): Promise<Blob>;
}

interface ZipFactoryLike {
  loadAsync(data: MdzCoreArchiveBinary): Promise<ZipLike>;
}

interface ZipWriterLike {
  file(path: string, data: string | ArrayBuffer | Uint8Array): void;
  generateAsync(options: { type: 'blob'; compression: 'DEFLATE'; compressionOptions: { level: number } }): Promise<Blob>;
}

interface ZipWriterFactoryLike {
  create(): ZipWriterLike;
}

/**
 * Author/contact metadata used by manifest fields.
 */
export interface MdzManifestAuthor {
  /** Human-readable display name. */
  name?: string;
  /** Optional contact email address. */
  email?: string;
  /** Optional author profile/home URL. */
  url?: string;
}

/**
 * Identity metadata used by timestamp `by` blocks.
 */
export interface MdzManifestBy {
  /** Display name for creator/modifier attribution. */
  name?: string;
  /** Optional contact email address. */
  email?: string;
  /** Optional profile/home URL. */
  url?: string;
}

/**
 * Object-form timestamp metadata used by draft 1.0.x manifests.
 */
export interface MdzManifestTimestampObject {
  /** ISO-8601 timestamp value. */
  when: string;
  /** Optional identity metadata for who performed the action. */
  by?: MdzManifestBy;
}

/**
 * Specification compatibility metadata for the archive manifest.
 */
export interface MdzManifestSpec {
  /** Spec identifier (for example `mdzip-spec`). */
  name?: string;
  /** Target spec version string (semver). */
  version?: string;
}

/**
 * Producer metadata node describing an app/core identity.
 */
export interface MdzManifestProducerNode {
  /** Producer display name. */
  name?: string;
  /** Producer version string. */
  version?: string;
  /** Producer homepage/repository URL. */
  url?: string;
}

/**
 * Producer metadata grouping for application and reusable core.
 */
export interface MdzManifestProducer {
  /** Top-level application/tool metadata. */
  application?: MdzManifestProducerNode;
  /** Reusable core/runtime metadata used by the producer app. */
  core?: MdzManifestProducerNode;
}

/**
 * Optional file-map entry used when source files are remapped during packaging.
 */
export interface MdzManifestFileMapEntry {
  /** Final archive-relative path after normalization/sanitization. */
  path: string;
  /** Original source-relative path before remapping. */
  originalPath: string;
  /** Human-friendly title derived from file name/source. */
  title: string;
}

/**
 * Supported archive interpretation modes defined by the spec.
 */
export type MdzManifestMode = 'document' | 'project';

/**
 * Parsed shape of `manifest.json` as supported by this library.
 *
 * Includes current fields plus legacy draft compatibility fields.
 */
export interface MdzManifest {
  /** Legacy pre-`spec.version` manifest version field. */
  mdz?: string;
  /** Specification compatibility metadata. */
  spec?: MdzManifestSpec;
  /** Producer provenance metadata. */
  producer?: MdzManifestProducer;
  /** Primary author attribution metadata. */
  author?: MdzManifestAuthor;
  /** Human-readable document title. */
  title?: string;
  /** Archive interpretation mode. */
  mode?: MdzManifestMode;
  /** Primary Markdown entry path, archive-relative. */
  entryPoint?: string | null;
  /** Natural language tag (for example `en`, `fr-CA`). */
  language?: string | null;
  /** Legacy plural author field retained for compatibility. */
  authors?: MdzManifestAuthor[] | null;
  /** Short document summary/description. */
  description?: string | null;
  /** Document version (not spec version). */
  version?: string | null;
  /** Creation timestamp (string or draft object form). */
  created?: string | MdzManifestTimestampObject;
  /** Last-modified timestamp (string or draft object form). */
  modified?: string | MdzManifestTimestampObject;
  /** SPDX ID or license URL. */
  license?: string;
  /** Keyword list used for cataloging/search. */
  keywords?: string[];
  /** Archive-relative cover asset path. */
  cover?: string;
  /** Optional file-map metadata generated during packing. */
  files?: MdzManifestFileMapEntry[];
}

/**
 * Packaging options used by {@link MdzPackagerCore.buildArchive}.
 */
export interface MdzPackOptions {
  /** Generate `index.md` when no unambiguous entry point exists. */
  createIndex: boolean;
  /** Enable path sanitization and include manifest file-map metadata. */
  mapFiles: boolean;
  /** Glob filters that determine which input files are included. */
  filters: string[];
  /** Optional manifest title override. */
  title?: string | null;
  /** Optional archive interpretation mode. */
  mode?: MdzManifestMode | null;
  /** Optional manifest entry point override. */
  entryPoint?: string | null;
  /** Optional language tag override. */
  language?: string | null;
  /** Optional single-author display name. */
  author?: string | null;
  /** Optional manifest description override. */
  description?: string | null;
  /** Optional document version field value. */
  docVersion?: string | null;
}

/**
 * Single source file candidate for packaging.
 */
export interface MdzPackInputFile {
  /** Source-relative path used as the archive path candidate. */
  path: string;
  /** Browser `File` source for binary/text loading. */
  file?: File;
  /** Direct text source when not providing `file`. */
  text?: string;
}

/**
 * Internal/returned representation of a file selected for archive output.
 */
export interface MdzSelectedFile {
  /** Final archive-relative output path. */
  archivePath: string;
  /** Original source path before remapping/sanitization. */
  originalPath: string;
  /** Original `File` input when provided. */
  file?: File;
  /** In-memory text content when provided/generated. */
  text?: string;
}

/**
 * Non-fatal packaging warnings and counters produced during archive build.
 */
export interface MdzPackWarnings {
  /** Count of source paths that failed strict archive path validation. */
  invalidPathCount: number;
  /** Count of paths that were sanitized and remapped. */
  sanitizedPathCount: number;
  /** Breakdown of skipped files by reason key. */
  skippedByReason: Record<string, number>;
  /** Advisory packaging warnings for callers to surface to users. */
  messages?: string[];
  /** True when no entry point could be resolved at build completion. */
  unresolvedEntry: boolean;
}

/**
 * Result object returned by archive build operations.
 */
export interface MdzPackBuildResult {
  /** Final archive blob payload. */
  blob: Blob;
  /** Manifest written to archive, when present. */
  manifest: MdzManifest | null;
  /** Resolved primary entry path (or `null`). */
  resolvedEntryPoint: string | null;
  /** All file paths written into the archive. */
  archivePaths: string[];
  /** Detailed selection list for included/generated files. */
  selected: MdzSelectedFile[];
  /** Packaging warnings/counters. */
  warnings: MdzPackWarnings;
}

/**
 * Conformance validation summary for an archive.
 */
export interface MdzValidationResult {
  /** True when no validation errors were found. */
  isValid: boolean;
  /** Fatal/non-conformant issues discovered during validation. */
  errors: string[];
  /** Non-fatal advisory findings discovered during validation. */
  warnings: string[];
}

/**
 * Result object returned by archive mutation operations.
 */
export interface MdzArchiveMutationResult {
  /** New archive blob generated after mutation. */
  blob: Blob;
  /** Parsed manifest after mutation, when present. */
  manifest: MdzManifest | null;
  /** Resolved primary entry path after mutation, if any. */
  resolvedEntryPoint: string | null;
  /** Archive file paths present after mutation. */
  archivePaths: string[];
}

/**
 * Controls archive path/entry listing output.
 */
export interface MdzArchiveListOptions {
  /** Include directory entries. Defaults to `false`. */
  includeDirectories?: boolean;
  /** Normalize paths via `normalizePath`. Defaults to `true`. */
  normalize?: boolean;
  /** Sort output paths case-insensitively. Defaults to `true`. */
  sort?: boolean;
}

/**
 * Metadata for one archive entry returned by `listEntries`.
 */
export interface MdzArchiveEntryInfo {
  /** Archive-relative path. */
  path: string;
  /** True when entry extension is Markdown. */
  isMarkdown: boolean;
  /** True when entry extension is known image type. */
  isImage: boolean;
  /** True when entry is a directory. */
  isDirectory: boolean;
}

/**
 * Optional controls for orphaned-asset analysis.
 */
export interface MdzOrphanedAssetsOptions {
  /**
   * Markdown scan mode.
   * - `entrypoint`: scan only the resolved/selected entry point (default)
   * - `all-markdown`: scan all Markdown files in archive
   */
  scanMode?: 'entrypoint' | 'all-markdown';
  /** Optional explicit markdown entry path to scan for `entrypoint` mode. */
  entryPoint?: string;
}

/**
 * One unresolved or ignored image reference observed during scan.
 */
export interface MdzOrphanedAssetReferenceIssue {
  /** Markdown file where the reference was found. */
  sourcePath: string;
  /** Raw reference value from Markdown. */
  reference: string;
  /** Normalized reason for why the reference was not counted. */
  reason: 'unsupported-scheme' | 'invalid-path' | 'not-found' | 'not-asset';
}

/**
 * Result for orphaned image analysis.
 */
export interface MdzOrphanedAssetsResult {
  /** Markdown files scanned for references. */
  scannedMarkdownPaths: string[];
  /** All image-asset paths in archive considered by v1 analysis. */
  assetPaths: string[];
  /** Asset paths referenced by scanned markdown and/or manifest cover. */
  referencedAssetPaths: string[];
  /** Asset paths not referenced by scanned markdown/cover. */
  orphanedAssetPaths: string[];
  /** References that could not be counted as valid image asset references. */
  unresolvedReferences: MdzOrphanedAssetReferenceIssue[];
}

/**
 * Extension-to-MIME map for common image assets in MDZip archives.
 */
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

/**
 * Core archive reader/validator/mutator for `.mdz` files.
 */
export class MdzArchiveCore {
  /**
   * Public image MIME map for consumers.
   */
  public static readonly IMAGE_MIME_TYPES = MDZ_IMAGE_MIME_TYPES;
  private static readonly SUPPORTED_MDZ_MAJOR = 1;
  private static readonly SUPPORTED_MODES: readonly MdzManifestMode[] = ['document', 'project'];
  private static readonly SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  private static readonly MARKDOWN_IMAGE_REF_RE = /!\[[^\]]*\]\(([^)\n]+)\)/g;
  private static readonly entriesCache = new WeakMap<ZipLike, Record<string, ZipEntry>>();
  private static readonly manifestCache = new WeakMap<ZipLike, MdzManifest | null>();

  /**
   * Creates an archive wrapper around a previously loaded ZIP object.
   *
   * @param zip - Loaded zip-like structure containing archive entries.
   */
  public constructor(private readonly zip: ZipLike) {}

  /**
   * Opens archive binary data and returns a core archive instance.
   *
   * @param input - Raw archive bytes.
   * @param zipFactory - Optional custom zip loader.
   */
  public static async open(input: MdzCoreArchiveBinary, zipFactory?: ZipFactoryLike): Promise<MdzArchiveCore> {
    const factory = zipFactory ?? MdzArchiveCore.getDefaultZipFactory();
    const zip = await factory.loadAsync(input);
    return new MdzArchiveCore(zip);
  }

  /**
   * Convenience helper to open and validate an archive in one call.
   *
   * @param input - Raw archive bytes.
   * @param zipFactory - Optional custom zip loader.
   */
  public static async validate(input: MdzCoreArchiveBinary, zipFactory?: ZipFactoryLike): Promise<MdzValidationResult> {
    const archive = await MdzArchiveCore.open(input, zipFactory);
    return archive.validate();
  }

  /**
   * Adds or replaces an archive entry and returns a newly generated archive blob.
   *
   * Also validates entry-point integrity and refreshes manifest metadata when present.
   *
   * @param input - Existing archive bytes.
   * @param archiveEntryPath - Archive-relative destination path.
   * @param content - New entry content.
   */
  public static async addFile(
    input: MdzCoreArchiveBinary,
    archiveEntryPath: string,
    content: MdzArchiveMutationInput
  ): Promise<MdzArchiveMutationResult> {
    const targetPath = MdzPackagerCore.normalizePath(archiveEntryPath);
    const pathError = MdzArchiveCore.validateArchivePath(targetPath);
    if (pathError) {
      throw new Error(`ERR_PATH_INVALID: ${pathError}`);
    }

    const zip = await MdzArchiveCore.loadZip(input);
    const targetLower = targetPath.toLowerCase();
    const archivePaths = MdzArchiveCore.getArchivePaths(zip);
    const nextArchivePaths = archivePaths.filter((p) => p.toLowerCase() !== targetLower);
    nextArchivePaths.push(targetPath);

    if (targetLower === 'manifest.json') {
      const replacement = await MdzArchiveCore.parseManifestObjectContent(content, true);
      const preparedManifest = MdzArchiveCore.stampManifestObject(replacement, true);
      MdzArchiveCore.validateManifest(preparedManifest);
      MdzArchiveCore.ensureCreatableEntryPoint(nextArchivePaths, preparedManifest);

      MdzArchiveCore.removeEntryIgnoreCase(zip, targetPath);
      zip.file('manifest.json', MdzArchiveCore.normaliseLf(JSON.stringify(preparedManifest, null, 2)));
      return MdzArchiveCore.finalizeMutation(zip);
    }

    const existingManifestObject = await MdzArchiveCore.readExistingManifestObject(zip, true);
    if (existingManifestObject) {
      MdzArchiveCore.validateManifest(existingManifestObject);
    }
    MdzArchiveCore.ensureCreatableEntryPoint(nextArchivePaths, existingManifestObject as MdzManifest | null);

    MdzArchiveCore.removeEntryIgnoreCase(zip, targetPath);
    await MdzArchiveCore.writeZipEntry(zip, targetPath, content);

    if (existingManifestObject) {
      const refreshed = MdzArchiveCore.stampManifestObject(existingManifestObject, false);
      MdzArchiveCore.removeEntryIgnoreCase(zip, 'manifest.json');
      zip.file('manifest.json', MdzArchiveCore.normaliseLf(JSON.stringify(refreshed, null, 2)));
    }

    return MdzArchiveCore.finalizeMutation(zip);
  }

  /**
   * Removes an archive entry and returns a newly generated archive blob.
   *
   * Also validates entry-point integrity and refreshes manifest metadata when present.
   *
   * @param input - Existing archive bytes.
   * @param archiveEntryPath - Archive-relative path to remove.
   */
  public static async removeFile(input: MdzCoreArchiveBinary, archiveEntryPath: string): Promise<MdzArchiveMutationResult> {
    const targetPath = MdzPackagerCore.normalizePath(archiveEntryPath);
    const pathError = MdzArchiveCore.validateArchivePath(targetPath);
    if (pathError) {
      throw new Error(`ERR_PATH_INVALID: ${pathError}`);
    }

    const zip = await MdzArchiveCore.loadZip(input);
    const targetLower = targetPath.toLowerCase();
    const archivePaths = MdzArchiveCore.getArchivePaths(zip);
    const exists = archivePaths.some((p) => p.toLowerCase() === targetLower);
    if (!exists) {
      throw new Error(`ERR_NOT_FOUND: Entry "${targetPath}" was not found in archive.`);
    }

    const nextArchivePaths = archivePaths.filter((p) => p.toLowerCase() !== targetLower);
    const existingManifestObject = targetLower === 'manifest.json' ? null : await MdzArchiveCore.readExistingManifestObject(zip, true);

    if (existingManifestObject) {
      MdzArchiveCore.validateManifest(existingManifestObject);
    }
    MdzArchiveCore.ensureCreatableEntryPoint(nextArchivePaths, existingManifestObject as MdzManifest | null);

    MdzArchiveCore.removeEntryIgnoreCase(zip, targetPath);

    if (existingManifestObject) {
      const refreshed = MdzArchiveCore.stampManifestObject(existingManifestObject, false);
      MdzArchiveCore.removeEntryIgnoreCase(zip, 'manifest.json');
      zip.file('manifest.json', MdzArchiveCore.normaliseLf(JSON.stringify(refreshed, null, 2)));
    }

    return MdzArchiveCore.finalizeMutation(zip);
  }

  /**
   * Removes multiple archive entries in one mutation operation.
   *
   * @param input - Existing archive bytes.
   * @param archiveEntryPaths - Archive-relative paths to remove.
   */
  public static async removeFiles(input: MdzCoreArchiveBinary, archiveEntryPaths: string[]): Promise<MdzArchiveMutationResult> {
    const targets = archiveEntryPaths.map((p) => {
      const normalized = MdzPackagerCore.normalizePath(p);
      const pathError = MdzArchiveCore.validateArchivePath(normalized);
      if (pathError) {
        throw new Error(`ERR_PATH_INVALID: ${pathError}`);
      }
      return normalized;
    });

    if (targets.length === 0) {
      const zip = await MdzArchiveCore.loadZip(input);
      return MdzArchiveCore.finalizeMutation(zip);
    }

    const zip = await MdzArchiveCore.loadZip(input);
    const targetSet = new Set(targets.map((p) => p.toLowerCase()));
    const archivePaths = MdzArchiveCore.getArchivePaths(zip);

    for (const target of targetSet) {
      if (!archivePaths.some((p) => p.toLowerCase() === target)) {
        throw new Error(`ERR_NOT_FOUND: Entry "${target}" was not found in archive.`);
      }
    }

    const nextArchivePaths = archivePaths.filter((p) => !targetSet.has(p.toLowerCase()));
    const removesManifest = targetSet.has('manifest.json');
    const existingManifestObject = removesManifest ? null : await MdzArchiveCore.readExistingManifestObject(zip, true);

    if (existingManifestObject) {
      MdzArchiveCore.validateManifest(existingManifestObject);
    }
    MdzArchiveCore.ensureCreatableEntryPoint(nextArchivePaths, existingManifestObject as MdzManifest | null);

    for (const target of targetSet) {
      MdzArchiveCore.removeEntryIgnoreCase(zip, target);
    }

    if (existingManifestObject) {
      const refreshed = MdzArchiveCore.stampManifestObject(existingManifestObject, false);
      MdzArchiveCore.removeEntryIgnoreCase(zip, 'manifest.json');
      zip.file('manifest.json', MdzArchiveCore.normaliseLf(JSON.stringify(refreshed, null, 2)));
    }

    return MdzArchiveCore.finalizeMutation(zip);
  }

  /**
   * Finds orphaned image assets in an archive.
   *
   * @param input - Existing archive bytes.
   * @param options - Scan options.
   */
  public static async findOrphanedAssets(input: MdzCoreArchiveBinary, options?: MdzOrphanedAssetsOptions): Promise<MdzOrphanedAssetsResult> {
    const archive = await MdzArchiveCore.open(input);
    return archive.findOrphanedAssets(options);
  }

  private static getDefaultZipFactory(): ZipFactoryLike {
    return {
      async loadAsync(data: MdzCoreArchiveBinary): Promise<ZipLike> {
        const zip = await new JSZip().loadAsync(data as unknown as Blob | ArrayBuffer | Uint8Array);
        return zip as unknown as ZipLike;
      }
    };
  }

  private static async loadZip(input: MdzCoreArchiveBinary): Promise<MutableZipLike> {
    const zip = await new JSZip().loadAsync(input as unknown as Blob | ArrayBuffer | Uint8Array);
    return zip as unknown as MutableZipLike;
  }

  /**
   * Normalizes path separators and strips leading slashes.
   *
   * @param path - Any input path.
   */
  public static normalizePath(path: string): string {
    return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
  }

  /**
   * Returns true if the provided path looks like a Markdown document path.
   *
   * @param path - Archive-relative path.
   */
  public static isMarkdownFile(path: string): boolean {
    return /\.(md|markdown)$/i.test(path);
  }

  /**
   * Validates archive path constraints.
   *
   * @param path - Archive-relative path.
   * @returns `null` when valid, otherwise a short reason string.
   */
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

  /**
   * Resolves a relative Markdown link target against an archive base path.
   *
   * Query/hash fragments are stripped and traversal beyond archive root is rejected.
   *
   * @param base - Referencing file path.
   * @param relative - Relative target path from markdown/link source.
   */
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

  /**
   * Finds an archive entry by path (case-insensitive fallback).
   *
   * @param path - Archive-relative path.
   */
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

  /**
   * Lists archive paths.
   *
   * @param options - Listing controls.
   */
  public listPaths(options?: MdzArchiveListOptions): string[] {
    return MdzArchiveCore.getArchivePaths(this.zip, options);
  }

  /**
   * Lists archive entries with basic type metadata.
   *
   * @param options - Listing controls.
   */
  public listEntries(options?: MdzArchiveListOptions): MdzArchiveEntryInfo[] {
    const entries = MdzArchiveCore.getArchiveEntries(this.zip, options);
    return entries.map((entry) => ({
      path: entry.path,
      isMarkdown: !entry.isDirectory && MdzArchiveCore.isMarkdownFile(entry.path),
      isImage: !entry.isDirectory && MdzArchiveCore.isImagePath(entry.path),
      isDirectory: entry.isDirectory
    }));
  }

  /**
   * Returns true if an entry path exists (file or directory).
   *
   * @param path - Archive-relative path.
   */
  public hasEntry(path: string): boolean {
    return this.findEntryWithDirectoryFallback(path) != null;
  }

  /**
   * Reads UTF-8 text content from an entry.
   *
   * @param path - Archive-relative file path.
   */
  public async readText(path: string): Promise<string> {
    const entry = this.getFileEntryOrThrow(path);
    return String(await entry.async('text'));
  }

  /**
   * Reads raw bytes from an entry.
   *
   * @param path - Archive-relative file path.
   */
  public async readBytes(path: string): Promise<Uint8Array> {
    const entry = this.getFileEntryOrThrow(path);
    const out = await entry.async('arraybuffer');
    return new Uint8Array(out as ArrayBuffer);
  }

  /**
   * Reads entry content as raw base64 (no data URI prefix).
   *
   * @param path - Archive-relative file path.
   */
  public async readBase64(path: string): Promise<string> {
    const entry = this.getFileEntryOrThrow(path);
    return String(await entry.async('base64'));
  }

  /**
   * Reads entry content and returns a data URI string.
   *
   * @param path - Archive-relative file path.
   * @param fallbackMime - Optional fallback MIME when extension is unknown.
   */
  public async readDataUri(path: string, fallbackMime?: string): Promise<string> {
    const normalizedPath = MdzArchiveCore.normalizePath(path);
    const base64 = await this.readBase64(normalizedPath);
    const ext = MdzArchiveCore.getPathExtension(normalizedPath);
    const mime = MDZ_IMAGE_MIME_TYPES[ext] ?? (fallbackMime?.trim() || 'application/octet-stream');
    return `data:${mime};base64,${base64}`;
  }

  /**
   * Finds orphaned image assets from markdown references.
   *
   * @param options - Scan options.
   */
  public async findOrphanedAssets(options?: MdzOrphanedAssetsOptions): Promise<MdzOrphanedAssetsResult> {
    const allEntries = this.listEntries();
    const assetPaths = allEntries
      .filter((entry) => entry.isImage)
      .map((entry) => entry.path)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const assetPathSet = new Set(assetPaths.map((p) => p.toLowerCase()));

    const scanMode = options?.scanMode ?? 'entrypoint';
    const scannedMarkdownPaths = scanMode === 'all-markdown'
      ? allEntries.filter((entry) => entry.isMarkdown).map((entry) => entry.path)
      : [options?.entryPoint ? MdzArchiveCore.normalizePath(options.entryPoint) : await this.resolveEntryPoint()];

    const referencedAssets = new Set<string>();
    const unresolvedReferences: MdzOrphanedAssetReferenceIssue[] = [];

    for (const markdownPath of scannedMarkdownPaths) {
      const markdown = await this.readText(markdownPath);
      const refs = MdzArchiveCore.extractMarkdownImageReferences(markdown);
      for (const ref of refs) {
        if (MdzArchiveCore.hasUriScheme(ref)) {
          unresolvedReferences.push({ sourcePath: markdownPath, reference: ref, reason: 'unsupported-scheme' });
          continue;
        }

        let resolved: string;
        try {
          resolved = MdzArchiveCore.normalizePath(MdzArchiveCore.resolvePath(markdownPath, ref));
        } catch {
          unresolvedReferences.push({ sourcePath: markdownPath, reference: ref, reason: 'invalid-path' });
          continue;
        }

        const entry = this.findEntryWithDirectoryFallback(resolved);
        if (!entry || entry.dir) {
          unresolvedReferences.push({ sourcePath: markdownPath, reference: ref, reason: 'not-found' });
          continue;
        }

        if (!MdzArchiveCore.isImagePath(resolved) || !assetPathSet.has(resolved.toLowerCase())) {
          unresolvedReferences.push({ sourcePath: markdownPath, reference: ref, reason: 'not-asset' });
          continue;
        }

        referencedAssets.add(MdzArchiveCore.resolveAssetPathCase(assetPaths, resolved));
      }
    }

    const manifest = await this.readManifest();
    if (manifest?.cover) {
      const cover = MdzArchiveCore.normalizePath(manifest.cover);
      if (assetPathSet.has(cover.toLowerCase())) {
        referencedAssets.add(MdzArchiveCore.resolveAssetPathCase(assetPaths, cover));
      }
    }

    const referencedAssetPaths = Array.from(referencedAssets).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const referencedSet = new Set(referencedAssetPaths.map((p) => p.toLowerCase()));
    const orphanedAssetPaths = assetPaths.filter((p) => !referencedSet.has(p.toLowerCase()));

    return {
      scannedMarkdownPaths,
      assetPaths,
      referencedAssetPaths,
      orphanedAssetPaths,
      unresolvedReferences
    };
  }

  public static validateManifest(manifest: unknown): asserts manifest is MdzManifest {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json must be a JSON object.');
    }

    const candidate = manifest as MdzManifest;

    const validateMetadataNode = (value: unknown, path: string): void => {
      if (value == null) return;
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`ERR_MANIFEST_INVALID: manifest.json "${path}" must be an object when provided.`);
      }
      const node = value as Record<string, unknown>;
      for (const key of ['name', 'version', 'url']) {
        const v = node[key];
        if (v != null && typeof v !== 'string') {
          throw new Error(`ERR_MANIFEST_INVALID: manifest.json "${path}.${key}" must be a string when provided.`);
        }
      }
    };

    const validateByNode = (value: unknown, path: string): void => {
      if (value == null) return;
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`ERR_MANIFEST_INVALID: manifest.json "${path}" must be an object when provided.`);
      }
      const node = value as Record<string, unknown>;
      for (const key of ['name', 'email', 'url']) {
        const v = node[key];
        if (v != null && typeof v !== 'string') {
          throw new Error(`ERR_MANIFEST_INVALID: manifest.json "${path}.${key}" must be a string when provided.`);
        }
      }
    };

    const validateTimestamp = (value: unknown, path: string): void => {
      if (value == null) return;
      if (typeof value === 'string') return;
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`ERR_MANIFEST_INVALID: manifest.json "${path}" must be a string or object when provided.`);
      }
      const node = value as Record<string, unknown>;
      if (typeof node.when !== 'string' || node.when.trim() === '') {
        throw new Error(`ERR_MANIFEST_INVALID: manifest.json "${path}.when" must be a non-empty string when "${path}" is an object.`);
      }
      validateByNode(node.by, `${path}.by`);
    };

    if (candidate.title != null && (typeof candidate.title !== 'string' || candidate.title.trim() === '')) {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json "title" must be a non-empty string when provided.');
    }
    if (candidate.mode != null) {
      if (typeof candidate.mode !== 'string') {
        throw new Error('ERR_MANIFEST_INVALID: manifest.json "mode" must be a string when provided.');
      }
      if (!MdzArchiveCore.SUPPORTED_MODES.includes(candidate.mode as MdzManifestMode)) {
        throw new Error(`ERR_MODE_UNSUPPORTED: manifest.json mode "${candidate.mode}" is not supported.`);
      }
    }
    if (candidate.description != null && typeof candidate.description !== 'string') {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json "description" must be a string when provided.');
    }
    if (candidate.version != null && typeof candidate.version !== 'string') {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json "version" must be a string when provided.');
    }
    if (candidate.language != null && typeof candidate.language !== 'string') {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json "language" must be a string when provided.');
    }
    if (candidate.license != null && typeof candidate.license !== 'string') {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json "license" must be a string when provided.');
    }
    if (candidate.keywords != null) {
      if (!Array.isArray(candidate.keywords) || candidate.keywords.some((k) => typeof k !== 'string')) {
        throw new Error('ERR_MANIFEST_INVALID: manifest.json "keywords" must be an array of strings when provided.');
      }
    }
    if (candidate.cover != null && typeof candidate.cover !== 'string') {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json "cover" must be a string when provided.');
    }

    if (candidate.entryPoint != null && typeof candidate.entryPoint !== 'string') {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json "entryPoint" must be a string when provided.');
    }
    if (candidate.entryPoint != null && MdzArchiveCore.validateArchivePath(candidate.entryPoint) != null) {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json "entryPoint" must be a valid archive-relative path.');
    }

    if (candidate.spec != null) {
      if (typeof candidate.spec !== 'object' || Array.isArray(candidate.spec)) {
        throw new Error('ERR_MANIFEST_INVALID: manifest.json "spec" must be an object when provided.');
      }
      const spec = candidate.spec as Record<string, unknown>;
      if (spec.name != null && typeof spec.name !== 'string') {
        throw new Error('ERR_MANIFEST_INVALID: manifest.json "spec.name" must be a string when provided.');
      }
      if (spec.version != null) {
        if (typeof spec.version !== 'string' || !MdzArchiveCore.SEMVER_RE.test(spec.version)) {
          throw new Error('ERR_MANIFEST_INVALID: manifest.json "spec.version" must be a valid semver string when provided.');
        }
        const specMajor = Number.parseInt(spec.version.split('.')[0] ?? '0', 10);
        if (specMajor > MdzArchiveCore.SUPPORTED_MDZ_MAJOR) {
          throw new Error(
            `ERR_VERSION_UNSUPPORTED: manifest.json spec.version ${spec.version} is not supported; this viewer supports major ${MdzArchiveCore.SUPPORTED_MDZ_MAJOR}.x only.`
          );
        }
      }
    }

    if (candidate.mdz != null) {
      if (typeof candidate.mdz !== 'string' || !MdzArchiveCore.SEMVER_RE.test(candidate.mdz)) {
        throw new Error('ERR_MANIFEST_INVALID: manifest.json "mdz" must be a valid semver string when provided.');
      }
      const major = Number.parseInt(candidate.mdz.split('.')[0] ?? '0', 10);
      if (major > MdzArchiveCore.SUPPORTED_MDZ_MAJOR) {
        throw new Error(`ERR_VERSION_UNSUPPORTED: manifest.json targets mdz ${candidate.mdz}, but this viewer supports major ${MdzArchiveCore.SUPPORTED_MDZ_MAJOR}.x only.`);
      }
    }

    if (candidate.producer != null) {
      if (typeof candidate.producer !== 'object' || Array.isArray(candidate.producer)) {
        throw new Error('ERR_MANIFEST_INVALID: manifest.json "producer" must be an object when provided.');
      }
      const producer = candidate.producer as Record<string, unknown>;
      validateMetadataNode(producer.application, 'producer.application');
      validateMetadataNode(producer.core, 'producer.core');
    }

    if (candidate.author != null) {
      validateByNode(candidate.author, 'author');
    }

    validateTimestamp(candidate.created, 'created');
    validateTimestamp(candidate.modified, 'modified');
  }

  /**
   * Parses and validates `manifest.json` if present.
   *
   * Missing or invalid cover references are normalized away in returned data.
   */
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

    const normalized = { ...(manifest as MdzManifest) };
    if (normalized.cover) {
      const coverPath = MdzArchiveCore.normalizePath(normalized.cover);
      const coverPathError = MdzArchiveCore.validateArchivePath(coverPath);
      const coverEntry = Object.entries(this.zip.files).find(([p]) => MdzArchiveCore.normalizePath(p).toLowerCase() === coverPath.toLowerCase())?.[1];
      const coverExistsAsFile = !!coverEntry && !coverEntry.dir;
      if (coverPathError || !coverExistsAsFile) {
        delete normalized.cover;
      }
    }

    MdzArchiveCore.manifestCache.set(this.zip, normalized);
    return normalized;
  }

  /**
   * Resolves archive interpretation mode using manifest data or the spec default.
   */
  public async resolveMode(): Promise<MdzManifestMode> {
    const manifest = await this.readManifest();
    return manifest?.mode ?? 'document';
  }

  /**
   * Validates archive conformance and returns errors/warnings.
   */
  public async validate(): Promise<MdzValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const archivePaths = MdzArchiveCore.getArchivePaths(this.zip);

    for (const path of archivePaths) {
      const pathError = MdzArchiveCore.validateArchivePath(path);
      if (pathError) errors.push(`ERR_PATH_INVALID: ${pathError}`);
    }

    let manifest: MdzManifest | null = null;
    let manifestReadFailed = false;
    const manifestEntry = this.findEntry('manifest.json');
    if (manifestEntry) {
      let rawManifest: Record<string, unknown> | null = null;
      try {
        const rawText = await manifestEntry.async('text');
        const parsed = JSON.parse(String(rawText));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          rawManifest = parsed as Record<string, unknown>;
        }
      } catch {
        // readManifest() will report JSON parse errors as ERR_MANIFEST_INVALID
      }

      try {
        manifest = await this.readManifest();
      } catch (error) {
        manifestReadFailed = true;
        errors.push(error instanceof Error ? error.message : String(error));
      }

      if (manifest) {
        const specVersion = manifest.spec?.version;
        if (!specVersion || specVersion.trim() === '') {
          warnings.push("manifest 'spec.version' is missing; version metadata is unavailable.");
        } else if (MdzArchiveCore.SEMVER_RE.test(specVersion)) {
          const major = Number.parseInt(specVersion.split('.')[0] ?? '0', 10);
          if (major < MdzArchiveCore.SUPPORTED_MDZ_MAJOR) {
            warnings.push(
              `manifest 'spec.version' major version ${major} is older than supported major ${MdzArchiveCore.SUPPORTED_MDZ_MAJOR}.`
            );
          }
        }

        if (manifest.entryPoint && !archivePaths.some((p) => p.toLowerCase() === manifest!.entryPoint!.toLowerCase())) {
          errors.push(`ERR_ENTRYPOINT_MISSING: manifest 'entryPoint' references '${manifest.entryPoint}' which does not exist in the archive.`);
        }

        const coverCandidate = typeof rawManifest?.cover === 'string' ? rawManifest.cover : manifest.cover;
        if (coverCandidate) {
          const cover = MdzArchiveCore.normalizePath(coverCandidate);
          const coverEntry = this.findEntry(cover);
          if (!coverEntry || coverEntry.dir) {
            warnings.push(`manifest 'cover' references '${coverCandidate}' which does not exist in the archive.`);
          }
        }
      }
    } else {
      warnings.push('No manifest.json present. Version metadata is unavailable.');
    }

    if (!manifestReadFailed) {
      try {
        await this.resolveEntryPoint();
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Resolves the primary markdown entry point for rendering.
   *
   * @throws When no unambiguous entry point can be determined.
   */
  public async resolveEntryPoint(): Promise<string> {
    const manifest = await this.readManifest();
    const archivePaths = MdzArchiveCore.getArchivePaths(this.zip);

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

  private static getArchivePaths(zip: ZipLike, options?: MdzArchiveListOptions): string[] {
    return MdzArchiveCore.getArchiveEntries(zip, options).map((entry) => entry.path);
  }

  private static getArchiveEntries(zip: ZipLike, options?: MdzArchiveListOptions): Array<{ path: string; isDirectory: boolean }> {
    const includeDirectories = options?.includeDirectories === true;
    const normalize = options?.normalize !== false;
    const sort = options?.sort !== false;

    const entries = Object.entries(zip.files)
      .filter(([, entry]) => includeDirectories || !entry?.dir)
      .map(([path, entry]) => ({
        path: normalize ? MdzArchiveCore.normalizePath(path) : path,
        isDirectory: !!entry?.dir
      }));

    if (sort) {
      entries.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }));
    }

    return entries;
  }

  private findEntryWithDirectoryFallback(path: string): ZipEntry | null {
    const normalized = MdzArchiveCore.normalizePath(path);
    const direct = this.findEntry(normalized);
    if (direct) return direct;

    if (normalized.endsWith('/')) {
      return this.findEntry(normalized.slice(0, -1));
    }
    return this.findEntry(`${normalized}/`);
  }

  private getFileEntryOrThrow(path: string): ZipEntry {
    const normalized = MdzArchiveCore.normalizePath(path);
    const entry = this.findEntryWithDirectoryFallback(normalized);
    if (!entry) {
      throw new Error(`ERR_NOT_FOUND: Entry "${normalized}" was not found in archive.`);
    }
    if (entry.dir) {
      throw new Error(`ERR_IS_DIRECTORY: Entry "${normalized}" is a directory.`);
    }
    return entry;
  }

  private static getPathExtension(path: string): string {
    const slash = path.lastIndexOf('/');
    const dot = path.lastIndexOf('.');
    if (dot <= slash) return '';
    return path.slice(dot + 1).toLowerCase();
  }

  private static isImagePath(path: string): boolean {
    return MdzArchiveCore.getPathExtension(path) in MDZ_IMAGE_MIME_TYPES;
  }

  private static extractMarkdownImageReferences(markdown: string): string[] {
    const refs: string[] = [];
    const re = new RegExp(MdzArchiveCore.MARKDOWN_IMAGE_REF_RE.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = re.exec(markdown)) != null) {
      const raw = match[1]?.trim();
      if (!raw) continue;
      refs.push(MdzArchiveCore.cleanMarkdownLinkTarget(raw));
    }
    return refs;
  }

  private static cleanMarkdownLinkTarget(raw: string): string {
    let target = raw.trim();
    if (target.startsWith('<') && target.endsWith('>')) {
      target = target.slice(1, -1).trim();
    }

    const quotedTitleIndex = target.search(/\s+"/);
    if (quotedTitleIndex > 0) {
      target = target.slice(0, quotedTitleIndex).trim();
    } else {
      const singleQuotedTitleIndex = target.search(/\s+'/);
      if (singleQuotedTitleIndex > 0) {
        target = target.slice(0, singleQuotedTitleIndex).trim();
      }
    }

    return target;
  }

  private static hasUriScheme(value: string): boolean {
    return /^[A-Za-z][A-Za-z\d+\-.]*:/.test(value);
  }

  private static resolveAssetPathCase(assetPaths: string[], resolvedPath: string): string {
    const lower = resolvedPath.toLowerCase();
    const exact = assetPaths.find((p) => p.toLowerCase() === lower);
    return exact ?? resolvedPath;
  }

  private static removeEntryIgnoreCase(zip: MutableZipLike, targetPath: string): void {
    const targetLower = targetPath.toLowerCase();
    for (const path of Object.keys(zip.files)) {
      if (MdzArchiveCore.normalizePath(path).toLowerCase() === targetLower) {
        zip.remove(path);
      }
    }
  }

  private static isTextFile(path: string): boolean {
    return /\.(md|markdown|json|txt|css|html|htm|xml|svg|yaml|yml|toml)$/i.test(path);
  }

  private static normaliseLf(content: string): string {
    return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  private static async readExistingManifestObject(zip: ZipLike, requireValid: boolean): Promise<Record<string, unknown> | null> {
    const manifestEntry = Object.entries(zip.files).find(([p, entry]) => MdzArchiveCore.normalizePath(p).toLowerCase() === 'manifest.json' && !entry.dir)?.[1];
    if (!manifestEntry) return null;

    const raw = await manifestEntry.async('text');
    try {
      const parsed = JSON.parse(String(raw));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        if (requireValid) throw new Error('ERR_MANIFEST_INVALID: Existing manifest.json is invalid: expected a JSON object.');
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (requireValid) {
        if (error instanceof Error && /expected a JSON object/.test(error.message)) throw error;
        throw new Error('ERR_MANIFEST_INVALID: Existing manifest.json is invalid JSON.');
      }
      return null;
    }
  }

  private static async parseManifestObjectContent(content: MdzArchiveMutationInput, requireValid: boolean): Promise<Record<string, unknown>> {
    const raw = await MdzArchiveCore.readMutationInputAsText(content);
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        if (requireValid) throw new Error('ERR_MANIFEST_INVALID: Replacement manifest.json is invalid: expected a JSON object.');
        return {};
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (requireValid) {
        if (error instanceof Error && /expected a JSON object/.test(error.message)) throw error;
        throw new Error('ERR_MANIFEST_INVALID: Replacement manifest.json is invalid JSON.');
      }
      return {};
    }
  }

  private static ensureManifestSpecObject(manifest: Record<string, unknown>): void {
    let spec = manifest.spec;
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      spec = {};
      manifest.spec = spec;
    }
    const specObj = spec as Record<string, unknown>;
    if (typeof specObj.name !== 'string' || !specObj.name.trim()) {
      specObj.name = 'mdzip-spec';
    }
    if (typeof specObj.version !== 'string' || !specObj.version.trim()) {
      specObj.version = PRODUCER_SPEC_VERSION;
    }
  }

  private static stampManifestObject(manifest: Record<string, unknown>, setCreatedIfMissing: boolean): Record<string, unknown> {
    const now = new Date().toISOString();
    const next = { ...manifest };
    MdzArchiveCore.ensureManifestSpecObject(next);
    if (setCreatedIfMissing && next.created == null) {
      next.created = now;
    }
    const modified = next.modified;
    if (modified && typeof modified === 'object' && !Array.isArray(modified)) {
      next.modified = { ...(modified as Record<string, unknown>), when: now };
    } else {
      next.modified = now;
    }
    return next;
  }

  private static ensureCreatableEntryPoint(archivePaths: string[], manifest?: Pick<MdzManifest, 'entryPoint'> | null): void {
    if (manifest?.entryPoint && !archivePaths.some((p) => p.toLowerCase() === manifest.entryPoint!.toLowerCase())) {
      throw new Error(`ERR_ENTRYPOINT_MISSING: manifest 'entryPoint' references '${manifest.entryPoint}' which does not exist in the archive.`);
    }

    const resolved = MdzPackagerCore.resolveEntryPoint(archivePaths, manifest);
    if (!resolved) {
      throw new Error(
        'ERR_ENTRYPOINT_UNRESOLVED: No unambiguous entry point could be determined. Add index.md at the archive root, keep exactly one root Markdown file, or set manifest.entryPoint.'
      );
    }
  }

  private static async readMutationInputAsText(content: MdzArchiveMutationInput): Promise<string> {
    if (typeof content === 'string') return content;
    if (content instanceof Blob) return content.text();
    return new TextDecoder().decode(content);
  }

  private static async readMutationInputAsBinary(content: MdzArchiveMutationInput): Promise<ArrayBuffer | Uint8Array> {
    if (typeof content === 'string') return new TextEncoder().encode(content);
    if (content instanceof Blob) return content.arrayBuffer();
    if (content instanceof Uint8Array) return content;
    return content;
  }

  private static async writeZipEntry(zip: MutableZipLike, path: string, content: MdzArchiveMutationInput): Promise<void> {
    if (MdzArchiveCore.isTextFile(path)) {
      const text = await MdzArchiveCore.readMutationInputAsText(content);
      zip.file(path, MdzArchiveCore.normaliseLf(text));
      return;
    }
    const binary = await MdzArchiveCore.readMutationInputAsBinary(content);
    zip.file(path, binary);
  }

  private static async finalizeMutation(zip: MutableZipLike): Promise<MdzArchiveMutationResult> {
    const bytes = await (zip as unknown as JSZip).generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([buffer], { type: 'application/zip' });
    const archive = await MdzArchiveCore.open(buffer);
    const manifest = await archive.readManifest();
    const resolvedEntryPoint = await archive.resolveEntryPoint().catch(() => null);
    return {
      blob,
      manifest,
      resolvedEntryPoint,
      archivePaths: MdzArchiveCore.getArchivePaths(zip)
    };
  }
}

/**
 * Packaging helpers for creating `.mdz` archives from source files.
 */
export class MdzPackagerCore {
  /**
   * Default include globs for markdown and common image assets.
   */
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

  /**
   * Normalizes input file paths for archive packaging.
   *
   * @param path - Source file path.
   */
  public static normalizePath(path: string): string {
    return MdzArchiveCore.normalizePath(path).replace(/^\.\//, '');
  }

  /**
   * Validates archive path constraints.
   *
   * @param path - Archive-relative path.
   */
  public static validateArchivePath(path: string): string | null {
    return MdzArchiveCore.validateArchivePath(path);
  }

  /**
   * Sanitizes one archive path segment by replacing forbidden characters.
   *
   * @param segment - Single path segment.
   */
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

  /**
   * Sanitizes a full archive path by normalizing each path segment.
   *
   * @param path - Candidate archive path.
   */
  public static sanitiseArchivePath(path: string): string {
    return MdzPackagerCore.normalizePath(path)
      .split('/')
      .filter(Boolean)
      .map(MdzPackagerCore.sanitisePathSegment)
      .join('/');
  }

  /**
   * Ensures archive path uniqueness by appending `-2`, `-3`, etc when needed.
   *
   * @param candidate - Desired archive path.
   * @param usedPaths - Case-insensitive set of already-used paths.
   */
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

  /**
   * Tests whether a path matches a glob pattern supporting `*`, `?`, and `**`.
   *
   * @param path - Archive-relative path.
   * @param pattern - Glob pattern.
   */
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

  /**
   * Returns true if a path matches at least one filter pattern.
   *
   * @param path - Archive-relative path.
   * @param filters - Glob filter list.
   */
  public static matchesAnyFilter(path: string, filters: string[]): boolean {
    return filters.some((pattern) => MdzPackagerCore.globMatch(path, pattern));
  }

  /**
   * Builds a generated manifest from packaging options, or `null` when none is needed.
   *
   * @param rootName - Root/source label for fallback title.
   * @param options - Packaging options.
   */
  public static buildManifestFromOptions(rootName: string, options: MdzPackOptions): MdzManifest | null {
    const hasManifestOption =
      options.mapFiles
      || !!options.title
      || !!options.mode
      || !!options.entryPoint
      || !!options.language
      || !!options.author
      || !!options.description
      || !!options.docVersion;

    if (!hasManifestOption) return null;

    const now = new Date().toISOString();

    return {
      spec: {
        name: 'mdzip-spec',
        version: PRODUCER_SPEC_VERSION
      },
      producer: {
        core: {
          name: 'mdzip-core-js',
          version: CORE_LIBRARY_VERSION,
          url: CORE_LIBRARY_URL
        }
      },
      title: options.title || rootName,
      mode: options.mode || undefined,
      entryPoint: options.entryPoint || null,
      language: options.language || 'en',
      author: options.author ? { name: options.author } : undefined,
      authors: options.author ? [{ name: options.author }] : null,
      description: options.description || null,
      version: options.docVersion || null,
      created: now,
      modified: now
    };
  }

  /**
   * Resolves entry point using manifest override, `index.md`, or single-root-markdown fallback.
   *
   * @param archivePaths - Archive file paths.
   * @param manifest - Optional manifest with `entryPoint`.
   */
  public static resolveEntryPoint(archivePaths: string[], manifest?: Pick<MdzManifest, 'entryPoint'> | null): string | null {
    if (manifest?.entryPoint && archivePaths.some((p) => p.toLowerCase() === manifest.entryPoint!.toLowerCase())) {
      return manifest.entryPoint;
    }
    if (archivePaths.some((p) => p.toLowerCase() === 'index.md')) return 'index.md';

    const rootMarkdown = archivePaths.filter((p) => !p.includes('/') && MdzArchiveCore.isMarkdownFile(p));
    return rootMarkdown.length === 1 ? (rootMarkdown[0] ?? null) : null;
  }

  /**
   * Generates a simple index markdown page for archives without a clear entry point.
   *
   * @param markdownPaths - Markdown files to list.
   * @param title - Optional heading title.
   */
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

  private static normalizeLf(content: string): string {
    return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  private static isTextFile(path: string): boolean {
    return /\.(md|markdown|json|txt|css|html|htm|xml|svg|yaml|yml|toml)$/i.test(path);
  }

  private static async readProvidedManifest(selected: MdzSelectedFile[]): Promise<MdzManifest | null> {
    const manifestItem = selected.find((item) => item.archivePath.toLowerCase() === 'manifest.json');
    if (!manifestItem) return null;

    const raw = manifestItem.file ? await manifestItem.file.text() : (manifestItem.text ?? '');
    let manifest: unknown;
    try {
      manifest = JSON.parse(raw);
    } catch {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json is not valid JSON');
    }

    MdzArchiveCore.validateManifest(manifest);
    return manifest as MdzManifest;
  }

  /**
   * Builds an `.mdz` archive from input files and packaging options.
   *
   * @param files - Source file candidates.
   * @param rootName - Root/source label for generated metadata.
   * @param options - Packaging options.
   * @param zipWriterFactory - Optional custom zip writer.
   */
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

    let manifest = MdzPackagerCore.buildManifestFromOptions(rootName, options);
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

    if (!manifest) {
      manifest = await MdzPackagerCore.readProvidedManifest(selected);
    }

    let archivePaths = selected.map((f) => f.archivePath);
    let resolvedEntryPoint = MdzPackagerCore.resolveEntryPoint(archivePaths, manifest);
    const warningMessages: string[] = [];
    const markdownPaths = archivePaths.filter(MdzArchiveCore.isMarkdownFile);

    if (!manifest?.mode && markdownPaths.length > 1) {
      warningMessages.push(
        'Archive contains multiple Markdown files and no explicit manifest.mode; consumers will default to document mode. If these files are intended as separate documents, set mode: "project".'
      );
    }

    if (options.createIndex && !resolvedEntryPoint) {
      if (manifest?.entryPoint) {
        throw new Error(`ERR_PACK_ENTRYPOINT_MISSING: Manifest entry-point "${manifest.entryPoint}" does not exist.`);
      }
      const sortedMarkdownPaths = markdownPaths.slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      const generated = MdzPackagerCore.buildGeneratedIndex(sortedMarkdownPaths, options.title || rootName);
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
        if (MdzPackagerCore.isTextFile(item.archivePath)) {
          const text = await item.file.text();
          zip.file(item.archivePath, MdzPackagerCore.normalizeLf(text));
        } else {
          const buffer = await item.file.arrayBuffer();
          zip.file(item.archivePath, buffer);
        }
      } else {
        const content = item.text || '';
        if (MdzPackagerCore.isTextFile(item.archivePath)) {
          zip.file(item.archivePath, MdzPackagerCore.normalizeLf(content));
        } else {
          zip.file(item.archivePath, content);
        }
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
        messages: warningMessages,
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
