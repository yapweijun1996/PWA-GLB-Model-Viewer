export const MAX_BYTES = 100 * 1024 * 1024;
export const MAX_FILES = 256;
export function safePath(raw: string): string {
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    throw new Error('Invalid encoded dependency path.');
  }
  if (!path || /[\\\u0000-\u001f?#:]/.test(path) || path.startsWith('/'))
    throw new Error('Unsafe dependency path.');
  const parts = path.split('/').filter((p) => p && p !== '.');
  if (parts.some((p) => p === '..'))
    throw new Error('Parent directory paths are not allowed.');
  return parts.join('/');
}
export function filePath(file: File) {
  return safePath(file.webkitRelativePath || file.name);
}
export function checkFiles(files: File[]): Map<string, File> {
  if (!files.length || files.length > MAX_FILES)
    throw new Error(`Select between 1 and ${MAX_FILES} files.`);
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_BYTES)
    throw new Error('Import exceeds the 100 MB total limit.');
  const map = new Map<string, File>();
  for (const file of files) {
    const path = filePath(file);
    if (map.has(path)) throw new Error(`Duplicate file path: ${path}`);
    map.set(path, file);
  }
  return map;
}
export function entryPath(files: Map<string, unknown>) {
  const entries = [...files.keys()].filter((p) => /\.(glb|gltf)$/i.test(p));
  if (entries.length !== 1)
    throw new Error(
      'Select exactly one GLB or glTF model, together with its dependencies.',
    );
  return entries[0];
}
export function resolvePath(entry: string, uri: string) {
  const base = entry.slice(0, entry.lastIndexOf('/') + 1);
  return safePath(base + safePath(uri));
}
