import * as THREE from 'three';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import { getDecor, type BoardDecorSKU } from '../../domain/materials/decor-catalog';
import { resolveMaterials, type LegacyFinish } from '../../domain/materials/configured-materials';
import type { createViewportResources } from './viewport-resources.js';
import { applyBoardColorRendering } from './board-color-rendering';
import { applyMaterialRelief } from './material-relief';
import { startLoadingShimmer } from './loading-shimmer';

type Resources = Pick<ReturnType<typeof createViewportResources>, 'M'> & Partial<Pick<ReturnType<typeof createViewportResources>, 'decorTexture'>>;
/** Plain finishes never borrow generic oak grain. A verified albedo uses white tint. */
export function createDecorMaterial(resources: Resources, sku: BoardDecorSKU) {
  const physical = sku.category === 'glass_mirror' || sku.category === 'high_gloss';
  const material: THREE.MeshStandardMaterial = physical ? new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(sku.pbr.baseHex).convertSRGBToLinear(), roughness: sku.pbr.roughness, metalness: sku.pbr.metalness,
    transmission: sku.pbr.transmission ?? 0, clearcoat: sku.pbr.clearcoat ?? 0, clearcoatRoughness: sku.pbr.clearcoatRoughness ?? .1,
    ior: sku.pbr.ior ?? 1.5,
  }) : resources.M(sku.pbr.baseHex, { roughness: sku.pbr.roughness, metalness: sku.pbr.metalness });
  material.userData.board = true;
  material.userData.decorId = sku.id;
  material.transparent = (sku.pbr.transmission ?? 0) > 0;
  if (material.transparent) material.depthWrite = false;
  material.userData.glassStyle = sku.glassStyle;
  material.userData.panelThickness = sku.thicknessMm / 10;
  material.userData.grainDirection = sku.grainDirection;
  material.userData.boardMapping = { sizeCm: sku.pbr.textureSizeCm ?? [231.1, 130], grainAxis: sku.pbr.textureGrainAxis ?? 'u' };
  if (!physical && sku.category !== 'metallic_brushed') applyBoardColorRendering(material);
  applyMaterialRelief(material, sku);
  if (sku.pbr.textureUrl && resources.decorTexture) {
    let disposed = false;
    // Until its scan arrives the surface shows the app's loading state, on this surface only.
    const loading = startLoadingShimmer(material);
    const texture = resources.decorTexture(sku.pbr.textureUrl, loaded => {
      loading.done();
      if (disposed) return;
      material.map = loaded;
      material.color.set('#ffffff'); material.userData.referenceColor = new THREE.Color('#ffffff'); material.needsUpdate = true;
    }, () => loading.done());
    material.addEventListener('dispose', () => { disposed = true; texture.dispose(); });
  }
  return material;
}

export function createCabinetMaterials(resources: Resources, design: Pick<EditorDesign, 'fin' | 'materials' | 'frontThickness'> | LegacyFinish) {
  const materials = resolveMaterials(typeof design === 'string' ? { fin: design } : design);
  const carcass = getDecor(materials.carcassDecorId), fronts = getDecor(materials.frontDecorId);
  const panel = createDecorMaterial(resources, carcass), door = createDecorMaterial(resources, fronts);
  const front = fronts.category === 'glass_mirror' ? createDecorMaterial(resources, carcass) : door;
  if (typeof design !== 'string' && design.frontThickness !== undefined) door.userData.panelThickness = front.userData.panelThickness = design.frontThickness;
  door.userData.frontProfile = front.userData.frontProfile = materials.frontProfile ?? 'slab';
  door.userData.frameColor = materials.handleFinish === 'anodized_champagne' ? '#c2b69c' : '#242426';
  const back = createDecorMaterial(resources, getDecor(materials.backingDecorId ?? carcass.id)), plinth = createDecorMaterial(resources, carcass);
  const drawer = createDecorMaterial(resources, getDecor(materials.drawerDecorId ?? carcass.id));
  const hardwareColor = { matte_black: '#242426', brushed_brass: '#b99a57', anodized_champagne: '#c2b69c', handleless_tip_on: '#242426' }[materials.handleFinish];
  const hardware = resources.M(hardwareColor,
    { metalness: materials.handleFinish === 'matte_black' ? .35 : .8, roughness: materials.handleFinish === 'matte_black' ? .75 : .4 });
  const accessoryColor = { matte_black: '#242426', brushed_steel: '#b9bdc2', anodized_champagne: '#c2b69c' }[materials.internalAccessoryFinish];
  const accessory = resources.M(accessoryColor, { metalness: .8, roughness: .4 });
  return { panel, front, door, back, drawer, plinth, hardware, accessory, owned: [...new Set([panel, front, door, back, drawer, plinth, hardware, accessory])] };
}
