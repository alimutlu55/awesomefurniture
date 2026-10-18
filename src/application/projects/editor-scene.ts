import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import type { Studio } from '../../domain/studio/studio';

/** Editing context is transient and is stripped by the document mapper. */
export interface EditorSelectionContext {
 sel: number; item: number; divider: number;
 space: { i: number; x: number; y: number } | null;
 open: boolean;
}
export type EditorState = EditorDesign & EditorSelectionContext;
export interface EditorCabinet {
  id: number; name: string; x: number; y: number; z: number; angle: number; state: EditorState;
}
export interface EditorScene {
  wardrobes: EditorCabinet[]; activeWardrobe: number; nextWardrobeId: number;
  /** The room around the wardrobes. Absent: an open floor. */
  studio?: Studio | undefined;
  /** The project's max reach height (cm), shared by every wardrobe and cabinet in it. Absent: not set. */
  maxReach?: number | undefined;
}
