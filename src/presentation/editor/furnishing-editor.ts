import type { Studio, StudioFurnishing } from '../../domain/studio/studio';
import type { Pose } from '../../domain/studio/studio-placement';
import { furnishingPiece, roomOf } from '../../domain/pieces/pieces';
import type { PieceTarget } from '../../domain/pieces/piece-model';
import { pieceAxes, piecePoint } from '../../domain/pieces/piece-motion';
import { moveFurnishing } from '../../domain/studio/furnishings/furnishing-edit';
import type { RoomSelection } from '../viewport/studio-renderer';
import { furthestValid } from './studio-drag';
import type { Guide } from './studio-drag';
import type { RoomHandle, RoomMeasure } from './studio-editor.ports';
import { TURN_KEY_STEP, bearing, sweptAngle, type TurnStart } from './turn-gesture';
import { turnButtonAt } from '../viewport/turn-ring';
import { measureNumber, unitSuffix } from './editor-format.js';

type Point = { x: number; y: number; z: number };
type Commands = Readonly<Pick<ReturnType<typeof import('../../application/commands/piece-commands').createPieceCommands>,
  'editFurnishing' | 'furnishingProblem' | 'turnStudioFurnishing' | 'duplicateStudioFurnishing' | 'removeStudioFurnishing'>>;
interface Drag {
  id: string; pointer: number; target: HTMLElement; snapshot: string; original: Studio; ground: Point; client: { x: number; y: number };
  moved: boolean; lock: PieceTarget | null; guides: Guide[]; reason: string | null;
  /** Set while it is turned by its turn handle rather than moved. */
  turn?: TurnStart;
}

export interface FurnishingEditorPorts {
  readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene' | 'snapshot' | 'restore'>;
  readonly sceneCommands: Commands;
  readonly history: { checkpoint(snapshot: string): void };
  readonly picking: { groundPoint(e: PointerEvent): Point | null };
  readonly selection: () => RoomSelection;
  readonly callbacks: {
    select(next: RoomSelection): void;
    /** The furnishing moved during a drag: redraw the room and its measures, nothing else. */
    redraw(): void;
    refresh(): void;
    histUI(): void;
  };
}

const round = (v: number) => Math.round(v * 10) / 10;
const text = (v: number) => measureNumber(round(v)) + unitSuffix();

/** Moving furnishings: a selected bed or rug is dragged across the floor by its own body. Near a wall it squares up flush
 * against it and lines up along it (the wall's middle, a window, the bed beside it); Shift moves freely. It goes as far as
 * the room allows, says why it stopped, and takes one undo step. Arrow keys slide it 1 cm (10 with Shift), R turns it. */
