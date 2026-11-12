import {
  Material,
  Mesh,
  Object3D,
  Texture,
  BufferGeometry,
  SkinnedMesh,
} from 'three';
export function disposeObject(root: Object3D) {
  const geometries = new Set<BufferGeometry>(),
    materials = new Set<Material>(),
    textures = new Set<Texture>();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material)
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
        (m) => materials.add(m),
      );
    if ((object as SkinnedMesh).isSkinnedMesh)
      (object as SkinnedMesh).skeleton.dispose();
  });
  for (const material of materials) {
    for (const value of Object.values(material))
      if (value instanceof Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) {
    const source = texture.source?.data;
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap)
      source.close();
    texture.dispose();
  }
  geometries.forEach((g) => g.dispose());
  root.removeFromParent();
}
