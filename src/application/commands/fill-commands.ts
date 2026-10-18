import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { isKitchen } from '../../domain/furniture/furniture';
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

/** Filling the gap beside a kitchen unit: units stand between walls and neighbours that are rarely a whole number of
 * unit widths apart, and a cabinet maker fills what is left by making a unit wider. */
export function createFillCommands({ getScene, active, checkpoint, discardCheckpoint, report, resize }: Ports) {
  const near = (cabinet: EditorCabinet) => measureAround(getScene(), cabinet, ['left', 'right']).gaps.filter(g => g.distance > .05 && g.distance <= FILL_REACH);
  const room = (cabinet: EditorCabinet | undefined) => cabinet && isKitchen(cabinet.state) ? Math.round(near(cabinet).reduce((sum, g) => sum + g.distance, 0) * 10) / 10 : 0;
  return {
    /** How much room beside the selected kitchen unit a wider unit could fill (0 when none, or not a kitchen unit). */
    fillableSpace: () => room(active()),
    /** Widens the selected kitchen unit to fill the room beside it, between the wall or neighbours on either side: one undo step. */
    fillSpace(): boolean {
      const cabinet = active(), space = room(cabinet);
      if (!cabinet || space < .05) { report('There is no gap beside this cabinet to fill.'); return false; }
      // Whole millimetres, rounded down: never into the neighbour. The unit first slides to the middle of its gaps, so that
      // growing evenly on both sides takes up each of them exactly.
      const gaps = near(cabinet), left = gaps.find(g => g.side === 'left')?.distance ?? 0, right = gaps.find(g => g.side === 'right')?.distance ?? 0;
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
