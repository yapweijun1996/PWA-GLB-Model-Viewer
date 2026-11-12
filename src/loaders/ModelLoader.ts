import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolvePath } from './DependencyResolver';

export async function loadModel(
  entry: string,
  files: Map<string, ArrayBuffer>,
) {
  const urls: string[] = [];
  const manager = new LoadingManager();
  manager.setURLModifier((uri) => {
    // Input URIs have already been validated. GLTFLoader creates its own blob
    // URLs for embedded buffer-view images and owns their revocation.
    if (uri.startsWith('data:') || uri.startsWith('blob:')) return uri;
    const resource = files.get(resolvePath(entry, uri));
    if (!resource) throw new Error(`Missing local resource: ${uri}`);
    const type = /\.png$/i.test(uri)
      ? 'image/png'
      : /\.jpe?g$/i.test(uri)
        ? 'image/jpeg'
        : /\.webp$/i.test(uri)
          ? 'image/webp'
          : 'application/octet-stream';
    const url = URL.createObjectURL(new Blob([resource], { type }));
    urls.push(url);
    return url;
  });
  try {
    const bytes = files.get(entry)!;
    return await new GLTFLoader(manager).parseAsync(
      /\.gltf$/i.test(entry) ? new TextDecoder().decode(bytes) : bytes,
      '',
    );
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}
