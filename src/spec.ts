/**
 * MDZip spec 1.2.0 rules that don't need a ZIP: path validation and matching
 * (§5.4, §5.4.1), manifest validation (§6.4) and link resolution (§9.3–9.6).
 *
 * Errors follow the library convention: `Error` whose message starts with the
 * spec error code, e.g. `ERR_PATH_TRAVERSAL: ...`.
 */

/** The MDZip specification version this library implements and writes. */
export const MDZ_SPEC_VERSION = '1.2.0';
/** The highest `spec.version` major this library reads (§11.2). */
export const MDZ_SUPPORTED_MAJOR = 1;
/** Modes defined by the spec (§5.7). */
export const MDZ_MODES: readonly string[] = ['document', 'project'];
/** Support file names (§5.5), compared ASCII case-insensitively, with .md or .markdown. */
export const MDZ_SUPPORT_FILE_NAMES: readonly string[] = ['readme', 'agents', 'license', 'changelog', 'contributing'];

/** A coded validation problem: `code` is a spec error code such as `ERR_PATH_TRAVERSAL`. */
export interface MdzCodedProblem {
  code: string;
  message: string;
}

/** Throws `Error("CODE: message")`. */
export function mdzError(code: string, message: string): Error {
  return new Error(`${code}: ${message}`);
}

/** The spec error code at the start of an error message, or null. */
export function mdzErrorCode(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const match = /^(ERR_[A-Z0-9_]+)\b/.exec(message);
  return match ? match[1]! : null;
}

// --- Paths (§5.4, §5.4.1) -----------------------------------------------------

const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const RESERVED_RE = /[\\:*?"<>|]/;
const MARKDOWN_EXT_RE = /\.(md|markdown)$/;

/** Unicode Normalization Form C. */
export function nfc(path: string): string {
  return String(path).normalize('NFC');
}

/** Lowercases A–Z only, never locale-aware (§5.4.1): `LICENSE` → `license`, even under Turkish rules. */
export function asciiLower(text: string): string {
  return String(text).replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

/** Path equality per §5.4.1: case-sensitive, after NFC normalization. */
export function samePath(a: string, b: string): boolean {
  return nfc(a) === nfc(b);
}

/** The stored path in `paths` that matches `wanted` (§5.4.1), or null. */
export function findPath(paths: Iterable<string>, wanted: string): string | null {
  const target = nfc(wanted);
  for (const p of paths) {
    if (nfc(p) === target) return p;
  }
  return null;
}

/** True for `.md` / `.markdown`, extension compared ASCII case-insensitively. */
export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_EXT_RE.test(asciiLower(path));
}

/** True for a root-level support file (§5.5): README, AGENTS, LICENSE, CHANGELOG or CONTRIBUTING. */
export function isSupportFile(path: string): boolean {
  if (path.includes('/') || !isMarkdownPath(path)) return false;
  return MDZ_SUPPORT_FILE_NAMES.includes(asciiLower(path).replace(MARKDOWN_EXT_RE, ''));
}

/** Why `path` isn't a valid archive entry path (§5.4), or null. A trailing `/` marks a directory entry. */
export function pathProblem(path: string): MdzCodedProblem | null {
  const raw = String(path ?? '');
  if (raw === '') return { code: 'ERR_PATH_EMPTY', message: 'path is empty' };
  if (raw.startsWith('/')) return { code: 'ERR_PATH_LEADING_SLASH', message: `'${raw}' starts with '/'` };
  if (CONTROL_RE.test(raw)) return { code: 'ERR_PATH_CONTROL_CHAR', message: `${JSON.stringify(raw)} contains a control character` };
  if (RESERVED_RE.test(raw)) return { code: 'ERR_PATH_RESERVED_CHAR', message: `'${raw}' contains a reserved character (\\ : * ? " < > |)` };
  const segments = (raw.endsWith('/') ? raw.slice(0, -1) : raw).split('/');
  if (segments.includes('..')) return { code: 'ERR_PATH_TRAVERSAL', message: `'${raw}' contains a '..' segment` };
  if (segments.some((s) => s === '' || s === '.')) return { code: 'ERR_PATH_INVALID', message: `'${raw}' contains an empty or '.' segment` };
  return null;
}

/**
 * Why a set of entry names can't form one archive (§5.4), or null. Names ending in `/` are
 * directory entries. Two names equal after NFC are duplicates (`ERR_DUPLICATE_PATH`); a file
 * whose path is also a directory of another entry is a conflict (`ERR_PATH_CONFLICT`).
 */
export function entrySetProblem(names: Iterable<string>): MdzCodedProblem | null {
  const files = new Map<string, string>();
  const directories = new Map<string, string>();
  for (const name of names) {
    const isDir = name.endsWith('/');
    const key = nfc(isDir ? name.slice(0, -1) : name);
    if (!isDir) {
      const other = files.get(key);
      if (other !== undefined) {
        return { code: 'ERR_DUPLICATE_PATH', message: `'${name}' and '${other}' are the same path (§5.4)` };
      }
      files.set(key, name);
    } else if (!directories.has(key)) {
      directories.set(key, name);
    }
    const parts = key.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      const dir = parts.slice(0, i).join('/');
      if (!directories.has(dir)) directories.set(dir, name);
    }
  }
  for (const [key, name] of files) {
    const dir = directories.get(key);
    if (dir !== undefined) {
      return { code: 'ERR_PATH_CONFLICT', message: `'${name}' is a file and also a directory of '${dir}' (§5.4)` };
    }
  }
  return null;
}

