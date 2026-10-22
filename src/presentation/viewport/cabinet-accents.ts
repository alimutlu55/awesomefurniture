import * as THREE from 'three';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import { resolveMaterials } from '../../domain/materials/configured-materials';
import { ceilingPieces, ceilingPolyline, resolveShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { PANEL } from '../../domain/wardrobe/catalog.js';

export function addCabinetLighting(design: EditorDesign, group: THREE.Group) {
  if (!resolveMaterials(design).integratedLed) return;
  const points = ceilingPolyline(ceilingPieces(resolveShape(design)), PANEL, design.w - PANEL);
  const material = new THREE.MeshBasicMaterial({ color: '#fff1cb', toneMapped: false });
  const z = design.d / 2 - 6;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    const start = new THREE.Vector3(a.x - design.w / 2, a.y - PANEL - .4, z), end = new THREE.Vector3(b.x - design.w / 2, b.y - PANEL - .4, z);
    const strip = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, start.distanceTo(end), 6), material);
    strip.position.copy(start).add(end).multiplyScalar(.5);
    strip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    strip.userData.integratedLed = true; group.add(strip);
    const light = new THREE.PointLight(0xffe2b5, .3, 150); light.position.copy(strip.position).y -= 2; group.add(light);
  }
  (group.userData.ownedMaterials ??= []).push(material);
}
