import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FrontStyleDef } from '../../domain/wardrobe/front-styles';
import type { Point2 } from './frame-geometry';

/** The outline brought in by `x` at its sides and `y` at its bottom and top: a frame's inner edge, or a moulding's. */
function inset(points: readonly Point2[], x: number, y: number): THREE.Vector2[] {
  const xs = points.map(p => p.x), ys = points.map(p => p.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return points.map(p => new THREE.Vector2(p.x < cx ? p.x + x : p.x - x, p.y < cy ? p.y + y : p.y - y));
}
const shape = (points: readonly THREE.Vector2[]) => new THREE.Shape([...points]);
/** An extrusion `depth` deep from `z` to `z + depth`, without the groups that would make it more than one draw. */
function slab(s: THREE.Shape, depth: number, z: number, bevel?: { size: number; thickness: number }) {
  const g = new THREE.ExtrudeGeometry(s, bevel ? { depth, bevelEnabled: true, bevelSize: bevel.size, bevelThickness: bevel.thickness, bevelSegments: 4, curveSegments: 4 }
    : { depth, bevelEnabled: false });
  g.translate(0, 0, z); g.clearGroups();
  return g;
}

/**
 * A styled door leaf as one geometry (one draw call, as a slab leaf is), `t` thick and centred on z = 0 with its face at
 * +t/2, in the leaf's own outline (a sloped top included):
 * - Shaker: the centre panel set back by the style's recess inside a frame of its stile and rail widths;
 * - profiled edge: the face with a moulded edge the style's width round it;
 * - handle rail: the grip routed across its top (a rectangular leaf), its depth into the face.
 * Null for a slab, or a leaf too small for its style, which the slab builder draws.
 */
export function styledFrontGeometry(outline: readonly Point2[], t: number, style: FrontStyleDef): THREE.BufferGeometry | null {
  const xs = outline.map(p => p.x), ys = outline.map(p => p.y), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const outer = outline.map(p => new THREE.Vector2(p.x, p.y));
  let parts: THREE.BufferGeometry[] | null = null;
  if (style.frame) {
    const stile = style.frame.stileMm / 10, rail = style.frame.railMm / 10, recess = Math.min(style.frame.recessMm / 10, t / 2);
    if (w <= 2 * stile + 4 || h <= 2 * rail + 4) return null;
    const ring = shape(outer); ring.holes.push(new THREE.Path(inset(outline, stile, rail).reverse()));
    parts = [slab(shape(outer), t - recess, -t / 2), slab(ring, recess, t / 2 - recess)];
  } else if (style.edgeProfileMm) {
    const edge = style.edgeProfileMm / 10, deep = Math.min(.45, t / 4);
    if (w <= 2 * edge + 2 || h <= 2 * edge + 2) return null;
    // The bevel grows the inset outline back out to the leaf's own, rounding its face edge in.
    parts = [slab(shape(inset(outline, edge, edge)), t - 2 * deep, -t / 2 + deep, { size: edge, thickness: deep })];
  } else if (style.grip) {
    const grip = style.grip.heightMm / 10, back = Math.min(style.grip.depthMm / 10, t * .55), top = Math.max(...ys), x0 = Math.min(...xs);
    // A routed grip needs a straight top to run along.
    if (outline.filter(p => Math.abs(p.y - top) < .01).length < 2 || outline.length !== 4 || h <= grip + 4) return null;
    const lower = new THREE.BoxGeometry(w, h - grip, t).translate(x0 + w / 2, Math.min(...ys) + (h - grip) / 2, 0);
    const upper = new THREE.BoxGeometry(w, grip, t - back).translate(x0 + w / 2, top - grip / 2, -back / 2);
    parts = [lower.toNonIndexed(), upper.toNonIndexed()];
  }
  if (!parts) return null;
  const merged = BufferGeometryUtils.mergeBufferGeometries(parts.map(g => (g.index ? g.toNonIndexed() : g)));
  parts.forEach(g => g.dispose());
  return merged;
}

/**
 * Where a styled leaf's detail reads as a shadow line seen from the front: a Shaker frame's inner edge, a moulded edge's
 * two steps, a handle rail's grip under its top. Closed loops, and open runs, of outline points (pivot space). Drawn with
 * the leaf's reveal line, so a style costs no draw call; empty for a slab.
 */
export function styleLines(outline: readonly Point2[], style: FrontStyleDef): { loops: THREE.Vector2[][]; runs: THREE.Vector2[][] } {
  const xs = outline.map(p => p.x), ys = outline.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), top = Math.max(...ys);
  if (style.frame) return { loops: [inset(outline, style.frame.stileMm / 10, style.frame.railMm / 10)], runs: [] };
  if (style.edgeProfileMm) { const e = style.edgeProfileMm / 10; return { loops: [inset(outline, e * .45, e * .45), inset(outline, e, e)], runs: [] }; }
  if (style.grip) { const y = top - style.grip.heightMm / 10; return { loops: [], runs: [[new THREE.Vector2(x0, y), new THREE.Vector2(x1, y)]] }; }
  return { loops: [], runs: [] };
}
