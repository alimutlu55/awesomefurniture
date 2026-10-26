import { ventilationGrille } from '../../domain/kitchen/ventilation';
import type { BoxBuilder } from './frame-geometry';
import { cabinetLighting } from '../../domain/kitchen/cabinet-lighting';
import * as THREE from 'three';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import { resolveMaterials } from '../../domain/materials/configured-materials';

export function addCabinetLighting(design: EditorDesign, group: THREE.Group) {
  if (!resolveMaterials(design).integratedLed) return;
  const material = new THREE.MeshBasicMaterial({ color: '#fff1cb', toneMapped: false });
  for (const segment of cabinetLighting(design)) {
    const { a, b, z } = segment;
    const start = new THREE.Vector3(a.x - design.w / 2, a.y, z - design.d / 2), end = new THREE.Vector3(b.x - design.w / 2, b.y, z - design.d / 2);
    const strip = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, start.distanceTo(end), 6), material);
    strip.position.copy(start).add(end).multiplyScalar(.5);
    strip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    strip.userData.integratedLed = true; group.add(strip);
    const light = new THREE.PointLight(0xffe2b5, .3, 150); light.position.copy(strip.position).y -= 2; group.add(light);
  }
  (group.userData.ownedMaterials ??= []).push(material);
}

export function addCabinetVentilation(design: EditorDesign, box: BoxBuilder, material: THREE.Material) {
  const vent = ventilationGrille(design);
  if (!vent) return;
  for (let y = vent.y0; y < vent.y1; y += 1) {
    const height = Math.min(.4, vent.y1 - y);
    box(vent.width, height, .3, 0, y + height / 2, vent.z - design.d / 2 + .15, material);
  }
}
