import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { StudioFixture } from '../../domain/studio/studio';
import { cylinder, inset, loft, plan } from './fixture-geometry';
import type { Ring } from './fixture-geometry';

export interface FixtureMaterials { readonly ceramic: THREE.Material; readonly metal: THREE.Material; readonly front: THREE.Material }
/** A part of a fixture: its geometry, its material, and where it goes in the fixture's frame (x across its middle,
 * y up from the floor, z out from its back). */
export type Part = { geometry: THREE.BufferGeometry; material: THREE.Material; at?: readonly [number, number, number]; turn?: number };

/** The bowl's inside: its opening on the rim, down to the water. */
function bowlInside(w: number, d: number, rim: number, back: number): Ring[] {
  const opening = plan(.36 * w, back + .14 * d, .93 * d, 2.3, 2.8);
  return [
    { y: rim, points: opening },
    { y: rim - 3, points: inset(opening, 1.4) },
    { y: rim - 10, points: plan(.25 * w, back + .25 * d, .8 * d, 2.2, 2.4) },
    { y: rim - 16, points: plan(.12 * w, back + .35 * d, .66 * d) },
  ];
}
/** The outside of a bowl from its lowest ring to a softly rounded rim at `rim`. */
function bowlRim(w: number, d: number, rim: number, back: number): Ring[] {
  return [
    { y: rim - 5, points: plan(.49 * w, back, .985 * d, 2.2, 6) },
    { y: rim - 1.2, points: plan(.5 * w, back, d, 2.2, 6) },
    { y: rim - .2, points: plan(.497 * w, back, d - .3, 2.2, 6) },
    { y: rim, points: plan(.488 * w, back + .2, d - .9, 2.2, 6) },
  ];
}

/** A seat with its lid down: a slab with soft edges on the rim, hinged at the back. */
function seat(w: number, d: number, rim: number, back: number, m: FixtureMaterials): Part[] {
  const outline = plan(.47 * w, back + .03 * d, .985 * d, 2.25, 3.2);
  const rings: Ring[] = [
    { y: rim + .2, points: inset(outline, .7) }, { y: rim + .7, points: outline },
    { y: rim + 2, points: outline }, { y: rim + 2.6, points: inset(outline, 1) },
  ];
  const hinge = (x: number): Part => ({ geometry: cylinder(.9, 3).rotateZ(Math.PI / 2), material: m.metal, at: [x, rim + 1.3, back + .02 * d] });
  return [{ geometry: loft(rings, { capStart: true, capEnd: true }), material: m.ceramic }, hinge(-.24 * w), hinge(.24 * w)];
}

/** A toilet in its fixture frame: wall-hung (on a frame, clear of the floor), back to wall (on the floor, cistern
 * hidden behind it) or with its cistern on show. The seat is at `height`; the flush plate belongs to the wall
 * or boxing behind it (fixture-views.ts). */
export function toiletParts(f: StudioFixture, m: FixtureMaterials): Part[] {
  const w = f.width, d = f.depth, rim = f.height - 2.6;
  if (f.type === 'close-coupled') {
    // The cistern stands on the bowl's back against the wall; the bowl stands on a narrow foot in front of it.
    const cistern = 17, back = cistern - 9;
    const body: Ring[] = [
      { y: 0, points: plan(.22 * w, back + .2 * d, .64 * d, 2.2, 3) }, { y: 6, points: plan(.24 * w, back + .19 * d, .66 * d, 2.2, 3) },
      { y: rim - 20, points: plan(.33 * w, back + .1 * d, .8 * d, 2.2, 4) }, ...bowlRim(w, d, rim, back), ...bowlInside(w, d, rim, back),
    ];
    const top = rim + 38;
    return [
      { geometry: loft(body, { capStart: true, capEnd: true }), material: m.ceramic },
      ...seat(w, d, rim, cistern + 1, m),
      { geometry: new RoundedBoxGeometry(w - 1.4, top - rim - 2, cistern, 4, 2.4), material: m.ceramic, at: [0, (rim + top - 2) / 2, cistern / 2] },
      { geometry: new RoundedBoxGeometry(w - .2, 2.2, cistern + 1.4, 3, .9), material: m.ceramic, at: [0, top - .9, (cistern + 1.4) / 2] },
      { geometry: cylinder(2.3, .8), material: m.metal, at: [0, top + .5, cistern / 2 + .2] },
    ];
  }
  const skirted = f.type === 'back-to-wall';
  const lower: Ring[] = skirted
    ? [{ y: 0, points: plan(.43 * w, 0, .92 * d, 3, 7) }, { y: 2.5, points: plan(.44 * w, 0, .94 * d, 3, 7) }, { y: rim - 14, points: plan(.47 * w, 0, .965 * d, 2.6, 7) }]
    : [{ y: rim - 31, points: plan(.27 * w, 0, .6 * d, 2.4, 8) }, { y: rim - 27, points: plan(.38 * w, 0, .79 * d, 2.3, 7) },
      { y: rim - 18, points: plan(.46 * w, 0, .93 * d, 2.2, 6) }];
  return [
    { geometry: loft([...lower, ...bowlRim(w, d, rim, 0), ...bowlInside(w, d, rim, 0)], { capStart: true, capEnd: true }), material: m.ceramic },
    ...seat(w, d, rim, 1.5, m),
  ];
}

/** A flush plate, 25 by 16.5 cm with two buttons, on the face behind the toilet or, `onTop`, lying on a low boxing. */
export function flushPlate(m: FixtureMaterials): THREE.Group {
  const plate = new THREE.Group();
  plate.add(new THREE.Mesh(new RoundedBoxGeometry(24.6, 16.4, 1, 3, .45), m.metal));
  for (const x of [-5.9, 5.9]) {
    const button = new THREE.Mesh(new RoundedBoxGeometry(11.2, 14.2, .5, 3, .35), m.metal);
    button.position.set(x, 0, .6);
    plate.add(button);
  }
  return plate;
}
