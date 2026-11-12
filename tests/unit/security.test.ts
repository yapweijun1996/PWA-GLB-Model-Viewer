import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  safePath,
  resolvePath,
  checkFiles,
  entryPath,
  MAX_BYTES,
} from '../../src/loaders/DependencyResolver';
import {
  readDocument,
  inspectDocument,
  imageDimensions,
} from '../../src/loaders/validation';
import { Store } from '../../src/app/AppState';
const arrayBuffer = (path: string) => {
  const bytes = readFileSync(path);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
};
describe('local file boundary', () => {
  it.each([
    '../a.bin',
    '%2e%2e/a.bin',
    'https://evil.test/a',
    '//evil/a',
    'C:/a',
    'a\\b',
    'a?b',
    'a#b',
    'a\u0000',
  ])('rejects %s', (path) => expect(() => safePath(path)).toThrow());
  it('normalizes safe relative paths', () =>
    expect(resolvePath('folder/model.gltf', './textures/a.png')).toBe(
      'folder/textures/a.png',
    ));
  it('rejects ambiguous roots', () =>
    expect(() =>
      entryPath(
        new Map([
          ['a.glb', 0],
          ['b.gltf', 0],
        ]),
      ),
    ).toThrow());
  it('rejects duplicates', () =>
    expect(() =>
      checkFiles([new File(['a'], 'x.glb'), new File(['b'], 'x.glb')]),
    ).toThrow());
  it('rejects total file size before allocation', () =>
    expect(() =>
      checkFiles([{ name: 'a.glb', size: MAX_BYTES + 1 } as File]),
    ).toThrow('100 MB'));
  it('rejects excessive file count', () =>
    expect(() => checkFiles(Array(257).fill(new File([''], 'a')))).toThrow());
});
describe('model safety and validity', () => {
  it('reads a real animated GLB', () => {
    const data = arrayBuffer('public/models/studio-rover.glb');
    const doc = readDocument(data, true);
    inspectDocument(doc, 'demo.glb', new Map([['demo.glb', data]]));
    expect(doc.animations).toHaveLength(1);
  });
  it('rejects truncated header', () =>
    expect(() => readDocument(new ArrayBuffer(3), true)).toThrow());
  it('rejects wrong GLB version', () => {
    const data = arrayBuffer('public/models/studio-rover.glb');
    new DataView(data).setUint32(4, 1, true);
    expect(() => readDocument(data, true)).toThrow();
  });
  it('rejects chunk overflow', () => {
    const data = arrayBuffer('public/models/studio-rover.glb');
    new DataView(data).setUint32(12, 0xfffffffc, true);
    expect(() => readDocument(data, true)).toThrow();
  });
  it('rejects wrong asset version', () =>
    expect(() =>
      readDocument(
        new TextEncoder().encode('{"asset":{"version":"1.0"}}').buffer,
        false,
      ),
    ).toThrow());
  it('rejects excessive JSON depth', () =>
    expect(() =>
      readDocument(
        new TextEncoder().encode('['.repeat(65) + ']'.repeat(65)).buffer,
        false,
      ),
    ).toThrow('nesting'));
  it('rejects cyclic node graph', () =>
    expect(() =>
      inspectDocument({ nodes: [{ children: [0] }] }, 'x.gltf', new Map()),
    ).toThrow('Cyclic'));
  it('rejects excessive geometry allocation', () =>
    expect(() =>
      inspectDocument({ accessors: [{ count: 5000001 }] }, 'x.gltf', new Map()),
    ).toThrow());
  it('rejects unknown required compression', () =>
    expect(() =>
      inspectDocument(
        { extensionsRequired: ['KHR_draco_mesh_compression'] },
        'x.gltf',
        new Map(),
      ),
    ).toThrow('uncompressed'));
  it('rejects missing dependencies', () =>
    expect(() =>
      inspectDocument(
        { buffers: [{ byteLength: 12, uri: 'missing.bin' }] },
        'x.gltf',
        new Map(),
      ),
    ).toThrow('Missing'));
  it('rejects remote dependencies', () =>
    expect(() =>
      inspectDocument(
        { buffers: [{ byteLength: 12, uri: 'https://evil.test/a.bin' }] },
        'x.gltf',
        new Map(),
      ),
    ).toThrow('Unsafe'));
  it('rejects script data resources', () =>
    expect(() =>
      inspectDocument(
        { images: [{ uri: 'data:text/html;base64,QQ==' }] },
        'x.gltf',
        new Map(),
      ),
    ).toThrow());
  it('rejects unidentified images', () =>
    expect(() => imageDimensions(new Uint8Array(32))).toThrow());
  it('bounds decoded texture dimensions', () => {
    const bytes = new Uint8Array(24),
      v = new DataView(bytes.buffer);
    v.setUint32(0, 0x89504e47);
    v.setUint32(4, 0x0d0a1a0a);
    v.setUint32(16, 65535);
    v.setUint32(20, 65535);
    expect(() =>
      inspectDocument(
        { images: [{ uri: 'x.png' }] },
        'x.gltf',
        new Map([['x.png', bytes.buffer]]),
      ),
    ).toThrow('Textures');
  });
});
describe('application state', () => {
  it('emits actual lifecycle changes and supports unsubscribe', () => {
    const store = new Store();
    const phases: string[] = [];
    const off = store.subscribe((s) => phases.push(s.phase));
    store.set({ phase: 'Validating' });
    store.set({ phase: 'Error', error: 'Invalid' });
    off();
    store.set({ phase: 'Idle' });
    expect(phases).toEqual(['Idle', 'Validating', 'Error']);
  });
});
