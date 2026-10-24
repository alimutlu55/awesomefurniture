import { addPoint, findPoint, flipProfile, healProfile, movePoint, profileProblem, removePoint, slideEdge, stepEdge, translateProfile, PROFILE,
  type ProfileVertex, type Vec } from '../../domain/geometry/profile-polygon';
import { primaryView, profileMessage, setSurfaceDepth, surfaceProfile, withSurfaceProfile, type SurfaceProfile, type SurfaceRef, type SurfaceView } from '../../domain/studio/surface-profile';
import { outerEdgeHeight, setOuterEdgeHeight } from '../../domain/studio/ceiling-edge';
import { STUDIO_LIMITS } from '../../domain/studio/studio';
import { drawingBox, drawingMarkup, type ShapeGuide, type ShapePick } from './surface-shape-drawing';
import { hitShape, snapCorner, snapMove, snapSlide, SHAPE_PX } from './surface-shape-snap';
import { applyShapeField, shapeFields } from './surface-shape-fields';
import { neighbourPoints } from './studio-align';
import { createShapeSession } from './surface-shape-session';
import { createDrawingZoom } from './surface-shape-zoom';
import { esc, measureNumber, unitSuffix } from './editor-format.js';
import type { SurfaceShapeEditorPorts } from './surface-shape-editor.ports';

type Hit = NonNullable<ShapePick> | { kind: 'body' };
interface Drag {
  pointer: number; hit: Hit; start: Vec; client: Vec; profile: SurfaceProfile; box: ReturnType<typeof drawingBox>;
  last: ProfileVertex[]; moved: boolean; merge: number | undefined; edge: number; badge: string; problem: string | null;
}
const len = (v: number) => measureNumber(Math.round(v * 10) / 10) + unitSuffix();
const HINT = 'Drag a corner or an edge. Tap an edge for a step or a new corner. Pinch or scroll to zoom.';

/** The Shape editor: a wall or a ceiling shape drawn from the front or from the side, edited by its corners and
 * edges; the solid is what both sides allow. A drag previews live in the room and takes one undo step when it ends;
 * a second finger, Escape or a cancelled pointer puts it back (two fingers then pinch the drawing). Exact sizes are
 * typed below the drawing. */