/**
 * Why a manifest `entryPoint` value isn't a valid entry point path (§5.5), or null.
 * Valid: a non-empty string, a relative archive path (§5.4) naming a file, with a
 * .md/.markdown extension. A single leading `./` is allowed.
 */
export function entryPointProblem(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return 'entryPoint must be a non-empty string';
  const path = value.startsWith('./') ? value.slice(2) : value;
  if (path.endsWith('/')) return `entryPoint '${value}' names a directory`;
  const problem = pathProblem(path);
  if (problem) return `entryPoint '${value}' is not a valid archive path (${problem.message})`;
  if (!isMarkdownPath(path)) return `entryPoint '${value}' is not a .md or .markdown file`;
  return null;
}

/** Why a manifest `cover` value isn't a valid path (§6.2), or null: like `entryPoint`, any file type. */
export function coverProblem(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return 'cover must be a non-empty string';
  const path = value.startsWith('./') ? value.slice(2) : value;
  if (path.endsWith('/')) return `cover '${value}' names a directory`;
  const problem = pathProblem(path);
  return problem ? `cover '${value}' is not a valid archive path (${problem.message})` : null;
}

// --- Manifest (§6.4) ----------------------------------------------------------

// Semantic Versioning 2.0.0, from semver.org (no leading zeros in numeric identifiers).
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
// RFC 3339 date-time (§6.1).
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;

/** True for a Semantic Versioning 2.0.0 string. */
export function isSemver(value: unknown): value is string {
  return typeof value === 'string' && SEMVER_RE.test(value);
}

/** True for an RFC 3339 date-time string (§6.1). */
export function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && DATE_TIME_RE.test(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isTimestamp(value: unknown): boolean {
  return isDateTime(value) || (isObject(value) && isDateTime(value.when));
}

const DESCRIPTIVE_FIELDS: Record<string, (value: unknown) => boolean> = {
  title: (v) => typeof v === 'string' && v !== '',
  language: (v) => typeof v === 'string',
  description: (v) => typeof v === 'string',
  version: (v) => typeof v === 'string',
  license: (v) => typeof v === 'string',
  keywords: (v) => Array.isArray(v) && v.every((k) => typeof k === 'string'),
  author: isObject,
  producer: isObject,
  created: isTimestamp,
  modified: isTimestamp,
  cover: (v) => coverProblem(v) === null
};

/** Names of members that appear more than once in the same object of a JSON text (§6.4). */
export function findDuplicateMembers(text: string): string[] {
  const duplicates: string[] = [];
  const stack: Array<{ object: boolean; keys: Set<string>; expectKey: boolean }> = [];
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      const top = stack[stack.length - 1];
      if (top?.object && top.expectKey) {
        const key = JSON.parse(text.slice(i, j + 1)) as string;
        if (top.keys.has(key)) duplicates.push(key);
        top.keys.add(key);
        top.expectKey = false;
      }
      i = j;
    } else if (c === '{' || c === '[') {
      stack.push({ object: c === '{', keys: new Set(), expectKey: c === '{' });
    } else if (c === '}' || c === ']') {
      stack.pop();
    } else if (c === ',') {
      const top = stack[stack.length - 1];
      if (top?.object) top.expectKey = true;
    }
  }
  return duplicates;
}

