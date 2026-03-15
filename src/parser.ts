import type { MdzArchive, MdzManifest, MdzEntry } from './types.js';

/**
 * Parses a raw manifest JSON string into a validated {@link MdzManifest}.
 *
 * @param json - The raw JSON string from the archive's manifest file.
 * @returns A parsed and validated {@link MdzManifest}.
 * @throws {Error} When the JSON is invalid or required fields are missing.
 */
export function parseManifest(json: string): MdzManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('MdzParser: manifest is not valid JSON');
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('MdzParser: manifest must be a JSON object');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj['version'] !== 'string') {
    throw new Error('MdzParser: manifest.version is required and must be a string');
  }

  const rawEntries = obj['entries'];
  if (!Array.isArray(rawEntries)) {
    throw new Error('MdzParser: manifest.entries is required and must be an array');
  }

  const entries: MdzEntry[] = rawEntries.map((e: unknown, idx: number) => {
    if (typeof e !== 'object' || e === null || Array.isArray(e)) {
      throw new Error(`MdzParser: manifest.entries[${String(idx)}] must be an object`);
    }
    const entry = e as Record<string, unknown>;
    if (typeof entry['path'] !== 'string') {
      throw new Error(
        `MdzParser: manifest.entries[${String(idx)}].path is required and must be a string`,
      );
    }
    const mdzEntry: MdzEntry = { path: entry['path'] };
    if (typeof entry['mimeType'] === 'string') mdzEntry.mimeType = entry['mimeType'];
    if (typeof entry['size'] === 'number') mdzEntry.size = entry['size'];
    return mdzEntry;
  });

  const manifest: MdzManifest = {
    version: obj['version'],
    entries,
  };
  if (typeof obj['title'] === 'string') manifest.title = obj['title'];
  if (typeof obj['createdAt'] === 'string') manifest.createdAt = obj['createdAt'];
  if (typeof obj['updatedAt'] === 'string') manifest.updatedAt = obj['updatedAt'];
  return manifest;
}

/**
 * Creates an {@link MdzArchive} from a raw byte buffer representing an .mdz file.
 *
 * **Note:** Full zip-extraction support will be added once the core code is
 * migrated from the existing repository.  This placeholder implementation
 * accepts a pre-parsed manifest and a simple in-memory entry map so that
 * callers can exercise the public API surface today.
 *
 * @param manifest - A pre-parsed {@link MdzManifest}.
 * @param entries  - An optional map of entry path → raw bytes.
 */
export function createArchive(
  manifest: MdzManifest,
  entries: Map<string, Uint8Array> = new Map(),
): MdzArchive {
  const decoder = new TextDecoder();

  return {
    manifest,
    readEntry(path: string): Uint8Array | undefined {
      return entries.get(path);
    },
    readEntryText(path: string): string | undefined {
      const bytes = entries.get(path);
      return bytes !== undefined ? decoder.decode(bytes) : undefined;
    },
  };
}
