export const EXTENSION_DIRECTORY_FORMAT = 'substore-extension-directory-v1' as const;

export const EXTENSION_DIRECTORY_LIMITS = Object.freeze({
  maxPayloadFiles: 128,
  maxFiles: 131,
  maxFileBytes: 2 * 1024 * 1024,
  maxPayloadBytes: 8 * 1024 * 1024,
});

export interface ExtensionDirectoryFileLike {
  name: string;
  size: number;
  webkitRelativePath?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ExtensionDirectoryProjection {
  schemaVersion: 1;
  format: typeof EXTENSION_DIRECTORY_FORMAT;
  rootName: string;
  files: Record<string, string>;
}

export class ExtensionDirectoryError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ExtensionDirectoryError';
    this.code = code;
    this.details = details;
  }
}

type ValidatedDirectoryFile = {
  file: ExtensionDirectoryFileLike;
  relativePath: string;
};

const DANGEROUS_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const METADATA_FILES = new Set(['manifest.json', 'receipt.json', 'package.json']);
const CONTROL_CHARACTER_RE = /[\u0000-\u001f\u007f]/;
const MAX_PATH_BYTES = 1024;
const MAX_PATH_SEGMENT_BYTES = 255;
const utf8Bytes = (value: string) => new TextEncoder().encode(value).byteLength;

const invalidPath = (path: string, reason: string): never => {
  throw new ExtensionDirectoryError(
    'EXTENSION_DIRECTORY_PATH_INVALID',
    `Invalid extension directory path: ${reason}`,
    { path, reason },
  );
};

const validatePath = (path: string) => {
  if (!path || CONTROL_CHARACTER_RE.test(path) || path.includes('\\')) invalidPath(path, 'unsafe separator or control character');
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) invalidPath(path, 'absolute paths are forbidden');
  if (utf8Bytes(path) > MAX_PATH_BYTES) invalidPath(path, 'path is too long');

  const segments = path.split('/');
  if (segments.length < 2) invalidPath(path, 'a selected directory root is required');
  if (segments.some(segment => (
    !segment
    || segment === '.'
    || segment === '..'
    || utf8Bytes(segment) > MAX_PATH_SEGMENT_BYTES
    || DANGEROUS_PATH_SEGMENTS.has(segment.toLowerCase())
  ))) {
    invalidPath(path, 'unsafe path segment');
  }
  return segments;
};