/**
 * Parses `manifest.json` text (a UTF-8 BOM is ignored). Throws `ERR_MANIFEST_INVALID` unless it
 * is JSON whose top-level value is an object. For duplicate members the last one wins (as
 * `JSON.parse` does); their names are returned so callers can report them (§6.4).
 */
export function parseManifestText(text: string): { manifest: Record<string, unknown>; duplicateMembers: string[] } {
  const source = String(text).replace(/^﻿/, '');
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw mdzError('ERR_MANIFEST_INVALID', 'manifest.json is not valid JSON');
  }
  if (!isObject(value)) throw mdzError('ERR_MANIFEST_INVALID', 'manifest.json must be a JSON object');
  return { manifest: value, duplicateMembers: findDuplicateMembers(source) };
}

/**
 * Applies the §6.4 rules to a parsed manifest and returns the descriptive fields a consumer
 * ignores because their type or value is wrong. Critical fields throw:
 * `spec`/`spec.version` (`ERR_MANIFEST_INVALID`, or `ERR_VERSION_UNSUPPORTED` for a newer
 * major), `mode` (`ERR_MANIFEST_INVALID` or `ERR_MODE_UNSUPPORTED`) and, unless
 * `options.entryPoint` is false, `entryPoint` (`ERR_ENTRYPOINT_INVALID`). `null` is a wrong
 * type. Unrecognized fields are never checked.
 */
export function checkManifest(manifest: Record<string, unknown>, options?: { entryPoint?: boolean }): string[] {
  if ('spec' in manifest) {
    const spec = manifest.spec;
    if (!isObject(spec)) throw mdzError('ERR_MANIFEST_INVALID', `spec must be an object, not ${JSON.stringify(spec)}`);
    if ('version' in spec) {
      const version = spec.version;
      if (typeof version !== 'string') throw mdzError('ERR_MANIFEST_INVALID', `spec.version must be a string, not ${JSON.stringify(version)}`);
      if (!SEMVER_RE.test(version)) throw mdzError('ERR_MANIFEST_INVALID', `spec.version '${version}' is not a semantic version`);
      if (Number.parseInt(version, 10) > MDZ_SUPPORTED_MAJOR) {
        throw mdzError('ERR_VERSION_UNSUPPORTED', `archive targets spec ${version}; this library supports ${MDZ_SUPPORTED_MAJOR}.x`);
      }
    }
  }
  if ('mode' in manifest) {
    const mode = manifest.mode;
    if (typeof mode !== 'string') throw mdzError('ERR_MANIFEST_INVALID', `mode must be a string, not ${JSON.stringify(mode)}`);
    if (!MDZ_MODES.includes(mode)) throw mdzError('ERR_MODE_UNSUPPORTED', `unrecognized mode '${mode}'; supported: ${MDZ_MODES.join(', ')}`);
  }
  if (options?.entryPoint !== false && 'entryPoint' in manifest) {
    const problem = entryPointProblem(manifest.entryPoint);
    if (problem) throw mdzError('ERR_ENTRYPOINT_INVALID', problem);
  }
  return Object.entries(DESCRIPTIVE_FIELDS)
    .filter(([name, ok]) => name in manifest && !ok(manifest[name]))
    .map(([name]) => name);
}

// --- Links (§9.3–9.6) ---------------------------------------------------------

/** A link written in document `path` of the archive at host path `archive`. */
export interface MdzArchiveLinkSource {
  archive: string;
  path: string;
}

/** A link written in an ordinary file at host path `host`. */
export interface MdzHostLinkSource {
  host: string;
}

