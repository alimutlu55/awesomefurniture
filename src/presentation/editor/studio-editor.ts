import { wallLine } from '../../domain/studio/studio';
import type { Studio } from '../../domain/studio/studio';
import { addWall, extendFromCorner } from '../../domain/studio/studio-edit';
import { studioFields, studioFieldEdit, studioActionEdit } from './studio-fields';
import { roomDragEdit, snapRoomPoint } from './studio-drag';
import type { GroundPoint, Guide, RoomSelection } from './studio-drag';
import { createStudioOverlay } from './studio-overlay';
import type { StudioEditorPorts } from './studio-editor.ports';

interface Drag {
  selected: RoomSelection; pointer: number; target: HTMLElement; start: GroundPoint;
  snapshot: string; original: Studio; last: GroundPoint; moved: boolean;
}
/** Explicit room session. Previews restore the original snapshot before the final command,
 * exactly like the shape inspector: one undo per drag, no undo for cancel/no-op. */
export function createStudioEditor({ dom, model, sceneCommands, picking, lifetime, rendering, callbacks }: StudioEditorPorts) {
  const panel = dom.$('#room-panel'), overlay = dom.$('#room-overlay'), fields = dom.$('#room-fields');
  let active = false, selected: RoomSelection | null = null, drag: Drag | null = null;
  let reason = '', guides: Guide[] = [], drawing = false, drawStart: GroundPoint | null = null, extend: string | null = null;
  let lastFields = '';
  const room = () => model.scene.studio;
  const visuals = createStudioOverlay({ dom, picking, rendering, root: overlay,
    getState: () => ({ room: room(), selected, active, guides, reason }) });
  function render() {
    if (!room()) { active = false; selected = null; drawing = false; }
    if (selected && !room()?.[selected.kind === 'wall' ? 'walls' : selected.kind === 'corner' ? 'corners' : 'openings'].some(x => x.id === selected!.id)) selected = null;
    dom.$('#room-edit').hidden = !room();
    dom.$('#room-edit').textContent = active ? 'Finish editing' : 'Edit room';
    dom.$('#room-edit').setAttribute('aria-pressed', String(active));
    dom.$('#room-draw').hidden = !active;
    dom.$('#room-draw').setAttribute('aria-pressed', String(drawing));
    dom.$('#room-plan').hidden = dom.$('#room-view').hidden = !room();
    dom.$('#room-picker').hidden = active;
    fields.hidden = !active;
    dom.$('#room-help').textContent = drawing ? (drawStart ? 'Choose the end of the wall. Escape cancels.' : 'Choose the start of the wall. Escape cancels.')
      : active ? 'Drag a dot, wall grip or opening. Arrows nudge. Shift uses 1 cm; otherwise 5 cm.' : 'Choose a studio, then make it your room.';
    const html = active && room() ? studioFields(room()!, selected) : '';
    if (html !== lastFields && !drag) { fields.innerHTML = html; lastFields = html; }
    dom.$('#room-feedback').textContent = reason;
    dom.$('#app').classList.toggle('room-editing', active);
    visuals.frame();
  }
  function refresh() { callbacks.refresh(); render(); }
  function show() {
    panel.hidden = false; dom.$('#room-toggle').setAttribute('aria-expanded', 'true');
    callbacks.enter(); render();
  }
  function finish() {
    endDrag(true); active = false; selected = null; drawing = false; drawStart = null; extend = null; guides = []; reason = '';
    panel.hidden = true; dom.$('#room-toggle').setAttribute('aria-expanded', 'false'); refresh();
  }
  function start() { show(); active = true; reason = ''; refresh(); callbacks.frameRoom(true); }
  function commit(next: Studio | null) {
    reason = sceneCommands.studioEditProblem(next) ?? '';
    if (!reason && next) sceneCommands.editStudio(() => next);
    lastFields = ''; refresh();
  }
  function endDrag(cancel = false) {
    if (!drag) return;
    const g = drag, final = room(); drag = null;
    if (g.target.hasPointerCapture(g.pointer)) g.target.releasePointerCapture(g.pointer);
    model.restore(g.snapshot);
    if (!cancel && g.moved && final) sceneCommands.editStudio(() => final);
    guides = []; if (cancel) reason = '';
    refresh();
  }
  function begin(e: PointerEvent, el: HTMLElement) {
    const kind = el.dataset.roomKind, id = el.dataset.roomId!;
    if (!room()) return;
    e.preventDefault(); e.stopPropagation();
    if (kind === 'extend') {
      extend = id; drawStart = room()!.corners.find(c => c.id === id)!; drawing = true; reason = ''; render(); return;
    }
    const p = picking.groundPoint(e); if (!p) return;
    selected = { kind: kind as RoomSelection['kind'], id }; reason = ''; render();
    drag = { selected, pointer: e.pointerId, target: el, start: { x: p.x, z: p.z },
      snapshot: model.snapshot(), original: room()!, last: { x: p.x, z: p.z }, moved: false };
    el.dataset.pointer = String(e.pointerId);
    try { el.setPointerCapture(e.pointerId); } catch { /* pointer already ended */ }
  }
  function move(e: PointerEvent) {
    const g = drag; if (!g || e.pointerId !== g.pointer) return;
    e.preventDefault(); e.stopPropagation();
    const p = picking.groundPoint(e); if (!p) return;
    const target = roomDragEdit(g.original, g.selected, g.start, p, e.shiftKey);
    reason = sceneCommands.studioEditProblem(target.room) ?? ''; guides = target.guides;
    let next = target.room, last = { x: p.x, z: p.z };
    if (reason) {
      // Bisect from the last accepted pointer toward the invalid target for smooth stops.
      let lo = 0, hi = 1; next = room()!;
      for (let i = 0; i < 12; i++) {
        const t = (lo + hi) / 2, at = { x: g.last.x + (p.x - g.last.x) * t, z: g.last.z + (p.z - g.last.z) * t };
        const trial = roomDragEdit(g.original, g.selected, g.start, at, e.shiftKey).room;
        if (!sceneCommands.studioEditProblem(trial)) { lo = t; next = trial; last = at; } else hi = t;
      }
    }
    if (next && JSON.stringify(next) !== JSON.stringify(room()) && sceneCommands.editStudio(() => next, false)) {
      g.moved = true; g.last = last; rendering.build();
    }
    render();
  }
  function nudge(e: KeyboardEvent, el: HTMLElement) {
    const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    const dz = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if ((!dx && !dz) || !room() || el.dataset.roomKind === 'extend') return;
    e.preventDefault(); e.stopPropagation();
    selected = { kind: el.dataset.roomKind as RoomSelection['kind'], id: el.dataset.roomId! };
    const step = e.shiftKey ? 1 : 5;
    let point = { x: dx * step, z: dz * step };
    if (selected.kind === 'wall') {
      const w = room()!.walls.find(w => w.id === selected!.id)!, line = wallLine(room()!, w)!;
      point = { x: (dx || dz) * step * line.nx, z: (dx || dz) * step * line.nz };
    } else if (selected.kind === 'opening') {
      const o = room()!.openings.find(o => o.id === selected!.id)!, w = room()!.walls.find(w => w.id === o.wall)!;
      const line = wallLine(room()!, w)!; point = { x: (dx || dz) * step * line.ux, z: (dx || dz) * step * line.uz };
    }
    commit(roomDragEdit(room()!, selected, { x: 0, z: 0 }, point, e.shiftKey).room);
    const replacement = overlay.querySelector<HTMLElement>(`[data-room-kind="${selected.kind}"][data-room-id="${selected.id}"]`);
    replacement?.focus();
  }
  function drawAt(e: PointerEvent) {
    const p = picking.groundPoint(e); if (!p || !room()) return;
    const snapped = snapRoomPoint(room()!, p, drawStart ?? undefined, extend ?? undefined, e.shiftKey);
    if (!drawStart) { drawStart = snapped.point; render(); return; }
    const next = extend ? extendFromCorner(room()!, extend, snapped.point.x, snapped.point.z)
      : addWall(room()!, drawStart.x, drawStart.z, snapped.point.x, snapped.point.z);
    reason = sceneCommands.studioEditProblem(next) ?? '';
    if (!reason && next && sceneCommands.editStudio(() => next)) {
      selected = { kind: 'wall', id: next.walls.at(-1)!.id }; drawing = false; drawStart = null; extend = null; guides = [];
    }
    refresh();
  }
  function bind() {
    const listen = lifetime.listen;
    listen(dom.$('#room-toggle'), 'click', () => panel.hidden ? show() : finish());
    listen(dom.$('#room-close'), 'click', finish);
    listen(dom.$('#room-edit'), 'click', () => active ? finish() : start());
    listen(dom.$('#room-view'), 'click', () => callbacks.frameRoom(false));
    listen(dom.$('#room-plan'), 'click', () => callbacks.frameRoom(true));
    listen(dom.$('#room-draw'), 'click', () => { drawing = !drawing; drawStart = null; extend = null; guides = []; reason = ''; render(); });
    listen(fields, 'change', (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.roomField && room() && selected) commit(studioFieldEdit(room()!, selected, el.dataset.roomField, el.valueAsNumber));
    });
    listen(fields, 'keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') (e.target as HTMLElement).blur(); });
    listen(fields, 'click', (e: Event) => {
      const el = (e.target as Element).closest<HTMLElement>('[data-room-action]');
      if (el && room() && selected) {
        const next = studioActionEdit(room()!, selected, el.dataset.roomAction!);
        if (next && !sceneCommands.studioEditProblem(next) && el.dataset.roomAction!.startsWith('add-')) {
          selected = { kind: 'opening', id: next.openings.at(-1)!.id };
        }
        commit(next);
      }
    });
    listen(overlay, 'pointerdown', (e: PointerEvent) => {
      const el = (e.target as Element).closest<HTMLElement>('[data-room-kind]'); if (el) begin(e, el);
    });
    listen(overlay, 'pointermove', move);
    listen(overlay, 'pointerup', (e: PointerEvent) => { if (drag?.pointer === e.pointerId) { e.stopPropagation(); endDrag(); } });
    listen(overlay, 'pointercancel', () => endDrag(true));
    listen(overlay, 'lostpointercapture', () => endDrag(true));
    listen(overlay, 'keydown', (e: KeyboardEvent) => {
      const el = (e.target as Element).closest<HTMLElement>('[data-room-kind]'); if (el) nudge(e, el);
    });
    listen(overlay, 'click', (e: MouseEvent) => {
      const el = (e.target as Element).closest<HTMLElement>('[data-room-kind]');
      if (el && el.dataset.roomKind !== 'extend' && e.detail === 0) {
        selected = { kind: el.dataset.roomKind as RoomSelection['kind'], id: el.dataset.roomId! }; render();
      }
      if (el?.dataset.roomKind === 'extend' && e.detail === 0 && room()) {
        extend = el.dataset.roomId!; drawStart = room()!.corners.find(c => c.id === extend)!; drawing = true; render();
      }
    });
    listen(dom.$('#view'), 'pointerdown', (e: PointerEvent) => {
      if (!active || e.target !== dom.$('#c')) return;
      if (drawing) { e.preventDefault(); e.stopImmediatePropagation(); drawAt(e); return; }
      // A floor click closes the room session; dragging empty space still orbits normally.
      const startX = e.clientX, startY = e.clientY;
      floorClick = { x: startX, y: startY };
    }, true);
    let floorClick: { x: number; y: number } | null = null;
    listen(dom.$('#view'), 'pointerup', (e: PointerEvent) => {
      if (floorClick && active && Math.hypot(e.clientX - floorClick.x, e.clientY - floorClick.y) < 4) finish();
      floorClick = null;
    }, true);
    listen(dom.$('#view'), 'pointermove', (e: PointerEvent) => {
      if (!drawing || !drawStart || !room() || e.target !== dom.$('#c')) return;
      const p = picking.groundPoint(e); if (!p) return;
      const snap = snapRoomPoint(room()!, p, drawStart, extend ?? undefined, e.shiftKey);
      guides = [...snap.guides, { a: drawStart, b: snap.point }];
    });
    listen(dom.window, 'keydown', (e: KeyboardEvent) => {
      if (!active && panel.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (drag) endDrag(true);
        else if (drawing) { drawing = false; drawStart = null; extend = null; guides = []; render(); }
        else finish();
      } else if (drag && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    const frame = () => { visuals.frame(); lifetime.frame(frame); };
    lifetime.frame(frame);
    lifetime.cleanup(() => { if (drag) model.restore(drag.snapshot); });
  }
  return { render, bind, finish };
}
