import type { Studio } from './studio';
import { cornerDegree, wallLine } from './studio';
import { extendFromCorner, mergeCorners } from './studio-edit';

const DEFAULT_LENGTH = 150;
const SHORTER = [100, 75, 50, 40, 30];

/** The wall the + at a free end adds: straight on from that end, `DEFAULT_LENGTH` long when that fits.
 * When it does not, it fills the gap instead: it runs to a free end straight ahead and joins it, else it
 * is the longest shorter wall that fits. `fits` judges a candidate room; when nothing fits, the default wall comes back so the caller can say why it is refused. */
export function extendToFit(studio: Studio, cornerId: string, fits: (next: Studio) => boolean): Studio | null {
  const c = studio.corners.find(c => c.id === cornerId);
  const w = studio.walls.find(w => w.a === cornerId || w.b === cornerId);
  const line = w && wallLine(studio, w);
  if (!c || !w || !line || cornerDegree(studio, cornerId) !== 1) return null;
  const sign = w.b === cornerId ? 1 : -1;
  const ahead = (length: number) => extendFromCorner(studio, cornerId, c.x + line.ux * sign * length, c.z + line.uz * sign * length);
  const first = ahead(DEFAULT_LENGTH);
  if (first && fits(first)) return first;
  const gaps = studio.corners.filter(o => o.id !== cornerId && cornerDegree(studio, o.id) === 1).map(o => {
    const dx = o.x - c.x, dz = o.z - c.z;
    return { id: o.id, along: (dx * line.ux + dz * line.uz) * sign, off: Math.abs(dx * line.nx + dz * line.nz) };
  }).filter(g => g.along > 0 && g.off < 1).sort((p, q) => p.along - q.along);
  for (const g of gaps) {
    const added = ahead(g.along);
    const joined = added && mergeCorners(added, added.corners.at(-1)!.id, g.id);
    if (joined && fits(joined)) return joined;
  }
  for (const length of SHORTER) {
    const next = ahead(length);
    if (next && fits(next)) return next;
  }
  return first; // nothing fits: hand back the default so the editor reports why
}
