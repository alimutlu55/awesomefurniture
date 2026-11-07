import { furnitureKind } from '../../domain/furniture/furniture';
import type { EditorScene } from '../projects/editor-scene';

/** What analytics may say about a design: how many pieces of each kind. Never sizes per piece, names or contents. */
export function sceneSummary(scene: Pick<EditorScene, 'wardrobes'>) {
  const kitchens = scene.wardrobes.filter(c => furnitureKind(c.state) === 'kitchen').length;
  const wardrobes = scene.wardrobes.length - kitchens;
  const mix = wardrobes && kitchens ? 'both' as const : kitchens ? 'kitchen' as const : wardrobes ? 'wardrobe' as const : 'empty' as const;
  return { wardrobes, kitchens, pieces: scene.wardrobes.length, mix, product: kitchens > wardrobes ? 'kitchen' as const : 'wardrobe' as const };
}
