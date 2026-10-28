import { automaticInstallationParts } from '../../domain/kitchen/automatic-installation';
import { drawKitchenFixture } from './kitchen-fixture-renderer';
import * as THREE from 'three';
import { kitchenSpans, type UnitPose } from '../../domain/kitchen/kitchen-runs';
import { hob, sinkWithTap, spanSlab } from './furniture-parts';
import { WORKTOP, kitchenUnit } from '../../domain/kitchen/kitchen-units';
import { hasTrait } from '../../domain/wardrobe/fittings';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import { getDecor } from '../../domain/materials/decor-catalog';
import { resolveMaterials, worktopThickness } from '../../domain/materials/configured-materials';
import { createDecorMaterial } from './cabinet-materials';
import { PANEL } from '../../domain/wardrobe/catalog.js';
import { sectionWidths } from '../../domain/wardrobe/shape/wardrobe-shape';
import type { EditorItem } from '../../domain/wardrobe/editor-design';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';

type UnitStatePick = Pick<EditorDesign, 'n' | 'wt' | 'fin' | 'materials' | 'leftPanelThickness' | 'rightPanelThickness' | 'endPanelThickness' | 'endPanelSides' | 'cornerStrip' | 'shape'>;
type Unit = UnitPose & { readonly state: UnitPose['state'] & UnitStatePick & { readonly secs: readonly (readonly EditorItem[])[] } };
interface RunResources {
  M: (color: string, options?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
  wood: (color: string) => THREE.Material;
  shade: (color: string, factor: number) => string;
}

/**
 * The parts a kitchen run shares: one worktop over its base units, one plinth under its floor units, and what
 * sits in the worktop (sinks with their taps, hobs). Rebuilt only when a kitchen unit moves, resizes or changes
 * what it holds, so dragging a unit along the wall extends and splits the worktop as it goes.
 */
export function createKitchenRunRenderer(scene: THREE.Scene, resources: RunResources) {
  const group = new THREE.Group();
  group.name = 'kitchen-runs';
  scene.add(group);
  const stone = resources.M('#e9e6e0', { roughness: .38, metalness: 0 });
  const steel = resources.M('#c4c8cc', { metalness: .85, roughness: .28 });
  const basin = resources.M('#7d8389', { metalness: .8, roughness: .4 });
  const glass = resources.M('#141619', { metalness: .25, roughness: .1 });
  const ring = resources.M('#5d636a', { metalness: .4, roughness: .5 });
  const plinths = new Map<string, THREE.Material>();
  const boardMaterial = (state: Unit['state'], kind: 'worktop' | 'plinth' | 'backsplash') => {
    const materials = resolveMaterials(state), id = kind === 'worktop' ? materials.worktopDecorId
      : kind === 'backsplash' ? materials.backsplashDecorId : materials.carcassDecorId;
    if (!id) return stone;
    let material = plinths.get(id);
    if (!material) { material = createDecorMaterial(resources, getDecor(id)); plinths.set(id, material); }
    return material;
  };
  let key = '';

  function clear() {
    group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    group.clear();
  }
  /** Section centres along a unit's width, cabinet-centred. */
  function sectionCentres(state: Unit['state']) {
    let x = -state.w / 2 + PANEL;
    return sectionWidths(state).map(w => { const left = x; x += w + PANEL; return { left, w }; });
  }
  function build(units: readonly Unit[]) {
    clear();
    const panels = automaticInstallationParts(units as readonly (Unit & { id: number })[]);
    const spans = kitchenSpans([...units, ...panels]);
    for (const p of panels) {
      const frame = new THREE.Group();
      frame.position.set(p.x, p.y, p.z); frame.rotation.y = p.angle * Math.PI / 180;
      const material = boardMaterial(p.state, 'plinth');
      drawKitchenFixture({ group: frame, design: p.state, hitMaterial: material, panel: material, front: material,
        M: resources.M, owned: [], hits: [], measure: null, interactive: false });
      frame.userData.ownerId = p.ownerId; group.add(frame);
    }
    for (const span of spans) {
      const first = units.find(u => u.id === span.units[0]);
      spanSlab(span, first ? boardMaterial(first.state, span.kind) : stone, group);
    }
    // What sits in the worktop stands on top of it, over its own section.
    for (const unit of units) {
      if (!kitchenUnit(unit.state.unit).worktop || !spans.some(s => s.kind === 'worktop' && s.units.includes(unit.id))) continue;
      const frame = new THREE.Group(), top = unit.state.h + worktopThickness(unit.state), centres = sectionCentres(unit.state);
      frame.position.set(unit.x, unit.y || 0, unit.z);
      frame.rotation.y = unit.angle * Math.PI / 180;
      unit.state.secs.slice(0, unit.state.n).forEach((items, i) => {
        // A sink or hob is as wide as its own fitting, wherever that stands in the bay: change the fitting's width and it follows.
        const places = WardrobePlanner.layoutSection(items, centres[i]!.w);
        items.forEach((it, j) => {
          if (!hasTrait(it.k, 'worktop')) return;
          const at = places[j]!, c = centres[i]!.left + at.x0 + at.w / 2, z = WORKTOP.overhang / 2;
          if (it.k === 'sink') sinkWithTap(frame, c, top, at.w, unit.state.d, z, { steel, basin, drain: glass });
          else hob(frame, c, top, at.w, unit.state.d, z, { glass, ring });
        });
      });
      if (frame.children.length) group.add(frame);
    }
  }
  /** Brings the shared parts up to date with the units; cheap when nothing a run depends on changed. */
  function sync(cabinets: readonly Unit[]) {
    const units = cabinets;
    let next = '';
    for (const u of units) {
      const pose = [u.x, u.y || 0, u.z, u.angle],
        size = [u.state.w, u.state.h, u.state.d, u.state.plinthHeight,
          u.state.leftPanelThickness, u.state.rightPanelThickness, u.state.endPanelThickness, u.state.endPanelSides?.join(':'), u.state.cornerStrip,
          JSON.stringify(u.state.shape), u.state.worktopThickness, u.state.n, u.state.wt.join(':')];
      next += [u.id, ...pose, ...size, u.state.fin, JSON.stringify(u.state.materials), u.state.unit, u.state.secs.map(s => s.map(it => [it.k, it.w, it.x, it.ax, it.h].join(':')).join('.')).join('/')].join(',') + ';';
    }
    if (next === key) return;
    key = next;
    build(units);
  }
  function dispose() {
    clear();
    scene.remove(group);
    for (const m of [stone, steel, basin, glass, ring, ...plinths.values()]) m.dispose();
  }
  return { sync, dispose, group };
}
