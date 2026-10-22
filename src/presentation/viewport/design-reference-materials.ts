import * as THREE from 'three';

type ColoredMaterial = THREE.Material & {
  color?: THREE.Color; map?: THREE.Texture | null; alphaMap?: THREE.Texture | null;
};

/** Unlit, color-faithful capture materials. Textures are borrowed; only these temporary materials are disposed. */
export function neutralReferenceMaterials(scene: THREE.Scene) {
  const materials = new Map<THREE.Material, THREE.MeshBasicMaterial>();
  const edges: { parent: THREE.Mesh; line: THREE.LineSegments }[] = [];
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: .18, toneMapped: false, depthWrite: false });
  scene.environment = null;
  scene.traverse(object => {
    if (object.userData.planarMirror) { object.visible = false; return; }
    if (object instanceof THREE.Light || object instanceof THREE.Line || object instanceof THREE.Sprite || object.userData.referenceShadow) {
      object.visible = false;
    }
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = object.receiveShadow = false;
    const convert = (source: ColoredMaterial) => {
      // Transparent unlit overlays are painted contact shadows, AO, selection glows or picking targets.
      if (source instanceof THREE.ShadowMaterial || source.opacity === 0
        || (source instanceof THREE.MeshBasicMaterial && source.transparent && !source.depthWrite)) object.visible = false;
      let neutral = materials.get(source);
      if (!neutral) {
        neutral = new THREE.MeshBasicMaterial({
          color: source.userData.referenceColor ?? source.color ?? 0xffffff,
          map: source.map ?? null, alphaMap: source.alphaMap ?? null,
          side: source.side, opacity: source.opacity, transparent: source.transparent, alphaTest: source.alphaTest,
          depthTest: source.depthTest, depthWrite: source.depthWrite, vertexColors: source.vertexColors,
          polygonOffset: source.polygonOffset, polygonOffsetFactor: source.polygonOffsetFactor, polygonOffsetUnits: source.polygonOffsetUnits,
          toneMapped: false,
        });
        materials.set(source, neutral);
      }
      return neutral;
    };
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    if (object.visible && (object.userData.studioCeiling || sourceMaterials.some(material => material.userData.board))) {
      // Preserve real panel boundaries when equal-color faces meet: these are thin geometry edges, not shaded surfaces.
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry, 35), edgeMaterial);
      line.userData.referenceEdge = true;
      edges.push({ parent: object, line });
    }
    object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
  });
  for (const { parent, line } of edges) if (parent.visible) parent.add(line);
  return { dispose: () => {
    for (const { parent, line } of edges) { parent.remove(line); line.geometry.dispose(); }
    edgeMaterial.dispose();
    for (const material of materials.values()) material.dispose();
  } };
}
