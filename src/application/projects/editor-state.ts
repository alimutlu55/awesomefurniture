import { createInitialDesign } from '../../domain/wardrobe/default-design';
import type { EditorState } from './editor-scene';
import { defaultMaterials } from '../../domain/materials/configured-materials';
import { furnitureModule } from '../../domain/furniture/furniture';

export function createEditorState(): EditorState {
 return {...createInitialDesign(),materials:defaultMaterials(),sel:0,item:-1,divider:-1,space:null,open:false};
}

/** Reset design defaults inside the original cabinet envelope. */
export function resetCabinetState(current: EditorState, initialDesign: () => EditorState): EditorState {
  const fresh = furnitureModule(current).reset?.(current);
  const defaults = fresh ? { ...createEditorState(), ...fresh } : initialDesign();
  const { w, h, d, shape } = current;
  // Steps in a fitted top can follow the partitions between sections.
  const fittedSections = shape ? { n: current.n, wt: current.wt } : {};
  return { ...current, ...defaults, w, h, d, shape, ...fittedSections, open: false };
}
