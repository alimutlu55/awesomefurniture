import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { StudioFixture } from '../../domain/studio/studio';
import { cylinder, inset, loft, pipe, plan } from './fixture-geometry';
import type { PlanPoint, Ring } from './fixture-geometry';
import type { FixtureMaterials, Part } from './fixture-toilet';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A ceramic basin: its outside from `bottom` up to a soft rim at `rim`, then its bowl down from the opening.
 * `outline` is its plan at the rim, `opening` the bowl's. */
function basinBody(outline: PlanPoint[], opening: PlanPoint[], bottom: number, rim: number, deep: number, under: PlanPoint[]): THREE.BufferGeometry {
  const rings: Ring[] = [
    { y: bottom, points: under }, { y: bottom + (rim - bottom) * .55, points: inset(outline, 1.2) },
    { y: rim - 1.2, points: outline }, { y: rim - .2, points: inset(outline, .25) }, { y: rim, points: inset(outline, .9) },
    { y: rim, points: opening }, { y: rim - 2.5, points: inset(opening, 1.1) },
    { y: rim - deep * .65, points: inset(opening, 6) }, { y: rim - deep, points: inset(opening, 11) },
  ];
  return loft(rings, { capStart: true, capEnd: true });
}

/** A single-lever mixer on the deck at (x, top, z), its spout reaching `reach` forward; tall for a bowl on a worktop. */
function deckMixer(x: number, top: number, z: number, reach: number, tall: boolean, m: FixtureMaterials): Part[] {
  const body = tall ? 26 : 13, r = 1.9;
  const spout = [V(x, top + body - 1.5, z), V(x, top + body + 2.5, z + 3), V(x, top + body + 2.8, z + reach * .7), V(x, top + body - 1.5, z + reach)];
  return [
    { geometry: cylinder(r + .5, .8), material: m.metal, at: [x, top + .4, z] },
    { geometry: cylinder(r, body, false, r * .92), material: m.metal, at: [x, top + body / 2 + .8, z] },
    { geometry: pipe(spout, 1.05), material: m.metal },
    // The lever on top, reaching back towards the wall without going into it.
    { geometry: new RoundedBoxGeometry(1.4, 1.2, 5.6, 2, .5), material: m.metal, at: [x, top + body + 1.4, z - 2.2] },
  ];
}
/** A wall-mounted spout and lever on a slim plate, its valve hidden in the wall or boxing behind it (z = 0). */
function wallMixer(y: number, reach: number, m: FixtureMaterials): Part[] {
  return [
    { geometry: new RoundedBoxGeometry(17, 6.5, .9, 3, .4), material: m.metal, at: [0, y, .45] },
    { geometry: pipe([V(-4, y, .8), V(-4, y, reach)], 1.1, false), material: m.metal },
    { geometry: cylinder(.95, 1.6, true), material: m.metal, at: [-4, y - .6, reach - .4] },
    { geometry: new RoundedBoxGeometry(1.3, 1.3, 7, 2, .5), material: m.metal, at: [5, y, 4] },
  ];
}
/** The chrome bottle trap under a basin that hangs free of a cabinet, and its waste running into the wall. */
function trap(x: number, under: number, z: number, m: FixtureMaterials): Part[] {
  const low = under - 20;
  return [
    { geometry: cylinder(1.6, 7), material: m.metal, at: [x, under - 3.5, z] },
    { geometry: cylinder(2.6, 11, false, 2.4), material: m.metal, at: [x, low + 5.5, z] },
    // Its rounded end meets the wall's face, where the waste goes in.
    { geometry: pipe([V(x, low + 8, z), V(x, low + 8, z * .5), V(x, low + 8, 1.7)], 1.6, false), material: m.metal },
  ];
}

/** A floating cabinet of `height` hung under a worktop at `top`, with drawers in the cabinet finish and bar pulls. */
function cabinet(w: number, d: number, top: number, height: number, drawers: number, m: FixtureMaterials): Part[] {
  const bottom = top - height, gap = .3, out: Part[] = [{ geometry: new RoundedBoxGeometry(w - .4, height, d - 2.2, 3, .3), material: m.front, at: [0, bottom + height / 2, (d - 2.2) / 2] }];
  const each = (height - gap * (drawers + 1)) / drawers;
  for (let k = 0; k < drawers; k++) {
    const y = bottom + gap + each / 2 + k * (each + gap);
    out.push({ geometry: new RoundedBoxGeometry(w - 1, each, 1.8, 3, .25), material: m.front, at: [0, y, d - 1.9] });
    out.push({ geometry: new RoundedBoxGeometry(Math.min(28, w * .4), 1.1, 1.4, 2, .45), material: m.metal, at: [0, y + each / 2 - 4, d - .3] });
  }
  return out;
}

/** A basin in its fixture frame: on the wall, on a pedestal, set into a vanity unit or as a bowl on a worktop,
 * with its tap on the basin or on the wall. Its rim is at `height`. */
export function basinParts(f: StudioFixture, m: FixtureMaterials): Part[] {
  const w = f.width, d = f.depth, rim = f.height, wallTap = f.tap === 'wall';
  if (f.type === 'countertop') {
    const counter = rim - 14, bw = Math.min(50, w - 16), bd = Math.min(38, d - 8), zc = d - bd / 2 - 3.5;
    const bowl = plan(bw / 2, zc - bd / 2, zc + bd / 2, 2.4, 2.4);
    const parts: Part[] = [
      { geometry: new RoundedBoxGeometry(w, 4, d, 3, .5), material: m.front, at: [0, counter - 2, d / 2] },
      ...cabinet(w, d, counter - 4, 40, 1, m),
      { geometry: basinBody(bowl, inset(bowl, 1.3), counter, rim, 12, inset(bowl, bd * .28)), material: m.ceramic },
    ];
    return [...parts, ...(wallTap ? wallMixer(rim + 20, zc - bd * .1, m) : deckMixer(0, counter, Math.max(4.5, zc - bd / 2 - 4), bd * .45, true, m))];
  }
  const vanity = f.type === 'vanity', back = wallTap ? 4 : 10.5;
  const outline = plan(w / 2, 0, d, vanity ? 9 : 2.6, 12), opening = plan(w / 2 - 4, back, d - 3.8, vanity ? 4 : 2.4, 3);
  const bottom = rim - (vanity ? 4 : 17), under = vanity ? outline : plan(.42 * w, 0, .74 * d, 2.4, 10);
  const parts: Part[] = [{ geometry: basinBody(outline, opening, bottom, rim, 15, under), material: m.ceramic }];
  if (vanity) parts.push(...cabinet(w, d, bottom, 48, 2, m));
  else if (f.type === 'pedestal') {
    const column: Ring[] = [
      { y: 0, points: plan(.13 * w, 0, .4 * d, 2.4, 10) }, { y: 4, points: plan(.12 * w, 0, .37 * d, 2.4, 10) },
      { y: bottom - 2, points: plan(.16 * w, 0, .46 * d, 2.4, 10) }, { y: bottom + 1, points: plan(.2 * w, 0, .55 * d, 2.4, 10) },
    ];
    parts.push({ geometry: loft(column, { capStart: true, capEnd: true }), material: m.ceramic });
  } else parts.push(...trap(0, bottom + 1, .42 * d, m));
  return [...parts, ...(wallTap ? wallMixer(rim + 22, .5 * d, m) : deckMixer(0, rim, 5.5, .32 * d, false, m))];
}
