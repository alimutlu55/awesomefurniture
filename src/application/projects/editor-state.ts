import { createInitialDesign } from '../../domain/wardrobe/default-design';
import type { EditorState } from './editor-scene';
import { defaultMaterials } from '../../domain/materials/configured-materials';

export function createEditorState(): EditorState {
 return {...createInitialDesign(),materials:defaultMaterials(),sel:0,item:-1,divider:-1,space:null,open:false};
}
