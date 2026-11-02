import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FRONT, FRONT_OVERLAYS, FRONT_REVEALS_MM, FRONT_STYLES, frontOverlay, frontStyle, isFrontReveal,
  type FrontOverlayDef, type FrontStyleDef } from '../../src/domain/wardrobe/front-styles';
import { DOOR, cabinetDoorAreas } from '../../src/domain/wardrobe/door-layout';
import { PLINTH } from '../../src/domain/wardrobe/catalog.js';
import { MATERIAL_FAMILIES } from '../../src/domain/materials/decor-types';
import { decorCatalog as DECORS } from '../../src/domain/materials/decor-catalog';
import { createEditorState } from '../../src/application/projects/editor-state';

/**
 * Adding a front style means adding one entry to front-styles.ts. These tests walk EVERY style, overlay and reveal
 * through every field. A failure names the entry and what is missing.
 */

const styles = FRONT_STYLES as readonly FrontStyleDef[], overlays = FRONT_OVERLAYS as readonly FrontOverlayDef[];

test('front styles · keys are unique words with names', () => {
  for (const list of [styles, overlays] as const) {
    const keys = list.map(e => e.key);
    assert.equal(new Set(keys).size, keys.length, 'keys are unique');
    for (const e of list) {
      assert.match(e.key, /^[a-z]+$/, `${e.key}: one lowercase word, it is saved in projects`);
      assert.ok(e.name.length > 0, `${e.key}: has a name`);
    }
  }
});

test('front styles · every style names overlays, decors and handles that exist', () => {
  const frontCategories = new Set(DECORS.filter(d => d.allowedZones.includes('fronts')).map(d => d.category));
  for (const s of styles) {
    assert.ok(s.overlays.length > 0, `${s.key}: give it at least one overlay`);
    for (const o of s.overlays) assert.ok(frontOverlay(o), `${s.key}: unknown overlay ${o}`);
    assert.ok(s.decors.length > 0, `${s.key}: give it at least one decor category`);
    for (const c of s.decors) {
      assert.ok(c in MATERIAL_FAMILIES, `${s.key}: unknown decor category ${c}`);
      assert.ok(frontCategories.has(c), `${s.key}: no decor in ${c} is allowed for fronts`);
    }
    assert.ok(s.handles === 'any' || s.handles === 'none', `${s.key}: handles is "any" or "none"`);
    if (s.handles === 'none') assert.ok(s.grip, `${s.key}: a front with no handle needs its own grip`);
    if (s.frame) for (const [k, v] of Object.entries(s.frame)) assert.ok(v > 0, `${s.key}: frame ${k} is positive`);
    if (s.edgeProfileMm !== undefined) assert.ok(s.edgeProfileMm > 0, `${s.key}: edge profile is positive`);
    assert.equal(frontStyle(s.key), s);
  }
  assert.equal(frontStyle('nope'), undefined);
});

test('front styles · every decor category allowed for fronts can be used by some style', () => {
  const used = new Set(styles.flatMap(s => s.decors));
  for (const d of DECORS.filter(x => x.allowedZones.includes('fronts'))) assert.ok(used.has(d.category), `${d.id}: no style takes ${d.category}`);
});

test('front styles · overlays and reveals are consistent', () => {
  for (const o of overlays) {
    assert.ok(o.cover >= 0 && o.cover <= 1, `${o.key}: cover is a share between 0 and 1`);
    assert.equal(o.inset, o.cover === 0, `${o.key}: only an inset leaf leaves the board showing`);
  }
  assert.deepEqual([...FRONT_REVEALS_MM].sort((a, b) => a - b), [...FRONT_REVEALS_MM], 'reveals are listed smallest first');
  for (const r of FRONT_REVEALS_MM) assert.ok(Number.isInteger(r) && r > 0 && isFrontReveal(r), `${r} mm: whole positive millimetres`);
  assert.ok(!isFrontReveal(5));
});

test('front styles · the materials profile maps to one style each', () => {
  const profiles = styles.map(s => s.materialProfile).filter(Boolean);
  assert.equal(new Set(profiles).size, profiles.length, 'one style per saved profile');
  assert.ok(profiles.includes('slab') && profiles.includes('micro_shaker'), 'both saved profiles have a style');
});

test('front styles · the default is slab, full overlay, 2 mm: equal to today\'s door geometry', () => {
  assert.deepEqual({ ...DEFAULT_FRONT }, { style: 'slab', overlay: 'full', revealMm: 2 });
  const style = frontStyle(DEFAULT_FRONT.style)!, overlay = frontOverlay(DEFAULT_FRONT.overlay)!;
  assert.ok((style.overlays as readonly string[]).includes(overlay.key), 'the default style takes the default overlay');
  assert.equal(overlay.cover, 1);
  assert.equal(overlay.inset, false);
  assert.equal(DEFAULT_FRONT.revealMm / 10, DOOR.topGap, 'the gap under the top is one reveal');
  // Today's leaves: half a reveal inside the left outer face, one reveal apart where they meet, one reveal above the plinth.
  const state = createEditorState();
  Object.assign(state, { n: 2, wt: [60, 60], dividers: [] });
  const half = DEFAULT_FRONT.revealMm / 20, [a, b] = cabinetDoorAreas(state as never, [60, 60]);
  assert.ok(Math.abs(a!.x0 - half) < 1e-9, 'left edge sits half a reveal inside the outer face');
  assert.ok(Math.abs(b!.x0 - a!.x1 - 2 * half) < 1e-9, 'leaves meet one reveal apart');
  assert.ok(Math.abs(a!.y0 - (PLINTH + 2 * half)) < 1e-9, 'bottom sits one reveal above the plinth');
});
