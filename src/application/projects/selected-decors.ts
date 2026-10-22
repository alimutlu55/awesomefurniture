import type { ConfigurationForImage } from './configuration-summary';
import { getDecor } from '../../domain/materials/decor-catalog';
import { resolveMaterials } from '../../domain/materials/configured-materials';

export function selectedDecors(specification: ConfigurationForImage) {
  const selected = new Map<string, { sku: ReturnType<typeof getDecor>; zones: string[] }>();
  specification.design.furniture.forEach((piece, i) => {
    const materials = resolveMaterials(piece);
    for (const [zone, id] of [['carcass, open shelves and exposed sides', materials.carcassDecorId],
      ['exterior door panels', materials.frontDecorId], ['worktop', materials.worktopDecorId], ['backsplash', materials.backsplashDecorId],
      ['drawer interiors and drawer boxes', materials.drawerDecorId], ['back panels', materials.backingDecorId]] as const) {
      if (!id) continue;
      let entry = selected.get(id);
      if (!entry) { entry = { sku: getDecor(id), zones: [] }; selected.set(id, entry); }
      entry.zones.push(`Wing/module ${i + 1}: ${zone}`);
    }
  });
  return [...selected.values()];
}