const validateDirectoryFiles = (
  input: Iterable<ExtensionDirectoryFileLike> | ArrayLike<ExtensionDirectoryFileLike>,
) => {
  const files = Array.from(input as ArrayLike<ExtensionDirectoryFileLike>);
  if (!files.length) {
    throw new ExtensionDirectoryError(
      'EXTENSION_DIRECTORY_EMPTY',
      'Select a directory that contains a plugin package.',
    );
  }
  if (files.length > EXTENSION_DIRECTORY_LIMITS.maxFiles) {
    throw new ExtensionDirectoryError(
      'EXTENSION_DIRECTORY_FILE_COUNT_EXCEEDED',
      `Plugin directories may contain at most ${EXTENSION_DIRECTORY_LIMITS.maxFiles} files.`,
      { count: files.length, limit: EXTENSION_DIRECTORY_LIMITS.maxFiles },
    );
  }

  let rootName = '';
  let payloadBytes = 0;
  let payloadFiles = 0;
  const seen = new Set<string>();
  const collisionIndex = new Map<string, string>();
  const validated: ValidatedDirectoryFile[] = [];

  files.forEach(file => {
    const path = `${file.webkitRelativePath || ''}`;
    const segments = validatePath(path);
    const currentRoot = segments[0];
    if (!rootName) rootName = currentRoot;
    if (rootName !== currentRoot) {
      throw new ExtensionDirectoryError(
        'EXTENSION_DIRECTORY_MULTIPLE_ROOTS',
        'Select exactly one plugin directory.',
        { expectedRoot: rootName, actualRoot: currentRoot },
      );
    }

    const relativePath = segments.slice(1).join('/');
    if (seen.has(relativePath)) {
      throw new ExtensionDirectoryError(
        'EXTENSION_DIRECTORY_DUPLICATE_PATH',
        `The plugin directory contains a duplicate path: ${relativePath}`,
        { path: relativePath },
      );
    }
    seen.add(relativePath);
    const collisionKey = relativePath.normalize('NFC').toLowerCase();
    const collidingPath = collisionIndex.get(collisionKey);
    if (collidingPath && collidingPath !== relativePath) {
      throw new ExtensionDirectoryError(
        'EXTENSION_DIRECTORY_PATH_COLLISION',
        `The plugin directory contains colliding paths: ${collidingPath}, ${relativePath}`,
        { paths: [collidingPath, relativePath] },
      );
    }
    collisionIndex.set(collisionKey, relativePath);

    const size = Number(file.size);
    if (!Number.isFinite(size) || size < 0) invalidPath(path, 'invalid file size');
    if (size > EXTENSION_DIRECTORY_LIMITS.maxFileBytes) {
      throw new ExtensionDirectoryError(
        'EXTENSION_DIRECTORY_FILE_TOO_LARGE',
        `Plugin files may not exceed ${EXTENSION_DIRECTORY_LIMITS.maxFileBytes} bytes.`,
        { path: relativePath, size, limit: EXTENSION_DIRECTORY_LIMITS.maxFileBytes },
      );
    }
    if (!METADATA_FILES.has(relativePath)) {
      payloadFiles += 1;
      payloadBytes += size;
    }
    if (payloadFiles > EXTENSION_DIRECTORY_LIMITS.maxPayloadFiles) {
      throw new ExtensionDirectoryError(
        'EXTENSION_DIRECTORY_FILE_COUNT_EXCEEDED',
        `Plugin directories may contain at most ${EXTENSION_DIRECTORY_LIMITS.maxPayloadFiles} payload files.`,
        { count: payloadFiles, limit: EXTENSION_DIRECTORY_LIMITS.maxPayloadFiles },
      );
    }
    if (payloadBytes > EXTENSION_DIRECTORY_LIMITS.maxPayloadBytes) {
      throw new ExtensionDirectoryError(
        'EXTENSION_DIRECTORY_TOO_LARGE',
        `Plugin payloads may not exceed ${EXTENSION_DIRECTORY_LIMITS.maxPayloadBytes} bytes.`,
        { totalBytes: payloadBytes, limit: EXTENSION_DIRECTORY_LIMITS.maxPayloadBytes },
      );
    }
    validated.push({ file, relativePath });
  });

  const missingMetadata = [...METADATA_FILES].filter(path => !seen.has(path));
  if (missingMetadata.length) {
    throw new ExtensionDirectoryError(
      missingMetadata.includes('manifest.json')
        ? 'EXTENSION_DIRECTORY_MANIFEST_MISSING'
        : 'EXTENSION_DIRECTORY_METADATA_MISSING',
      `The selected directory is missing required metadata: ${missingMetadata.join(', ')}.`,
      { missing: missingMetadata },
    );
  }

  return {
    rootName,
    files: validated.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
  };
};

const decodeUtf8 = async ({ file, relativePath }: ValidatedDirectoryFile) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new ExtensionDirectoryError(
      'EXTENSION_DIRECTORY_TEXT_INVALID',
      `Plugin directory files must be valid UTF-8 text: ${relativePath}`,
      { path: relativePath },
    );
  }
};

export async function buildExtensionDirectoryProjection(
  input: Iterable<ExtensionDirectoryFileLike> | ArrayLike<ExtensionDirectoryFileLike>,
): Promise<ExtensionDirectoryProjection> {
  const validated = validateDirectoryFiles(input);
  const entries = await Promise.all(validated.files.map(async item => [
    item.relativePath,
    await decodeUtf8(item),
  ] as const));

  return {
    schemaVersion: 1,
    format: EXTENSION_DIRECTORY_FORMAT,
    rootName: validated.rootName,
    files: Object.fromEntries(entries),
  };
}
