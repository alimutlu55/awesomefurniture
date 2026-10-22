import * as THREE from 'three';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import { getDecor, type BoardDecorSKU } from '../../domain/materials/decor-catalog';
import { resolveMaterials, type LegacyFinish } from '../../domain/materials/configured-materials';
import type { createViewportResources } from './viewport-resources.js';

type Resources = Pick<ReturnType<typeof createViewportResources>, 'M'> & Partial<Pick<ReturnType<typeof createViewportResources>, 'decorTexture'>>;
/** Plain finishes never borrow generic oak grain. A verified albedo uses white tint. */
export function createDecorMaterial(resources: Resources, sku: BoardDecorSKU) {
  const material: THREE.MeshStandardMaterial = resources.M(sku.pbr.baseHex, { roughness: sku.pbr.roughness, metalness: sku.pbr.metalness });
  material.userData.board = true;
  material.userData.decorId = sku.id;
  material.userData.grainDirection = sku.grainDirection;
  if (sku.pbr.textureUrl && resources.decorTexture) {
    let disposed = false;
    const texture = resources.decorTexture(sku.pbr.textureUrl, loaded => {
      if (disposed) return;
      material.map = loaded;
      material.color.set('#ffffff'); material.userData.referenceColor = new THREE.Color('#ffffff'); material.needsUpdate = true;
    });
    material.addEventListener('dispose', () => { disposed = true; texture.dispose(); });
  }
  return material;
}

export function createCabinetMaterials(resources: Resources, design: Pick<EditorDesign, 'fin' | 'materials'> | LegacyFinish) {
  const materials = resolveMaterials(typeof design === 'string' ? { fin: design } : design);
  const carcass = getDecor(materials.carcassDecorId), fronts = getDecor(materials.frontDecorId);
  const panel = createDecorMaterial(resources, carcass), front = createDecorMaterial(resources, fronts);
  const back = createDecorMaterial(resources, carcass), plinth = createDecorMaterial(resources, carcass);
  // Recess shading belongs only to the interactive view, not the geometry reference sent to Gemini.
  back.userData.referenceColor = plinth.userData.referenceColor = panel.color.clone();
  back.color.multiplyScalar(.92); plinth.color.multiplyScalar(.72);
  const hardwareColor = { matte_black: '#242426', brushed_brass: '#b99a57', anodized_champagne: '#c2b69c', handleless_tip_on: '#242426' }[materials.handleFinish];
  const hardware = resources.M(hardwareColor,
    { metalness: materials.handleFinish === 'matte_black' ? .35 : .8, roughness: materials.handleFinish === 'matte_black' ? .75 : .4 });
  const accessoryColor = { matte_black: '#242426', brushed_steel: '#b9bdc2', anodized_champagne: '#c2b69c' }[materials.internalAccessoryFinish];
  const accessory = resources.M(accessoryColor, { metalness: .8, roughness: .4 });
  return { panel, front, back, plinth, hardware, accessory, owned: [panel, front, back, plinth, hardware, accessory] };
}
