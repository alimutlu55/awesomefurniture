import { cornerDegree, wallLine, type Studio, type StudioWall } from './studio';

/**
 * Merges collinear, connected wall segments of the same thickness and facing into a continuous wall run.
 * Wall extensions or splits used for customization in 3D are treated as one continuous physical wall
 * on technical drawings and plans, preventing cabinets from being truncated or split at artificial seams.
 */
export function continuousStudio(studio: Studio | undefined): Studio | undefined {
  if (!studio?.walls?.length) return studio;
  let corners = [...studio.corners];
  let walls = [...studio.walls];
  let openings = [...studio.openings];
  let fixtures = studio.fixtures ? [...studio.fixtures] : undefined;
  let ceilings = studio.ceilings ? [...studio.ceilings] : undefined;
  let changed = true;

  while (changed) {
    changed = false;
    const current = { ...studio, corners, walls };
    for (let i = 0; i < walls.length; i++) {
      const w1 = walls[i]!;
      const l1 = wallLine(current, w1);
      if (!l1) continue;

      const c = w1.b;
      if (cornerDegree(current, c) !== 2) continue;

      const j = walls.findIndex(w => w !== w1 && (w.a === c || w.b === c));
      if (j < 0) continue;
      const w2 = walls[j]!;
      const l2 = wallLine(current, w2);
      if (!l2) continue;

      const forward = w2.a === c;
      const ux2 = forward ? l2.ux : -l2.ux;
      const uz2 = forward ? l2.uz : -l2.uz;
      const nx2 = forward ? l2.nx : -l2.nx;
      const nz2 = forward ? l2.nz : -l2.nz;

      const collinear = Math.abs(l1.ux * uz2 - l1.uz * ux2) < 1e-4 && (l1.ux * ux2 + l1.uz * uz2) > 0.999;
      const sameFacing = (l1.nx * nx2 + l1.nz * nz2) > 0.999;
      const sameThickness = Math.abs(w1.thickness - w2.thickness) < 0.1;

      if (collinear && sameFacing && sameThickness) {
        const newEnd = forward ? w2.b : w2.a;
        const mergedWall: StudioWall = {
          ...w1,
          b: newEnd,
          height: Math.max(w1.height, w2.height),
        };
        const w1Len = l1.length;

        openings = openings.map(o => {
          if (o.wall === w2.id) {
            const off = forward ? w1Len + o.offset : w1Len + (l2.length - o.offset);
            return { ...o, wall: mergedWall.id, offset: off };
          }
          if (o.wall === w1.id) return { ...o, wall: mergedWall.id };
          return o;
        });

        if (fixtures) {
          fixtures = fixtures.map(f => {
            if (f.wall === w2.id) {
              const off = forward ? w1Len + f.offset : w1Len + (l2.length - f.offset);
              return { ...f, wall: mergedWall.id, offset: off };
            }
            if (f.wall === w1.id) return { ...f, wall: mergedWall.id };
            return f;
          });
        }

        if (ceilings) {
          ceilings = ceilings.map(cl => {
            if (cl.wall === w2.id) {
              const profile = cl.run === 'along'
                ? cl.profile.map(p => ({ ...p, t: forward ? w1Len + p.t : w1Len + (l2.length - p.t) }))
                : cl.profile;
              return { ...cl, wall: mergedWall.id, profile };
            }
            if (cl.wall === w1.id) return { ...cl, wall: mergedWall.id };
            return cl;
          });
        }

        walls.splice(Math.max(i, j), 1);
        walls.splice(Math.min(i, j), 1, mergedWall);
        corners = corners.filter(cr => cr.id !== c);
        changed = true;
        break;
      }
    }
  }

  return {
    ...studio,
    corners,
    walls,
    openings,
    ...(fixtures ? { fixtures } : {}),
    ...(ceilings ? { ceilings } : {}),
  };
}
