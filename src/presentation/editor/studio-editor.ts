import { STUDIO_LIMITS, cornerDegree, wallFace, wallLine } from '../../domain/studio/studio';
import type { Studio, StudioWall } from '../../domain/studio/studio';
import { extendFromCorner, mergeCorners, moveCorner, moveOpening, moveWall, moveWallAxis, removeOpening, removeWall, splitWall } from '../../domain/studio/studio-edit';
import type { RoomSelection } from '../viewport/studio-renderer';
import type { StudioEditorPorts, RoomHandle, RoomMeasure } from './studio-editor.ports';
import { alignTo, type Align } from './align-snap';
import { centredOffset, furthestValid, snapCorner, wallTargets, type CornerLocks, type Guide } from './studio-drag';
import { measureNumber } from './editor-format.js';

type P = { x: number; z: number };
interface Drag {
  handle: RoomHandle; pointer: number; target: HTMLElement; snapshot: string; original: Studio; last: Studio;
  client: { x: number; y: number }; ground: P | null; moved: boolean; created: string | null;
  locks: CornerLocks; lock: Align | null; guides: Guide[]; reason: string | null; free: boolean;
  /** Where the dragged corner is meant to be (snapped), for its handle. */
  at: P | null;
}

const f = (v: number) => measureNumber(Math.round(v * 10) / 10) + ' cm';
/** Rulers stand this far into the room from the face they measure. */
const RULER = 4;

/** Editing the room on the model: select a wall or an opening, drag its corners, the wall itself or the
 * opening along it, and add walls from free ends with "+". It follows the shape editor: session handles,
 * smooth drags that stop where the room stops them and say why, alignment guides, live rulers, and one
 * undo step per drag. Every change goes through the scene's studio commands. */
