import type { Studio } from '../../domain/studio/studio';
import { wallLine } from '../../domain/studio/studio';
import type { EditorCabinet } from '../../application/projects/editor-scene';
import { detectRooms, door2DPlan, wall2DPlan, window2DPlan, type Point2D } from '../../domain/studio/studio-plan';
export type { Point2D };
import { lengthText, unitSuffix } from './length-unit-state';
import { openingNoun } from '../../domain/studio/wall-utilities';
import type { RoomSelection } from '../viewport/studio-renderer';

export interface ViewportTransform {
  readonly panX: number;
  readonly panZ: number;
  readonly zoom: number; // pixels per cm
  readonly width: number;
  readonly height: number;
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Converts scene coordinate (cm) to screen pixel in 2D viewport. */
export function createTransform(t: ViewportTransform) {
  const cx = t.width / 2, cz = t.height / 2;
  const toScreen = (p: Point2D): Point2D => ({
    x: Math.round((cx + (p.x - t.panX) * t.zoom) * 10) / 10,
    z: Math.round((cz + (p.z - t.panZ) * t.zoom) * 10) / 10,
  });
  const toScene = (sx: number, sz: number): Point2D => ({
    x: Math.round(((sx - cx) / t.zoom + t.panX) * 10) / 10,
    z: Math.round(((sz - cz) / t.zoom + t.panZ) * 10) / 10,
  });
  return { toScreen, toScene };
}

/** Returns the SVG defs containing GPU-accelerated pattern grids. */
export function buildDefsSvg(): string {
  return `
    <pattern id="sp2d-pat-minor" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" class="sp2d-grid-line-minor" stroke-width="0.5"/>
    </pattern>
    <pattern id="sp2d-pat-major" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#sp2d-pat-minor)"/>
      <path d="M 100 0 L 0 0 0 100" fill="none" class="sp2d-grid-line-major" stroke-width="1"/>
    </pattern>
  `;
}

/** Renders enclosed room polygons with soft floor fill and area badge. */
export function renderRooms(studio: Studio): string {
  const rooms = detectRooms(studio);
  const out: string[] = [];
  for (const r of rooms) {
    const pts = r.polygon.map(p => `${p.x},${p.z}`).join(' ');
    out.push(`<polygon points="${pts}" class="sp2d-room-fill"/>`);
    out.push(`<g class="sp2d-room-badge" transform="translate(${r.centroid.x}, ${r.centroid.z})">
      <rect x="-65" y="-22" width="130" height="44" rx="8" class="sp2d-badge-bg" vector-effect="non-scaling-stroke"/>
      <text x="0" y="-4" class="sp2d-room-title">${esc(r.name)}</text>
      <text x="0" y="14" class="sp2d-room-area">${r.areaM2.toFixed(1)} m²</text>
    </g>`);
  }
  return out.join('');
}

/** Renders walls with solid thickness, mitres, and dimension lines. */
export function renderWalls(studio: Studio, selection: RoomSelection): string {
  const out: string[] = [];
  for (const w of studio.walls) {
    const plan = wall2DPlan(studio, w);
    if (!plan) continue;
    const isSel = selection?.kind === 'wall' && selection.id === w.id;
    const pts = plan.solid.map(p => `${p.x},${p.z}`).join(' ');
    out.push(`<polygon points="${pts}" class="sp2d-wall-poly ${isSel ? 'selected' : ''}" data-wall-id="${w.id}" vector-effect="non-scaling-stroke"/>`);

    const pA = plan.faceFrom, pB = plan.faceTo;
    out.push(`<line x1="${pA.x}" y1="${pA.z}" x2="${pB.x}" y2="${pB.z}" class="sp2d-wall-face ${isSel ? 'selected' : ''}" data-wall-id="${w.id}" vector-effect="non-scaling-stroke"/>`);

    const mid = { x: (pA.x + pB.x) / 2, z: (pA.z + pB.z) / 2 };
    const dx = pB.x - pA.x, dz = pB.z - pA.z, len = Math.hypot(dx, dz);
    if (len > 30) {
      const nx = len ? -dz / len : 0, nz = len ? dx / len : 0;
      const off = 18;
      const tx = mid.x + nx * off, tz = mid.z + nz * off;
      const angle = (Math.atan2(dz, dx) * 180 / Math.PI + 360) % 180 - (Math.abs(dx) < Math.abs(dz) && dz < 0 ? 180 : 0);
      const rot = Math.abs(angle) > 90 ? angle - 180 : angle;
      const formatted = lengthText(plan.faceLength) + unitSuffix();
      out.push(`<g class="sp2d-dim-badge" transform="translate(${tx}, ${tz}) rotate(${rot})" data-edit-wall="${w.id}">
        <rect x="-35" y="-10" width="70" height="20" rx="4" class="sp2d-dim-bg" vector-effect="non-scaling-stroke"/>
        <text x="0" y="4" class="sp2d-dim-text">${esc(formatted)}</text>
      </g>`);
    }
  }
  return out.join('');
}

/** Renders doors (leaves and swing arcs), windows, and utilities. */
export function renderOpenings(studio: Studio, selection: RoomSelection): string {
  const out: string[] = [];
  for (const o of studio.openings) {
    const isSel = selection?.kind === 'opening' && selection.id === o.id;
    if (o.kind === 'door') {
      const dp = door2DPlan(studio, o);
      if (!dp) continue;
      const h = dp.hingePoint, c = dp.closedPoint, op = dp.openPoint;
      const r = dp.radius;
      const sweep = dp.swingDir > 0 ? 1 : 0;
      const arcPath = `M ${c.x} ${c.z} A ${r} ${r} 0 0 ${sweep} ${op.x} ${op.z}`;
      out.push(`<g class="sp2d-opening sp2d-door ${isSel ? 'selected' : ''}" data-opening-id="${o.id}">
        <path d="${arcPath}" class="sp2d-door-arc" vector-effect="non-scaling-stroke"/>
        <line x1="${h.x}" y1="${h.z}" x2="${op.x}" y2="${op.z}" class="sp2d-door-leaf" vector-effect="non-scaling-stroke"/>
        <circle cx="${h.x}" cy="${h.z}" r="3.5" class="sp2d-door-hinge" vector-effect="non-scaling-stroke"/>
      </g>`);
    } else if (o.kind === 'window') {
      const wp = window2DPlan(studio, o);
      if (!wp) continue;
      const iA = wp.innerFrom, iB = wp.innerTo;
      const oA = wp.outerFrom, oB = wp.outerTo;
      const midA = { x: (iA.x + oA.x) / 2, z: (iA.z + oA.z) / 2 };
      const midB = { x: (iB.x + oB.x) / 2, z: (iB.z + oB.z) / 2 };
      const poly = `${iA.x},${iA.z} ${iB.x},${iB.z} ${oB.x},${oB.z} ${oA.x},${oA.z}`;
      out.push(`<g class="sp2d-opening sp2d-window ${isSel ? 'selected' : ''}" data-opening-id="${o.id}">
        <polygon points="${poly}" class="sp2d-window-reveal"/>
        <line x1="${iA.x}" y1="${iA.z}" x2="${oA.x}" y2="${oA.z}" class="sp2d-window-frame" vector-effect="non-scaling-stroke"/>
        <line x1="${iB.x}" y1="${iB.z}" x2="${oB.x}" y2="${oB.z}" class="sp2d-window-frame" vector-effect="non-scaling-stroke"/>
        <line x1="${midA.x}" y1="${midA.z}" x2="${midB.x}" y2="${midB.z}" class="sp2d-window-glass" vector-effect="non-scaling-stroke"/>
      </g>`);
    } else {
      const w = studio.walls.find(x => x.id === o.wall);
      const line = w && wallLine(studio, w);
      if (!line) continue;
      const half = (w?.thickness ?? 12) / 2;
      const pos = {
        x: line.a.x + line.ux * o.offset + line.nx * half,
        z: line.a.z + line.uz * o.offset + line.nz * half,
      };
      out.push(`<g class="sp2d-opening sp2d-utility ${isSel ? 'selected' : ''}" data-opening-id="${o.id}" transform="translate(${pos.x}, ${pos.z})">
        <rect x="-8" y="-8" width="16" height="16" rx="3" class="sp2d-util-box" vector-effect="non-scaling-stroke"/>
        <text x="0" y="3" class="sp2d-util-icon">${openingNoun(o.kind).slice(0, 1).toUpperCase()}</text>
      </g>`);
    }
  }
  return out.join('');
}

/** Renders furniture / wardrobe footprints with bay lines and front orientation. */
export function renderFurniture(wardrobes: readonly EditorCabinet[], activeId: number): string {
  const out: string[] = [];
  for (const c of wardrobes) {
    const isAct = c.id === activeId;
    const rad = (c.angle * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const hw = c.state.w / 2, hd = c.state.d / 2;
    const corners: Point2D[] = [
      { x: c.x - hw * cos - -hd * sin, z: c.z - hw * sin + -hd * cos },
      { x: c.x + hw * cos - -hd * sin, z: c.z + hw * sin + -hd * cos },
      { x: c.x + hw * cos - hd * sin, z: c.z + hw * sin + hd * cos },
      { x: c.x - hw * cos - hd * sin, z: c.z - hw * sin + hd * cos },
    ];
    const pts = corners.map(p => `${p.x},${p.z}`).join(' ');
    const bays = Math.max(1, c.state.n || 1);
    const bayLines: string[] = [];
    for (let i = 1; i < bays; i++) {
      const frac = i / bays;
      const b1 = { x: corners[0]!.x + (corners[1]!.x - corners[0]!.x) * frac, z: corners[0]!.z + (corners[1]!.z - corners[0]!.z) * frac };
      const b2 = { x: corners[3]!.x + (corners[2]!.x - corners[3]!.x) * frac, z: corners[3]!.z + (corners[2]!.z - corners[3]!.z) * frac };
      bayLines.push(`<line x1="${b1.x}" y1="${b1.z}" x2="${b2.x}" y2="${b2.z}" class="sp2d-furn-bay" vector-effect="non-scaling-stroke"/>`);
    }
    out.push(`<g class="sp2d-furniture-item ${isAct ? 'active' : ''}" data-cabinet-id="${c.id}">
      <polygon points="${pts}" class="sp2d-furn-body" vector-effect="non-scaling-stroke"/>
      <line x1="${corners[3]!.x}" y1="${corners[3]!.z}" x2="${corners[2]!.x}" y2="${corners[2]!.z}" class="sp2d-furn-front" vector-effect="non-scaling-stroke"/>
      ${bayLines.join('')}
    </g>`);
  }
  return out.join('');
}

/** Corner nodes remain draggable; additions are offered at the tapped wall position. */
export function renderHandles(studio: Studio, selection: RoomSelection): string {
  const out: string[] = [];
  for (const c of studio.corners) {
    const isCornerSel = selection?.kind === 'wall' && (studio.walls.find(w => w.id === selection.id)?.a === c.id || studio.walls.find(w => w.id === selection.id)?.b === c.id);
    out.push(`<g class="sp2d-corner-handle-group" data-corner-id="${c.id}">
      <circle cx="${c.x}" cy="${c.z}" r="22" class="sp2d-hit-target" fill="transparent" pointer-events="all"/>
      <circle cx="${c.x}" cy="${c.z}" r="${isCornerSel ? 9 : 7}" class="sp2d-handle-corner ${isCornerSel ? 'selected' : ''}" aria-label="Corner ${c.id}" vector-effect="non-scaling-stroke"/>
    </g>`);
  }
  return out.join('');
}

/** Renders the architectural scale bar and north compass arrow in screen space. */
export function renderOverlays(t: ViewportTransform): string {
  const compass = `<g class="sp2d-compass" transform="translate(${t.width - 45}, 45)">
    <circle cx="0" cy="0" r="18" class="sp2d-compass-ring"/>
    <polygon points="0,-14 5,2 0,-1 -5,2" class="sp2d-compass-arrow-n"/>
    <polygon points="0,14 5,-2 0,1 -5,-2" class="sp2d-compass-arrow-s"/>
    <text x="0" y="-18" class="sp2d-compass-label">N</text>
  </g>`;
  const barMeters = 2;
  const barPx = Math.round(barMeters * 100 * t.zoom);
  const scaleBar = `<g class="sp2d-scale-bar" transform="translate(40, ${t.height - 35})">
    <line x1="0" y1="0" x2="${barPx}" y2="0" class="sp2d-scale-line"/>
    <line x1="0" y1="-5" x2="0" y2="5" class="sp2d-scale-tick"/>
    <line x1="${barPx / 2}" y1="-4" x2="${barPx / 2}" y2="4" class="sp2d-scale-tick"/>
    <line x1="${barPx}" y1="-5" x2="${barPx}" y2="5" class="sp2d-scale-tick"/>
    <text x="0" y="-8" class="sp2d-scale-text">0</text>
    <text x="${barPx / 2}" y="-8" class="sp2d-scale-text">1m</text>
    <text x="${barPx}" y="-8" class="sp2d-scale-text">2m</text>
  </g>`;
  return `${compass}${scaleBar}`;
}
