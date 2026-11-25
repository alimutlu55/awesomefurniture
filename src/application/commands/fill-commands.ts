import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { furnitureModule, isKitchen } from '../../domain/furniture/furniture';
import { FILL_REACH, measureAround } from './align-commands';

interface Ports {
  getScene(): EditorScene;
  active(): EditorCabinet | undefined;
  checkpoint(): void;
  discardCheckpoint(): void;
  report(message: string): void;
  /** Sets the selected cabinet's width without a checkpoint of its own. */
  resize(width: number): boolean;
}

/** Filling the gap beside a piece. Kitchen units stand between walls and neighbours that are rarely a whole number of
 * unit widths apart, and a cabinet maker fills what is left by making a unit wider (up to FILL_REACH each side). A
 * wardrobe, chest or sideboard between two walls or neighbours (an alcove, a wall between two corners) fills the whole
 * stretch between them, as wide as it may be: the built-in people draw rooms for. */
export function createFillCommands({ getScene, active, checkpoint, discardCheckpoint, report, resize }: Ports) {
  // The exact distance between the faces: a gap's `distance` is rounded for showing, and adding rounded gaps can come
  // out a fraction of a millimetre wider than the room there is.
  const exact = (g: { from: { x: number; z: number }; to: { x: number; z: number } }) => Math.hypot(g.to.x - g.from.x, g.to.z - g.from.z);
  const near = (cabinet: EditorCabinet) => {
    const all = measureAround(getScene(), cabinet, ['left', 'right']).gaps.map(g => ({ ...g, distance: exact(g) })), gaps = all.filter(g => g.distance > .05);
    if (isKitchen(cabinet.state)) return gaps.filter(g => g.distance <= FILL_REACH);
    // A built-in fills only between two things: with open floor on one side there is no wall to fill to.
    return all.some(g => g.side === 'left') && all.some(g => g.side === 'right') ? gaps : [];
  };
  /** How much wider it can grow: the gaps, but never past the widest this kind of furniture is made. */
  const room = (cabinet: EditorCabinet | undefined) => {
    if (!cabinet) return 0;
    // Whole millimetres, rounded down: rounded up, a 29.996 cm gap would be offered as 30 and the piece refused for overlapping.
    const gaps = Math.floor(near(cabinet).reduce((sum, g) => sum + g.distance, 0) * 10 + 1e-6) / 10;
    return Math.max(0, Math.min(gaps, furnitureModule(cabinet.state).sizes(cabinet.state).w[1] - cabinet.state.w));
  };
  return {
    /** How much room beside the selected piece it could grow to fill (0 when none). */
    fillableSpace: () => room(active()),
    /** Widens the selected piece to fill the room beside it, between the walls or neighbours on either side: one undo step. */
    fillSpace(): boolean {
      const cabinet = active(), space = room(cabinet);
      if (!cabinet || space < .05) { report('There is no gap beside this cabinet to fill.'); return false; }
      // Whole millimetres, rounded down: never into the neighbour. The unit first slides to the middle of its gaps, so that
      // growing evenly on both sides takes up each of them exactly.
      const gaps = near(cabinet), left = gaps.find(g => g.side === 'left')?.distance ?? 0, right = gaps.find(g => g.side === 'right')?.distance ?? 0;
      // Capped at the widest it may be: it then stands in the middle of the stretch, with what is left shared out.
      const turn = cabinet.angle * Math.PI / 180, slide = (right - left) / 2, before = { x: cabinet.x, z: cabinet.z };
      checkpoint();
      cabinet.x += Math.cos(turn) * slide; cabinet.z -= Math.sin(turn) * slide;
      if (resize(Math.floor((cabinet.state.w + space) * 10 + 1e-6) / 10)) return true;
      Object.assign(cabinet, before);
      discardCheckpoint();
      return false;
    },
  };
}