export function createStudioEditor({ model, sceneCommands, history, picking, selectionState, callbacks }: StudioEditorPorts) {
  let drag: Drag | null = null, pxPerCm = 2;
  const room = () => model.scene.studio;
  const selection = (): RoomSelection => selectionState.room ?? null;
  const tolerance = () => Math.max(.5, Math.min(25, 8 / pxPerCm));
  const wallOf = (studio: Studio, id: string) => studio.walls.find(w => w.id === id);
  const selectedWall = (studio = room()) => {
    const s = selection();
    if (!studio || !s) return undefined;
    return wallOf(studio, s.kind === 'wall' ? s.id : studio.openings.find(o => o.id === s.id)?.wall ?? '');
  };

  /** Selects a wall or an opening (null clears). A selection that no longer exists clears itself. */
  function select(next: RoomSelection) {
    if (JSON.stringify(next) === JSON.stringify(selection())) return;
    selectionState.room = next;
    callbacks.selectionChanged();
  }
  function valid() {
    // A wardrobe in focus takes the selection over from the room.
    if (selectionState.focusOn) selectionState.room = null;
    const s = selection(), studio = room();
    if (s && (!studio || !(s.kind === 'wall' ? wallOf(studio, s.id) : studio.openings.some(o => o.id === s.id)))) selectionState.room = null;
    return selection();
  }
  /** A click on the model: the wall or opening under it, if it is nearer than any wardrobe. */
  function pick(hit: { object: { userData: Record<string, unknown> } } | undefined) {
    const u = hit?.object.userData;
    if (u?.studioOpening) select({ kind: 'opening', id: String(u.studioOpening) });
    else if (u?.studioWall) select({ kind: 'wall', id: String(u.studioWall) });
    else return false;
    return true;
  }

  /** Handles for the selection: its wall's corners, a grip to move the wall, "+" on free ends, and a grip
 * for each opening on it. Positions are on the floor, except openings, which sit at their middle. */
  function handles(): RoomHandle[] {
    const studio = room(), w = selectedWall(studio), line = studio && w && wallLine(studio, w);
    if (!studio || !w || !line) return [];
    const face = wallFace(studio, w)!, out: RoomHandle[] = [], s = selection()!;
    if (s.kind === 'wall') {
      for (const c of [line.a, line.b]) out.push({ key: 'corner:' + c.id, kind: 'corner', id: c.id, x: c.x, y: w.y ?? 0, z: c.z, label: 'Corner. Drag to move it; the walls that meet there follow' });
      const mid = (face.start + face.end) / 2, at = { x: line.a.x + line.ux * mid + line.nx * w.thickness / 2, z: line.a.z + line.uz * mid + line.nz * w.thickness / 2 };
      // On the wall's top edge: wardrobes stand against its foot.
      out.push({ key: 'wall:' + w.id, kind: 'wall', id: w.id, ...at, y: (w.y ?? 0) + w.height, label: 'Move this wall in or out', nx: line.nx, nz: line.nz });
      for (const axis of ['x', 'y', 'z'] as const) {
        out.push({ key: 'wall:' + w.id + ':' + axis, kind: 'wall', id: w.id, axis,
          x: at.x + (axis === 'x' ? 65 : 0), y: (w.y ?? 0) + w.height + (axis === 'y' ? 65 : 0), z: at.z + (axis === 'z' ? 65 : 0),
          label: 'Move wall along ' + axis.toUpperCase() + '. Drag or use arrow keys', nx: axis === 'x' ? 1 : 0, nz: axis === 'z' ? 1 : 0 });
      }
      for (const c of [line.a, line.b]) {
        if (cornerDegree(studio, c.id) !== 1) continue;
        const sign = c.id === w.b ? 1 : -1;
        out.push({ key: 'extend:' + c.id, kind: 'extend', id: c.id, x: c.x + line.ux * sign * 60, y: 0, z: c.z + line.uz * sign * 60, label: 'Add a wall here. Drag to draw it, or click for a corner' });
      }
    }
    for (const o of studio.openings.filter(o => o.wall === w.id && (s.kind === 'wall' || o.id === s.id))) {
      const off = w.thickness / 2 + 3;
      const x = line.a.x + line.ux * o.offset + line.nx * off, z = line.a.z + line.uz * o.offset + line.nz * off;
      out.push({ key: 'opening:' + o.id, kind: 'opening', id: o.id, x, y: (w.y ?? 0) + o.sill + o.height / 2, z, label: 'Slide this ' + o.kind + ' along the wall', ux: line.ux, uz: line.uz });
    }
    // The handle being dragged stays under the pointer even when its part is renamed (a joined corner)
    // or new (a wall drawn from "+"), so the drag keeps its pointer.
    if (drag?.moved && drag.at && !out.some(x => x.key === drag!.handle.key)) out.push({ ...drag.handle, x: drag.at.x, y: 0, z: drag.at.z });
    else if (drag?.moved && drag.at) Object.assign(out.find(x => x.key === drag!.handle.key)!, drag.handle.kind === 'extend' ? { x: drag.at.x, z: drag.at.z } : {});
    return out;
  }

  /** Inside length of a wall as a ruler along the top of its room face, clear of the wardrobes. */
  function wallRuler(studio: Studio, w: StudioWall): RoomMeasure | null {
    const line = wallLine(studio, w), face = wallFace(studio, w);
    if (!line || !face || face.length < 1) return null;
    const o = { x: line.nx * RULER, z: line.nz * RULER }, y = (w.y ?? 0) + w.height + 12;
    return { a: { x: face.from.x + o.x, y, z: face.from.z + o.z }, b: { x: face.to.x + o.x, y, z: face.to.z + o.z }, text: f(face.length) };
  }
  /** Rulers for what is selected or dragged: the wall's inside length, and while a wall or corner moves,
   * every wall it stretches. An opening shows its distance from each end of the wall and its width. */
  function measures(): RoomMeasure[] {
    const studio = drag?.last ?? room(), s = selection();
    if (!studio || !s) return [];
    const w = selectedWall(studio);
    if (!w) return [];
    if (s.kind === 'opening' || drag?.handle.kind === 'opening') {
      const o = studio.openings.find(x => x.id === (drag?.handle.kind === 'opening' ? drag.handle.id : s.id)), line = wallLine(studio, w), face = wallFace(studio, w);
      if (!o || !line || !face) return [];
      const y = (w.y ?? 0) + o.sill + o.height + 14, z = w.thickness / 2 + 4, at = (t: number) => ({ x: line.a.x + line.ux * t + line.nx * z, y, z: line.a.z + line.uz * t + line.nz * z });
      const l = o.offset - o.width / 2, r = o.offset + o.width / 2;
      return [[face.start, l], [l, r], [r, face.end]].filter(([p, q]) => q! - p! > .5).map(([p, q]) => ({ a: at(p!), b: at(q!), text: f(q! - p!) }));
    }
    const moving = drag && (drag.handle.kind === 'wall' || drag.handle.kind === 'corner' || drag.created) ? drag : null;
    const ids = new Set([w.id]);
    if (moving) {
      const corners = moving.handle.kind === 'wall' ? [w.a, w.b] : [moving.created ?? moving.handle.id];
      for (const x of studio.walls) if (corners.includes(x.a) || corners.includes(x.b)) ids.add(x.id);
    }
    return studio.walls.filter(x => ids.has(x.id)).map(x => wallRuler(studio, x)).filter((m): m is RoomMeasure => !!m);
  }
  const guides = () => drag?.guides ?? [];
  const reason = () => {
    if (!drag?.reason) return null;
    const h = handles().find(x => x.key === drag!.handle.key) ?? drag.handle;
    return { text: drag.reason, x: h.x, y: h.y + 10, z: h.z };
  };

  // Dragging. A drag previews quietly and takes one undo step when it ends.
  function begin(e: PointerEvent, handle: RoomHandle, target: HTMLElement) {
    const studio = room();
    if (!studio || e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    const ground = picking.groundPoint(e);
    drag = { handle, pointer: e.pointerId, target, snapshot: model.snapshot(), original: studio, last: studio, client: { x: e.clientX, y: e.clientY }, ground: ground && { x: ground.x, z: ground.z },
      moved: false, created: null, locks: { x: null, z: null, ray: null, join: null }, lock: null, guides: [], reason: null, free: false, at: null };
    try { target.setPointerCapture(e.pointerId); } catch { /* the drag still works from the handle's own events */ }
  }
  /** Centimetres the pointer moved along a scene direction from the grab, measured on screen so it feels
   * the same at any camera angle. */
  function along(e: PointerEvent, h: RoomHandle, dx: number, dz: number, dy = 0) {
    const a = picking.screenPoint({ x: h.x, y: h.y, z: h.z }), b = picking.screenPoint({ x: h.x + dx * 50, y: h.y + dy * 50, z: h.z + dz * 50 });
    const sx = (b.x - a.x) / 50, sy = (b.y - a.y) / 50, len2 = sx * sx + sy * sy;
    pxPerCm = Math.sqrt(len2) || pxPerCm;
    return len2 < 1e-4 ? 0 : ((e.clientX - drag!.client.x) * sx + (e.clientY - drag!.client.y) * sy) / len2;
  }
  /** Where the pointer is on the floor, moved by how far it travelled since the grab. */
  function floorPoint(e: PointerEvent, from: P): P | null {
    const g = picking.groundPoint(e), start = drag!.ground;
    if (!g || !start) return null;
    const a = picking.screenPoint({ x: from.x, y: 0, z: from.z }), b = picking.screenPoint({ x: from.x + 10, y: 0, z: from.z });
    pxPerCm = Math.hypot(b.x - a.x, b.y - a.y) / 10 || pxPerCm;
    return { x: from.x + g.x - start.x, z: from.z + g.z - start.z };
  }
  const step = (v: number) => drag?.free ? Math.round(v * 10) / 10 : Math.round(v);

  function move(e: PointerEvent) {
    const g = drag;
    if (!g || e.pointerId !== g.pointer) return;
    if (!g.moved && Math.hypot(e.clientX - g.client.x, e.clientY - g.client.y) < 4) return;
    g.free = e.shiftKey;
    if (!g.moved && g.handle.kind === 'extend') startExtend(e);
    g.moved = true;
    const problem = (s: Studio) => sceneCommands.studioProblem(s);
    let want: ((t: number) => Studio | null) | null = null;
    const h = g.handle;
    if (h.kind === 'corner' || g.created) {
      const id = g.created ?? h.id, c = g.original.corners.find(x => x.id === id)!, raw = floorPoint(e, c);
      if (!raw) return;
      const snapped = g.free ? { at: { x: raw.x, z: raw.z }, locks: { x: null, z: null, ray: null, join: null }, guides: [] } : snapCorner(g.original, id, { x: step(raw.x), z: step(raw.z) }, g.locks, tolerance());
      g.locks = snapped.locks;
      g.guides = snapped.guides;
      g.at = snapped.at;
      const from = g.last.corners.find(x => x.id === id) ?? c, to = snapped.at, join = snapped.locks.join;
      want = t => {
        const moved = moveCorner(g.original, id, from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t);
        return moved && join && t === 1 ? mergeCorners(moved, id, join) : moved;
      };
    } else if (h.kind === 'wall' && h.axis) {
      const axis = h.axis, w = wallOf(g.original, h.id)!, original = wallLine(g.original, w)!, last = wallOf(g.last, h.id)!, line = wallLine(g.last, last)!;
      const raw = step(along(e, h, axis === 'x' ? 1 : 0, axis === 'z' ? 1 : 0, axis === 'y' ? 1 : 0));
      const before = axis === 'y' ? (last.y ?? 0) - (w.y ?? 0) : line.a[axis] - original.a[axis];
      g.guides = [];
      want = t => moveWallAxis(g.original, h.id, axis, before + (raw - before) * t);
    } else if (h.kind === 'wall') {
      const w = wallOf(g.original, h.id)!, raw = step(along(e, h, h.nx!, h.nz!));
      const lock = g.free ? null : alignTo(raw, wallTargets(g.original, w), g.lock, tolerance());
      g.lock = lock;
      const d = lock ? lock.v : raw, before = lastDistance(g, w);
      g.guides = lock ? alignedGuide(g.original, w, d) : [];
      want = t => moveWall(g.original, h.id, before + (d - before) * t);
    } else if (h.kind === 'opening') {
      const o = g.original.openings.find(x => x.id === h.id)!, w = wallOf(g.original, o.wall)!, centre = centredOffset(g.original, w);
      const raw = step(o.offset + along(e, h, h.ux!, h.uz!));
      const lock = g.free || centre === null ? null : alignTo(raw, [{ v: centre, label: 'Centred on the wall' }], g.lock, tolerance());
      g.lock = lock;
      const target = lock ? lock.v : raw, from = g.last.openings.find(x => x.id === h.id)!.offset;
      g.guides = lock ? centreGuide(g.original, w) : [];
      want = t => moveOpening(g.original, h.id, from + (target - from) * t);
    }
    if (!want) return;
    const whole = want(1), wanted = whole && problem(whole);
    // Go as far as the room allows; say why it stopped.
    const result = furthestValid(t => want!(t), s => !problem(s));
    g.reason = wanted || null;
    if (result.room && JSON.stringify(result.room) !== JSON.stringify(g.last)) {
      g.last = result.room;
      model.scene.studio = result.room;
    }
    callbacks.redraw();
  }
  /** How far the dragged wall has moved so far: the last valid preview, along its room side. */
  function lastDistance(g: Drag, w: StudioWall) {
    const a0 = wallLine(g.original, w)!, now = wallOf(g.last, w.id), a1 = now && wallLine(g.last, now);
    return a1 ? (a1.a.x - a0.a.x) * a0.nx + (a1.a.z - a0.a.z) * a0.nz : 0;
  }
  function alignedGuide(studio: Studio, w: StudioWall, d: number): Guide[] {
    const line = wallLine(studio, w)!, c = studio.corners.find(x => x.id !== w.a && x.id !== w.b && Math.abs((x.x - line.a.x) * line.nx + (x.z - line.a.z) * line.nz - d) < 1e-6);
    if (!c) return [];
    const ends = [line.a, line.b].map(p => ({ x: p.x + line.nx * d, z: p.z + line.nz * d }));
    const nearest = ends.sort((p, q) => Math.hypot(p.x - c.x, p.z - c.z) - Math.hypot(q.x - c.x, q.z - c.z))[0]!;
    return [{ a: c, b: nearest, label: 'Aligned with corner' }];
  }
  function centreGuide(studio: Studio, w: StudioWall): Guide[] {
    const line = wallLine(studio, w)!, mid = centredOffset(studio, w)!, at = { x: line.a.x + line.ux * mid, z: line.a.z + line.uz * mid };
    return [{ a: { x: at.x + line.nx * w.thickness / 2, z: at.z + line.nz * w.thickness / 2 }, b: { x: at.x + line.nx * 70, z: at.z + line.nz * 70 }, label: 'Centred on the wall' }];
  }
  /** Dragging "+" draws a new wall from that free end; its far corner follows the pointer. */
  function startExtend(e: PointerEvent) {
    const g = drag!, p = picking.groundPoint(e), extended = p && extendFromCorner(g.original, g.handle.id, p.x, p.z);
    if (!p || !extended) return;
    g.original = extended;
    g.created = extended.corners.at(-1)!.id;
    g.ground = { x: p.x, z: p.z };
  }
  function end(cancel = false) {
    const g = drag;
    if (!g) return;
    drag = null;
    try { if (g.target.hasPointerCapture(g.pointer)) g.target.releasePointerCapture(g.pointer); } catch { /* released already */ }
    if (cancel) { model.restore(g.snapshot); callbacks.refresh(); return; }
    if (!g.moved) { click(g.handle); return; }
    if (JSON.stringify(g.last) !== JSON.stringify(JSON.parse(g.snapshot).studio ?? null)) {
      history.checkpoint(g.snapshot);
      callbacks.histUI();
    }
    // A wall drawn from "+" is selected: it is still there after its end joined another.
    if (g.created) selectionState.room = { kind: 'wall', id: g.original.walls.at(-1)!.id };
    if (g.locks.join) callbacks.report('Walls joined.');
    callbacks.refresh();
  }
  function click(h: RoomHandle) {
    if (h.kind === 'opening') select({ kind: 'opening', id: h.id });
    else if (h.kind === 'extend') {
      const id = sceneCommands.addStudioWall(selectedWall()?.id);
      if (id) selectionState.room = { kind: 'wall', id };
      callbacks.refresh();
    } else callbacks.redraw();
  }
  /** Arrow keys on a focused handle: 1 cm, Shift 10 cm. */
  function nudge(h: RoomHandle, key: string, shift: boolean) {
    const n = shift ? 10 : 1, dir = key === 'ArrowRight' || key === 'ArrowUp' ? 1 : -1;
    const across = key.endsWith('Left') || key.endsWith('Right') ? dir * n : 0, deep = key.endsWith('Up') || key.endsWith('Down') ? dir * n : 0;
    const ok = h.kind === 'corner' ? edit(s => { const c = s.corners.find(x => x.id === h.id)!; return moveCorner(s, h.id, c.x + across, c.z - deep); })
      : h.kind === 'wall' ? edit(s => h.axis ? moveWallAxis(s, h.id, h.axis, dir * n) : moveWall(s, h.id, dir * n))
        : h.kind === 'opening' ? edit(s => moveOpening(s, h.id, s.openings.find(x => x.id === h.id)!.offset + dir * n)) : false;
    return ok;
  }
  function edit(change: (s: Studio) => Studio | null) {
    const ok = sceneCommands.editStudio(change);
    callbacks.refresh();
    return ok;
  }

  /** Toolbar commands for the selection. */
  function act(key: string) {
    const s = selection(), w = selectedWall();
    if (key === 'add-wall') {
      const id = sceneCommands.addStudioWall(w?.id);
      if (id) selectionState.room = { kind: 'wall', id };
      callbacks.refresh();
    } else if (key === 'door' || key === 'window' || key === 'archway') {
      const id = sceneCommands.addStudioOpening(key, w?.id);
      if (id) selectionState.room = { kind: 'opening', id };
      callbacks.refresh();
    } else if (key === 'split' && w) {
      if (!sceneCommands.editStudio(r => splitWall(r, w.id)) ) callbacks.report('This wall is too short to split. Each part needs ' + STUDIO_LIMITS.minWallLength + ' cm.');
      callbacks.refresh();
    } else if (key === 'remove' && s) {
      if (s.kind === 'opening' ? sceneCommands.editStudio(r => removeOpening(r, s.id)) : sceneCommands.editStudio(r => removeWall(r, s.id))) selectionState.room = null;
      callbacks.refresh();
    }
  }

  return {
    select, valid, pick, handles, measures, guides, reason, act, nudge,
    begin, move, end,
    dragging: () => drag !== null,
    selection,
  };
}