export type MdzLinkSource = MdzArchiveLinkSource | MdzHostLinkSource;
export type MdzLinkUse = 'navigate' | 'embed';
export type MdzUnresolvedReason = 'not-found' | 'invalid' | 'unsupported' | 'no-host-location' | 'nested-archive' | 'denied';

/**
 * Where a link points. `kind` is `internal` (`entry` in the source archive), `host` (host file
 * `path`), `archive` (`entry` in archive `archive`, addressed through the host), `url` (not a
 * path) or `unresolved` (with a `reason`). Fields that don't apply are absent.
 */
export interface MdzLinkTarget {
  kind: 'internal' | 'host' | 'archive' | 'url' | 'unresolved';
  archive?: string;
  entry?: string;
  path?: string;
  fragment?: string;
  reason?: MdzUnresolvedReason;
}

/**
 * What link resolution needs to know about the files around an archive. Host paths are
 * `/`-separated. Capability flags default to true and trust settings to "trust everything,
 * no outside resources" (§9.4–9.6).
 */
export interface MdzLinkHost {
  /** What exists at a host path: a file, a directory, an MDZip archive, or nothing. */
  kind(path: string): 'file' | 'directory' | 'archive' | null;
  /** The stored entry path in `archive` matching `entry` (NFC, case-sensitive), or null. */
  findEntry(archive: string, entry: string): string | null;
  /** The entry point of `archive` (§5.5), or null. */
  entryPoint(archive: string): string | null;
  /** False when the archive was opened from bytes and has no location (§9.4). */
  hostLocation?: boolean;
  /** Whether links may leave the archive for files next to it (§9.4). */
  outsideLinks?: boolean;
  /** Whether links may enter archives (§9.5). */
  intoArchiveLinks?: boolean;
  /** Trust boundary (§9.6): `''` (default) trusts the whole host; null trusts nothing. */
  trustRoot?: string | null;
  /** Host paths outside the boundary that the user explicitly allowed. */
  allowedPaths?: readonly string[];
  /** Whether embeds may load resources from outside an archive (inside the boundary only). */
  loadOutsideResources?: boolean;
}

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const BAD_SEGMENT_RE = /[/\\\u0000-\u001f\u007f]/;
const BAD_PERCENT_RE = /%(?![0-9A-Fa-f]{2})/;

/** True for a name with an `.mdz` extension, compared ASCII case-insensitively. */
export function isMdzName(name: string): boolean {
  return asciiLower(name).endsWith('.mdz');
}

function dirSegments(path: string): string[] {
  return path.split('/').slice(0, -1).filter(Boolean);
}

/** Destination → decoded segments (§9.3 steps 3–4), or null if the link is invalid. */
function decodeSegments(dest: string): string[] | null {
  if (dest.startsWith('/') || dest.includes('\\')) return null;
  const segments: string[] = [];
  for (const raw of dest.split('/')) {
    let segment = raw;
    if (raw.includes('%')) {
      // Decode exactly once; invalid escapes and non-UTF-8 bytes make the link unresolved.
      if (BAD_PERCENT_RE.test(raw)) return null;
      try {
        segment = decodeURIComponent(raw);
      } catch {
        return null;
      }
    }
    if (BAD_SEGMENT_RE.test(segment)) return null;
    segments.push(segment);
  }
  return segments;
}

function permitted(host: MdzLinkHost, path: string): boolean {
  if (host.allowedPaths?.includes(path)) return true;
  const root = host.trustRoot === undefined ? '' : host.trustRoot;
  if (root === null) return false;
  return root === '' || path === root || path.startsWith(`${root.replace(/\/+$/, '')}/`);
}

function unresolved(reason: MdzUnresolvedReason): MdzLinkTarget {
  return { kind: 'unresolved', reason };
}

/**
 * Resolves a Markdown link destination written in `source` (§9.3–9.6).
 *
 * `use` is `navigate` for a link the user follows, or `embed` for a resource the document loads
 * automatically (an image, a stylesheet). Host targets outside the trust boundary are `denied`
 * whether or not they exist; embeds that leave an archive are `denied` unless the host sets
 * `loadOutsideResources`. A `..` is never clamped at the archive root.
 */
