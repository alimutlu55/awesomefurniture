import type { ProfileVertex, Vec } from '../../domain/geometry/profile-polygon';
import type { SurfaceProfile } from '../../domain/studio/surface-profile';
import { measureNumber, unitSuffix } from './editor-format.js';
import type { GuideLine } from './smart-guides';

/** What is picked in the drawing: a corner or an edge (from that corner to the next). */
export type ShapePick = { readonly kind: 'vertex' | 'edge'; readonly index: number } | null;
export interface ShapeGuide extends GuideLine<Vec> { readonly delta?: number }

/** The drawing's frame in centimetres, y up: the wall (or the room in section) with a margin for labels. */
export function drawingBox(profile: SurfaceProfile, points: readonly Vec[]) {
  const xs = [profile.context.from, profile.context.to, ...points.map(p => p.x)], ys = [0, profile.context.top, ...points.map(p => p.y)];
  // More room above the ceiling, where most shapes hang and their edge tools go.
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(...ys), pad = Math.max(x1 - x0, y1) * .07 + 6, above = pad * 2.4;
  // A narrow part (a wall's cross-section) gets room either side, so the drawing fills the panel's width.
  const h = y1 + pad + above, w = Math.max(x1 - x0 + 2 * pad, h * .75), cx = (x0 + x1) / 2;
  return { x: cx - w / 2, y: -(y1 + above), w, h };
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();
const len = (v: number) => measureNumber(Math.round(v * 10) / 10) + unitSuffix();
const outward = (a: Vec, b: Vec) => { const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.y - a.y) / l, y: -(b.x - a.x) / l }; };

/** The drawing as SVG markup: context first, then the shape, its edge lengths, its corners and the snap guides.
 * `px` is centimetres per screen pixel, so strokes, dots and text keep their size whatever the zoom. */
export function drawingMarkup({ profile, points, pick, guides, px, problem, box }: {
  profile: SurfaceProfile; points: readonly ProfileVertex[]; pick: ShapePick; guides: readonly ShapeGuide[]; px: number; problem: boolean;
  box: ReturnType<typeof drawingBox>;
}): string {
  const { context: c } = profile, P = (p: Vec) => `${n(p.x)} ${n(-p.y)}`, out: string[] = [];
  // The wall face (or, in section, the room beside the wall), its floor and its ceiling.
  if (profile.view === 'front') out.push(`<rect class="shape-wall" x="${n(c.from)}" y="${n(-c.top)}" width="${n(c.to - c.from)}" height="${n(c.top)}"/>`);
  else out.push(`<rect class="shape-wall" x="${n(-profile.wall.thickness)}" y="${n(-c.top)}" width="${n(profile.wall.thickness)}" height="${n(c.top)}"/>`);
  for (const o of profile.openings) out.push(`<rect class="shape-opening" x="${n(o.x0)}" y="${n(-o.y1)}" width="${n(o.x1 - o.x0)}" height="${n(o.y1 - o.y0)}"/>`);
  const left = profile.view === 'front' ? c.from : -profile.wall.thickness;
  out.push(`<path class="shape-floor" d="M${n(left - 4 * px * 8)} 0H${n(c.to + 4 * px * 8)}"/>`);
  out.push(`<path class="shape-ceiling" d="M${n(left)} ${n(-c.top)}H${n(c.to)}"/>`);
  // Seen from the side, the room is to the right of the wall's face.
  if (profile.view === 'side') out.push(`<text class="shape-room" x="${n(box.x + box.w - 8 * px)}" y="${n(box.y + box.h - 8 * px)}" font-size="${n(11 * px)}" text-anchor="end">Room →</text>`);
  // The shape: filled, its outline, and the picked edge above it.
  out.push(`<path class="shape-solid${problem ? ' problem' : ''}" d="M${points.map(P).join('L')}Z"/>`);
  for (const g of guides) {
    const near = Math.abs(g.delta ?? 0) > .001;
    out.push(`<path class="shape-guide${near ? ' near' : ''}" d="M${P(g.a)}L${P(g.b)}"/>`);
  }
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]!, picked = pick?.kind === 'edge' && pick.index === i;
    out.push(`<path class="shape-edge${picked ? ' picked' : ''}" data-edge="${i}" d="M${P(a)}L${P(b)}"/>`);
  });
  // Edge lengths, outside each edge long enough on screen to carry one.
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]!, length = Math.hypot(b.x - a.x, b.y - a.y), picked = pick?.kind === 'edge' && pick.index === i;
    if (!picked && length / px < 46) return;
    const o = outward(a, b), text = len(length), half = text.length * 3.2 * px;
    // Outside the edge, kept inside the drawing so a label at its side is never cut off.
    const away = 7 * px + Math.abs(o.x) * half + Math.abs(o.y) * 7 * px, mid = { x: (a.x + b.x) / 2 + o.x * away, y: (a.y + b.y) / 2 + o.y * away };
    // Kept inside the drawing near its sides; an edge zoomed out of view has no label.
    const lo = { x: box.x + half, y: -box.y - box.h + 8 * px }, hi = { x: box.x + box.w - half, y: -box.y - 8 * px };
    if (mid.x < lo.x - 40 * px || mid.x > hi.x + 40 * px || mid.y < lo.y - 20 * px || mid.y > hi.y + 20 * px) return;
    const at = { x: Math.max(lo.x, Math.min(hi.x, mid.x)), y: Math.max(lo.y, Math.min(hi.y, mid.y)) };
    out.push(`<text class="shape-length${picked ? ' picked' : ''}" x="${n(at.x)}" y="${n(-at.y)}" font-size="${n(11 * px)}" dominant-baseline="middle" text-anchor="middle">${text}</text>`);
  });
  points.forEach((p, i) => {
    const picked = pick?.kind === 'vertex' && pick.index === i;
    out.push(`<circle class="shape-corner${picked ? ' picked' : ''}${p.pinned ? ' pinned' : ''}" data-corner="${i}" cx="${n(p.x)}" cy="${n(-p.y)}" r="${n((picked ? 7 : 5.5) * px)}" stroke-width="${n(2 * px)}"/>`);
  });
  return out.join('');
}
