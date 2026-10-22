import * as THREE from 'three';

/** Per-editor assets reused across meshes and rebuilds, pruned to the current scene. */
export function createRenderAssetCache() {
  const geometries = new Map<string, THREE.BufferGeometry>();
  const materials = new Map<string, THREE.Material[]>();
  const sharedGeometries = new Set<THREE.BufferGeometry>();
  const sharedMaterials = new Set<THREE.Material>();
  const usedGeometry = new Set<string>(), usedMaterials = new Set<string>();
  const meshes = new Set<THREE.Mesh>();

  function geometry(key: string, make: () => THREE.BufferGeometry) {
    usedGeometry.add(key);
    let value = geometries.get(key);
    if (!value) {
      value = make();
      geometries.set(key, value);
      sharedGeometries.add(value);
    }
    return value;
  }
  function material(key: string, make: () => THREE.Material[]) {
    usedMaterials.add(key);
    let value = materials.get(key);
    if (!value) {
      value = make();
      materials.set(key, value);
      value.forEach(m => sharedMaterials.add(m));
    }
    return value;
  }
  // Retain only assets used by the current scene, including across edits. Meshes and sway remain per item.
  function beginBuild() {
    usedGeometry.clear();
    usedMaterials.clear();
    meshes.clear();
  }
  function endBuild() {
    for (const [key, value] of geometries) if (!usedGeometry.has(key)) {
      value.dispose();
      geometries.delete(key);
      sharedGeometries.delete(value);
    }
    for (const [key, value] of materials) if (!usedMaterials.has(key)) {
      value.forEach(m => { m.dispose(); sharedMaterials.delete(m); });
      materials.delete(key);
    }
  }
  function retain(usedGeoms?: Set<THREE.BufferGeometry>, usedMats?: Set<THREE.Material>) {
    if (usedGeoms) for (const [key, value] of geometries) if (usedGeoms.has(value)) usedGeometry.add(key);
    if (usedMats) for (const [key, value] of materials) if (value.some(m => usedMats.has(m))) usedMaterials.add(key);
  }
  function dispose() {
    // Detach cached meshes before the viewport's general scene cleanup to avoid double disposal.
    meshes.forEach(mesh => mesh.parent?.remove(mesh));
    beginBuild();
    endBuild();
  }

  return { geometry, material, meshes, beginBuild, endBuild, retain, dispose, sharedGeometries, sharedMaterials };
}
