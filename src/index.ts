/**
 * mdz-core-js public API
 *
 * Re-exports all public types and functions that form the stable surface area
 * of the library.  Consumers should import exclusively from this barrel.
 *
 * @example
 * ```ts
 * import { parseManifest, createArchive, render } from 'mdz-core-js';
 * ```
 */

export type { MdzManifest, MdzEntry, MdzArchive, RenderOptions, RenderResult } from './types.js';

export { parseManifest, createArchive } from './parser.js';
export { render } from './renderer.js';
