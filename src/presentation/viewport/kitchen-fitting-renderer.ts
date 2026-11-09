import * as THREE from 'three';
import type { EditorItem } from '../../domain/wardrobe/editor-design';
import { kitchenUnit, type KitchenUnitKey } from '../../domain/kitchen/kitchen-units';
import { PANEL } from '../../domain/wardrobe/catalog.js';
import { cornerDoorSide, cornerFrontSplit, cornerPulloutGeometry, fridgeSplit, itemHingeSide, kitchenFrontRect } from '../../domain/kitchen/kitchen-fronts';
import { cargoPulloutGeometry } from '../../domain/kitchen/cargo-pullout';
import { createFrontParts } from './furniture-parts';
import type { BoxBuilder } from './frame-geometry';
import { frontCoveredByReturn, type FaceWidth } from '../../domain/kitchen/corner-widths';

/** What a kitchen front is drawn with. Fronts use the unit's finish; appliances their own metal and glass. */
export interface KitchenFrontMaterials {
  door?: THREE.Material; drawer?: THREE.Material;
  front: THREE.Material;
  inside: THREE.Material;
  hardware?: THREE.Material;
  M: (color: string, options?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
}

/**
 * Kitchen fittings show their own fronts over the carcass edges: drawer fronts, hinged and lift-up doors,
 * appliance fronts. A front reaches over the bottom and top boards when it is the lowest or highest one,
 * as overlay fronts do. Cabinet-centred x, floor-relative y, centimetres. What sits in the worktop (sink,
 * hob) is drawn with the worktop (kitchen-run-renderer.ts).
 */
export function createKitchenFittingRenderer({ box, group, d, unit, doorHang, materials, handleless = false, shelfThickness = 1.6, faceWidths = [], cabinetWidth = 0, cabinetHeight = 0, plinthHeight = 0, fridgeDoorSplit, handle, reveal }: {
  handleless?: boolean; shelfThickness?: number; fridgeDoorSplit?: number | undefined;
  handle?: Parameters<typeof createFrontParts>[0]['handle']; reveal?: number | undefined;
  box: BoxBuilder; group: THREE.Group; d: number; unit: KitchenUnitKey | undefined; doorHang?: 'left' | 'right' | undefined; materials: KitchenFrontMaterials;
  faceWidths?: readonly FaceWidth[]; cabinetWidth?: number; cabinetHeight?: number; plinthHeight?: number;
}) {
  const steel = materials.M('#b9bdc2', { metalness: .85, roughness: .32 });
  const glass = materials.M('#1b1e22', { metalness: .3, roughness: .12 });
  const owned: THREE.Material[] = [steel, glass];
  const face = d / 2 + (materials.front.userData.panelThickness ?? PANEL) / 2;
  /** Doors whose middle is lower than this (cm from the floor) take their handle at the top, higher ones at the bottom. */
  const HANDLE_REACH = 110;
  const fixedFront = (x0: number, x1: number) => frontCoveredByReturn(x0 + cabinetWidth / 2, x1 + cabinetWidth / 2, faceWidths);
  const { panel, doors, shelves, drawerBox, pull } = createFrontParts({ box, group, face, depth: d, front: materials.front, inside: materials.inside,
    door: materials.door ?? materials.front, drawer: materials.drawer ?? materials.inside, metal: materials.hardware ?? steel, handleless, shelfThickness, fixedFront, ...(handle ? { handle } : {}), reveal });

  for (const s of faceWidths.filter(s => s.strip)) {
    const a = s.from - cabinetWidth / 2, b = s.to - cabinetWidth / 2;
    const part = box(b - a, cabinetHeight - plinthHeight, materials.front.userData.panelThickness ?? PANEL,
      (a + b) / 2, (cabinetHeight + plinthHeight) / 2, face, materials.front);
    part.userData.installationPart = true;
  }

  /** Draws one kitchen fitting. `inside` is the bottom and top of the unit's inside, so the end fronts can cover the boards;
   * `outer` is where the unit's left and right faces are, so the fronts at its edges can cover the side panels. */
  function kitchenFitting(it: EditorItem, cx: number, y: number, sw: number, inside: { bottom: number; top: number }, outer?: { left: number; right: number }) {
    const hh = it.h;
    let { x0, x1, y0, y1 } = kitchenFrontRect(unit, cx, y, sw, hh, inside, outer);
    if (it.k !== 'corner' && faceWidths.some(s => s.strip)) {
      for (const s of faceWidths.filter(s => s.covered)) {
        const a = Math.max(x0, s.from - cabinetWidth / 2), b = Math.min(x1, s.to - cabinetWidth / 2);
        if (b > a) panel(a, b, y0, y1).userData.fixedCornerReturn = true;
      }
      const open = faceWidths.filter(s => !s.covered && !s.strip).map(s => ({ a: Math.max(x0, s.from - cabinetWidth / 2), b: Math.min(x1, s.to - cabinetWidth / 2) }))
        .filter(s => s.b > s.a).sort((a, b) => (b.b - b.a) - (a.b - a.a))[0];
      if (!open) return;
      x0 = open.a; x1 = open.b;
    }
    const frontCentre = (x0 + x1) / 2;
    const mid = (y0 + y1) / 2, hinge = itemHingeSide(it, { doorHang }), explicit = !!(it.hinge ?? doorHang), pullX = hinge === 'right' ? x0 + 4 : x1 - 4;
    switch (it.k) {
      case 'cutlery': case 'pan': case 'hob': {
        // The front and its pull go on the drawer, to travel with its box.
        const slide = drawerBox(cx, y, sw, hh);
        panel(x0, x1, y0, y1, undefined, slide);
        pull(x1 - x0, frontCentre, it.k === 'pan' ? y1 - Math.min(7, (y1 - y0) / 3) : mid, false, slide);
        break;
      }
      case 'cupboard': case 'sink':
        // The handle goes on the edge nearest the height a hand reaches: at the top of a door below the middle of a person's
        // reach, at the bottom of one above it (a wall unit's door, the cupboard at the top of a tall unit).
        doors(x0, x1, y0, y1, kitchenUnit(unit).elevation + mid < HANDLE_REACH, hinge, explicit);
        if (it.k === 'cupboard') shelves(cx - sw / 2, cx + sw / 2, y, y + hh);
        break;
      case 'corner': {
        // A blind-corner unit: one half is a fixed blind panel where the perpendicular run meets it, the other half
        // is the hinged door with two swing-out kidney trays on a post inside.
        let doorSide = cornerDoorSide(it);
        let { blind, door } = cornerFrontSplit(x0, x1, hinge, doorSide);
        const doorPullX = door.hinge === 'left' ? door.x1 - 4 : door.x0 + 4;
        const installed = faceWidths.some(s => s.strip);
        if (installed) {
          const hidden = faceWidths.find(s => s.covered)!, open = faceWidths.find(s => !s.covered && !s.strip)!;
          if (hidden && open) {
            blind = { x0: hidden.from - cabinetWidth / 2, x1: hidden.to - cabinetWidth / 2 };
            doorSide = open.from < hidden.from ? 'left' : 'right';
          }
          const cornerHinge = explicit ? hinge : (doorSide === 'left' ? 'right' : 'left');
          for (const s of faceWidths) {
            const a = Math.max(x0, s.from - cabinetWidth / 2), b = Math.min(x1, s.to - cabinetWidth / 2);
            if (b <= a || s.strip) continue;
            panel(a, b, y0, y1);
            if (!s.covered && !s.strip) pull(y1 - y0, cornerHinge === 'left' ? b - 4 : a + 4, y1 - Math.min(12, (y1 - y0) / 4), true);
          }
        } else {
        panel(blind.x0, blind.x1, y0, y1);
        const leaf = panel(door.x0, door.x1, y0, y1);
        if (fixedFront(door.x0, door.x1)) leaf.userData.fixedCornerReturn = true;
        else pull(y1 - y0, doorPullX, y1 - Math.min(12, (y1 - y0) / 4), true);
        }
        const { post, trayW, trayD, trays } = cornerPulloutGeometry(cx, y, sw, hh, d, blind, doorSide);
        box(post.size, post.h, post.size, post.x, y + hh / 2, 0, steel);
        for (const t of trays) {
          box(trayW, 1.4, trayD, cx, t.y, 0, materials.inside);
          box(trayW + .8, 3.6, trayD + .8, cx, t.y + 2, 0, steel);
        }
        break;
      }
      case 'flap':
        panel(x0, x1, y0, y1);
        pull(x1 - x0, frontCentre, y0 + 4);
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
        pull(sw, cx, y0 + (y1 - y0) * .8);
        break;
      }
      case 'dishwasher': {
        // An integrated dishwasher: a door that matches the fronts, with its handle along the top edge and a thin control strip.
        panel(x0, x1, y0, y1);
        pull(x1 - x0, frontCentre, y1 - 5);
        break;
      }
      case 'hood': {
        // A canopy hood: a steel front with a darker filter strip along its lower edge.
        panel(x0, x1, y0, y1, steel);
        box(Math.max(4, x1 - x0 - 6), Math.max(1.5, (y1 - y0) * .25), .4, cx, y0 + (y1 - y0) * .3, face + PANEL / 2 + .2, glass);
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
        const split = fridgeSplit(y0, y1, hh, fridgeDoorSplit);
        if (split !== null) {
          panel(x0, x1, y0, split); panel(x0, x1, split, y1);
          pull(split - y0, pullX, split - 14, true);
          pull(y1 - split, pullX, split + 20, true);
        } else { panel(x0, x1, y0, y1); pull(hh, pullX, y1 - 16, true); }
        break;
      }
      case 'cargo': {
        // A slim pull-out is opened from its top edge: a bar across the middle of the front, near the top.
        panel(x0, x1, y0, y1);
        pull(x1 - x0, frontCentre, y1 - 5);
        const geo = cargoPulloutGeometry(cx, y, sw, hh, d, {
          tiers: it.tiers,
          basketStyle: it.basketStyle,
          mount: it.cargoMount,
          isTall: hh >= 100,
        });
        for (const u of geo.frame.uprights) {
          box(u.x1 - u.x0, u.y1 - u.y0, u.z1 - u.z0, (u.x0 + u.x1) / 2, (u.y0 + u.y1) / 2, (u.z0 + u.z1) / 2 - d / 2, steel);
        }
        for (const c of geo.frame.crossbars) {
          box(c.x1 - c.x0, c.y1 - c.y0, c.z1 - c.z0, (c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, (c.z0 + c.z1) / 2 - d / 2, steel);
        }
        const br = geo.runners.bottom;
        box(br.x1 - br.x0, br.y1 - br.y0, br.z1 - br.z0, (br.x0 + br.x1) / 2, (br.y0 + br.y1) / 2, (br.z0 + br.z1) / 2 - d / 2, steel);
        if (geo.runners.top) {
          const tr = geo.runners.top;
          box(tr.x1 - tr.x0, tr.y1 - tr.y0, tr.z1 - tr.z0, (tr.x0 + tr.x1) / 2, (tr.y0 + tr.y1) / 2, (tr.z0 + tr.z1) / 2 - d / 2, steel);
        }
        for (const b of geo.baskets) {
          const bw = b.base.x1 - b.base.x0, bd = b.base.z1 - b.base.z0, bz = (b.base.z0 + b.base.z1) / 2 - d / 2;
          const baseMat = geo.basketStyle === 'solid' ? materials.inside : steel;
          box(bw, b.base.y1 - b.base.y0, bd, (b.base.x0 + b.base.x1) / 2, (b.base.y0 + b.base.y1) / 2, bz, baseMat);
          const rw = b.rail.x1 - b.rail.x0, rd = b.rail.z1 - b.rail.z0, ry = b.rail.y1;
          box(rw, .3, .3, cx, ry, bz + bd / 2, steel);
          box(rw, .3, .3, cx, ry, bz - bd / 2, steel);
          box(.3, .3, rd, cx - rw / 2, ry, bz, steel);
          box(.3, .3, rd, cx + rw / 2, ry, bz, steel);
          box(rw, .2, .2, cx, b.y + 1.8, bz + bd / 2, steel);
          box(rw, .2, .2, cx, b.y + 1.8, bz - bd / 2, steel);
          box(.2, .2, rd, cx - rw / 2, b.y + 1.8, bz, steel);
          box(.2, .2, rd, cx + rw / 2, b.y + 1.8, bz, steel);
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            box(.25, b.railHeight, .25, cx + sx * (rw / 2 - .15), b.y + b.railHeight / 2, bz + sz * (bd / 2 - .15), steel);
          }
          // Clip-on transverse wire separator (6. Separatory, Manual Pages 1 & 7)
          const sepZ = (b.separator.z0 + b.separator.z1) / 2 - d / 2;
          box(rw, .25, .25, cx, b.separator.y1 - .15, sepZ, steel);
          box(rw - .6, .2, .2, cx, b.separator.y0 + .6, sepZ, steel);
        }
        for (const brk of geo.brackets) {
          box(Math.min(brk.width, sw - 1), brk.height, 1.2, cx, brk.y, face - (materials.front.userData.panelThickness ?? PANEL) / 2 - .6, steel);
        }
        break;
      }
      case 'pantry':
        panel(x0, x1, y0, y1);
        pull(Math.min(60, hh * .35), pullX, mid, true);
        shelves(cx - sw / 2, cx + sw / 2, y, y + hh);
        break;
      default:
        panel(x0, x1, y0, y1);
    }
  }
  return { kitchenFitting, owned };
}
