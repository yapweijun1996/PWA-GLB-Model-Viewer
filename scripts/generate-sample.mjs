// Original procedural model, authored for GLB Studio.
import { BoxGeometry, CylinderGeometry } from 'three';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const chunks = [];
let length = 0;
const doc = {
  asset: { version: '2.0', generator: 'GLB Studio' },
  scene: 0,
  scenes: [{ name: 'Studio Rover', nodes: [0] }],
  nodes: [{ name: 'Studio Rover', children: [] }],
  meshes: [],
  materials: [
    {
      name: 'Ceramic blue',
      pbrMetallicRoughness: {
        baseColorFactor: [0.12, 0.28, 0.38, 1],
        metallicFactor: 0.45,
        roughnessFactor: 0.3,
      },
    },
    {
      name: 'Graphite',
      pbrMetallicRoughness: {
        baseColorFactor: [0.035, 0.045, 0.055, 1],
        metallicFactor: 0.15,
        roughnessFactor: 0.6,
      },
    },
    {
      name: 'Glass',
      pbrMetallicRoughness: {
        baseColorFactor: [0.14, 0.24, 0.29, 1],
        metallicFactor: 0.7,
        roughnessFactor: 0.15,
      },
    },
    {
      name: 'Ivory accent',
      pbrMetallicRoughness: {
        baseColorFactor: [0.85, 0.82, 0.72, 1],
        metallicFactor: 0.2,
        roughnessFactor: 0.4,
      },
    },
  ],
  accessors: [],
  bufferViews: [],
  buffers: [],
  animations: [],
};
function accessor(array, type, target, min, max) {
  const data = Buffer.from(array.buffer, array.byteOffset, array.byteLength),
    view = doc.bufferViews.length;
  doc.bufferViews.push({
    buffer: 0,
    byteOffset: length,
    byteLength: data.length,
    ...(target ? { target } : {}),
  });
  chunks.push(data);
  const pad = (4 - (data.length % 4)) % 4;
  chunks.push(Buffer.alloc(pad));
  length += data.length + pad;
  doc.accessors.push({
    bufferView: view,
    componentType: array instanceof Float32Array ? 5126 : 5123,
    count: array.length / { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type],
    type,
    ...(min ? { min, max } : {}),
  });
  return doc.accessors.length - 1;
}
function mesh(geometry, material) {
  geometry.computeBoundingBox();
  const b = geometry.boundingBox;
  const position = accessor(
    geometry.attributes.position.array,
    'VEC3',
    34962,
    b.min.toArray(),
    b.max.toArray(),
  );
  const normal = accessor(geometry.attributes.normal.array, 'VEC3', 34962),
    indices = accessor(new Uint16Array(geometry.index.array), 'SCALAR', 34963);
  const uv = accessor(geometry.attributes.uv.array, 'VEC2', 34962);
  doc.meshes.push({
    primitives: [
      {
        attributes: { POSITION: position, NORMAL: normal, TEXCOORD_0: uv },
        indices,
        material,
      },
    ],
  });
  return doc.meshes.length - 1;
}
const box = new BoxGeometry(1, 1, 1),
  body = mesh(box, 0),
  rubber = mesh(new CylinderGeometry(0.42, 0.42, 0.26, 32), 1),
  glass = mesh(box, 2),
  accent = mesh(box, 3),
  hub = mesh(new CylinderGeometry(0.23, 0.23, 0.28, 24), 3);
function node(name, mesh, translation, scale = [1, 1, 1], rotation) {
  doc.nodes.push({
    name,
    mesh,
    translation,
    scale,
    ...(rotation ? { rotation } : {}),
  });
  doc.nodes[0].children.push(doc.nodes.length - 1);
}
node('Body', body, [0, 0.85, 0], [3.8, 0.58, 1.65]);
node('Cabin', glass, [-0.3, 1.4, 0], [1.9, 0.65, 1.45]);
node('Roof', body, [-0.3, 1.77, 0], [2, 0.12, 1.55]);
node('Front light', accent, [1.93, 0.91, 0], [0.06, 0.13, 1.5]);
node('Rear bumper', accent, [-1.94, 0.65, 0], [0.1, 0.12, 1.5]);
for (const x of [-1.22, 1.22])
  for (const z of [-0.86, 0.86]) {
    const r = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
    node(
      `Wheel ${x > 0 ? 'front' : 'rear'} ${z > 0 ? 'left' : 'right'}`,
      rubber,
      [x, 0.46, z],
      [1, 1, 1],
      r,
    );
    node('Wheel hub', hub, [x, 0.46, z], [1, 1, 1], r);
  }
const input = accessor(
    new Float32Array([0, 1, 2]),
    'SCALAR',
    undefined,
    [0],
    [2],
  ),
  output = accessor(
    new Float32Array([
      0,
      0,
      0,
      1,
      0,
      Math.SQRT1_2,
      0,
      Math.SQRT1_2,
      0,
      1,
      0,
      0,
    ]),
    'VEC4',
  );
doc.animations.push({
  name: 'Turntable',
  samplers: [{ input, output, interpolation: 'LINEAR' }],
  channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }],
});
doc.buffers.push({ byteLength: length });
let json = Buffer.from(JSON.stringify(doc));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
const bin = Buffer.concat(chunks),
  header = Buffer.alloc(12),
  jh = Buffer.alloc(8),
  bh = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
jh.writeUInt32LE(json.length);
jh.writeUInt32LE(0x4e4f534a, 4);
bh.writeUInt32LE(bin.length);
bh.writeUInt32LE(0x004e4942, 4);
mkdirSync('public/models', { recursive: true });
writeFileSync(
  'public/models/studio-rover.glb',
  Buffer.concat([header, jh, json, bh, bin]),
);
mkdirSync('tests/fixtures', { recursive: true });
writeFileSync('tests/fixtures/rover.bin', bin);
doc.buffers[0].uri = 'rover.bin';
writeFileSync('tests/fixtures/rover.gltf', JSON.stringify(doc));
console.log('Generated sample and external-buffer fixture.');
// Separate textured fixture exercises GLTFLoader's internally created blob URLs.
const texture = readFileSync('tests/fixtures/texture.png');
const textured = structuredClone(doc);
delete textured.buffers[0].uri;
textured.bufferViews.push({
  buffer: 0,
  byteOffset: bin.length,
  byteLength: texture.length,
});
textured.images = [
  { bufferView: textured.bufferViews.length - 1, mimeType: 'image/png' },
];
textured.textures = [{ source: 0 }];
textured.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
const tb = Buffer.concat([
  bin,
  texture,
  Buffer.alloc((4 - (texture.length % 4)) % 4),
]);
textured.buffers[0].byteLength = tb.length;
let tj = Buffer.from(JSON.stringify(textured));
tj = Buffer.concat([tj, Buffer.alloc((4 - (tj.length % 4)) % 4, 32)]);
const th = Buffer.from(header),
  tjh = Buffer.from(jh),
  tbh = Buffer.from(bh);
th.writeUInt32LE(28 + tj.length + tb.length, 8);
tjh.writeUInt32LE(tj.length);
tbh.writeUInt32LE(tb.length);
writeFileSync(
  'tests/fixtures/textured.glb',
  Buffer.concat([th, tjh, tj, tbh, tb]),
);
