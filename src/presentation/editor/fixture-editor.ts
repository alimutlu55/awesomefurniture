import type { Studio, StudioFixture } from '../../domain/studio/studio';
import { wallFace, wallLine } from '../../domain/studio/studio';
import { slideFixture } from '../../domain/studio/fixtures/fixture-setup';
import { resolveAlignment } from '../../domain/geometry/alignment';
import type { RoomSelection } from '../viewport/studio-renderer';
import { furthestValid } from './studio-drag';
import type { Guide } from './studio-drag';
import { fixtureGuide, fixtureMeasures, fixtureTargets } from './fixture-drag';
import type { FixtureTarget } from './fixture-drag';
import type { RoomMeasure } from './studio-editor.ports';

type Point = { x: number; y: number; z: number };
type Commands = Readonly<Pick<ReturnType<typeof import('../../application/commands/fixture-commands').createFixtureCommands>,
  'addStudioFixture' | 'editFixture' | 'fixtureProblem' | 'duplicateStudioFixture' | 'removeStudioFixture'>>;
interface Drag {
  id: string; pointer: number; target: HTMLElement; snapshot: string; original: Studio; at: Point; client: { x: number; y: number };
  moved: boolean; lock: FixtureTarget | null; guides: Guide[]; reason: string | null;
}

export interface FixtureEditorPorts {
  readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene' | 'snapshot' | 'restore'>;
  readonly sceneCommands: Commands;
  readonly history: { checkpoint(snapshot: string): void };
  readonly picking: { screenPoint(p: Point): { x: number; y: number } };
  readonly selection: () => RoomSelection;
  readonly callbacks: {
    select(next: RoomSelection): void;
    /** The fixture moved during a drag: redraw the room and its measures, nothing else. */
    redraw(): void;
    refresh(): void;
    histUI(): void;
  };
}

/** Moving fixtures: a selected toilet or basin is dragged along its wall by its own body, lining up with the wall's
 * middle, a window, its boxing and its neighbours (Shift moves freely); a boxing of its own goes with it. It goes as far as the room allows, says why it
 * stopped, and takes one undo step. Arrow keys slide it 1 cm (10 with Shift). */
export function createFixtureEditor({ model, sceneCommands, history, picking, selection, callbacks }: FixtureEditorPorts) {
  let drag: Drag | null = null, pxPerCm = 2;
  const room = () => model.scene.studio;
  const selected = (studio = room()): StudioFixture | undefined => {
    const s = selection();
    return s?.kind === 'fixture' ? studio?.fixtures?.find(f => f.id === s.id) : undefined;
  };
  const tolerance = () => Math.max(.5, Math.min(25, 8 / pxPerCm));

  /** Pointer travel along the fixture's wall, in centimetres, measured on screen. */
  function along(e: PointerEvent, g: Drag, ux: number, uz: number) {
    const a = picking.screenPoint(g.at), b = picking.screenPoint({ x: g.at.x + ux * 50, y: g.at.y, z: g.at.z + uz * 50 });
    const sx = (b.x - a.x) / 50, sy = (b.y - a.y) / 50, len2 = sx * sx + sy * sy;
    pxPerCm = Math.sqrt(len2) || pxPerCm;
    return len2 < 1e-4 ? 0 : ((e.clientX - g.client.x) * sx + (e.clientY - g.client.y) * sy) / len2;
  }

  /** Grabs a fixture by its body: selects it if another part was selected, and starts a drag that moves once the pointer does. */
  function grab(e: PointerEvent, hit: { point: Point; object: { userData: Record<string, unknown> } }, target: HTMLElement) {
    const studio = room(), id = hit.object.userData.studioFixture;
    if (!studio || typeof id !== 'string' || e.button > 0 || !studio.fixtures?.some(f => f.id === id)) return false;
    if (selection()?.kind !== 'fixture' || selection()!.id !== id) callbacks.select({ kind: 'fixture', id });
    e.preventDefault();
    e.stopPropagation();
    drag = { id, pointer: e.pointerId, target, snapshot: model.snapshot(), original: studio, at: { ...hit.point }, client: { x: e.clientX, y: e.clientY },
      moved: false, lock: null, guides: [], reason: null };
    try { target.setPointerCapture(e.pointerId); } catch { /* the canvas keeps the gesture */ }
    return true;
  }
  function move(e: PointerEvent) {
    const g = drag;
    if (!g || e.pointerId !== g.pointer) return;
    if (!g.moved && Math.hypot(e.clientX - g.client.x, e.clientY - g.client.y) < 4) return;
    g.moved = true;
    const f = g.original.fixtures!.find(x => x.id === g.id)!, w = g.original.walls.find(x => x.id === f.wall), line = w && wallLine(g.original, w), face = w && wallFace(g.original, w);
    if (!line || !face) return;
    const raw = f.offset + along(e, g, line.ux, line.uz);
    const hit = e.shiftKey ? null : resolveAlignment(raw, fixtureTargets(g.original, f), { tolerance: tolerance(), lock: g.lock, within: [face.start + f.width / 2, face.end - f.width / 2] });
    g.lock = hit;
    g.guides = hit ? fixtureGuide(g.original, f, hit) : [];
    const goal = hit ? hit.v : raw, from = model.scene.studio?.fixtures?.find(x => x.id === g.id)?.offset ?? f.offset;
    const want = (t: number) => slideFixture(g.original, g.id, from + (goal - from) * t);
    const problem = (s: Studio) => sceneCommands.fixtureProblem(s, g.id);
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

  /** Slides the selected fixture `by` centimetres along its wall (positive towards corner b). */
  function nudge(by: number) {
    const f = selected();
    if (!f || !sceneCommands.editFixture(f.id, r => slideFixture(r, f.id, f.offset + by))) return false;
    callbacks.refresh();
    return true;
  }

  /** Toolbar commands for a selected fixture. Returns whether it handled the key. */
  function act(key: string) {
    const f = selected();
    if (!f) return false;
    if (key === 'duplicate') {
      const id = sceneCommands.duplicateStudioFixture(f.id);
      if (id) callbacks.select({ kind: 'fixture', id });
    } else if (key === 'remove') {
      if (sceneCommands.removeStudioFixture(f.id)) callbacks.select(null);
    } else return false;
    callbacks.refresh();
    return true;
  }

  const reason = () => {
    if (!drag?.reason) return null;
    const f = room()?.fixtures?.find(x => x.id === drag!.id), w = f && room()!.walls.find(x => x.id === f.wall), line = w && wallLine(room()!, w);
    return f && line && w ? { text: drag.reason, x: line.a.x + line.ux * f.offset + line.nx * (w.thickness / 2 + f.depth), y: 110, z: line.a.z + line.uz * f.offset + line.nz * (w.thickness / 2 + f.depth) } : null;
  };

  return {
    grab, move, end, nudge, act, reason,
    dragging: () => drag !== null,
    dragKey: () => drag?.moved ? 'fixture:' + drag.id : null,
    guides: () => drag?.guides ?? [],
    measures: (): RoomMeasure[] => { const f = selected(); return f && room() ? fixtureMeasures(room()!, f.id, !!drag?.moved) : []; },
  };
}
