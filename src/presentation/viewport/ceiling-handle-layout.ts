type Handle = { key: string; kind: string; x: number; y: number };
/** Keep add-point targets clear of the draggable points, even when a ceiling run is foreshortened. */
export function ceilingSplitOffsets(handles: readonly Handle[]): Map<string, { x: number; y: number }> {
  const occupied = handles.filter(h => h.kind !== 'ceiling-split'), offsets = new Map<string, { x: number; y: number }>();
  const candidates = [{ x: 0, y: 0 }, ...[48, 80, 112].flatMap(r => [
    { x: 0, y: -r }, { x: 0, y: r }, { x: -r, y: 0 }, { x: r, y: 0 },
    { x: -r * .7, y: -r * .7 }, { x: r * .7, y: -r * .7 },
    { x: -r * .7, y: r * .7 }, { x: r * .7, y: r * .7 },
  ])];
  for (const h of handles.filter(h => h.kind === 'ceiling-split')) {
    const offset = candidates.find(o => occupied.every(p => Math.hypot(h.x + o.x - p.x, h.y + o.y - p.y) >= 48)) ?? candidates.at(-1)!;
    offsets.set(h.key, offset);
    occupied.push({ ...h, x: h.x + offset.x, y: h.y + offset.y });
  }
  return offsets;
}
