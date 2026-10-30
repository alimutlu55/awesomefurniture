import { STUDIO_LIMITS, cornerDegree, roomHeight, wallFace, wallLine } from '../../domain/studio/studio';
import type { OpeningKind, Studio, StudioWall } from '../../domain/studio/studio';
import { extendFromCorner, mergeCorners, moveCorner, moveOpening2D, moveWall, removeOpening, removeWall, splitWall } from '../../domain/studio/studio-edit';
import { OPENING_KINDS } from '../../domain/studio/wall-utilities';
import { addCeiling, ceilingFrame, flipCeiling, reachAt, removeCeiling, setCeilingDepth } from '../../domain/studio/studio-ceiling';
import { ceilingHandles, depthRuler, outerEdgeMeasures, restHeights, runAxis } from './studio-ceiling-drag';
import type { RoomSelection } from '../viewport/studio-renderer';
import type { StudioEditorPorts, RoomHandle, RoomMeasure } from './studio-editor.ports';
import { AUTO_ALIGN_CM, alignTo, resolveAlignment, type Align, type AlignTarget } from '../../domain/geometry/alignment';
import { sideGuide, sideTargets, depthGuide, depthTargets, heightGuide, heightTargets, liftTargets, openingGuide, openingTargets } from './studio-align';
import { centredOffset, cornerAngle, furthestValid, openingMeasures, snapCorner, wallGap, wallTargets, type CornerLocks, type Guide, type WallTarget } from './studio-drag';
import { measureNumber, unitSuffix } from './editor-format.js';
import { surfaceProfile, withSurfaceProfile } from '../../domain/studio/surface-profile';
import { translateProfile } from '../../domain/geometry/profile-polygon';
import { outerEdgeHeight, liftWholeCeiling, setOuterEdgeHeight } from '../../domain/studio/ceiling-edge';
import type { Carried } from '../../application/commands/studio-commands';

type P = { x: number; z: number };
interface Drag {
  handle: RoomHandle; pointer: number; target: HTMLElement; snapshot: string; original: Studio; last: Studio;
  client: { x: number; y: number }; ground: P | null; moved: boolean; created: string | null;
  locks: CornerLocks; lock: Align | null; lockUp: Align | null; guides: Guide[]; reason: string | null; free: boolean;
  /** Wardrobes standing against a dragged wall: they go with it. */
  carry: Carried | null;
  /** Where the dragged corner is meant to be (snapped), for its handle. */
  at: P | null;
}

const f = (v: number) => measureNumber(Math.round(v * 10) / 10) + unitSuffix();
/** Rulers stand this far into the room from the face they measure. */
const RULER = 4;

/** Room edits reshape wardrobes live and commit as one undo step. A wall or ceiling shape's outline is drawn
 * in the Shape editor (surface-shape-editor.ts); on the model a shape keeps only its depth grip and edge lift. */
