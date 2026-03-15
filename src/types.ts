/**
 * Represents the metadata extracted from an .mdz archive manifest.
 */
export interface MdzManifest {
  /** Archive format version */
  version: string;
  /** Display title of the document */
  title?: string;
  /** ISO 8601 creation timestamp */
  createdAt?: string;
  /** ISO 8601 last-modified timestamp */
  updatedAt?: string;
  /** Ordered list of file entries within the archive */
  entries: MdzEntry[];
}

/**
 * A single file entry within an .mdz archive.
 */
export interface MdzEntry {
  /** Path of the file relative to the archive root */
  path: string;
  /** MIME type of the entry (e.g. "text/markdown") */
  mimeType?: string;
  /** Size of the entry in bytes */
  size?: number;
}

/**
 * Result of reading an .mdz archive.
 */
export interface MdzArchive {
  /** Parsed manifest metadata */
  manifest: MdzManifest;
  /**
   * Read the raw bytes for a specific entry by path.
   * Returns `undefined` when the entry does not exist.
   */
  readEntry(path: string): Uint8Array | undefined;
  /**
   * Read the text content for a specific entry by path.
   * Returns `undefined` when the entry does not exist.
   */
  readEntryText(path: string): string | undefined;
}

/**
 * Options accepted by the renderer.
 */
export interface RenderOptions {
  /** Base URL used to resolve relative asset references */
  baseUrl?: string;
  /** When `true` the renderer emits sanitised HTML (default: true) */
  sanitize?: boolean;
}

/**
 * Rendered output produced by the renderer.
 */
export interface RenderResult {
  /** The produced HTML string */
  html: string;
}
