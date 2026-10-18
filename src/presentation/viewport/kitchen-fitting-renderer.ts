import * as THREE from 'three';
import type { EditorItem } from '../../domain/wardrobe/editor-design';
import { kitchenUnit, type KitchenUnitKey } from '../../domain/kitchen/kitchen-units';
import { PANEL } from '../../domain/wardrobe/catalog.js';
import { createFrontParts } from './furniture-parts';
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
  /** Doors whose middle is lower than this (cm from the floor) take their handle at the top, higher ones at the bottom. */
  const HANDLE_REACH = 110;
  const { panel, doors, shelves, drawerBox, pull } = createFrontParts({ box, group, face, depth: d, front: materials.front, inside: materials.inside, metal: steel });

  /** Draws one kitchen fitting. `inside` is the bottom and top of the unit's inside, so the end fronts can cover the boards;
   * `outer` is where the unit's left and right faces are, so the fronts at its edges can cover the side panels. */
  function kitchenFitting(it: EditorItem, cx: number, y: number, sw: number, inside: { bottom: number; top: number }, outer?: { left: number; right: number }) {
    // Like the top and bottom, a front reaches over the whole side panel where it stands at the unit's edge (less a 3 mm
    // gap to the next unit); beside another front in the same unit it stops halfway across their shared partition.
    const edge = (side: number, face: number) => outer !== undefined && Math.abs(side - face) < PANEL + .01 ? PANEL - gap / 2 : PANEL / 2;
    const hh = it.h, x0 = cx - sw / 2 - edge(cx - sw / 2, outer?.left ?? 0), x1 = cx + sw / 2 + edge(cx + sw / 2, outer?.right ?? 0);
    // A wall unit's bottom is solid down to its lower edge (frame-geometry.ts), so its lowest front reaches that edge.
    const y0 = Math.abs(y - inside.bottom) < .05 ? (kitchenUnit(unit).plinth ? y - PANEL : 0) : y, y1 = Math.abs(y + hh - inside.top) < .05 ? y + hh + PANEL : y + hh;
    const mid = (y0 + y1) / 2;
    switch (it.k) {
      case 'cutlery': case 'pan': case 'hob': {
        panel(x0, x1, y0, y1);
        pull(Math.min(32, sw * .45), cx, it.k === 'pan' ? y1 - Math.min(7, (y1 - y0) / 3) : mid);
        drawerBox(cx, y, sw, hh);
        break;
      }
      case 'cupboard': case 'sink':
        // The handle goes on the edge nearest the height a hand reaches: at the top of a door below the middle of a person's
        // reach, at the bottom of one above it (a wall unit's door, the cupboard at the top of a tall unit).
        doors(x0, x1, y0, y1, kitchenUnit(unit).elevation + mid < HANDLE_REACH);
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
      case 'dishwasher': {
        // An integrated dishwasher: a door that matches the fronts, with its handle along the top edge and a thin control strip.
        panel(x0, x1, y0, y1);
        pull(Math.min(60, sw * .75), cx, y1 - 5);
        break;
      }
      case 'hood': {
        // A canopy hood: a steel front with a darker filter strip along its lower edge.
        panel(x0, x1, y0, y1, steel);
        box(Math.max(4, x1 - x0 - 6), Math.max(1.5, (y1 - y0) * .25), .4, cx, y0 + (y1 - y0) * .3, face + PANEL / 2 + .2, glass);
        break;
      }
      case 'cooker': {
        // A freestanding cooker: a steel body with the controls along the top, an oven door in glass with a handle, and
        // a glass hob on top with four burners.
        const fw = x1 - x0, front = face + PANEL / 2 + .2, top = y1;
        panel(x0, x1, y0, y1, steel);
        box(Math.max(4, fw - 8), Math.max(4, (y1 - y0) * .55), .4, cx, y0 + (y1 - y0) * .4, front, glass);
        pull(Math.min(fw - 8, 60), cx, y0 + (y1 - y0) * .78);
        for (let n = 0; n < 4; n++) box(2.4, 2.4, .6, cx - fw * .3 + n * fw * .2, y1 - 3, front, materials.M('#8a8f96', { metalness: .8, roughness: .3 }));
        box(Math.max(4, fw - 6), .8, Math.max(4, d - 6), cx, top + .4, -1, glass);
        const rings = [[-.25, -.22, 7.5], [.25, -.22, 6], [-.25, .22, 6], [.25, .22, 7.5]] as const;
        for (const [rx, rz, r] of rings) {
          const ring = new THREE.Mesh(new THREE.RingGeometry(r - 1.2, r, 28), materials.M('#8a8f96', { metalness: .8, roughness: .3 }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(cx + rx * fw, top + .85, -1 + rz * (d - 6));
          owned.push(ring.material as THREE.Material);
          group.add(ring);
        }
        break;
      }
      case 'microwave': {
        // A steel front: a dark glass window on the left, the controls in a column on the right, a handle between them.
        const fw = x1 - x0, front = face + PANEL / 2 + .2, win = fw * .68, wx = x0 + 3 + (win - 3) / 2;
        panel(x0, x1, y0, y1, steel);
        box(Math.max(4, win - 3), Math.max(4, (y1 - y0) - 8), .4, wx, mid, front, glass);
        box(2.2, Math.max(4, (y1 - y0) * .5), .6, x0 + 3 + win, mid, front + .1, materials.M('#8a8f96', { metalness: .8, roughness: .3 }));
        box(Math.max(3, fw - win - 9), Math.max(3, (y1 - y0) * .55), .4, x1 - (fw - win - 3) / 2 - 1.5, mid, front, glass);
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
      case 'cargo':
        // A slim pull-out is opened from its top edge: a bar across the middle of the front, near the top.
        panel(x0, x1, y0, y1);
        pull(Math.min(24, sw * .8), cx, y1 - 5);
        shelves(cx - sw / 2, cx + sw / 2, y, y + hh);
        break;
      case 'pantry':
        panel(x0, x1, y0, y1);
        pull(Math.min(60, hh * .35), x1 - 4, mid, true);
        shelves(cx - sw / 2, cx + sw / 2, y, y + hh);
        break;
      default:
        panel(x0, x1, y0, y1);
    }
  }
  return { kitchenFitting, owned };
}
