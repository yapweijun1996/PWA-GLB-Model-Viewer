import { MAX_BYTES, resolvePath } from './DependencyResolver';
export type ModelDocument = Record<string, any>;
export function readDocument(data: ArrayBuffer, glb: boolean): ModelDocument {
  let json: string;
  if (glb) {
    const view = new DataView(data);
    if (
      data.byteLength < 20 ||
      view.getUint32(0, true) !== 0x46546c67 ||
      view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== data.byteLength
    )
      throw new Error('Invalid GLB header or length.');
    let offset = 12;
    let chunk = 0;
    json = '';
    while (offset < data.byteLength) {
      if (offset + 8 > data.byteLength) throw new Error('Truncated GLB chunk.');
      const size = view.getUint32(offset, true);
      const type = view.getUint32(offset + 4, true);
      if (size % 4 || offset + 8 + size > data.byteLength)
        throw new Error('Invalid GLB chunk length.');
      if (chunk === 0) {
        if (type !== 0x4e4f534a) throw new Error('GLB must begin with JSON.');
        if (size > 8 * 1024 * 1024)
          throw new Error('Model JSON exceeds the 8 MB limit.');
        json = new TextDecoder().decode(
          data.slice(offset + 8, offset + 8 + size),
        );
      }
      offset += 8 + size;
      chunk++;
    }
  } else {
    if (data.byteLength > 8 * 1024 * 1024)
      throw new Error('Model JSON exceeds the 8 MB limit.');
    json = new TextDecoder().decode(data);
  }
  // Bound nesting before JSON.parse to prevent recursive parser/loader exhaustion.
  let depth = 0,
    quoted = false,
    escaped = false;
  for (const char of json) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') {
      if (++depth > 64) throw new Error('JSON nesting exceeds 64 levels.');
    } else if (char === '}' || char === ']') depth--;
  }
  const doc = JSON.parse(json);
  if (!doc || Array.isArray(doc) || doc.asset?.version !== '2.0')
    throw new Error('Only glTF 2.0 models are supported.');
  return doc;
}
export function inspectDocument(
  doc: ModelDocument,
  entry: string,
  files: Map<string, ArrayBuffer>,
) {
  if (
    (doc.nodes?.length ?? 0) > 2000 ||
    (doc.meshes?.length ?? 0) > 1000 ||
    (doc.images?.length ?? 0) > 128
  )
    throw new Error('Model exceeds node, mesh or texture limits.');
  const nodes = doc.nodes ?? [];
  const visiting = new Set<number>(),
    visited = new Set<number>();
  const walk = (i: number, depth: number) => {
    if (depth > 64 || visiting.has(i))
      throw new Error('Cyclic or overly deep scene graph.');
    if (!nodes[i]) throw new Error('Scene references a missing node.');
    if (visited.has(i)) return;
    visiting.add(i);
    for (const child of nodes[i].children ?? []) walk(child, depth + 1);
    visiting.delete(i);
    visited.add(i);
  };
  nodes.forEach((_: unknown, i: number) => walk(i, 0));
  let expanded = 0;
  for (const buffer of doc.buffers ?? []) {
    if (!Number.isSafeInteger(buffer.byteLength) || buffer.byteLength < 0)
      throw new Error('Invalid buffer length.');
    expanded += buffer.byteLength;
  }
  for (const accessor of doc.accessors ?? []) {
    if (
      !Number.isSafeInteger(accessor.count) ||
      accessor.count < 0 ||
      accessor.count > 5_000_000
    )
      throw new Error('Accessor exceeds the geometry limit.');
    expanded += accessor.count * 16;
  }
  if (expanded > 256 * 1024 * 1024)
    throw new Error('Estimated geometry memory exceeds 256 MB.');
  const allowedRequired = new Set([
    'KHR_materials_unlit',
    'KHR_materials_clearcoat',
    'KHR_materials_transmission',
    'KHR_materials_ior',
    'KHR_materials_specular',
    'KHR_materials_volume',
    'KHR_materials_sheen',
    'KHR_materials_emissive_strength',
    'KHR_texture_transform',
    'KHR_mesh_quantization',
  ]);
  for (const ext of doc.extensionsRequired ?? [])
    if (!allowedRequired.has(ext))
      throw new Error(
        `Required extension is not supported: ${ext}. Export an uncompressed GLB.`,
      );
  const visit = (value: any) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'uri' && typeof item === 'string') {
        if (item.startsWith('data:')) {
          if (
            !/^data:(application\/(octet-stream|gltf-buffer)|image\/(png|jpeg|webp));base64,[A-Za-z0-9+/=]*$/.test(
              item,
            ) ||
            item.length * 0.75 > MAX_BYTES
          )
            throw new Error('Unsupported or oversized embedded resource.');
        } else if (!files.has(resolvePath(entry, item)))
          throw new Error(`Missing local dependency: ${item}`);
      } else visit(item);
    }
  };
  visit(doc);
  const root = files.get(entry)!;
  let binOffset = 0;
  if (/\.glb$/i.test(entry)) {
    const view = new DataView(root);
    let offset = 12;
    while (offset + 8 <= root.byteLength) {
      const size = view.getUint32(offset, true);
      if (view.getUint32(offset + 4, true) === 0x004e4942)
        binOffset = offset + 8;
      offset += size + 8;
    }
  }
  const resource = (uri: string): Uint8Array => {
    if (uri.startsWith('data:')) {
      const decoded = atob(uri.slice(uri.indexOf(',') + 1));
      return Uint8Array.from(decoded, (c) => c.charCodeAt(0));
    }
    return new Uint8Array(files.get(resolvePath(entry, uri))!);
  };
  let pixels = 0;
  for (const image of doc.images ?? []) {
    let bytes: Uint8Array;
    if (image.uri) bytes = resource(image.uri);
    else {
      const view = doc.bufferViews?.[image.bufferView],
        buffer = doc.buffers?.[view?.buffer];
      if (!view || !buffer) throw new Error('Invalid texture buffer view.');
      const source = buffer.uri
        ? resource(buffer.uri)
        : new Uint8Array(root, binOffset);
      bytes = source.slice(
        view.byteOffset ?? 0,
        (view.byteOffset ?? 0) + view.byteLength,
      );
    }
    const [width, height] = imageDimensions(bytes);
    pixels += width * height;
    if (
      !width ||
      !height ||
      width > 4096 ||
      height > 4096 ||
      pixels > 32 * 1024 * 1024
    )
      throw new Error(
        'Textures exceed the 4096 px / 32 megapixel total limit.',
      );
  }
}

export function imageDimensions(bytes: Uint8Array): [number, number] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length >= 24 &&
    v.getUint32(0) === 0x89504e47 &&
    v.getUint32(4) === 0x0d0a1a0a
  )
    return [v.getUint32(16), v.getUint32(20)];
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1],
        size = v.getUint16(offset + 2);
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      )
        return [v.getUint16(offset + 7), v.getUint16(offset + 5)];
      if (size < 2) break;
      offset += 2 + size;
    }
  }
  if (
    bytes.length >= 30 &&
    v.getUint32(0) === 0x52494646 &&
    v.getUint32(8) === 0x57454250
  ) {
    const type = v.getUint32(12);
    if (type === 0x56503858)
      return [
        1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      ];
    if (type === 0x56503820)
      return [v.getUint16(26, true) & 0x3fff, v.getUint16(28, true) & 0x3fff];
    if (type === 0x5650384c && bytes[20] === 0x2f) {
      const bits = v.getUint32(21, true);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
  }
  throw new Error('Unsupported texture format. Use PNG, JPEG or WebP.');
}