export function createFurnishingEditor({ model, sceneCommands, history, picking, selection, callbacks }: FurnishingEditorPorts) {
  let drag: Drag | null = null;
  const room = () => model.scene.studio;
  const selected = (studio = room()): StudioFurnishing | undefined => {
    const s = selection();
    return s?.kind === 'furnishing' ? studio?.furnishings?.find(f => f.id === s.id) : undefined;
  };

  /** Grabs a furnishing by its body: selects it if another part was selected, and starts a drag that moves once the pointer does. */
  function grab(e: PointerEvent, hit: { object: { userData: Record<string, unknown> } }, target: HTMLElement) {
    const studio = room(), id = hit.object.userData.studioFurnishing, ground = picking.groundPoint(e);
    if (!studio || typeof id !== 'string' || e.button > 0 || !ground || !studio.furnishings?.some(f => f.id === id)) return false;
    if (selection()?.kind !== 'furnishing' || selection()!.id !== id) callbacks.select({ kind: 'furnishing', id });
    e.preventDefault();
    e.stopPropagation();
    drag = { id, pointer: e.pointerId, target, snapshot: model.snapshot(), original: studio, ground: { ...ground }, client: { x: e.clientX, y: e.clientY },
      moved: false, lock: null, guides: [], reason: null };
    try { target.setPointerCapture(e.pointerId); } catch { /* the canvas keeps the gesture */ }
    return true;
  }

  /** Where the pointer puts it: moved with the pointer, then flush against a wall it comes near and lined up along it. */
  function goal(g: Drag, f: StudioFurnishing, e: PointerEvent): Pose | null {
    const p = picking.groundPoint(e);
    if (!p) return null;
    const out = furnishingPiece(f).aim(roomOf(g.original, model.scene.wardrobes), { x: f.x + p.x - g.ground.x, z: f.z + p.z - g.ground.z, angle: f.angle }, g.lock, e.shiftKey);
    g.lock = out.lock;
    g.guides = [...out.guides];
    return out.pose;
  }

  /** Starts turning the selected furnishing by its turn handle, as a wardrobe is turned: the pointer sweeps round its middle. */
  function beginTurn(e: PointerEvent, target: HTMLElement) {
    const studio = room(), f = selected(studio), ground = picking.groundPoint(e);
    if (!studio || !f || e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    const centre = { x: f.x, z: f.z };
    drag = { id: f.id, pointer: e.pointerId, target, snapshot: model.snapshot(), original: studio, ground: ground ?? { x: f.x, y: 0, z: f.z }, client: { x: e.clientX, y: e.clientY },
      moved: false, lock: null, guides: [], reason: null, turn: { angle: f.angle, centre, polar: bearing(centre, ground), x: e.clientX, spatial: !!ground } };
    target.classList.add('rotating');
    try { target.setPointerCapture(e.pointerId); } catch { /* the handle keeps the gesture */ }
  }

  function move(e: PointerEvent) {
    const g = drag;
    if (!g || e.pointerId !== g.pointer) return;
    if (g.turn) {
      const raw = sweptAngle(g.turn, picking.groundPoint(e), e.clientX);
      g.moved = g.moved || Math.abs(raw - g.turn.angle) > 2;
      if (g.moved) sceneCommands.turnStudioFurnishing(g.id, raw, e.shiftKey, false);
      callbacks.redraw();
      return;
    }
    if (!g.moved && Math.hypot(e.clientX - g.client.x, e.clientY - g.client.y) < 4) return;
    g.moved = true;
    const f = g.original.furnishings!.find(x => x.id === g.id)!, to = goal(g, f, e);
    if (!to) return;
    const now = model.scene.studio?.furnishings?.find(x => x.id === g.id) ?? f;
    const want = (t: number) => moveFurnishing(g.original, g.id, { x: now.x + (to.x - now.x) * t, z: now.z + (to.z - now.z) * t, angle: to.angle });
    const problem = (s: Studio) => sceneCommands.furnishingProblem(s, g.id);
    const whole = want(1), result = furthestValid(want, s => !problem(s));
    if (!result.whole) g.guides = [];
    g.reason = whole ? problem(whole) : null;
    if (result.room) model.scene.studio = result.room;
    callbacks.redraw();
  }
  /** Ends a drag: one undo step if it moved. Returns whether it moved, so a tap is left to selection. */
  function end(cancel = false) {
    const g = drag;
    if (!g) return false;
    drag = null;
    g.target.classList.remove('rotating');
    try { if (g.target.hasPointerCapture(g.pointer)) g.target.releasePointerCapture(g.pointer); } catch { /* released already */ }
    if (cancel) { model.restore(g.snapshot); callbacks.refresh(); return g.moved; }
    if (!g.moved) return false;
    if (JSON.stringify(room()) !== JSON.stringify(g.original)) { history.checkpoint(g.snapshot); callbacks.histUI(); }
    callbacks.refresh();
    return true;
  }

  /** Slides the selected furnishing `across` centimetres along its front and `out` towards its front. */
  function nudge(across: number, out: number) {
    const f = selected();
    if (!f) return false;
    const at = piecePoint(f, across, out);
    if (!sceneCommands.editFurnishing(f.id, r => moveFurnishing(r, f.id, { ...at, angle: f.angle }))) return false;
    callbacks.refresh();
    return true;
  }

  /** The turn handle of the selected furnishing, on its ring at the front left, as a wardrobe's is. */
  function handles(): RoomHandle[] {
    const f = selected();
    if (!f) return [];
    const at = turnButtonAt(Math.hypot(f.width, f.depth) / 2 + 16), p = piecePoint(f, at.x, at.z);
    return [{ key: 'turn:' + f.id, kind: 'turn', id: f.id, x: p.x, y: .8, z: p.z, label: 'Turn the ' + furnishingPiece(f).noun, angle: f.angle }];
  }
  /** Arrow keys on its turn handle turn it 15° (Shift: 1°), as on a wardrobe's. */
  function turnBy(key: string, shift: boolean) {
    const f = selected();
    if (!f || (key !== 'ArrowLeft' && key !== 'ArrowRight')) return false;
    const step = (shift ? 1 : TURN_KEY_STEP) * (key === 'ArrowLeft' ? -1 : 1);
    if (!sceneCommands.turnStudioFurnishing(f.id, f.angle + step, true)) return false;
    callbacks.refresh();
    return true;
  }

  /** Toolbar commands for a selected furnishing. Returns whether it handled the key. */
  function act(key: string) {
    const f = selected();
    if (!f) return false;
    if (key === 'duplicate') {
      const id = sceneCommands.duplicateStudioFurnishing(f.id);
      if (id) callbacks.select({ kind: 'furnishing', id });
    } else if (key === 'remove') {
      if (sceneCommands.removeStudioFurnishing(f.id)) callbacks.select(null);
    } else if (key === 'turn') sceneCommands.turnStudioFurnishing(f.id);
    else return false;
    callbacks.refresh();
    return true;
  }

  /** What a person reads for a selected or dragged furnishing: the free floor on each side to the walls, wardrobes,
   * fixtures and other furniture, amber where it is less than a person needs (the gaps every piece shares). */
  function measures(): RoomMeasure[] {
    const studio = room(), f = selected(studio);
    if (!studio || !f || !furnishingPiece(f).blocks) return [];
    return furnishingPiece(f).gaps(roomOf(studio, model.scene.wardrobes))
      .map(g => ({ a: g.from, b: g.to, text: text(g.distance), ...(g.short ? { tone: 'warn' as const } : {}) }));
  }

  const reason = () => {
    const f = selected();
    if (!drag?.reason || !f) return null;
    const { f: fw } = pieceAxes(f.angle);
    return { text: drag.reason, x: f.x + fw.x * f.depth / 2, y: Math.max(f.height, 40) + 20, z: f.z + fw.z * f.depth / 2 };
  };

  return {
    grab, beginTurn, handles, turnBy, move, end, nudge, act, reason, measures,
    dragging: () => drag !== null,
    // A turn keeps its turn handle on show; a move keeps the piece's.
    dragKey: () => drag?.moved ? (drag.turn ? 'turn:' : 'furnishing:') + drag.id : null,
    guides: () => drag?.guides ?? [],
  };
}