export function createStudioEditor({ model, sceneCommands, history, picking, selectionState, callbacks }: StudioEditorPorts) {
  let drag: Drag | null = null;
  const room = () => model.scene.studio;
  const selection = (): RoomSelection => selectionState.room ?? null;
  const standing = () => model.scene.wardrobes.map(f => ({ x: f.x, z: f.z, angle: f.angle, w: f.state.w, d: f.state.d, h: f.state.h }));
  const tolerance = () => AUTO_ALIGN_CM;
  const wallOf = (studio: Studio, id: string) => studio.walls.find(w => w.id === id);
  const selectedWall = (studio = room()) => {
    const s = selection();
    if (!studio || !s) return undefined;
    return wallOf(studio, s.kind === 'wall' ? s.id : s.kind === 'ceiling' ? ceilingOf(studio, s.id)?.wall ?? ''
      : s.kind === 'fixture' ? studio.fixtures?.find(f => f.id === s.id)?.wall ?? '' : studio.openings.find(o => o.id === s.id)?.wall ?? '');
  };
  const ceilingOf = (studio: Studio, id: string) => studio.ceilings?.find(c => c.id === id);
  const exists = (studio: Studio, s: NonNullable<RoomSelection>) =>
    s.kind === 'wall' ? !!wallOf(studio, s.id) : s.kind === 'ceiling' ? !!ceilingOf(studio, s.id)
      : s.kind === 'fixture' ? !!studio.fixtures?.some(f => f.id === s.id) : studio.openings.some(o => o.id === s.id);

  /** Selects a wall or an opening (null clears). A selection that no longer exists clears itself. */
  function select(next: RoomSelection) {
    if (JSON.stringify(next) === JSON.stringify(selection())) return;
    selectionState.room = next;
    callbacks.selectionChanged();
  }
  function valid() {
    if (selectionState.focusOn) selectionState.room = null;
    const s = selection(), studio = room();
    if (s && (!studio || !exists(studio, s))) selectionState.room = null;
    return selection();
  }
  function pick(hit: { object: { userData: Record<string, unknown> } } | undefined) {
    const u = hit?.object.userData;
    if (u?.studioFixture) select({ kind: 'fixture', id: String(u.studioFixture) });
    else if (u?.studioOpening) select({ kind: 'opening', id: String(u.studioOpening) });
    else if (u?.studioCeiling) select({ kind: 'ceiling', id: String(u.studioCeiling) });
    else if (u?.studioWall) select({ kind: 'wall', id: String(u.studioWall) });
    else return false;
    return true;
  }

  /** Handles for the selected wall or ceiling. Surfaces themselves are also draggable. */
  function handles(): RoomHandle[] {
    const studio = room(), s = selection(), w = selectedWall(studio), line = studio && w && wallLine(studio, w);
    if (!studio || !s || !w || !line) return [];
    const out: RoomHandle[] = [];
    if (s.kind === 'wall') {
      for (const c of [line.a, line.b]) out.push({ key: 'corner:' + c.id, kind: 'corner', id: c.id, x: c.x, y: 0, z: c.z, label: 'Corner. Drag to move it; the walls that meet there follow' });
      for (const c of [line.a, line.b]) {
        if (cornerDegree(studio, c.id) !== 1) continue;
        const sign = c.id === w.b ? 1 : -1;
        out.push({ key: 'extend:' + c.id, kind: 'extend', id: c.id, x: c.x + line.ux * sign * 60, y: 0, z: c.z + line.uz * sign * 60, label: 'Add a wall here. Drag to draw it, or click for a corner' });
      }
    } else if (s.kind === 'ceiling') {
      const c = ceilingOf(studio, s.id);
      // Its outline is drawn in the Shape editor; on the model it keeps how far it reaches and its edge lift.
      const grounded = !!c && Math.min(...c.profile.map(p => p.y)) < STUDIO_LIMITS.minCeilingHeight;
      if (c) out.push(...ceilingHandles(studio, c).filter(h => h.kind === 'depth' || (h.kind === 'tilt' && !grounded)));
    }
    const kept = drag?.moved && drag.at && ['corner', 'extend'].includes(drag.handle.kind);
    if (kept && !out.some(x => x.key === drag!.handle.key)) out.push({ ...drag!.handle, x: drag!.at!.x, y: 0, z: drag!.at!.z });
    else if (kept && drag!.handle.kind === 'extend') Object.assign(out.find(x => x.key === drag!.handle.key)!, { x: drag!.at!.x, z: drag!.at!.z });
    return out;
  }

  function wallRuler(studio: Studio, w: StudioWall): RoomMeasure | null {
    const line = wallLine(studio, w), face = wallFace(studio, w);
    if (!line || !face || face.length < 1) return null;
    const o = { x: line.nx * RULER, z: line.nz * RULER }, y = w.height + 12;
    return { a: { x: face.from.x + o.x, y, z: face.from.z + o.z }, b: { x: face.to.x + o.x, y, z: face.to.z + o.z }, text: f(face.length) };
  }
  /** Rulers for the selection and adjoining surfaces affected by a drag. */
  function measures(): RoomMeasure[] {
    const studio = drag?.last ?? room(), s = selection();
    if (!studio || !s) return [];
    const w = selectedWall(studio);
    if (!w) return [];
    if (s.kind === 'ceiling') {
      const c = ceilingOf(studio, s.id), h = drag?.moved ? drag.handle : null;
      if (!c) return [];
      const list = h?.kind === 'tilt' ? outerEdgeMeasures(studio, c, handles().find(x => x.key === h.key) ?? h) : h?.kind === 'depth' ? [depthRuler(studio, c, handles().find(x => x.key === h.key) ?? h)] : h ? [] : restHeights(studio, c);
      return list.filter((m): m is RoomMeasure => !!m);
    }
    if (s.kind === 'opening' || drag?.handle.kind === 'opening') {
      return openingMeasures(studio, w, drag?.handle.kind === 'opening' ? drag.handle.id : s.id, !!drag);
    }
    const moving = drag && (drag.handle.kind === 'wall' || drag.handle.kind === 'corner' || drag.created) ? drag : null;
    const ids = new Set([w.id]);
    if (moving) {
      const corners = moving.handle.kind === 'wall' ? [w.a, w.b] : [moving.created ?? moving.handle.id];
      for (const x of studio.walls) if (corners.includes(x.a) || corners.includes(x.b)) ids.add(x.id);
    }
    const gap = moving?.handle.kind === 'wall' ? wallGap(studio, w, model.scene.wardrobes, moving.carry) : null;
    const ruler = (x: StudioWall) => { const m = wallRuler(studio, x); return m && x.id === w.id && !moving && s.kind === 'wall' ? { ...m, edit: 'length' } : m; };
    return [...studio.walls.filter(x => ids.has(x.id)).map(ruler), gap].filter((m): m is RoomMeasure => !!m);
  }
  const guides = () => {
    const id = drag?.moved ? (drag.created ?? (drag.handle.kind === 'corner' ? drag.handle.id : null)) : null, angle = id && drag ? cornerAngle(drag.last, drag.locks.join ?? id) : null;
    return [...drag?.guides ?? [], ...(angle ? [angle] : [])];
  };
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
      moved: false, created: null, locks: { x: null, z: null, ray: null, join: null }, lock: null, lockUp: null, guides: [], reason: null, free: false, at: null,
      carry: handle.kind === 'wall' ? sceneCommands.standingAgainst(handle.id) : null };
    try { target.setPointerCapture(e.pointerId); } catch { /* the drag still works from the handle's own events */ }
  }
  /** Grab a selected surface; otherwise leave the gesture to camera orbit. */
  function grab(e: PointerEvent, hit: { point: P & { y: number }; object: { userData: Record<string, unknown> } }, target: HTMLElement) {
    const studio = room(), s = selection(), u = hit.object.userData, w = selectedWall(studio), line = studio && w && wallLine(studio, w);
    if (!studio || !s || !w || !line) return false;
    const at = { x: hit.point.x, y: hit.point.y, z: hit.point.z };
    const opening = u.studioOpening ? studio.openings.find(o => o.id === u.studioOpening && o.wall === w.id) : undefined;
    let handle: RoomHandle | null = null;
    if (opening && s.kind !== 'ceiling') handle = { key: 'opening:' + opening.id, kind: 'opening', id: opening.id, ...at, label: '', ux: line.ux, uz: line.uz };
    else if (s.kind === 'wall' && u.studioWall === w.id) handle = { key: 'wall:' + w.id, kind: 'wall', id: w.id, ...at, label: '', nx: line.nx, nz: line.nz };
    else if (s.kind === 'ceiling' && u.studioCeiling === s.id) handle = { key: 'lift:' + s.id, kind: 'lift', id: s.id, ...at, label: '' };
    if (!handle) return false;
    if (handle.kind === 'opening' && s.id !== handle.id) select({ kind: 'opening', id: handle.id });
    begin(e, handle, target);
    return true;
  }
  /** Pointer travel in the vertical editing plane. */
  function inPlane(e: PointerEvent, h: RoomHandle, dx: number, dz: number) {
    const o = picking.screenPoint({ x: h.x, y: h.y, z: h.z }), a = picking.screenPoint({ x: h.x + dx * 50, y: h.y, z: h.z + dz * 50 }), b = picking.screenPoint({ x: h.x, y: h.y + 50, z: h.z });
    const u = { x: (a.x - o.x) / 50, y: (a.y - o.y) / 50 }, v = { x: (b.x - o.x) / 50, y: (b.y - o.y) / 50 }, det = u.x * v.y - u.y * v.x;
    const mx = e.clientX - drag!.client.x, my = e.clientY - drag!.client.y;
    // Looking straight along the run, only the height can follow the pointer.
    if (Math.abs(det) < .02 * Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) + 1e-6) return { s: 0, y: (mx * v.x + my * v.y) / Math.max(1e-6, v.x * v.x + v.y * v.y) };
    return { s: (mx * v.y - my * v.x) / det, y: (u.x * my - u.y * mx) / det };
  }
  /** Pointer travel along a floor direction, measured on screen. */
  function along(e: PointerEvent, h: RoomHandle, dx: number, dz: number) {
    const a = picking.screenPoint({ x: h.x, y: h.y, z: h.z }), b = picking.screenPoint({ x: h.x + dx * 50, y: h.y, z: h.z + dz * 50 });
    const sx = (b.x - a.x) / 50, sy = (b.y - a.y) / 50, len2 = sx * sx + sy * sy;
    return len2 < 1e-4 ? 0 : ((e.clientX - drag!.client.x) * sx + (e.clientY - drag!.client.y) * sy) / len2;
  }
  function floorPoint(e: PointerEvent, from: P): P | null {
    const g = picking.groundPoint(e), start = drag!.ground;
    if (!g || !start) return null;
    return { x: from.x + g.x - start.x, z: from.z + g.z - start.z };
  }
  const step = (v: number) => v;

  function move(e: PointerEvent) {
    const g = drag;
    if (!g || e.pointerId !== g.pointer) return;
    if (!g.moved && Math.hypot(e.clientX - g.client.x, e.clientY - g.client.y) < 4) return;
    g.free = e.shiftKey;
    if (!g.moved && g.handle.kind === 'extend') startExtend(e);
    g.moved = true;
    const problem = (s: Studio) => sceneCommands.studioProblem(s, g.carry ?? undefined);
    let want: ((t: number) => Studio | null) | null = null;
    const h = g.handle;
    if (h.kind === 'corner' || g.created) {
      const id = g.created ?? h.id, c = g.original.corners.find(x => x.id === id)!, raw = floorPoint(e, c);
      if (!raw) return;
      const snapped = g.free ? { at: { x: raw.x, z: raw.z }, locks: { x: null, z: null, ray: null, join: null }, guides: [] }
        : snapCorner(g.original, id, { x: step(raw.x), z: step(raw.z) }, g.locks, tolerance(), true);
      g.locks = snapped.locks;
      g.guides = snapped.guides;
      g.at = snapped.at;
      const from = g.last.corners.find(x => x.id === id) ?? c, to = snapped.at, join = snapped.locks.join;
      want = t => {
        const moved = moveCorner(g.original, id, from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t);
        return moved && join && t === 1 ? mergeCorners(moved, id, join) : moved;
      };
    } else if (h.kind === 'wall') {
      const w = wallOf(g.original, h.id)!, raw = step(along(e, h, h.nx!, h.nz!));
      const targets = wallTargets(g.original, w), hit = g.free ? null : resolveAlignment(raw, targets, { tolerance: tolerance(), hold: 1, lock: g.lock });
      g.lock = hit && { v: hit.v, label: hit.label, kind: hit.kind ?? hit.label };
      const d = hit ? hit.v : raw, before = lastDistance(g, w);
      g.guides = hit ? alignedGuide(g.original, w, d, hit) : [];
      want = t => moveWall(g.original, h.id, before + (d - before) * t);
    } else if (h.kind === 'opening') {
      const o = g.original.openings.find(x => x.id === h.id)!, w = wallOf(g.original, o.wall)!, centre = centredOffset(g.original, w);
      const d = inPlane(e, h, h.ux!, h.uz!), raw = step(o.offset + d.s), rawSill = step(o.sill + d.y);
      const near = openingTargets(g.original, o);
      const lock = g.free ? null : alignTo(raw, [...(centre === null ? [] : [{ v: centre, label: 'Centred on the wall' }]), ...near.along], g.lock, tolerance(), 1);
      const lockUp = g.free ? null : alignTo(rawSill, near.up, g.lockUp, tolerance(), 1);
      g.lock = lock; g.lockUp = lockUp;
      const target = lock ? lock.v : raw, sill = lockUp ? lockUp.v : rawSill, cur = g.last.openings.find(x => x.id === h.id)!;
      g.guides = [...lock ? (lock.label === 'Centred on the wall' ? centreGuide(g.original, w) : openingGuide(g.original, w, lock.v, null)) : [], ...lockUp ? openingGuide(g.original, w, null, lockUp.v) : []];
      want = t => moveOpening2D(g.original, h.id, cur.offset + (target - cur.offset) * t, cur.sill + (sill - cur.sill) * t);
    } else if (h.kind === 'depth') {
      const c = ceilingOf(g.original, h.id)!, raw = step(c.depth + along(e, h, h.nx!, h.nz!)), fr = ceilingFrame(g.original, c)!;
      // Snaps to the wall opposite, so a staircase can span the whole room.
      const opposite = reachAt(g.original, c.wall, (fr.along.from + fr.along.to) / 2);
      const lock = g.free ? null : alignTo(raw, [...opposite === null ? [] : [{ v: Math.round(opposite * 10) / 10, label: 'Wall' }], ...depthTargets(g.original, c, standing())], g.lock, tolerance(), 1);
      g.lock = lock;
      g.guides = lock ? depthGuide(g.original, c, lock.v, h.y) : [];
      const target = lock ? lock.v : raw, from = ceilingOf(g.last, h.id)?.depth ?? c.depth;
      want = t => setCeilingDepth(g.original, h.id, from + (target - from) * t);
    } else if (h.kind === 'tilt') {
      const c = ceilingOf(g.original, h.id)!, axis = runAxis(ceilingFrame(g.original, c)!, c);
      const rawHeight = outerEdgeHeight(c) + inPlane(e, h, axis.x, axis.z).y, lock = g.free ? null : alignTo(rawHeight, heightTargets(g.original, c, standing()), g.lock, tolerance(), 1);
      g.lock = lock;
      const height = lock ? lock.v : rawHeight;
      g.guides = lock ? heightGuide(g.original, c, h, lock.v) : [];
      const from = outerEdgeHeight(ceilingOf(g.last, h.id)!);
      want = t => setOuterEdgeHeight(g.original, h.id, from + (height - from) * t);
    } else if (h.kind === 'lift') {
      // The whole ceiling, as one: up or down (a box lowered, a staircase raised), and along its wall.
      const c = ceilingOf(g.original, h.id)!, top = roomHeight(g.original), fr = ceilingFrame(g.original, c)!, ref = { kind: 'ceiling' as const, id: h.id };
      const dy = step(inPlane(e, h, 1, 0).y), dx = c.run === 'along' ? step(inPlane(e, h, fr.line.ux, fr.line.uz).s) : 0;
      const cap = top - Math.max(...c.profile.map(p => p.y)), tol = { tolerance: tolerance(), within: [-1e6, cap] as const };
      const hit: AlignTarget<number> | null = g.free ? null : resolveAlignment(dy, liftTargets(c, heightTargets(g.original, c, standing())), { ...tol, hold: 1, lock: g.lock });
      const side: AlignTarget<number> | null = g.free || !dx ? null : resolveAlignment(dx, sideTargets(g.original, c, standing()), { tolerance: tolerance(), hold: 1, lock: g.lockUp });
      g.lock = hit && { v: hit.v, label: hit.label };
      g.lockUp = side && { v: side.v, label: side.label };
      g.guides = [...hit ? heightGuide(g.original, c, h, hit.src!) : [], ...side ? sideGuide(g.original, c, side.src!) : []];
      const lift = Math.min(cap, hit ? hit.v : dy), shift = side ? side.v : dx, before = (ceilingOf(g.last, h.id)?.profile[0]!.y ?? c.profile[0]!.y) - c.profile[0]!.y;
      const sideBefore = c.run === 'along' ? (ceilingOf(g.last, h.id)?.profile[0]!.t ?? c.profile[0]!.t) - c.profile[0]!.t : 0;
      want = t => {
        const lifted = liftWholeCeiling(g.original, h.id, before + (lift - before) * t), sp = lifted && surfaceProfile(lifted, ref, 'front');
        if (!lifted || !sp || !shift && !sideBefore) return lifted;
        return withSurfaceProfile(lifted, ref, translateProfile(sp.points, sideBefore + (shift - sideBefore) * t, 0, sp.bounds), 'front');
      };
    }
    if (!want) return;
    const whole = want(1), wanted = whole && problem(whole);
    // Go as far as the room allows; say why it stopped.
    const result = furthestValid(t => want!(t), s => !problem(s));
    if (!result.whole) g.guides = [];
    g.reason = wanted || null;
    if (result.room && JSON.stringify(result.room) !== JSON.stringify(g.last)) {
      g.last = result.room;
      model.scene.studio = result.room;
      if (g.carry?.list.length) sceneCommands.carryWardrobes(g.carry, result.room);
      // Wardrobes under a ceiling follow it live; their fittings are fitted when the drag ends.
      if (sceneCommands.followCeilings(false) || g.carry?.list.length) { callbacks.rebuild(); return; }
    }
    callbacks.redraw();
  }
  /** How far the dragged wall has moved so far: the last valid preview, along its room side. */
  function lastDistance(g: Drag, w: StudioWall) {
    const a0 = wallLine(g.original, w)!, now = wallOf(g.last, w.id), a1 = now && wallLine(g.last, now);
    return a1 ? (a1.a.x - a0.a.x) * a0.nx + (a1.a.z - a0.a.z) * a0.nz : 0;
  }
  /** A line on the plane the moved wall shares with the part it lines up with, from that part to the wall. */
  function alignedGuide(studio: Studio, w: StudioWall, d: number, hit: WallTarget): Guide[] {
    const line = wallLine(studio, w)!, src = hit.src;
    if (!src) return [];
    const ends = [line.a, line.b].map(p => ({ x: p.x + line.nx * d, z: p.z + line.nz * d }));
    const shift = hit.plane - d, face = ends.map(p => ({ x: p.x + line.nx * shift, z: p.z + line.nz * shift }));
    const nearest = face.sort((p, q) => Math.hypot(p.x - src.x, p.z - src.z) - Math.hypot(q.x - src.x, q.z - src.z))[0]!;
    return [{ a: { ...src, y: 2 }, b: { ...nearest, y: 2 }, label: hit.label }];
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
  /** Ends a drag. Returns whether anything moved: a tap on a surface is left to selection. */
  function end(cancel = false) {
    const g = drag;
    if (!g) return false;
    drag = null;
    try { if (g.target.hasPointerCapture(g.pointer)) g.target.releasePointerCapture(g.pointer); } catch { /* released already */ }
    if (cancel) { model.restore(g.snapshot); callbacks.refresh(); return g.moved; }
    if (!g.moved) { click(g.handle); return false; }
    if (JSON.stringify(g.last) !== JSON.stringify(JSON.parse(g.snapshot).studio ?? null)) {
      history.checkpoint(g.snapshot);
      sceneCommands.followCeilings(true);
      callbacks.histUI();
    }
    if (g.created) selectionState.room = { kind: 'wall', id: g.original.walls.at(-1)!.id };
    if (g.locks.join) callbacks.report('Walls joined.');
    callbacks.refresh();
    return true;
  }
  function click(h: RoomHandle) {
    if (h.kind === 'tilt') callbacks.openFields('surface-shape', 'outer');
    else if (h.kind === 'extend') {
      const id = sceneCommands.addStudioWall(selectedWall()?.id);
      if (id) selectionState.room = { kind: 'wall', id };
      callbacks.refresh();
    } else if (h.kind === 'corner' || h.kind === 'depth') callbacks.redraw();
  }
  function nudge(h: RoomHandle, key: string, shift: boolean) {
    const n = shift ? 10 : 1, dir = key === 'ArrowRight' || key === 'ArrowUp' ? 1 : -1;
    const across = key.endsWith('Left') || key.endsWith('Right') ? dir * n : 0, deep = key.endsWith('Up') || key.endsWith('Down') ? dir * n : 0;
    const ok = h.kind === 'corner' ? edit(s => { const c = s.corners.find(x => x.id === h.id)!; return moveCorner(s, h.id, c.x + across, c.z - deep); })
      : h.kind === 'wall' ? edit(s => moveWall(s, h.id, dir * n))
        : h.kind === 'opening' ? edit(s => { const o = s.openings.find(x => x.id === h.id)!; return moveOpening2D(s, h.id, o.offset + across, o.sill + deep); })
            : h.kind === 'tilt' ? edit(s => setOuterEdgeHeight(s, h.id, outerEdgeHeight(ceilingOf(s, h.id)!) + dir * n))
              : h.kind === 'depth' ? edit(s => setCeilingDepth(s, h.id, ceilingOf(s, h.id)!.depth + dir * n)) : false;
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
    } else if ((OPENING_KINDS as readonly string[]).includes(key)) {
      const id = sceneCommands.addStudioOpening(key as OpeningKind, w?.id);
      if (id) selectionState.room = { kind: 'opening', id };
      callbacks.refresh();
    } else if (key === 'split' && w) {
      if (!sceneCommands.editStudio(r => splitWall(r, w.id)) ) callbacks.report('This wall is too short to split. Each part needs ' + STUDIO_LIMITS.minWallLength + unitSuffix() + '.');
      callbacks.refresh();
    } else if (key.startsWith('ceiling:') && w) {
      if (sceneCommands.editStudio(r => addCeiling(r, w.id, key.slice(8)))) select({ kind: 'ceiling', id: room()!.ceilings!.at(-1)!.id });
      callbacks.refresh();
    } else if (key === 'flip' && s?.kind === 'ceiling') {
      if (!sceneCommands.editStudio(r => flipCeiling(r, s.id))) callbacks.report('A sloped ceiling always slopes down to its wall. Pick the wall it slopes down to.');
      callbacks.refresh();
    } else if (key === 'remove' && s) {
      const removed = s.kind === 'opening' ? sceneCommands.editStudio(r => removeOpening(r, s.id))
        : s.kind === 'ceiling' ? sceneCommands.editStudio(r => removeCeiling(r, s.id)) : sceneCommands.editStudio(r => removeWall(r, s.id));
      if (removed) selectionState.room = null;
      callbacks.refresh();
    }
  }

  return {
    select, valid, pick, handles, measures, guides, reason, act, nudge, click,
    begin, grab, move, end,
    /** Tapping a length on the model opens its field. */
    editMeasure: (m: RoomMeasure) => {
      if (!m.edit) return;
      // A ceiling's heights are typed in its Shape editor.
      const action = selection()?.kind === 'ceiling' ? 'surface-shape' : selection()?.kind === 'opening' ? 'opening-size' : 'wall-size';
      callbacks.openFields(action, m.edit);
    },
    dragging: () => drag !== null,
    /** The handle being dragged, which stays on show while the others step aside. */
    dragKey: () => drag?.moved ? drag.handle.key : null,
    selection,
  };
}
