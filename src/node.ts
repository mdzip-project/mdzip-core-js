import { constants } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import {
  MdzArchiveCore,
  MdzPackagerCore,
  type MdzCoreArchiveBinary,
  type MdzPackBuildResult,
  type MdzPackInputFile,
  type MdzPackOptions
} from './mdz-core.js';

export type MdzNodeArchiveInput = MdzCoreArchiveBinary | string;

export interface MdzPackDirectoryOptions {
  rootName?: string;
  packOptions?: Partial<MdzPackOptions>;
  overwrite?: boolean;
}

export interface MdzExtractArchiveOptions {
  overwrite?: boolean;
}

export interface MdzExtractArchiveResult {
  destinationDirectory: string;
  extractedPaths: string[];
}

const DEFAULT_PACK_OPTIONS: MdzPackOptions = {
  createIndex: true,
  mapFiles: false,
  filters: ['**/*']
};

export async function packDirectory(
  sourceDirectory: string,
  outputFile?: string,
  options: MdzPackDirectoryOptions = {}
): Promise<MdzPackBuildResult> {
  const sourceRoot = path.resolve(sourceDirectory);
  const sourceStats = await lstat(sourceRoot);
  if (!sourceStats.isDirectory() || sourceStats.isSymbolicLink()) {
    throw new Error(`ERR_PACK_SOURCE_NOT_DIRECTORY: "${sourceDirectory}" must be a real directory.`);
  }

  const outputPath = outputFile ? path.resolve(outputFile) : null;
  const files = await collectDirectoryFiles(sourceRoot, outputPath);
  const packOptions: MdzPackOptions = {
    ...DEFAULT_PACK_OPTIONS,
    ...options.packOptions,
    filters: options.packOptions?.filters ?? DEFAULT_PACK_OPTIONS.filters
  };
  const rootName = options.rootName ?? path.basename(sourceRoot);
  const result = await MdzPackagerCore.buildArchive(files, rootName, packOptions);

  if (outputPath) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeBlobToFile(result.blob, outputPath, options.overwrite ?? true);
  }
  return result;
}

export async function extractArchive(
  input: MdzNodeArchiveInput,
  destinationDirectory: string,
  options: MdzExtractArchiveOptions = {}
): Promise<MdzExtractArchiveResult> {
  const archiveBytes = typeof input === 'string' ? await readFile(input) : input;
  const archive = await MdzArchiveCore.open(archiveBytes);
  const destinationRoot = path.resolve(destinationDirectory);
  await ensureExtractionRoot(destinationRoot);

  const entries = archive.listEntries({ includeDirectories: false, normalize: false, sort: true });
  const planned = entries.map((entry) => planExtractionPath(destinationRoot, entry.path));
  assertNoExtractionCollisions(planned);
  await preflightExtractionTargets(destinationRoot, planned, options.overwrite ?? false);

  for (const item of planned) {
    await ensureSafeDirectoryPath(destinationRoot, path.dirname(item.targetPath));
    const bytes = await archive.readBytes(item.archivePath);
    await writeBytes(item.targetPath, bytes, options.overwrite ?? false);
  }

  return {
    destinationDirectory: destinationRoot,
    extractedPaths: planned.map((item) => item.archivePath)
  };
}

interface PlannedExtraction {
  archivePath: string;
  targetPath: string;
}

async function collectDirectoryFiles(
  sourceRoot: string,
  outputPath: string | null,
  currentDirectory = sourceRoot
): Promise<MdzPackInputFile[]> {
  const files: MdzPackInputFile[] = [];
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name);
    if (outputPath && sameFilePath(absolutePath, outputPath)) {
      continue;
    }
    if (entry.isSymbolicLink()) {
      throw new Error(`ERR_PACK_SYMLINK: Symbolic links are not supported: "${absolutePath}".`);
    }
    if (entry.isDirectory()) {
      files.push(...await collectDirectoryFiles(sourceRoot, outputPath, absolutePath));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`ERR_PACK_UNSUPPORTED_ENTRY: Unsupported filesystem entry: "${absolutePath}".`);
    }
    files.push({
      path: path.relative(sourceRoot, absolutePath).split(path.sep).join('/'),
      data: await readFile(absolutePath)
    });
  }
  return files;
}