export function createSurfaceShapeEditor({ document, model, sceneCommands, history, listen, callbacks }: SurfaceShapeEditorPorts) {
  const root = document.createElement('div');
  root.className = 'surface-shape';
  root.setAttribute('data-sheet-scroll', '');
  root.innerHTML = `<p class="surface-shape-hint">${HINT}</p>`
    // Front, Side and Fit sit on the drawing itself, so they take no room from the panel.
    + `<div class="surface-shape-stage"><div class="surface-shape-views" role="group" aria-label="Seen from"><button type="button" data-shape-view="front" aria-pressed="true">Front</button>`
    + `<button type="button" data-shape-view="side" aria-pressed="false">Side</button><button type="button" data-shape-act="fit" class="surface-shape-fit">Fit</button></div>`
    + `<svg class="surface-shape-svg" tabindex="0" role="application" preserveAspectRatio="xMidYMid meet" `
    + `aria-label="Shape drawing. Drag corners and edges; arrow keys move what is picked"></svg>`
    + `<div class="surface-shape-pill" role="toolbar" aria-label="Edit what is picked" hidden></div><div class="surface-shape-badge" role="status" hidden></div></div>`
    + `<button type="button" class="surface-shape-adjustments" data-shape-act="adjustments">Manual adjustments <span aria-hidden="true">↓</span></button>`
    + `<div class="surface-shape-fields" role="group" aria-label="Manual adjustments"></div><div class="surface-shape-actions"><button type="button" data-shape-act="undo" aria-label="Undo">Undo</button>`
    + `<button type="button" data-shape-act="redo" aria-label="Redo">Redo</button><button type="button" data-shape-act="flip">Flip</button>`
    + `<button type="button" data-shape-act="reset">Full wall</button></div>`;
  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const svg = $<SVGSVGElement>('svg'), stage = $<HTMLElement>('.surface-shape-stage'), pill = $<HTMLElement>('.surface-shape-pill');
  const badge = $<HTMLElement>('.surface-shape-badge'), fieldsRoot = $<HTMLElement>('.surface-shape-fields');
  let ref: SurfaceRef | null = null, view: SurfaceView | null = null, pick: ShapePick = null, drag: Drag | null = null, guides: ShapeGuide[] = [];
  const session = createShapeSession({ model, sceneCommands, history, callbacks }), zoom = createDrawingZoom();
  /** Pointers down on the drawing, for a pinch. */
  const pointers = new Map<number, Vec>();
  /** Set when a part or a side opens: its first drawing checks whether it needs zooming in. */
  let fitNext = false;
  /** The + Step | + Point pill (or Remove corner) shows right after a tap picks something, and goes once it is used
   * or the next drag starts. What stays picked keeps its sizes in the fields below. */
  let tools = false;

  const room = () => model.scene.studio;
  const neighbours = (s: SurfaceProfile) => {
    const studio = room();
    return studio ? neighbourPoints(studio, s, model.scene.wardrobes.map(f => ({ x: f.x, z: f.z, angle: f.angle, w: f.state.w, d: f.state.d, h: f.state.h }))) : [];
  };
  /** The view on show: the one chosen, else the part's main one. */
  const current = (): SurfaceView | undefined => view ?? undefined;
  const profile = () => { const r = room(); return r && ref ? surfaceProfile(r, ref, current()) : null; };
  /** Centimetres per CSS pixel of the drawing, and a pointer's place in centimetres (y up). */
  const scale = () => { const m = svg.getScreenCTM(); return m && m.a > 0 ? 1 / m.a : 1; };
  const toCm = (e: { clientX: number; clientY: number }): Vec => {
    const m = svg.getScreenCTM(), p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m ? m.inverse() : undefined);
    return { x: p.x, y: -p.y };
  };
  const toScreen = (p: Vec) => { const m = svg.getScreenCTM(), s = stage.getBoundingClientRect(), q = new DOMPoint(p.x, -p.y).matrixTransform(m ?? undefined); return { x: q.x - s.left, y: q.y - s.top }; };

  function render() {
    const s = profile();
    root.hidden = !s;
    // Drawn once it is in the panel: until then it has no size to draw at.
    if (!s || !root.isConnected) return;
    const points = drag?.last ?? s.points, box = drag?.box ?? clearTop(zoom.view(drawingBox(s, points)));
    svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
    svg.style.aspectRatio = `${box.w} / ${box.h}`;
    svg.innerHTML = drawingMarkup({ profile: s, points, pick: drag ? (drag.hit.kind === 'body' ? null : { kind: drag.hit.kind, index: drag.hit.kind === 'edge' ? drag.edge : drag.hit.index }) : pick,
      guides, px: scale(), problem: !!drag?.problem, box });
    renderViews(s);
    root.querySelector<HTMLElement>('[data-shape-act="reset"]')!.hidden = s.ref.kind !== 'wall';
    renderPill(points);
    renderBadge();
    renderFields(s, points);
    if (fitNext && !drag) { fitNext = false; focusNarrow(s); }
  }
  /** A part narrower on screen than a fingertip's reach (a wall's 12 cm cross-section) opens zoomed on its top,
   * where it is usually shaped; Fit shows it whole. */
  function focusNarrow(s: SurfaceProfile) {
    const px = scale(), xs = s.points.map(p => p.x), ys = s.points.map(p => p.y), wide = (Math.max(...xs) - Math.min(...xs)) / px;
    if (!(wide > 0) || wide >= 72) return;
    const factor = 72 / wide, box = drawingBox(s, s.points), shown = box.h / factor;
    zoom.frame({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: -Math.max(...ys) + shown * .35 }, factor);
    render();
  }
  /** The drawing's frame with its top strip kept clear for the Front | Side switch over it: the frame grows upward
   * (and as much sideways) so the drawing keeps its size on screen and nothing in it sits under the switch. */
  function clearTop(box: ReturnType<typeof drawingBox>) {
    const W = svg.clientWidth || stage.clientWidth, cap = parseFloat(getComputedStyle(svg).maxHeight);
    if (!(W > 0)) return box;
    const H = Math.min(W * box.h / box.w, Number.isFinite(cap) ? cap : Infinity), clear = 46;
    if (!(H > clear * 2)) return box;
    const h = box.h / (1 - clear / H), w = box.w * h / box.h;
    return { x: box.x - (w - box.w) / 2, y: box.y - (h - box.h), w, h };
  }
  /** Front and Side, both always open: a lifted outer edge shows from the side as the slope of its underside. */
  function renderViews(s: SurfaceProfile) {
    root.querySelectorAll<HTMLButtonElement>('[data-shape-view]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.shapeView === s.view));
      b.title = b.dataset.shapeView === 'side' ? 'Seen from the side' : 'Seen face on from the room';
    });
    root.querySelector<HTMLElement>('[data-shape-act="fit"]')!.hidden = !zoom.zoomed();
    root.querySelector<HTMLElement>('[data-shape-act="reset"]')!.textContent = s.primary ? 'Full wall' : 'Plain side';
  }
  function renderPill(points: readonly ProfileVertex[]) {
    const p = !drag && tools && pick && points[pick.index] ? pick : null;
    pill.hidden = !p;
    if (!p) return;
    const a = points[p.index]!, b = p.kind === 'edge' ? points[(p.index + 1) % points.length]! : a;
    pill.innerHTML = p.kind === 'edge' ? '<button type="button" data-shape-act="step">+ Step</button><button type="button" data-shape-act="point">+ Point</button>'
      : `<button type="button" data-shape-act="remove"${points.length <= 3 ? ' disabled' : ''}>Remove corner</button>`;
    const at = toScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    // Outside the edge, or outside the corner between its two edges, so it never covers another edge. Screen y
    // runs down, so the normal's y flips.
    const out = (q: ProfileVertex, r: ProfileVertex) => { const l = Math.hypot(r.x - q.x, r.y - q.y) || 1; return { x: (r.y - q.y) / l, y: (r.x - q.x) / l }; };
    const prev = points[(p.index - 1 + points.length) % points.length]!, n1 = out(prev, a), n2 = out(a, points[(p.index + 1) % points.length]!);
    const bisector = { x: n1.x + n2.x, y: n1.y + n2.y }, bl = Math.hypot(bisector.x, bisector.y);
    const normal = p.kind === 'edge' ? out(a, b) : bl > 1e-6 ? { x: bisector.x / bl, y: bisector.y / bl } : n2;
    // Far enough that the pill's own width and height clear the edge whichever way the normal points.
    const w = stage.clientWidth, h = stage.clientHeight, half = pill.offsetWidth / 2 || 60, gap = 34 + Math.abs(normal.x) * half + Math.abs(normal.y) * 20;
    const outside = { x: at.x + normal.x * gap, y: at.y + normal.y * gap };
    // Turned inward only when the outward side is beyond the drawing; near its sides it is kept in by clamping.
    const beyond = (q: { x: number; y: number }) => q.x < -half / 2 || q.x > w + half / 2 || q.y < 0 || q.y > h;
    const place = beyond(outside) ? { x: at.x - normal.x * gap, y: at.y - normal.y * gap } : outside;
    pill.style.left = Math.max(half + 4, Math.min(w - half - 4, place.x)) + 'px';
    // Below the Front | Side switch at the drawing's top.
    pill.style.top = Math.max(60, Math.min(h - 18, place.y)) + 'px';
  }
  function renderBadge() {
    badge.hidden = !drag?.moved;
    if (!drag?.moved) return;
    badge.textContent = drag.problem ?? drag.badge;
    badge.classList.toggle('problem', !!drag.problem);
  }
  function placeBadge(e: PointerEvent) {
    const s = stage.getBoundingClientRect(), x = e.clientX - s.left, y = e.clientY - s.top, half = badge.offsetWidth / 2 || 50;
    badge.style.left = Math.max(half + 4, Math.min(s.width - half - 4, x)) + 'px';
    // Above the finger, or below it near the top so the finger never covers it.
    badge.style.top = (y < 70 ? y + 55 : y - 45) + 'px';
  }
  function renderFields(s: SurfaceProfile, points: readonly ProfileVertex[]) {
    // A ceiling hung along its wall can lift its outer edge; one standing on the floor cannot.
    const c = s.ref.kind === 'ceiling' ? room()?.ceilings?.find(x => x.id === s.ref.id) : undefined;
    const outer = c && c.run === 'along' && s.primary && !c.section && Math.min(...points.map(p => p.y)) >= STUDIO_LIMITS.minCeilingHeight ? outerEdgeHeight(c) : undefined;
    const list = shapeFields(s, points, pick, outer), active = document.activeElement ?? root.ownerDocument.activeElement;
    const markup = list.map(f => `<label class="surface-shape-field"><span>${esc(f.label)}</span><span class="size-field">`
      + `<input type="number" inputmode="decimal" step="0.1" data-shape-field="${f.key}"><small>${f.unit ?? 'cm'}</small></span></label>`).join('');
    // Rebuilt when the fields change, or only their names (another side of the same part).
    const signature = list.map(f => f.key + ':' + f.label).join();
    if (fieldsRoot.dataset.keys !== signature) { fieldsRoot.innerHTML = markup; fieldsRoot.dataset.keys = signature; }
    for (const f of list) {
      const input = fieldsRoot.querySelector<HTMLInputElement>(`[data-shape-field="${f.key}"]`);
      if (input && input !== active && input !== (root.getRootNode() as Document | ShadowRoot).activeElement) input.value = String(Math.round(f.value * 10) / 10);
    }
  }

  /** Writes a profile to the room, healed, as one undo step; keeps what was picked where it moved to. */
  function commit(points: readonly ProfileVertex[], next: ShapePick = pick) {
    const s = profile();
    if (!s || !ref) return false;
    const healed = healProfile(points), at = next && points[next.index], target = ref, side = s.view;
    if (!sceneCommands.editStudio(r => withSurfaceProfile(r, target, healed, side))) return false;
    pick = next && at ? (() => { const index = findPoint(healed, at); return index >= 0 ? { kind: next.kind, index } : null; })() : null;
    sceneCommands.followCeilings(true);
    callbacks.refresh();
    return true;
  }
  function act(key: string) {
    const s = profile();
    if (!s || !ref) return;
    tools = false;
    const points = s.points, edge = pick?.kind === 'edge' ? pick.index : -1;
    if (key === 'step' && edge >= 0) {
      const r = stepEdge(points, edge, s.bounds);
      if (!r) callbacks.report('This edge has no room for a step. Make it at least ' + len(2 * PROFILE.minEdge) + ' long.');
      else commit(r.points, { kind: 'edge', index: r.edge });
    } else if (key === 'point' && edge >= 0) {
      const r = addPoint(points, edge);
      if (!r) callbacks.report('This edge is too short for another corner.');
      else commit(r.points, { kind: 'vertex', index: r.index });
    } else if (key === 'remove' && pick?.kind === 'vertex') {
      const r = removePoint(points, pick.index, s.bounds);
      if (!r) callbacks.report('Removing this corner would break the shape. Move it first.');
      else commit(r, null);
    } else if (key === 'fit') {
      zoom.reset(); render();
    } else if (key === 'undo' || key === 'redo') {
      pick = null;
      callbacks.history(key);
    } else if (key === 'flip') {
      commit(flipProfile(points), null);
    } else if (key === 'reset' && s.ref.kind === 'wall') {
      // Back to a plain wall at its full height.
      const box = s.bounds, top = s.wall.height;
      commit([{ x: box.minX, y: 0 }, { x: box.maxX, y: 0 }, { x: box.maxX, y: top }, { x: box.minX, y: top }], null);
    }
  }

  // Dragging.
  const spread = () => { const [a, b] = [...pointers.values()]; return a && b ? { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(b.x - a.x, b.y - a.y) } : null; };
  function down(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const two = pointers.size === 2 ? spread() : null;
    if (two) {
      // A second finger: put a drag back as it was, and pinch the drawing instead.
      if (drag) cancel();
      zoom.begin('pinch', two.mid, two.distance, scale());
      try { svg.setPointerCapture(e.pointerId); } catch { /* the pinch follows the drawing's events */ }
      e.preventDefault();
      return;
    }
    if (drag) { if (e.pointerId !== drag.pointer) cancel(); return; }
    const s = profile();
    if (!s || e.button > 0) return;
    tools = false;
    const at = toCm(e), hit = hitShape(s.points, at, scale());
    if (!hit) {
      // Zoomed in, the empty drawing pans; otherwise a tap there lets go of what was picked.
      if (zoom.zoomed()) { zoom.begin('pan', { x: e.clientX, y: e.clientY }, 0, scale()); try { svg.setPointerCapture(e.pointerId); } catch { /* as above */ } e.preventDefault(); return; }
      pick = null; render(); return;
    }
    e.preventDefault();
    svg.focus({ preventScroll: true });
    const h: Hit = hit === 'body' ? { kind: 'body' } : hit;
    if (!ref || !session.begin(ref, s.view)) return;
    drag = { pointer: e.pointerId, hit: h, start: at, client: { x: e.clientX, y: e.clientY }, profile: s, box: clearTop(zoom.view(drawingBox(s, s.points))),
      last: s.points, moved: false, merge: undefined, edge: h.kind === 'edge' ? h.index : -1, badge: '', problem: null };
    try { svg.setPointerCapture(e.pointerId); } catch { /* the drag still follows the stage's events */ }
  }
  function move(e: PointerEvent) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (zoom.active()) {
      const two = spread();
      if (two) zoom.follow(two.mid, two.distance); else zoom.follow({ x: e.clientX, y: e.clientY }, 0);
      render();
      return;
    }
    const g = drag;
    if (!g || e.pointerId !== g.pointer || !ref) return;
    if (!g.moved && Math.hypot(e.clientX - g.client.x, e.clientY - g.client.y) < SHAPE_PX.tap) return;
    g.moved = true;
    const s = g.profile, px = scale(), at = toCm(e), grid = e.shiftKey ? PROFILE.typedGrid : PROFILE.dragGrid, roomLevels = { ...s.context, points: neighbours(s) };
    let next: ProfileVertex[] | null = null, raw: ProfileVertex[] = g.last;
    g.merge = undefined;
    if (g.hit.kind === 'vertex') {
      const index = g.hit.index, p = s.points[index]!, snapped = snapCorner(s.points, index, { x: p.x + at.x - g.start.x, y: p.y + at.y - g.start.y }, s.bounds, roomLevels, px, grid);
      guides = snapped.guides;
      raw = s.points.map((q, k) => k === index ? { ...q, ...snapped.at } : q);
      // Dropped onto a neighbour: the two corners become one.
      if (snapped.merge !== undefined) { next = removePoint(s.points, index, s.bounds); g.merge = snapped.merge; }
      else next = movePoint(s.points, index, snapped.at, s.bounds);
      g.badge = len(snapped.at.x - s.origin) + ' · ' + len(snapped.at.y) + ' high';
    } else if (g.hit.kind === 'edge') {
      const a = s.points[g.hit.index]!, b = s.points[(g.hit.index + 1) % s.points.length]!, l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const normal = { x: (b.y - a.y) / l, y: -(b.x - a.x) / l }, wanted = (at.x - g.start.x) * normal.x + (at.y - g.start.y) * normal.y;
      const snapped = snapSlide(s.points, g.hit.index, wanted, s.bounds, roomLevels, px, grid), r = slideEdge(s.points, g.hit.index, snapped.d, s.bounds);
      guides = snapped.guides; next = r.points; g.edge = r.edge;
      const level = Math.abs(normal.y) > .999, upright = Math.abs(normal.x) > .999;
      g.badge = level ? len(a.y + r.applied * normal.y) + ' high' : upright ? len(a.x + r.applied * normal.x - s.origin) + (s.view === 'side' ? ' from the wall' : ' from the left')
        : (r.applied >= 0 ? 'Out ' : 'In ') + len(Math.abs(r.applied));
    } else {
      const snapped = snapMove(s.points, at.x - g.start.x, at.y - g.start.y, s.bounds, roomLevels, px, grid);
      next = translateProfile(s.points, snapped.dx, snapped.dy, s.bounds); guides = [];
      const xs = next.map(p => p.x), ys = next.map(p => p.y);
      g.badge = len(Math.min(...xs) - s.origin) + (s.view === 'side' ? ' from the wall · ' : ' from the left · ') + len(Math.min(...ys)) + ' up';
    }
    const problem = next ? null : profileProblem(raw, s.bounds);
    g.problem = problem ? profileMessage(problem) : null;
    if (next && JSON.stringify(next) !== JSON.stringify(g.last)) {
      if (session.preview(next)) g.last = next;
      else g.problem = 'A wardrobe or wall is in the way here.';
    }
    render();
    placeBadge(e);
  }
  function up(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (zoom.active()) { if (pointers.size === 0) zoom.end(); render(); return; }
    const g = drag;
    if (!g || e.pointerId !== g.pointer) return;
    drag = null; guides = [];
    try { if (svg.hasPointerCapture(g.pointer)) svg.releasePointerCapture(g.pointer); } catch { /* released already */ }
    const keep: ShapePick = g.hit.kind === 'vertex' ? (g.merge !== undefined ? null : g.hit) : g.hit.kind === 'edge' ? { kind: 'edge', index: g.edge } : null;
    const at = keep && g.last[keep.index];
    if (!g.moved) { session.drop(); pick = g.hit.kind === 'body' ? null : g.hit; tools = !!pick; render(); return; }
    // Picked first: ending the drag redraws the panel with what stays picked.
    const index = at ? findPoint(healProfile(g.last), at) : -1;
    pick = keep && index >= 0 ? { kind: keep.kind, index } : null;
    session.end();
  }
  /** Shows the other side: what was picked and the zoom start afresh; the room turns to face it. */
  function turn(next: SurfaceView) {
    const r = room();
    if (!r || !ref || profile()?.view === next) return;
    cancel();
    view = next === primaryView(r, ref) ? null : next;
    pick = null; tools = false; zoom.reset(); fitNext = true;
    render();
    callbacks.viewChanged();
  }
  function cancel() {
    const g = drag;
    if (!g) return;
    drag = null; guides = [];
    try { if (svg.hasPointerCapture(g.pointer)) svg.releasePointerCapture(g.pointer); } catch { /* released already */ }
    session.cancel();
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') { if (drag) cancel(); else if (pick) { pick = null; render(); } else return; }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && pick?.kind === 'vertex') act('remove');
    else if (e.key.startsWith('Arrow') && pick && !drag) nudge(e.key, e.shiftKey ? 10 : 1);
    else return;
    e.preventDefault(); e.stopPropagation();
  }
  function nudge(key: string, step: number) {
    const s = profile();
    if (!s || !pick) return;
    const dx = key === 'ArrowRight' ? step : key === 'ArrowLeft' ? -step : 0, dy = key === 'ArrowUp' ? step : key === 'ArrowDown' ? -step : 0, p = s.points[pick.index]!;
    if (pick.kind === 'vertex') { const r = movePoint(s.points, pick.index, { x: p.x + dx, y: p.y + dy }, s.bounds); if (r) commit(r); return; }
    const b = s.points[(pick.index + 1) % s.points.length]!, l = Math.hypot(b.x - p.x, b.y - p.y) || 1;
    const r = slideEdge(s.points, pick.index, dx * (b.y - p.y) / l - dy * (b.x - p.x) / l, s.bounds);
    if (r.applied) commit(r.points, { kind: 'edge', index: r.edge });
  }

  listen(svg, 'pointerdown', e => down(e as PointerEvent));
  listen(svg, 'pointermove', e => move(e as PointerEvent));
  listen(svg, 'pointerup', e => up(e as PointerEvent));
  listen(svg, 'pointercancel', e => { pointers.delete((e as PointerEvent).pointerId); zoom.end(); cancel(); });
  listen(svg, 'wheel', e => {
    const w = e as WheelEvent, m = svg.getScreenCTM();
    if (!m || !profile()) return;
    w.preventDefault();
    zoom.wheel(new DOMPoint(w.clientX, w.clientY).matrixTransform(m.inverse()), w.deltaY);
    render();
  }, { passive: false });
  listen(svg, 'lostpointercapture', e => { if (drag && (e as PointerEvent).pointerId === drag.pointer) cancel(); });
  listen(svg, 'keydown', e => key(e as KeyboardEvent));
  listen(root, 'click', e => {
    const button = (e.target as Element).closest<HTMLButtonElement>('[data-shape-act],[data-shape-view]');
    if (!button || button.disabled) return;
    if (button.dataset.shapeView) { turn(button.dataset.shapeView as SurfaceView); return; }
    if (button.dataset.shapeAct === 'adjustments') { fieldsRoot.scrollIntoView({ block: 'start', behavior: 'instant' }); return; }
    if (button.dataset.shapeAct) act(button.dataset.shapeAct);
  });
  listen(fieldsRoot, 'change', e => {
    const input = e.target as HTMLInputElement, keyName = input.dataset.shapeField, s = profile();
    if (!keyName || !s || !ref) return;
    const value = input.valueAsNumber, target = ref;
    if (keyName === 'depth' || keyName === 'outer') {
      const edit = (r: NonNullable<ReturnType<typeof room>>) => keyName === 'depth' ? setSurfaceDepth(r, target, value) : setOuterEdgeHeight(r, target.id, value);
      if (sceneCommands.editStudio(edit)) { sceneCommands.followCeilings(true); callbacks.refresh(); }
      else render();
      return;
    }
    const next = applyShapeField(s, s.points, pick, keyName, value);
    if (!next || !commit(next)) { callbacks.report('That size does not fit here. Try a smaller change.'); render(); }
  });
  listen(fieldsRoot, 'keydown', e => { if ((e as KeyboardEvent).key === 'Enter') (e.target as HTMLInputElement).blur?.(); });

  return {
    root,
    /** Shows a wall or a ceiling shape; the same one keeps what was picked. */
    open(next: SurfaceRef) { if (!ref || ref.kind !== next.kind || ref.id !== next.id) { pick = null; tools = false; view = null; zoom.reset(); fitNext = true; } ref = next; render(); },
    close() { cancel(); ref = null; pick = null; tools = false; view = null; zoom.reset(); },
    /** Which side is on show. */
    view: (): SurfaceView | null => profile()?.view ?? null,
    render,
    active: () => ref,
    dragging: () => drag !== null,
    /** For checks and the agent guide: the shape as the editor holds it. */
    points: () => profile()?.points ?? [],
  };
}
export type SurfaceShapeEditor = ReturnType<typeof createSurfaceShapeEditor>;
