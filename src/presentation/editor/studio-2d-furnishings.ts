import type { Studio, StudioFurnishing } from '../../domain/studio/studio';
import type { CabinetData } from '../../domain/pieces/pieces';
import { furnishingKind } from '../../domain/studio/furnishings/furnishing-kinds';
import { moveFurnishing } from '../../domain/studio/furnishings/furnishing-edit';
import type { RoomSelection } from '../viewport/studio-renderer';
import { createTransform, type Point2D, type ViewportTransform } from './studio-2d-canvas';
import { furnishingPiece, roomOf } from '../../domain/pieces/pieces';
import type { PieceTarget } from '../../domain/pieces/piece-model';
import type { Guide } from './studio-drag';
import { esc } from './editor-format.js';

/** A furnishing's plan symbol in its own frame (x across, y from its back at -d/2 to its front), as an architect draws it. */
function symbol(f: StudioFurnishing): string {
  const w = f.width, d = f.depth, x0 = -w / 2, y0 = -d / 2, line = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  if (f.kind === 'rug') return `<rect class="sp2d-rug" x="${x0}" y="${y0}" width="${w}" height="${d}" rx="2"/><rect class="sp2d-rug" x="${x0 + 8}" y="${y0 + 8}" width="${w - 16}" height="${d - 16}"/>`;
  const body = `<rect x="${x0}" y="${y0}" width="${w}" height="${d}" rx="${Math.min(4, w / 8)}"/>`;
  if (f.kind === 'bed') {
    const pw = w > 110 ? (w - 22) / 2 : w - 24, pillows = w > 110 ? [-pw - 3, 3] : [-pw / 2];
    return body + line(x0, y0 + 8, -x0, y0 + 8) + pillows.map(px => `<rect x="${px}" y="${y0 + 12}" width="${pw}" height="${34}" rx="6"/>`).join('')
      + line(x0, d / 2 - d * .62, -x0, d / 2 - d * .62) + line(x0 + 4, d / 2 - d * .62 + 6, -x0 - 4, d / 2 - d * .62 + 6);
  }
  if (f.kind === 'desk') return body + `<rect x="-22" y="${d / 2 - 33}" width="44" height="42" rx="8"/>` + line(-21, d / 2 + 6, 21, d / 2 + 6);
  if (f.kind === 'armchair') return body + line(x0, y0 + 18, -x0, y0 + 18) + line(x0 + 13, y0 + 18, x0 + 13, d / 2) + line(-x0 - 13, y0 + 18, -x0 - 13, d / 2);
  return body + `<circle cx="0" cy="0" r="${Math.min(w, d) / 4}"/>`;
}

/** Furnishings on the plan: rugs first (under everything), each a footprint with its symbol, the selected one in blue. */
export function renderFurnishings(studio: Studio, selection: RoomSelection): string {
  const list = [...studio.furnishings ?? []].sort((a, b) => Number(b.kind === 'rug') - Number(a.kind === 'rug'));
  return list.map(f => {
    const on = selection?.kind === 'furnishing' && selection.id === f.id;
    return `<g class="sp2d-furnishing${on ? ' selected' : ''}" data-furnishing-id="${esc(f.id)}" transform="translate(${f.x},${f.z}) rotate(${-f.angle})">`
      + `<title>${esc(furnishingKind(f.kind)?.name ?? 'Furniture')}</title>${symbol(f)}</g>`;
  }).join('');
}

interface PlanFurnishingPorts {
  readonly model: { scene: { studio?: Studio | undefined; wardrobes: readonly CabinetData[] }; snapshot(): string; restore(snapshot: string): void };
  readonly sceneCommands: { furnishingProblem(next: Studio, id: string): string | null };
  readonly history: { checkpoint(snapshot: string): void };
  transform(): ViewportTransform;
  selection(): RoomSelection;
  select(next: RoomSelection): void;
  refresh(): void;
}

/** Dragging a furnishing on the plan by its footprint, with the same rule as on the model: flush and lined up against a
 * wall it comes near, as far as the room allows, one undo step. Shift moves freely; a tap only selects it. */
export function createPlanFurnishings(ports: PlanFurnishingPorts) {
  let drag: { id: string; pointer: number; start: Point2D; client: Point2D; original: Studio; snapshot: string; moved: boolean; lock: PieceTarget | null; guides: Guide[] } | null = null;
  const point = (e: PointerEvent, svg: Element) => {
    const r = svg.getBoundingClientRect();
    return createTransform(ports.transform()).toScene(e.clientX - r.left, e.clientY - r.top);
  };
  function finish(cancel = false) {
    const g = drag;
    if (!g) return false;
    drag = null;
    if (cancel && g.moved) ports.model.restore(g.snapshot);
    else if (g.moved && JSON.stringify(ports.model.scene.studio) !== JSON.stringify(g.original)) ports.history.checkpoint(g.snapshot);
    ports.refresh();
    return true;
  }
  return {
    active: () => !!drag,
    guides: () => drag?.guides ?? [],
    down(e: PointerEvent, svg: Element) {
      const el = (e.target as Element).closest('[data-furnishing-id]'), studio = ports.model.scene.studio, id = el?.getAttribute('data-furnishing-id');
      if (!el || !id || e.button !== 0 || !studio?.furnishings?.some(f => f.id === id)) return false;
      if (ports.selection()?.kind !== 'furnishing' || ports.selection()!.id !== id) ports.select({ kind: 'furnishing', id });
      drag = { id, pointer: e.pointerId, start: point(e, svg), client: { x: e.clientX, z: e.clientY }, original: studio, snapshot: ports.model.snapshot(), moved: false, lock: null, guides: [] };
      ports.refresh();
      return true;
    },
    move(e: PointerEvent, svg: Element) {
      const g = drag;
      if (!g || e.pointerId !== g.pointer) return;
      if (!g.moved && Math.hypot(e.clientX - g.client.x, e.clientY - g.client.z) < 4) return;
      g.moved = true;
      const f = g.original.furnishings!.find(x => x.id === g.id)!, p = point(e, svg);
      const now = ports.model.scene.studio?.furnishings?.find(x => x.id === g.id) ?? f;
      const result = furnishingPiece(f).move(roomOf(g.original, ports.model.scene.wardrobes), {
        x: f.x + p.x - g.start.x, z: f.z + p.z - g.start.z, angle: f.angle,
      }, { lock: g.lock, free: e.shiftKey, from: now, tolerance: 5 / Math.max(.2, ports.transform().zoom) + 2, problem: pose => {
        const next = moveFurnishing(g.original, g.id, pose);
        return next ? ports.sceneCommands.furnishingProblem(next, g.id) : 'Choose a furnishing first.';
      } });
      g.lock = result.lock;
      g.guides = [...result.guides];
      const next = result.value && moveFurnishing(g.original, g.id, result.value);
      if (next) ports.model.scene.studio = next;
      ports.refresh();
    },
    finish,
  };
}
