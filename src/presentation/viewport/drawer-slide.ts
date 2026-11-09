import { Group } from 'three';
import type { Material, Object3D } from 'three';
import type { DrawerMechanism } from '../../domain/wardrobe/drawer-mechanism';
import type { BoxBuilder } from './frame-geometry';

/** The name of the part of a pull-out fitting that travels when its piece is shown open (door-renderer slides it). */
export const DRAWER_SLIDE = 'drawer-slide';

/**
 * A drawer as it is built (drawer-mechanism.ts): its open box and the drawer member of each runner on a group that
 * slides `travel` cm towards the viewer; the cabinet member of each runner stays on `parent` with the carcass.
 * The caller puts the front and its handle on the returned group so they travel with the box.
 */
export function drawerSlide(parent: Object3D, box: BoxBuilder, mechanism: DrawerMechanism, materials: { box: Material; bottom?: Material; metal: Material }): Group {
  const slide = travelling(parent, mechanism.travel);
  for (const p of mechanism.box) box(p.w, p.h, p.d, p.x, p.y, p.z, p.name === 'Box bottom' ? materials.bottom ?? materials.box : materials.box, slide);
  for (const r of mechanism.runners) box(r.w, r.h, r.d, r.x, r.y, r.z, materials.metal, r.role === 'drawer' ? slide : parent);
  return slide;
}

/** An empty group on `parent` that slides `travel` cm out when the piece is shown open: the moving part of a pull-out. */
export function travelling(parent: Object3D, travel: number): Group {
  const slide = new Group();
  slide.name = DRAWER_SLIDE;
  slide.userData.slide = travel;
  parent.add(slide);
  return slide;
}

/** A pull-out fitting's travelling part with its travel, or the whole fitting where it has none of its own. */
export function slidingPart(fitting: Object3D, fallback: number): { part: Object3D; travel: number } {
  const part = fitting.getObjectByName(DRAWER_SLIDE);
  return part ? { part, travel: part.userData.slide as number } : { part: fitting, travel: fallback };
}
