import { bindPlanPinch } from './floor-plan-navigation';
import { ceilingClearance } from '../../domain/studio/studio-clearance';
import { resolveShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { fixturePlace } from '../../domain/studio/fixtures/fixture-place';
import { openingPlanMeasurements, bindFloorPlanMeasurements } from './floor-plan-measurements';
import { wallFace, wallLine, type Studio } from '../../domain/studio/studio';
import { mergeCorners, moveCorner, moveWall, moveOpening, setDoorOperation, removeOpening, removeWall } from '../../domain/studio/studio-edit';
import { clampPlanOpenings, drawPlanWall, millimetrePoint, wallPlanPolygon, type FloorPoint } from '../../domain/studio/floor-plan';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { alignTo, type Align } from '../../domain/geometry/alignment';
import { snapCorner, wallTargets, type CornerLocks, type Guide } from './studio-drag';
import { decorateMeasurementBadge } from '../components/measurement-badge';
import { lengthText, unitSuffix } from './length-unit-state';
import type { FloorPlanPorts } from './floor-plan.ports';


type Hit = { kind: 'corner' | 'wall' | 'opening' | 'cabinet' | 'rotate'; id: string };
const SVG = 'http://www.w3.org/2000/svg';
const emptyLocks = (): CornerLocks => ({ x: null, z: null, ray: null, join: null });

/** A projection of the editor scene. Only view transforms and pointer sessions live here. */
export function createFloorPlan(p: FloorPlanPorts) {
  const { dom, model, lifetime } = p, doc = dom.document, view = dom.$('#view'), app = dom.$('#app');
  const button = doc.createElement('button');
  button.type = 'button'; button.className = 'tb'; button.textContent = '2D'; button.setAttribute('aria-label', '2D floor plan'); button.setAttribute('aria-pressed', 'false');
  dom.$('#view-modes').append(button);
  const root = doc.createElement('div'); root.className = 'floor-plan'; root.hidden = true;
  const svg = doc.createElementNS(SVG, 'svg') as SVGSVGElement; svg.setAttribute('aria-label', 'Floor plan. Drag walls, corners and furniture. Drag empty floor to pan.');
  const badges = doc.createElement('div'); badges.className = 'floor-plan-badges';
  const tools = doc.createElement('div'); tools.className = 'fl floor-plan-tools';
  const status = doc.createElement('output'); status.className = 'floor-plan-status'; status.setAttribute('aria-live', 'polite');
  const actions = [
    ['select', 'Select'], ['draw', 'Wall'], ['door', 'Door'], ['window', 'Window'], ['archway', 'Opening'],
    ['hinge', 'Hinge'], ['swing', 'Swing'], ['delete', 'Delete'], ['fit', 'Fit'], ['in', '+'], ['out', '−'],
  ];
  for (const [action, label] of actions) {
    const b = doc.createElement('button'); b.type = 'button'; b.className = 'tb';
    b.dataset.action = action; b.textContent = label!; tools.append(b);
  }
  root.append(svg, badges, status, tools); view.append(root);
  let open = false, disposed = false, tool = 'select', drawStart: FloorPoint | null = null;
  let scale = 1, cx = 0, cz = 0, width = 1, height = 1, key = '', guides: Guide[] = [], editing = false;
  let pending: PointerEvent | null = null, scheduled = false;
  type Drag = { pointer: number;
      hit: Hit | null;
      start: FloorPoint;
      px: number;
      py: number;
      cx: number;
      cz: number;
      before: string;
      room: Studio | undefined;
      moved: boolean;
      locks: CornerLocks;
      wallLock: Align | null;
      snapped: boolean;
      cabinet?: { x: number;
      z: number;
      angle: number } };
      let drag: Drag | null = null;
  const screen = (pt: FloorPoint) => ({ x: (pt.x - cx) * scale + width / 2, y: (pt.z - cz) * scale + height / 2 });
  const world = (e: { clientX: number; clientY: number }) => { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left - width / 2) / scale + cx, z: (e.clientY - r.top - height / 2) / scale + cz }; };
  const selected = (h: Hit) => h.kind === 'cabinet' ? !p.selection.room && model.scene.activeWardrobe === Number(h.id) : p.selection.room?.kind === h.kind && p.selection.room?.id === h.id;
  function select(h: Hit) {
    if (h.kind === 'cabinet' || h.kind === 'rotate') { model.select(Number(h.id)); p.selection.room = null; }
    else if (h.kind !== 'corner') { p.selection.focusOn = false; p.selection.room = { kind: h.kind, id: h.id }; }
  }
  function node(tag: string, attrs: Record<string, string | number>, parent: Element = svg) {
    const el = doc.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v)); parent.append(el); return el;
  }
  const pts = (points: readonly FloorPoint[]) => points.map(q => { const s = screen(q); return `${s.x},${s.y}`; }).join(' ');
  function fit() {
    width = view.clientWidth; height = view.clientHeight;
    const points = [...model.scene.studio?.corners ?? [], ...model.scene.wardrobes.flatMap(c => [{ x: c.x - c.state.w / 2, z: c.z - c.state.d / 2 }, { x: c.x + c.state.w / 2, z: c.z + c.state.d / 2 }])];
    if (!points.length) points.push({ x: -250, z: -200 }, { x: 250, z: 200 });
    const xs = points.map(q => q.x), zs = points.map(q => q.z), minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    cx = (minX + maxX) / 2; cz = (minZ + maxZ) / 2;
    scale = Math.max(.1, Math.min((width - 100) / Math.max(100, maxX - minX), (height - 210) / Math.max(100, maxZ - minZ)));
    render();
  }
  function render() {
    if (!open || editing) return;
    width = view.clientWidth; height = view.clientHeight; svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.replaceChildren(); badges.replaceChildren();
    const room = model.scene.studio;
    for (const w of room?.walls ?? []) {
      const l = wallLine(room!, w), face = wallFace(room!, w); if (!l || !face) continue;
      const hit: Hit = { kind: 'wall', id: w.id }, a = screen(l.a), b = screen(l.b);
      const group = node('g', { 'data-kind': 'wall', 'data-id': w.id, class: selected(hit) ? 'selected' : '' });
      node('polygon', { points: pts(wallPlanPolygon(room!, w)), class: 'plan-wall' }, group);
      node('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'plan-hit' }, group);
      const mid = screen({ x: (l.a.x + l.b.x) / 2, z: (l.a.z + l.b.z) / 2 });
      if (selected(hit)) node('circle', { cx: mid.x, cy: mid.y, r: 6, class: 'plan-handle' }, group);
      const at = screen({ x: (face.from.x + face.to.x) / 2, z: (face.from.z + face.to.z) / 2 });
      const badge = doc.createElement('button'); badge.type = 'button'; badge.dataset.wall = w.id;
      const candidate = (shift: number) => ({ x: at.x + l.nx * 54 + l.ux * shift, y: at.y + l.nz * 54 + l.uz * shift });
      const clear = (point: { x: number; y: number }) => model.scene.wardrobes.every(c => {
        const center = screen(c), angle = c.angle * Math.PI / 180;
        const w = (Math.abs(Math.cos(angle)) * c.state.w + Math.abs(Math.sin(angle)) * c.state.d) * scale / 2;
        const d = (Math.abs(Math.sin(angle)) * c.state.w + Math.abs(Math.cos(angle)) * c.state.d) * scale / 2;
        return Math.abs(point.x - center.x) > w + 46 || Math.abs(point.y - center.y) > d + 26;
      });
      const position = [0, -90, 90, -160, 160].map(candidate)
        .find(q => q.x > 44 && q.x < width - 44 && q.y > 80 && q.y < height - 110 && clear(q)) ?? candidate(0);
      badge.style.left = `${position.x}px`; badge.style.top = `${position.y}px`;
      badge.textContent = lengthText(face.length) + unitSuffix();
      decorateMeasurementBadge(badge, { id: `plan:${w.id}`, label: 'Inner wall length', value: face.length, orientation: 'horizontal', min: 30, max: 2000 }); badges.append(badge);
    }
    for (const o of room?.openings ?? []) {
      const w = room!.walls.find(w => w.id === o.wall), l = w && wallLine(room!, w); if (!w || !l || !['door', 'window', 'archway'].includes(o.kind)) continue;
      const at = (t: number, n: number): FloorPoint => ({ x: l.a.x + l.ux * t + l.nx * n, z: l.a.z + l.uz * t + l.nz * n });
      const from = o.offset - o.width / 2, to = o.offset + o.width / 2;
      const group = node('g', { 'data-kind': 'opening', 'data-id': o.id, class: selected({ kind: 'opening', id: o.id }) ? 'selected' : '' });
      node('polygon', { points: pts([at(from, -w.thickness / 2), at(to, -w.thickness / 2), at(to, w.thickness / 2), at(from, w.thickness / 2)]), class: 'plan-opening' }, group);
      if (o.kind === 'window') for (const n of [-w.thickness / 4, w.thickness / 4]) { const a = screen(at(from, n)), b = screen(at(to, n)); node('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'plan-symbol' }, group); }
      if (o.kind === 'door') {
        const right = o.hinge === 'right',
      sign = o.swing === 'out' ? -1 : 1,
      hinge = screen(at(right ? to : from,
      w.thickness / 2 * sign)),
      shut = screen(at(right ? from : to,
      w.thickness / 2 * sign)),
      leaf = screen(at(right ? to : from,
      (w.thickness / 2 + o.width) * sign)),
      radius = o.width * scale;
        node('path', { d: `M${hinge.x},
      ${hinge.y} L${leaf.x},
      ${leaf.y} M${shut.x},
      ${shut.y} A${radius},
      ${radius} 0 0 ${right === (sign > 0) ? 0 : 1} ${leaf.x},
      ${leaf.y}`, class: 'plan-symbol', 'stroke-dasharray': o.hinge && o.swing ? '' : '4 3' }, group);
      }
      const a = screen(at(from, 0)), b = screen(at(to, 0)); node('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'plan-hit' }, group);
    }
    for (const c of model.scene.wardrobes) {
      const angle = c.angle * Math.PI / 180, co = Math.cos(angle), si = Math.sin(angle), at = (x: number, z: number) => ({ x: c.x + x * co + z * si, z: c.z - x * si + z * co });
      const group = node('g', { 'data-kind': 'cabinet', 'data-id': c.id, class: selected({ kind: 'cabinet', id: String(c.id) }) ? 'selected' : '' });
      const w = c.state.w / 2, d = c.state.d / 2;
      node('polygon', { points: pts([at(-w, -d), at(w, -d), at(w, d), at(-w, d)]), class: 'plan-cabinet' }, group);
      const a = screen(at(-w, d)), b = screen(at(w, d)); node('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'plan-symbol' }, group);
      if (selected({ kind: 'cabinet', id: String(c.id) })) {
        const grip = screen(at(0, d + 32 / scale));
        const rotate = node('g', { 'data-kind': 'rotate', 'data-id': c.id, 'aria-label': 'Rotate furniture' });
        node('circle', { cx: grip.x, cy: grip.y, r: 22, class: 'plan-corner-hit' }, rotate);
        node('circle', { cx: grip.x, cy: grip.y, r: 7, class: 'plan-handle' }, rotate);
      }
      const center = screen(c); const text = node('text', { x: center.x, y: center.y, class: 'plan-name' }, group); text.textContent = c.name;
    }
    for (const f of room?.fixtures ?? []) {
      const placed = fixturePlace(room!, f); if (!placed) continue;
      const { at, back } = placed, a = f.offset - f.width / 2, b = f.offset + f.width / 2;
      node('polygon', { points: pts([at(a, back), at(b, back), at(b, back + f.depth), at(a, back + f.depth)]), class: 'plan-cabinet' });
    }
    for (const c of room?.corners ?? []) {
      const at = screen(c), group = node('g', { 'data-kind': 'corner', 'data-id': c.id });
      node('circle', { cx: at.x, cy: at.y, r: 22, class: 'plan-corner-hit' }, group); node('circle', { cx: at.x, cy: at.y, r: 4, class: 'plan-handle' }, group);
    }
    for (const guide of guides) { const a = screen(guide.a), b = screen(guide.b); node('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'plan-guide' }); }
    if (drawStart) { const at = screen(drawStart); node('circle', { cx: at.x, cy: at.y, r: 8, class: 'plan-handle' }); }
    const opening = room?.openings.find(o => p.selection.room?.kind === 'opening' && o.id === p.selection.room.id);
    if (opening) openingPlanMeasurements(badges, opening);
    tools.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b => {
      const action = b.dataset.action!;
      b.hidden = ['hinge', 'swing'].includes(action) ? opening?.kind !== 'door' : action === 'delete' ? !p.selection.room : false;
      b.setAttribute('aria-pressed', String(action === tool));
    });
  }
  function finished() { p.refresh(); key = ''; render(); }
  function end(cancel = false) {
    const g = drag; if (!g) return;
    if (!cancel && pending) flush(); pending = null; drag = null;
    if (cancel && g.moved && g.hit) model.restore(g.before);
    else if (g.hit && g.moved && model.snapshot() !== g.before) p.history.checkpoint(g.before);
    if (svg.hasPointerCapture(g.pointer)) svg.releasePointerCapture(g.pointer);
    guides = []; if (g.hit && g.moved) finished(); else render();
  }
  function flush() {
    const e = pending; pending = null; const g = drag; if (!e || !g) return;
    if (!g.moved && Math.hypot(e.clientX - g.px, e.clientY - g.py) < 4) return;
    g.moved = true;
    if (!g.hit) { cx = g.cx - (e.clientX - g.px) / scale; cz = g.cz - (e.clientY - g.py) / scale; render(); return; }
    const at = world(e), dx = at.x - g.start.x, dz = at.z - g.start.z, h = g.hit; guides = [];
    let next: Studio | null = null;
    if (g.room && h.kind === 'corner') {
      const c = g.room.corners.find(c => c.id === h.id)!;
      const snap = snapCorner(g.room, h.id, { x: c.x + dx, z: c.z + dz }, g.locks, 8 / scale);
      g.locks = snap.locks; guides = snap.guides; next = moveCorner(g.room, h.id, snap.at.x, snap.at.z);
      if (next && snap.locks.join) next = mergeCorners(next, h.id, snap.locks.join);
    } else if (g.room && h.kind === 'wall') {
      const w = g.room.walls.find(w => w.id === h.id)!, l = wallLine(g.room, w)!;
      const distance = dx * l.nx + dz * l.nz; g.wallLock = alignTo(distance, wallTargets(g.room, w).map(t => ({ v: t.v, label: t.label })), g.wallLock, 8 / scale, 1.6);
      next = moveWall(g.room, h.id, g.wallLock?.v ?? distance);
      status.textContent = g.wallLock?.label ?? `${Math.round(distance * 10)} mm`;
    } else if (g.room && h.kind === 'opening') {
      const o = g.room.openings.find(o => o.id === h.id)!, w = g.room.walls.find(w => w.id === o.wall)!, l = wallLine(g.room, w)!;
      next = moveOpening(g.room, o.id, o.offset + dx * l.ux + dz * l.uz);
    } else if ((h.kind === 'cabinet' || h.kind === 'rotate') && g.cabinet) {
      const c = model.scene.wardrobes.find(c => c.id === Number(h.id))!;
      const raw = { ...millimetrePoint({ x: g.cabinet.x + dx, z: g.cabinet.z + dz }), angle: g.cabinet.angle };
      if (h.kind === 'rotate') {
        raw.x = g.cabinet.x; raw.z = g.cabinet.z;
        const angle = Math.atan2(at.x - raw.x, at.z - raw.z) * 180 / Math.PI;
        const snapped = alignTo(angle, Array.from({ length: 9 }, (_, i) => ({ v: (i - 4) * 45, label: 'Angle' })), g.wallLock, 4, 1.6);
        g.wallLock = snapped; raw.angle = snapped?.v ?? Math.round(angle);
      }
      const snap = h.kind === 'rotate' ? null : p.commands.wallSnap(c, raw, (g.snapped ? 20 : 12) / scale, 180); g.snapped = !!snap;
      const pose = snap ?? raw;
      const collision = createCabinetGeometry(() => model.scene.wardrobes.filter(o => o.id !== c.id), () => studioObstacles(model.scene.studio));
      if (collision.cabinetCollides({ ...c, ...pose })) { status.textContent = 'Blocked by furniture or wall'; render(); return; }
      const blockedAbove = ceilingClearance(model.scene.studio, { ...c, ...pose, w: c.state.w, d: c.state.d });
      if (blockedAbove(resolveShape(c.state))) { status.textContent = 'Blocked by ceiling'; render(); return; }
      Object.assign(c, pose); status.textContent = snap ? 'Flush against wall' : `${Math.round(c.x * 10)}, ${Math.round(c.z * 10)} mm`;
      if (snap && model.scene.studio) {
        const room = model.scene.studio;
        const w = room.walls.find(w => { const l = wallLine(room, w)!; return Math.abs((c.x - l.a.x) * l.nx + (c.z - l.a.z) * l.nz - w.thickness / 2 - c.state.d / 2) < .2; });
        const l = w && wallLine(room, w), f = w && wallFace(room, w);
        if (l && f) { const t = (c.x - l.a.x) * l.ux + (c.z - l.a.z) * l.uz; status.textContent = `Flush · ${Math.round((t - c.state.w / 2 - f.start) * 10)} / ${Math.round((f.end - t - c.state.w / 2) * 10)} mm to corners`; }
      }
    }
    if (next) { next = clampPlanOpenings(next);
      const problem = p.commands.studioProblem(next);
      if (problem) status.textContent = problem;
      else { model.scene.studio = next;
      if (guides.length) status.textContent = guides.map(g => g.label).join(' · ');
      } }
    render();
  }
  function toggle(on: boolean) {
    if (editing) return;
    end(true); open = on; root.hidden = !on; button.setAttribute('aria-pressed', String(on)); button.textContent = on ? '3D' : '2D'; button.setAttribute('aria-label', on ? 'Return to 3D' : '2D floor plan');
    app.dataset.floorPlan = String(on); app.classList.toggle('floor-plan-open', on); if (on) { p.closePanels(); fit(); } else { drawStart = null; p.refresh(); }
  }
  lifetime.listen(button, 'click', () => toggle(!open));
  lifetime.listen(dom.$('#view-modes'), 'click', (e: Event) => { if ((e.target as Element).closest('button[data-view-mode]') && open) toggle(false); }, true);
  bindPlanPinch(svg, lifetime, { cancelEdit: () => end(true), scale: () => scale,
    zoom: (value, anchor, midpoint) => {
      const before = world({ clientX: anchor.x, clientY: anchor.y }); scale = Math.max(.08, Math.min(10, value));
      const after = world({ clientX: midpoint.x, clientY: midpoint.y }); cx += before.x - after.x; cz += before.z - after.z; render();
    } });
  lifetime.listen(svg, 'pointerdown', (event: Event) => {
    const e = event as PointerEvent; if (e.button !== 0 || drag) return; e.preventDefault();
    const target = (e.target as Element).closest<SVGElement>('[data-kind]'); const hit = target ? { kind: target.dataset.kind, id: target.dataset.id } as Hit : null;
    const at = world(e);
    if (tool === 'draw') {
      const room = model.scene.studio ?? { template: 'custom', corners: [], walls: [], openings: [] } as Studio;
      const nearest = room.corners.find(c => Math.hypot(c.x - at.x, c.z - at.z) < 16 / scale); let point = nearest ?? millimetrePoint(at);
      if (!drawStart) { drawStart = point; status.textContent = 'Tap the next corner'; render(); return; }
      if (!nearest) { const dx = point.x - drawStart.x,
      dz = point.z - drawStart.z,
      angle = Math.atan2(dz,
      dx),
      common = Math.round(angle / (Math.PI / 4)) * Math.PI / 4,
      len = Math.hypot(dx,
      dz);
      if (Math.abs(Math.sin(angle - common) * len) < 12 / scale) point = millimetrePoint({ x: drawStart.x + Math.cos(common) * len,
      z: drawStart.z + Math.sin(common) * len });
      }
      const next = drawPlanWall(room, drawStart, point, 16 / scale), problem = next && p.commands.studioProblem(next);
      if (next && !problem) { p.history.checkpoint(); model.scene.studio = next; drawStart = point; finished(); } else status.textContent = problem ?? 'Choose a different corner';
      return;
    }
    if (hit) select(hit);
    if (['door', 'window', 'archway'].includes(tool)) {
      if (hit?.kind === 'wall') { const id = p.commands.addStudioOpening(tool as 'door' | 'window' | 'archway', hit.id);
        if (id) p.selection.room = { kind: 'opening', id }; tool = 'select'; finished(); } else status.textContent = 'Tap a wall for the opening'; return;
    }
    const cabinet = hit && (hit.kind === 'cabinet' || hit.kind === 'rotate') ? model.scene.wardrobes.find(c => c.id === Number(hit.id)) : undefined;
    drag = { pointer: e.pointerId,
      hit,
      start: at,
      px: e.clientX,
      py: e.clientY,
      cx,
      cz,
      before: model.snapshot(),
      room: model.scene.studio,
      moved: false,
      locks: emptyLocks(),
      wallLock: null,
      snapped: false,
      ...(cabinet ? { cabinet: { x: cabinet.x,
      z: cabinet.z,
      angle: cabinet.angle } } : {}) };
    svg.setPointerCapture(e.pointerId); render();
  });
  lifetime.listen(svg,
      'pointermove',
      (event: Event) => { const e = event as PointerEvent;
      if (drag?.pointer !== e.pointerId) return;
      pending = e;
      if (!scheduled) { scheduled = true;
      lifetime.frame(() => { scheduled = false;
      flush();
      });
      } });
  lifetime.listen(svg, 'pointerup', () => end());
  lifetime.listen(svg, 'pointercancel', () => end(true));
  lifetime.listen(dom.window, 'blur', () => end(true));
  lifetime.listen(svg, 'lostpointercapture', () => end(true));
  lifetime.listen(svg,
      'wheel',
      (event: Event) => { const e = event as WheelEvent;
      e.preventDefault();
      if (drag) return;
      const before = world(e);
      scale = Math.max(.08,
      Math.min(10,
      scale * Math.exp(-e.deltaY * .001)));
      const after = world(e);
      cx += before.x - after.x;
      cz += before.z - after.z;
      render();
      },
      { passive: false });
  lifetime.listen(tools, 'click', (e: Event) => {
    const action = (e.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action; if (!action) return; end();
    const sel = p.selection.room;
    if (action === 'fit') fit();
    else if (action === 'in' || action === 'out') scale = Math.max(.08, Math.min(10, scale * (action === 'in' ? 1.25 : .8)));
    else if (action === 'delete' && sel) { if (p.commands.editStudio(r => sel.kind === 'wall' ? removeWall(r, sel.id) : sel.kind === 'opening' ? removeOpening(r, sel.id) : null)) p.selection.room = null; finished(); }
    else if ((action === 'hinge' || action === 'swing') && sel?.kind === 'opening') {
      p.commands.editStudio(r => { const o = r.openings.find(o => o.id === sel.id);
      return o ? setDoorOperation(r,
      o.id,
      { hinge: action === 'hinge' ? o.hinge === 'right' ? 'left' : 'right' : o.hinge ?? 'left',
      swing: action === 'swing' ? o.swing === 'out' ? 'in' : 'out' : o.swing ?? 'in' }) : null;
      });
      finished();
    } else { tool = action; drawStart = null; status.textContent = action === 'draw' ? 'Tap two corners to draw a wall' : action === 'select' ? '' : 'Tap a wall'; }
    render();
  });
  bindFloorPlanMeasurements(p, badges, value => { editing = value; }, render);
  lifetime.listen(dom.window, 'keydown', (e: KeyboardEvent) => {
    if (!open || (e.target as Element).matches('input,textarea')) return;
    if (drag && (e.metaKey || e.ctrlKey)) { end(true); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.key !== 'Escape') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (drag) end(true);
    else if (drawStart || tool !== 'select') { drawStart = null; tool = 'select'; render(); }
    else toggle(false);
  }, true);
  function frame() {
    if (disposed) return;
    if (open && !drag && !editing) { const next = JSON.stringify([model.scene.studio,
      model.scene.wardrobes.map(c => [c.id,
      c.x,
      c.z,
      c.angle,
      c.state.w,
      c.state.d]),
      model.scene.activeWardrobe,
      p.selection.room,
      view.clientWidth,
      view.clientHeight,
      lengthText(100)]);
      if (key !== next) { key = next;
      render();
      } }
    lifetime.frame(frame);
  }
  lifetime.frame(frame); lifetime.cleanup(() => { disposed = true; if (drag?.moved && drag.hit) model.restore(drag.before); root.remove(); button.remove(); delete app.dataset.floorPlan; app.classList.remove('floor-plan-open'); });
  return { close: () => toggle(false) };
}