export function resolveLink(source: MdzLinkSource, link: string, host: MdzLinkHost, use: MdzLinkUse = 'navigate'): MdzLinkTarget {
  const hostLocation = host.hostLocation ?? true;
  const outside = host.outsideLinks ?? true;
  const into = host.intoArchiveLinks ?? true;
  const loadOutside = host.loadOutsideResources ?? false;

  if (SCHEME_RE.test(link)) return { kind: 'url' };

  // Split at the first "#" before removing the query: a "?" in the fragment stays there.
  const hash = link.indexOf('#');
  let dest = hash >= 0 ? link.slice(0, hash) : link;
  const fragment = hash >= 0 ? link.slice(hash + 1) : '';
  const query = dest.indexOf('?');
  if (query >= 0) dest = dest.slice(0, query);
  // A trailing "/" names a directory: never an entry or a host file (only an archive itself).
  const directory = dest.endsWith('/');
  const withFragment = (target: MdzLinkTarget): MdzLinkTarget => (fragment ? { ...target, fragment } : target);

  if (dest === '') {
    return withFragment('archive' in source ? { kind: 'internal', entry: source.path } : { kind: 'host', path: source.host });
  }

  const segments = decodeSegments(dest);
  if (!segments) return unresolved('invalid');

  let i = 0;
  let stack: string[];
  if ('archive' in source) {
    stack = dirSegments(source.path);
    let left = false;
    while (i < segments.length) {
      const s = segments[i++]!;
      if (s === '' || s === '.') continue;
      if (s === '..') {
        if (!stack.length) {
          left = true;
          break;
        }
        stack.pop();
      } else {
        stack.push(s);
      }
    }
    if (!left) {
      if (directory) return unresolved('not-found');
      const entry = host.findEntry(source.archive, stack.join('/'));
      return entry ? withFragment({ kind: 'internal', entry }) : unresolved('not-found');
    }
    if (!outside) return unresolved('unsupported');
    if (!hostLocation) return unresolved('no-host-location');
    if (use === 'embed' && !loadOutside) return unresolved('denied');
    stack = dirSegments(source.archive);
  } else {
    stack = dirSegments(source.host);
  }

  while (i < segments.length) {
    const s = segments[i++]!;
    if (s === '' || s === '.') continue;
    if (s === '..') {
      if (!stack.length) return unresolved('not-found');
      stack.pop();
      continue;
    }
    stack.push(s);
    const hostPath = stack.join('/');
    if (isMdzName(s) && permitted(host, hostPath) && host.kind(hostPath) === 'archive') {
      if (!into) return unresolved('unsupported');
      if ('archive' in source && hostPath !== source.archive && use === 'embed' && !loadOutside) return unresolved('denied');
      return insideArchive(hostPath, segments.slice(i), host, withFragment, directory);
    }
  }

  const hostPath = stack.join('/');
  // Checked before existence, so a link can't probe for files outside the boundary.
  if (!permitted(host, hostPath)) return unresolved('denied');
  if (directory) return unresolved('not-found');
  return host.kind(hostPath) === 'file' ? withFragment({ kind: 'host', path: hostPath }) : unresolved('not-found');
}

function insideArchive(
  archive: string,
  segments: string[],
  host: MdzLinkHost,
  withFragment: (target: MdzLinkTarget) => MdzLinkTarget,
  directory: boolean
): MdzLinkTarget {
  const inner: string[] = [];
  for (let j = 0; j < segments.length; j += 1) {
    const s = segments[j]!;
    if (s === '' || s === '.') continue;
    if (s === '..') {
      if (!inner.length) return unresolved('invalid');
      inner.pop();
      continue;
    }
    inner.push(s);
    if (isMdzName(s) && j < segments.length - 1) return unresolved('nested-archive');
  }
  if (!inner.length) {
    const entryPoint = host.entryPoint(archive);
    return entryPoint ? withFragment({ kind: 'archive', archive, entry: entryPoint }) : unresolved('not-found');
  }
  if (directory) return unresolved('not-found');
  const entry = host.findEntry(archive, inner.join('/'));
  return entry ? withFragment({ kind: 'archive', archive, entry }) : unresolved('not-found');
}
