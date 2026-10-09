import { createInitialDesign } from '../../domain/wardrobe/default-design';
import type { EditorState } from './editor-scene';

export function createEditorState(): EditorState {
 return {...createInitialDesign(),sel:0,item:-1,divider:-1,space:null,open:false};
}
