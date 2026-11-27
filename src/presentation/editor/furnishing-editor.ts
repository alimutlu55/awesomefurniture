import type { Studio, StudioFurnishing } from '../../domain/studio/studio';
import type { Pose } from '../../domain/studio/studio-placement';
import { furnishingDragGoal, type FurnishingTarget } from './furnishing-drag';
import { moveFurnishing } from '../../domain/studio/furnishings/furnishing-edit';
import { furnishingKind } from '../../domain/studio/furnishings/furnishing-kinds';
import { furnishingAxes, furnishingPoint, steadyGap } from '../../domain/studio/furnishings/furnishing-place';
import { fixtureObstacles } from '../../domain/studio/fixtures/fixture-place';
import { gapsAround, type GapSide, type PlacedBox } from '../../domain/studio/scene-gaps';
import type { RoomSelection } from '../viewport/studio-renderer';
import { furthestValid } from './studio-drag';
import type { Guide } from './studio-drag';
import type { RoomMeasure } from './studio-editor.ports';
import { measureNumber, unitSuffix } from './editor-format.js';

type Point = { x: number; y: number; z: number };
type Commands = Readonly<Pick<ReturnType<typeof import('../../application/commands/furnishing-commands').createFurnishingCommands>,
  'editFurnishing' | 'furnishingProblem' | 'turnStudioFurnishing' | 'duplicateStudioFurnishing' | 'removeStudioFurnishing'>>;
interface Drag {
  id: string; pointer: number; target: HTMLElement; snapshot: string; original: Studio; ground: Point; client: { x: number; y: number };
  moved: boolean; lock: FurnishingTarget | null; guides: Guide[]; reason: string | null;
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
const box = (f: StudioFurnishing, id: number): PlacedBox => ({ id, x: f.x, z: f.z, y: 0, angle: f.angle, w: f.width, d: f.depth, h: Math.max(f.height, 1) });

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
    const out = furnishingDragGoal(g.original, f, { x: f.x + p.x - g.ground.x, z: f.z + p.z - g.ground.z, angle: f.angle }, g.lock, e.shiftKey);
    g.lock = out.lock;
    g.guides = out.guides;
    return out.pose;
  }

  function move(e: PointerEvent) {
    const g = drag;
    if (!g || e.pointerId !== g.pointer) return;
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
    const at = furnishingPoint(f, across, out);
    if (!sceneCommands.editFurnishing(f.id, r => moveFurnishing(r, f.id, { ...at, angle: f.angle }))) return false;
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
   * fixtures and other furniture, amber where it is less than a person needs to use it (beside and at the foot of a bed). */
  function measures(): RoomMeasure[] {
    const studio = room(), f = selected(studio), k = f && furnishingKind(f.kind);
    if (!studio || !f || !k || k.flat) return [];
    const others: PlacedBox[] = [
      ...model.scene.wardrobes.map(c => ({ id: c.id, x: c.x, z: c.z, y: c.y || 0, angle: c.angle, w: c.state.w, d: c.state.d, h: c.state.h })),
      ...fixtureObstacles(studio).map((o, i) => ({ id: -1000 - i, x: o.x, z: o.z, y: o.y, angle: o.angle, ...o.state })),
      ...(studio.furnishings ?? []).filter(o => o.id !== f.id && !furnishingKind(o.kind)?.flat).map((o, i) => box(o, -2000 - i)),
    ];
    // The same four sides whether it is held or not, so no reading comes and goes when a drag starts.
    const sides: GapSide[] = ['left', 'right', 'front', 'back'];
    return gapsAround(box(f, -1), others, studio, sides).filter(g => g.distance > .5 && g.distance < 400).flatMap(g => {
      const need = g.side === 'front' ? k.use.front : g.side === 'left' || g.side === 'right' ? k.use.sides : 0, line = steadyGap(f, g);
      return line ? [{ a: line.from, b: line.to, text: text(g.distance), ...(need && g.distance < need ? { tone: 'warn' as const } : {}) }] : [];
    });
  }

  const reason = () => {
    const f = selected();
    if (!drag?.reason || !f) return null;
    const { f: fw } = furnishingAxes(f.angle);
    return { text: drag.reason, x: f.x + fw.x * f.depth / 2, y: Math.max(f.height, 40) + 20, z: f.z + fw.z * f.depth / 2 };
  };

  return {
    grab, move, end, nudge, act, reason, measures,
    dragging: () => drag !== null,
    dragKey: () => drag?.moved ? 'furnishing:' + drag.id : null,
    guides: () => drag?.guides ?? [],
  };
}
