import { decorCatalog } from '../src/domain/materials/decor-catalog.ts';
import { createKitchenDesign, kitchenPreset } from '../src/domain/kitchen/kitchen-design.ts';

/** Reference dimension chains from the supplied 15 October 2026 plan, with explicit construction.
 * Appliance envelopes and example service plates are modeled allocations, not manufacturer cut-out templates. */
export function installationDrawingFixture() {
  let next = 1;
  const cabinets = [];
  const add = (preset, x, z, angle, w, extra = {}) => {
    const state = { ...createKitchenDesign(kitchenPreset(preset).unit, preset), w, plinthHeight: 10, frontThickness: preset === 'upper' ? 1.9 : 1.8, worktopThickness: 2,
      sel: 0, item: -1, divider: -1, space: null, open: false, ...extra };
    const cabinet = { id: next++, name: preset, x, y: 0, z, angle, state };
    cabinets.push(cabinet); return cabinet;
  };
  add('corner', 31.5, 51, 90, 102, { h: 88, d: 53, cornerStrip: 4 });
  add('drawers', 31.5, 137.8, 90, 71.6, { h: 88, d: 53 });
  add('drawers', 31.5, 213.6, 90, 80, { h: 88, d: 53 });
  add('drawers', 31.5, 289.4, 90, 71.6, { h: 88, d: 53 });
  add('end-panel', 31.5, 326.1, 90, 1.8, { h: 88, d: 53 });
  // Gross 40 mm corner allocation: 18 mm overlapping blind front plus a 22 mm return strip.
  add('filler', 60.9, 29, 0, 2.2, { h: 88 });
  add('cargo', 72, 29, 0, 20, { h: 88 });
  add('cargo', 113.35, 29, 0, 62.7, { h: 88 });
  add('dishwasher', 174.7, 29, 0, 60, { h: 88 });
  for (const x of [234.7, 294.7, 354.7]) add('fridge', x, 29, 0, 60, { h: 261.2,
    ...(x > 250 ? { ventilationWidth: 50, ventilationHeight: 6 } : {}) });
  add('end-panel', 385.6, 29, 0, 1.8, { h: 261.2 });
  const cover = add('filler', 11, 17.5, 0, 18, { h: 111.2, d: 35, plinthHeight: 0 }); cover.y = 150; cover.state.frontThickness = 1.9;
  cover.state.materials.linkedDecors = false; cover.state.materials.frontDecorId = decorCatalog.find(s => s.construction === 'lacquered_mdf').id;
  for (const [x, w] of [[50.45, 60.9], [111.4, 61], [172.4, 61]]) {
    const upper = add('upper', x, 17.5, 0, w, { h: 111.2 }); upper.y = 150;
    upper.state.materials.integratedLed = true; upper.state.materials.linkedDecors = false;
    upper.state.materials.frontDecorId = decorCatalog.find(s => s.construction === 'lacquered_mdf').id;
  }
  const upperEnd = add('end-panel', 203.8, 17.5, 0, 1.8, { h: 111.2, d: 35 }); upperEnd.y = 150;
  const shelf = add('shelf', 20, 181, 90, 292, { h: 3.8, d: 30 }); shelf.y = 150; shelf.state.materials.integratedLed = true;
  add('hob-top', 31.5, 213.6, 90, 80, { d: 52 }).y = 90;
  add('sink-top', 113.35, 28, 0, 72, { d: 50 }).y = 90;
  return { wardrobes: cabinets, activeWardrobe: 1, nextWardrobeId: next, studio: { template: 'custom',
    corners: [{ id: 'a', x: -6, z: 327 }, { id: 'b', x: -6, z: -6 }, { id: 'c', x: 411.5, z: -6 }],
    walls: [{ id: 'back', a: 'b', b: 'c', thickness: 12, height: 271.2 }, { id: 'left', a: 'a', b: 'b', thickness: 12, height: 271.2 }],
    openings: [{ id: 'service-example', wall: 'left', kind: 'socket', offset: 20, width: 14, height: 7, sill: 118.5, status: 'new' }] } };
}
