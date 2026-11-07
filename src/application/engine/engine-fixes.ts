import type { FixAction } from '../../domain/engine/rules/engine-rules';
import type { Construction } from '../../domain/make/make-construction';
import type { EditorScene } from '../projects/editor-scene';

/**
 * Applies a finding's fix with the editor's own commands, so a fix is exactly what a person could do by hand: one undo
 * step, the same checks, the same messages. The ports are the commands the presentation already has.
 */
export interface FixPorts {
  readonly scene: () => EditorScene;
  /** Makes the piece the active one and selects it, as tapping it does. */
  readonly select: (piece: number) => void;
  /** Splits the active piece's selected bay in two, keeping its layout on both sides (bay-split-commands.ts). */
  readonly splitSelectedBay: () => void;
  readonly setConstruction: (piece: number, change: Partial<Construction>) => void;
}

/** Applies `action`; false when its piece or bay no longer exists (the design changed since the finding). */
export function applyFix(action: FixAction, ports: FixPorts): boolean {
  const piece = ports.scene().wardrobes.find(w => w.id === action.piece);
  if (!piece) return false;
  switch (action.kind) {
    case 'select-piece':
      ports.select(piece.id);
      return true;
    case 'split-bay':
      if (action.bay < 0 || action.bay >= piece.state.n) return false;
      ports.select(piece.id);
      piece.state.sel = action.bay;
      piece.state.item = -1; piece.state.divider = -1; piece.state.space = null;
      ports.splitSelectedBay();
      return true;
    case 'set-construction':
      ports.setConstruction(piece.id, action.construction);
      return true;
  }
}
