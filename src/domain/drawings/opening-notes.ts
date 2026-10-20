import type { StudioOpening } from '../studio/studio';
import { isWallUtility } from '../studio/wall-utilities';
import { type Item, line, mm, note, rect } from './drawing';

const KIND: Record<StudioOpening['kind'], string> = {
  door: 'Door',
  window: 'Window',
  archway: 'Archway',
  water: 'Water pipes',
  socket: 'Electrical point',
  duct: 'Extractor vent',
  gas: 'Gas point',
  radiator: 'Radiator',
  switch: 'Light switch',
};

/** An opening or wall utility as an architect writes it beside the symbol: what it is, width × height, and its
 * height above the floor (`sill`), in millimetres ("Window 2940 × 2350, sill 0", "Water pipes 240 × 200, sill 500"). */
export const openingNote = (o: StudioOpening) =>
  KIND[o.kind] + ' ' + mm(o.width) + ' × ' + mm(o.height) + (o.kind === 'window' || isWallUtility(o.kind) ? ', sill ' + mm(o.sill) : '');

/** Draws an opening or wall utility on a wall elevation (`a` to `b` in cm from the wall's left inside end). */
export function elevationOpeningItems(o: StudioOpening, a: number, b: number): Item[] {
  const x0 = mm(a), x1 = mm(b), y0 = mm(o.sill), y1 = mm(o.sill + o.height);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = x1 - x0, h = y1 - y0;
  const out: Item[] = [rect(x0, y0, x1, y1, 'outline', o.kind === 'window' ? 'glass' : undefined)];
  const cross = (px: number, py: number, r: number) => [
    line({ x: px - r, y: py }, { x: px + r, y: py }, 'thin'),
    line({ x: px, y: py - r }, { x: px, y: py + r }, 'thin'),
  ];

  if (o.kind === 'water') {
    const dx = Math.min(w * 0.26, 75), vy = y0 + h * 0.68, dy = y0 + h * 0.3, r = Math.min(w, h) * 0.14;
    out.push(...cross(cx - dx, vy, r), ...cross(cx + dx, vy, r));
    out.push(rect(cx - r, dy - r, cx + r, dy + r, 'thin'), ...cross(cx, dy, r * 0.7));
  } else if (o.kind === 'socket') {
    const padX = Math.max(15, w * 0.12), padY = Math.max(15, h * 0.22);
    out.push(rect(x0 + padX, y0 + padY, x1 - padX, y1 - padY, 'thin'));
    out.push(line({ x: x0 + padX, y: cy }, { x: x1 - padX, y: cy }, 'thin'));
    if (w >= 130) out.push(line({ x: cx, y: y0 + padY }, { x: cx, y: y1 - padY }, 'thin'));
  } else if (o.kind === 'duct') {
    const pad = Math.max(18, Math.min(w, h) * 0.16);
    out.push(rect(x0 + pad, y0 + pad, x1 - pad, y1 - pad, 'thin'));
    out.push(line({ x: x0 + pad, y: y0 + pad }, { x: x1 - pad, y: y1 - pad }, 'thin'));
    out.push(line({ x: x0 + pad, y: y1 - pad }, { x: x1 - pad, y: y0 + pad }, 'thin'));
  } else if (o.kind === 'gas') {
    const rx = w * 0.3, ry = h * 0.3;
    out.push({
      kind: 'line',
      stroke: 'thin',
      closed: true,
      points: [{ x: cx, y: cy + ry }, { x: cx + rx, y: cy }, { x: cx, y: cy - ry }, { x: cx - rx, y: cy }],
    });
    out.push(...cross(cx, cy, Math.min(rx, ry) * 0.6));
  } else if (o.kind === 'radiator') {
    const step = 65, margin = 35;
    for (let rx = x0 + margin; rx <= x1 - margin + 0.1; rx += step) {
      out.push(line({ x: rx, y: y0 + 25 }, { x: rx, y: y1 - 25 }, 'thin'));
    }
  } else if (o.kind === 'switch') {
    const pad = Math.max(15, Math.min(w, h) * 0.2);
    out.push(rect(x0 + pad, y0 + pad, x1 - pad, y1 - pad, 'thin'));
    out.push(line({ x: cx, y: y0 + pad }, { x: cx, y: y1 - pad }, 'thin'));
  }

  const labelY = o.height >= 40 ? y1 - 120 : y1 + 45;
  out.push(note({ x: cx, y: labelY }, openingNote(o)));
  return out;
}
