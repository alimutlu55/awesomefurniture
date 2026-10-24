import * as THREE from 'three';
import { tiltedCeilingGeometry } from './tilted-ceiling-geometry';
import { twoViewGeometry } from './two-view-geometry';
import { roomHeight, wallFace, wallLine } from '../../domain/studio/studio';
import type { Studio, StudioCeiling } from '../../domain/studio/studio';

interface CeilingView { id: string; wall: string; solid: THREE.Mesh; edges: THREE.LineSegments; outline: THREE.LineSegments | null; low: boolean }

/** Draws the ceilings that come down into the room (stairs, landings, sloped roofs, boxes) as plastered
 * solids from the room's ceiling down to their underside. Like the ceiling, they show solid when the camera
 * is below it and their wall stands; from above, or behind a lowered wall, they are drawn as thin lines, so
 * they never hide the wardrobes under them. Centimetres, in each wall's frame (x along it from corner a,
 * z into the room). */
export function createCeilingViews(root: THREE.Object3D, plaster: THREE.Material | ((wall: string) => THREE.Material), select: THREE.LineBasicMaterial) {
  const group = new THREE.Group();
  group.name = 'studio-ceilings';
  root.add(group);
  const lines = new THREE.LineBasicMaterial({ color: new THREE.Color('#7d7262').convertSRGBToLinear(), transparent: true, opacity: .75, toneMapped: false });
  let views: CeilingView[] = [], top = 0, selected: string | null = null, shown = '';

  function geometry(studio: Studio, c: StudioCeiling) {
    const w = studio.walls.find(x => x.id === c.wall), line = w && wallLine(studio, w), face = w && wallFace(studio, w);
    if (!w || !line || !face || c.profile.length < 2) return null;
    // The solid's side view: down from the room's ceiling to the underside and back up.
    const shape = new THREE.Shape(), first = c.profile[0]!, last = c.profile.at(-1)!;
    if (c.outline) {
      shape.moveTo(c.outline[0]!.t, c.outline[0]!.y);
      c.outline.slice(1).forEach(p => shape.lineTo(p.t, p.y)); shape.closePath();
    } else {
    shape.moveTo(first.t, top);
    for (const p of c.profile) shape.lineTo(p.t, Math.min(top, p.y));
    shape.lineTo(last.t, top);
    shape.lineTo(first.t, top);
    }
    let g: THREE.BufferGeometry;
    if (c.section) {
      // Shaped from both sides: along the wall from the front, out from its face from the side, whichever is the main view.
      const ring = (list: readonly { t: number; y: number }[]) => list.map(p => ({ x: p.t, y: Math.min(top, p.y) }));
      const outline = c.outline ?? [...c.profile, { t: last.t, y: top }, { t: first.t, y: top }];
      const [front, side] = c.run === 'along' ? [outline, c.section] : [c.section, outline];
      g = twoViewGeometry([ring(front)], ring(side)).translate(0, 0, w.thickness / 2);
    } else if (c.run === 'along') {
      g = c.edgeRise || c.outline ? tiltedCeilingGeometry(c, top).translate(0, 0, w.thickness / 2)
        : new THREE.ExtrudeGeometry(shape, { depth: c.depth, bevelEnabled: false }).translate(0, 0, w.thickness / 2);
    } else {
      // Drawn across the room, then turned so it runs along the wall's whole inside face.
      g = new THREE.ExtrudeGeometry(shape, { depth: face.end - face.start, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(face.end, 0, w.thickness / 2);
    }
    return { g, line };
  }

  function sync(studio: Studio | undefined) {
    clear();
    if (!studio?.ceilings?.length) return;
    top = roomHeight(studio);
    for (const c of studio.ceilings) {
      const built = geometry(studio, c);
      if (!built) continue;
      const holder = new THREE.Group();
      holder.rotation.y = built.line.angle * Math.PI / 180;
      holder.position.set(built.line.a.x, 0, built.line.a.z);
      const solid = new THREE.Mesh(built.g, typeof plaster === 'function' ? plaster(c.wall) : plaster);
      solid.userData.studioCeiling = c.id;
      solid.castShadow = solid.receiveShadow = true;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(built.g, 20), lines);
      holder.add(solid, edges);
      group.add(holder);
      // A boxing on the floor, below the ceiling, is furniture-height: it stays solid from above, as the toilet in front of it does.
      const low = !!c.outline && Math.min(...c.outline.map(p => p.y)) < 1 && Math.max(...c.outline.map(p => p.y)) < top - 1;
      views.push({ id: c.id, wall: c.wall, solid, edges, outline: null, low });
    }
    outline();
  }
  function clear() {
    group.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose(); });
    group.clear();
    views = [];
  }

  /** Solid from inside the room, lines from above or from behind a lowered wall. */
  function frame(camera: THREE.Camera, standing: (wall: string) => boolean) {
    const below = camera.position.y < top - 5;
    let key = '';
    for (const v of views) {
      const solid = (below || v.low) && standing(v.wall);
      v.solid.visible = solid;
      v.edges.visible = !solid;
      key += solid ? '1' : '0';
    }
    shown = key;
  }

  function outline() {
    for (const v of views) {
      if (v.outline) { v.outline.parent?.remove(v.outline); v.outline.geometry.dispose(); v.outline = null; }
      if (v.id !== selected) continue;
      v.outline = new THREE.LineSegments(new THREE.EdgesGeometry(v.solid.geometry, 20), select);
      v.outline.renderOrder = 12;
      v.solid.parent!.add(v.outline);
    }
  }

  return {
    sync, frame,
    select(id: string | null) { if (id !== selected) { selected = id; outline(); } },
    /** The solids on show, for picking: a ceiling drawn as lines never takes a click from a wardrobe below. */
    pickables: () => views.filter(v => v.solid.visible).map(v => v.solid),
    /** Changes when a ceiling turns solid or into lines, which changes the shadows. */
    shadowKey: () => shown,
    dispose() { clear(); lines.dispose(); root.remove(group); },
  };
}