function planExtractionPath(destinationRoot: string, rawArchivePath: string): PlannedExtraction {
  const archivePath = MdzArchiveCore.normalizePath(rawArchivePath);
  const pathError = MdzArchiveCore.validateArchivePath(archivePath);
  if (pathError || !archivePath || path.isAbsolute(rawArchivePath) || /^[a-z]:/i.test(rawArchivePath)) {
    throw new Error(`ERR_EXTRACT_UNSAFE_PATH: Unsafe archive path "${rawArchivePath}".`);
  }

  const targetPath = path.resolve(destinationRoot, ...archivePath.split('/'));
  const relativeTarget = path.relative(destinationRoot, targetPath);
  if (!relativeTarget || relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    throw new Error(`ERR_EXTRACT_UNSAFE_PATH: Unsafe archive path "${rawArchivePath}".`);
  }
  return { archivePath, targetPath };
}

function assertNoExtractionCollisions(planned: PlannedExtraction[]): void {
  const targets = new Set<string>();
  for (const item of planned) {
    const key = normalizedFileKey(item.targetPath);
    if (targets.has(key)) {
      throw new Error(`ERR_EXTRACT_PATH_COLLISION: Multiple entries resolve to "${item.archivePath}".`);
    }
    targets.add(key);
  }
}

async function preflightExtractionTargets(
  destinationRoot: string,
  planned: PlannedExtraction[],
  overwrite: boolean
): Promise<void> {
  for (const item of planned) {
    await assertSafeExistingPath(destinationRoot, path.dirname(item.targetPath));
    const stats = await tryLstat(item.targetPath);
    if (stats?.isSymbolicLink()) {
      throw new Error(`ERR_EXTRACT_SYMLINK: Refusing to write through symbolic link "${item.targetPath}".`);
    }
    if (stats?.isDirectory()) {
      throw new Error(`ERR_EXTRACT_TARGET_DIRECTORY: File target is a directory: "${item.targetPath}".`);
    }
    if (stats && !overwrite) {
      throw new Error(`ERR_EXTRACT_TARGET_EXISTS: File already exists: "${item.targetPath}".`);
    }
  }
}

async function ensureExtractionRoot(destinationRoot: string): Promise<void> {
  const existing = await tryLstat(destinationRoot);
  if (existing?.isSymbolicLink()) {
    throw new Error(`ERR_EXTRACT_SYMLINK: Destination cannot be a symbolic link: "${destinationRoot}".`);
  }
  if (existing && !existing.isDirectory()) {
    throw new Error(`ERR_EXTRACT_TARGET_NOT_DIRECTORY: Destination is not a directory: "${destinationRoot}".`);
  }
  await mkdir(destinationRoot, { recursive: true });
  await realpath(destinationRoot);
}

async function assertSafeExistingPath(destinationRoot: string, directory: string): Promise<void> {
  const relative = path.relative(destinationRoot, directory);
  if (!relative) {
    return;
  }
  let current = destinationRoot;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    const stats = await tryLstat(current);
    if (stats?.isSymbolicLink()) {
      throw new Error(`ERR_EXTRACT_SYMLINK: Refusing to traverse symbolic link "${current}".`);
    }
    if (stats && !stats.isDirectory()) {
      throw new Error(`ERR_EXTRACT_PARENT_NOT_DIRECTORY: Parent path is not a directory: "${current}".`);
    }
  }
}

async function ensureSafeDirectoryPath(destinationRoot: string, directory: string): Promise<void> {
  const relative = path.relative(destinationRoot, directory);
  let current = destinationRoot;
  for (const segment of relative ? relative.split(path.sep) : []) {
    current = path.join(current, segment);
    const stats = await tryLstat(current);
    if (stats?.isSymbolicLink()) {
      throw new Error(`ERR_EXTRACT_SYMLINK: Refusing to traverse symbolic link "${current}".`);
    }
    if (stats && !stats.isDirectory()) {
      throw new Error(`ERR_EXTRACT_PARENT_NOT_DIRECTORY: Parent path is not a directory: "${current}".`);
    }
    if (!stats) {
      await mkdir(current);
    }
  }
}

async function writeBlobToFile(blob: Blob, outputPath: string, overwrite: boolean): Promise<void> {
  await writeBytes(outputPath, new Uint8Array(await blob.arrayBuffer()), overwrite);
}

async function writeBytes(outputPath: string, bytes: Uint8Array, overwrite: boolean): Promise<void> {
  if (overwrite) {
    await writeFile(outputPath, bytes);
    return;
  }
  const handle = await open(outputPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
}

async function tryLstat(targetPath: string): Promise<Awaited<ReturnType<typeof lstat>> | null> {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) {
      return null;
    }
    throw error;
  }
}

function sameFilePath(left: string, right: string): boolean {
  return normalizedFileKey(path.resolve(left)) === normalizedFileKey(path.resolve(right));
}

function normalizedFileKey(filePath: string): string {
  return process.platform === 'win32' ? filePath.toLowerCase() : filePath;
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}
