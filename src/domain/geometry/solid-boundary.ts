import { interpolateBoundary, validBoundary, type BoundaryLocation, type BoundaryPoint, type BoundarySection } from './boundary';

export interface SolidPoint extends BoundaryPoint { readonly u: number }
export interface SolidEdge {
  readonly a: SolidPoint; readonly b: SolidPoint;
  readonly start: string; readonly end: string;
  readonly location: BoundaryLocation;
}
export function solidEdges(sections: readonly BoundarySection[]): SolidEdge[] {
  const edges: SolidEdge[] = [];
  // Keep the outer profile first, so existing handles retain their identity.
  for (let section = sections.length - 1; section >= 0; section--) {
    const ring = sections[section]!;
    ring.outline.forEach((p, edge) => {
      const next = (edge + 1) % ring.outline.length;
      edges.push({ a: { ...p, u: ring.u }, b: { ...ring.outline[next]!, u: ring.u },
        start: section + ':' + edge, end: section + ':' + next, location: { edge, fraction: 0, section } });
    });
  }
  for (let section = 0; section < sections.length - 1; section++) {
    const a = sections[section]!, b = sections[section + 1]!;
    a.outline.forEach((p, edge) => edges.push({ a: { ...p, u: a.u }, b: { ...b.outline[edge]!, u: b.u },
      start: section + ':' + edge, end: section + 1 + ':' + edge, location: { edge, fraction: 0, section, across: true } }));
  }
  return edges;
}
export const interpolateSolid = (a: SolidPoint, b: SolidPoint, fraction: number): SolidPoint =>
  ({ ...interpolateBoundary(a, b, fraction), u: a.u + (b.u - a.u) * fraction });
export function solidEdge(edges: readonly SolidEdge[], at: BoundaryLocation) {
  return edges.find(e => e.location.edge === at.edge && (at.section === undefined || e.location.section === at.section)
    && !!e.location.across === !!at.across);
}
export function solidPoint(edges: readonly SolidEdge[], at: BoundaryLocation) {
  const edge = solidEdge(edges, at);
  return edge ? interpolateSolid(edge.a, edge.b, at.fraction) : null;
}
export function validSections(sections: readonly BoundarySection[]): boolean {
  if (sections.length < 2 || sections[0]!.u !== 0 || sections.at(-1)!.u !== 1) return false;
  return sections.every((s, k) => Number.isFinite(s.u) && s.u >= 0 && s.u <= 1 && (!k || s.u > sections[k - 1]!.u)
    && s.outline.length === sections[0]!.outline.length && validBoundary(s.outline));
}
/** The side faces use the same diagonal as the viewport mesh. */
const triangleCache = new WeakMap<readonly BoundarySection[], [SolidPoint, SolidPoint, SolidPoint][]>();
export function sectionTriangles(sections: readonly BoundarySection[]): [SolidPoint, SolidPoint, SolidPoint][] {
  const cached = triangleCache.get(sections);
  if (cached) return cached;
  const triangles: [SolidPoint, SolidPoint, SolidPoint][] = [];
  for (let k = 0; k < sections.length - 1; k++) {
    const a = sections[k]!, b = sections[k + 1]!;
    a.outline.forEach((p, j) => {
      const next = (j + 1) % a.outline.length;
      const p0 = { ...p, u: a.u }, p1 = { ...a.outline[next]!, u: a.u };
      const p2 = { ...b.outline[next]!, u: b.u }, p3 = { ...b.outline[j]!, u: b.u };
      triangles.push([p0, p1, p2], [p0, p2, p3]);
    });
  }
  triangleCache.set(sections, triangles);
  return triangles;
}
export function triangleHeight([a, b, c]: readonly SolidPoint[], t: number, u: number): number | null {
  if (!a || !b || !c) return null;
  const det = (b.t - a.t) * (c.u - a.u) - (c.t - a.t) * (b.u - a.u);
  if (Math.abs(det) < 1e-12) return null;
  const f = ((t - a.t) * (c.u - a.u) - (u - a.u) * (c.t - a.t)) / det;
  const g = ((b.t - a.t) * (u - a.u) - (b.u - a.u) * (t - a.t)) / det;
  return f >= -1e-8 && g >= -1e-8 && f + g <= 1 + 1e-8 ? a.y + (b.y - a.y) * f + (c.y - a.y) * g : null;
}
