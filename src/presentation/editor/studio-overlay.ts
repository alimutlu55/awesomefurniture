import { Vector3 } from 'three';
import { cornerDegree, wallLine } from '../../domain/studio/studio';
import type { Studio } from '../../domain/studio/studio';
import type { StudioEditorPorts } from './studio-editor.ports';
import type { GroundPoint, Guide, RoomSelection } from './studio-drag';

type Handle = RoomSelection | { kind: 'extend'; id: string };
interface OverlayOptions extends Pick<StudioEditorPorts, 'dom' | 'picking' | 'rendering'> {
  root: HTMLElement;
  getState(): { room: Studio | undefined; selected: RoomSelection | null; active: boolean; guides: Guide[]; reason: string };
}
/** Pooled shape handles retain pointer capture during live rebuilds. Room rulers reuse the
 * wardrobe ruler's screen placement, and only the selection has text to avoid collisions. */
export function createStudioOverlay({ dom, picking, rendering, root, getState }: OverlayOptions) {
  const pool = new Map<string, HTMLButtonElement>();
  const svg = dom.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('room-lines');
  const label = dom.document.createElement('span'), reason = dom.document.createElement('span');
  label.className = 'room-measure'; reason.className = 'room-reason';
  reason.setAttribute('role', 'status');
  root.append(svg, label, reason);
  const project = (p: GroundPoint) => picking.screenPoint(new Vector3(p.x, 2, p.z));
  const linePath = (a: { x: number; y: number }, b: { x: number; y: number }) => `M${a.x},${a.y}L${b.x},${b.y}`;
  function handle(h: Handle, point: GroundPoint, name: string, text = '', offset = { x: 0, y: 0 }) {
    const key = h.kind + ':' + h.id;
    let el = pool.get(key);
    if (!el) {
      el = dom.document.createElement('button'); el.type = 'button';
      el.className = 'lbl shape-handle room-handle ' + (h.kind === 'corner' ? 'point' : 'split-handle');
      el.dataset.roomKind = h.kind; el.dataset.roomId = h.id;
      pool.set(key, el); root.append(el);
    }
    el.hidden = false; el.textContent = text;
    el.setAttribute('aria-label', name); el.title = name;
    el.classList.toggle('selected', getState().selected?.id === h.id && getState().selected?.kind === h.kind);
    const p = project(point); el.style.left = (p.x + offset.x) + 'px'; el.style.top = (p.y + offset.y) + 'px';
  }
  function frame() {
    const { room, selected, active, guides, reason: why } = getState();
    root.hidden = !active || !room;
    if (root.hidden || !room) return;
    for (const el of pool.values()) el.hidden = true;
    const paths: string[] = [];
    let measure: { a: GroundPoint; b: GroundPoint; text: string } | null = null;
    for (const [i, w] of room.walls.entries()) {
      const l = wallLine(room, w); if (!l) continue;
      const mid = { x: (l.a.x + l.b.x) / 2, z: (l.a.z + l.b.z) / 2 };
      const on = selected?.kind === 'wall' && selected.id === w.id;
      paths.push(`<path class="${on ? 'selected' : ''}" d="${linePath(project(l.a), project(l.b))}"/>`);
      // Screen-space spacing keeps touch targets clear of door/window grips at any zoom.
      const a = project(mid), inside = project({ x: mid.x + l.nx * 20, z: mid.z + l.nz * 20 });
      const distance = Math.hypot(inside.x - a.x, inside.y - a.y) || 1;
      const offset = { x: (inside.x - a.x) / distance * 46, y: (inside.y - a.y) / distance * 46 };
      handle({ kind: 'wall', id: w.id }, mid, `Wall ${i + 1}: ${Math.round(l.length)} cm`, '↔', offset);
      if (on || (selected?.kind === 'corner' && (w.a === selected.id || w.b === selected.id) && !measure)) {
        measure = { a: { x: l.a.x - l.nx * 36, z: l.a.z - l.nz * 36 },
          b: { x: l.b.x - l.nx * 36, z: l.b.z - l.nz * 36 }, text: Math.round(l.length * 10) / 10 + ' cm' };
      }
    }
    for (const [i, c] of room.corners.entries()) {
      handle({ kind: 'corner', id: c.id }, c, `Room corner ${i + 1}`);
      if (cornerDegree(room, c.id) === 1) {
        const w = room.walls.find(w => w.a === c.id || w.b === c.id)!;
        const l = wallLine(room, w)!; const sign = w.b === c.id ? 1 : -1;
        handle({ kind: 'extend', id: c.id }, { x: c.x + l.ux * 32 * sign, z: c.z + l.uz * 32 * sign }, 'Extend wall from corner ' + (i + 1), '+');
      }
    }
    for (const [i, o] of room.openings.entries()) {
      const w = room.walls.find(w => w.id === o.wall)!, l = wallLine(room, w)!;
      const at = (offset: number) => ({ x: l.a.x + l.ux * offset, z: l.a.z + l.uz * offset });
      handle({ kind: 'opening', id: o.id }, at(o.offset), `${o.kind} ${i + 1}: ${o.width} cm`, o.kind === 'window' ? '▤' : '▯');
      if (selected?.kind === 'opening' && selected.id === o.id) {
        measure = { a: at(o.offset - o.width / 2), b: at(o.offset + o.width / 2), text: o.width + ' cm' };
      }
    }
    for (const g of guides) paths.push(`<path class="guide" d="${linePath(project(g.a), project(g.b))}"/>`);
    label.hidden = !measure;
    if (measure) {
      const a = project(measure.a), b = project(measure.b), rect = root.getBoundingClientRect();
      const q = rendering.rulerScreenPlacement(a, b, 'width', 90, 18, { left: 20, right: rect.width - 20, bottom: rect.height - 90 });
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / len * 4, ny = (b.x - a.x) / len * 4;
      const ticks = linePath({ x: a.x - nx, y: a.y - ny }, { x: a.x + nx, y: a.y + ny })
        + linePath({ x: b.x - nx, y: b.y - ny }, { x: b.x + nx, y: b.y + ny });
      paths.push(`<path class="ruler" d="${linePath(a, b) + ticks}"/>`);
      label.textContent = measure.text; label.style.left = q.x + 'px'; label.style.top = q.y + 'px';
      reason.style.left = Math.max(120, Math.min(rect.width - 120, q.x)) + 'px'; reason.style.top = (q.y + 28) + 'px';
    }
    reason.hidden = !why; reason.textContent = why;
    svg.innerHTML = paths.join('');
    // Deleted topology must not leave a growing pool of detached handles.
    for (const [key, el] of pool) if (el.hidden && !el.hasPointerCapture(Number(el.dataset.pointer))) { el.remove(); pool.delete(key); }
  }
  return { frame };
}
