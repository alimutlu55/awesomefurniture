import * as THREE from 'three';
import type { EditorItem } from '../../domain/wardrobe/editor-design';
import type { KitchenUnitKey } from '../../domain/kitchen/kitchen-units';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { barPull } from './hardware';
import type { BoxBuilder } from './frame-geometry';

/** What a kitchen front is drawn with. Fronts use the unit's finish; appliances their own metal and glass. */
export interface KitchenFrontMaterials {
  front: THREE.Material;
  inside: THREE.Material;
  M: (color: string, options?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
}

/**
 * Kitchen fittings show their own fronts over the carcass edges: drawer fronts, hinged and lift-up doors,
 * appliance fronts. A front reaches over the bottom and top boards when it is the lowest or highest one,
 * as overlay fronts do. Cabinet-centred x, floor-relative y, centimetres. What sits in the worktop (sink,
 * hob) is drawn with the worktop (kitchen-run-renderer.ts).
 */
export function createKitchenFittingRenderer({ box, group, d, unit, materials }: { box: BoxBuilder; group: THREE.Group; d: number; unit: KitchenUnitKey | undefined; materials: KitchenFrontMaterials }) {
  const steel = materials.M('#b9bdc2', { metalness: .85, roughness: .32 });
  const glass = materials.M('#1b1e22', { metalness: .3, roughness: .12 });
  const owned: THREE.Material[] = [steel, glass];
  const face = d / 2 + PANEL / 2, gap = .3;
  const pull = (length: number, x: number, y: number, vertical = false) => {
    const bar = barPull(length, steel, vertical);
    bar.position.set(x, y, face + PANEL / 2);
    group.add(bar);
  };
  /** One front panel from y0 to y1 across x0..x1 (cabinet-centred), standing proud of the carcass. */
  const panel = (x0: number, x1: number, y0: number, y1: number, material = materials.front) =>
    box(Math.max(1, x1 - x0 - gap), Math.max(1, y1 - y0 - gap), PANEL, (x0 + x1) / 2, (y0 + y1) / 2, face, material);
  /** Hinged leaves across a span: one up to 60 cm, two above it, each with a vertical pull by its free edge. */
  const doors = (x0: number, x1: number, y0: number, y1: number, pullAtTop: boolean) => {
    const leaves = x1 - x0 > 62 ? 2 : 1, w = (x1 - x0) / leaves, py = pullAtTop ? y1 - Math.min(12, (y1 - y0) / 4) : y0 + Math.min(12, (y1 - y0) / 4);
    for (let n = 0; n < leaves; n++) {
      const a = x0 + n * w, b = a + w;
      panel(a, b, y0, y1);
      const free = leaves === 2 ? (n === 0 ? b - 4 : a + 4) : b - 4;
      pull(Math.min(18, (y1 - y0) * .5), free, py, true);
    }
  };
  const shelves = (x0: number, x1: number, y0: number, y1: number) => {
    const count = Math.floor((y1 - y0) / 34);
    for (let n = 1; n <= count; n++) box(x1 - x0 - 1, 1.6, d - 6, (x0 + x1) / 2, y0 + (y1 - y0) * n / (count + 1), -1, materials.inside);
  };

  /** Draws one kitchen fitting. `inside` is the bottom and top of the unit's inside, so the end fronts can cover the boards. */
  function kitchenFitting(it: EditorItem, cx: number, y: number, sw: number, inside: { bottom: number; top: number }) {
    const hh = it.h, x0 = cx - sw / 2 - PANEL / 2, x1 = cx + sw / 2 + PANEL / 2;
    const y0 = Math.abs(y - inside.bottom) < .05 ? y - PANEL : y, y1 = Math.abs(y + hh - inside.top) < .05 ? y + hh + PANEL : y + hh;
    const mid = (y0 + y1) / 2, high = unit === 'upper';
    switch (it.k) {
      case 'cutlery': case 'pan': case 'hob': {
        panel(x0, x1, y0, y1);
        pull(Math.min(32, sw * .45), cx, it.k === 'pan' ? y1 - Math.min(7, (y1 - y0) / 3) : mid);
        // The drawer box behind the front.
        box(Math.max(4, sw - 4), Math.max(4, hh - 4), d - 6, cx, y + hh / 2, -1, materials.inside);
        break;
      }
      case 'cupboard': case 'sink':
        doors(x0, x1, y0, y1, !high);
        if (it.k === 'cupboard') shelves(cx - sw / 2, cx + sw / 2, y, y + hh);
        break;
      case 'flap':
        panel(x0, x1, y0, y1);
        pull(Math.min(32, sw * .45), cx, y0 + 4);
        break;
      case 'niche': {
        // An open shelf: a board and a few bowls and jars on it.
        box(sw - 1, 1.6, d - 4, cx, y + .8, -.5, materials.inside);
        const count = Math.max(1, Math.floor(sw / 18));
        for (let n = 0; n < count; n++) {
          const jar = new THREE.Mesh(new THREE.CylinderGeometry(4, 3.4, Math.min(12, hh - 4), 18), materials.M(['#e9e4da', '#c9b79c', '#9fb2a6'][n % 3]!, { roughness: .45 }));
          owned.push(jar.material as THREE.Material);
          jar.position.set(cx - sw / 2 + (n + .5) * sw / count, y + 1.6 + Math.min(12, hh - 4) / 2, 0);
          jar.castShadow = true;
          group.add(jar);
        }
        break;
      }
      case 'oven': {
        // Steel fascia with the controls, a glass door, and a handle across its top.
        panel(x0, x1, y0, y1, steel);
        box(Math.max(4, x1 - x0 - 6), Math.max(4, (y1 - y0) * .62), .4, cx, y0 + (y1 - y0) * .4, face + PANEL / 2 + .2, glass);
        box(Math.max(4, x1 - x0 - 6), 5, .4, cx, y1 - 5, face + PANEL / 2 + .2, glass);
        pull(Math.min(44, sw * .7), cx, y0 + (y1 - y0) * .8);
        break;
      }
      case 'fridge': {
        // An integrated fridge behind a door that matches the fronts; a freezer door below in a tall unit.
        const split = hh > 140 ? y0 + Math.max(50, (y1 - y0) * .32) : null;
        if (split !== null) {
          panel(x0, x1, y0, split); panel(x0, x1, split, y1);
          pull(Math.min(28, (split - y0) * .45), x1 - 4, split - 14, true);
          pull(Math.min(40, (y1 - split) * .3), x1 - 4, split + 20, true);
        } else { panel(x0, x1, y0, y1); pull(Math.min(28, hh * .4), x1 - 4, y1 - 16, true); }
        break;
      }
      case 'pantry':
        panel(x0, x1, y0, y1);
        pull(Math.min(60, hh * .35), x1 - 4, mid, true);
        shelves(cx - sw / 2, cx + sw / 2, y, y + hh);
        break;
      default:
        panel(x0, x1, y0, y1);
    }
  }
  /** A wall unit's light rail: a board across the front, under its bottom, hiding the worktop lights. */
  function lightRail(w: number) {
    box(w - gap, PLINTH, PANEL, 0, PLINTH / 2, face, materials.front);
  }
  return { kitchenFitting, lightRail, owned };
}
