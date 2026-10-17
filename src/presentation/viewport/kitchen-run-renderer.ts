import * as THREE from 'three';
import { kitchenSpans, isKitchenUnit, type UnitPose } from '../../domain/kitchen/kitchen-runs';
import { hob, sinkWithTap, spanSlab } from './furniture-parts';
import { WORKTOP, kitchenUnit } from '../../domain/kitchen/kitchen-units';
import { hasTrait } from '../../domain/wardrobe/fittings';
import { FIN, PANEL } from '../../domain/wardrobe/catalog.js';
import { sectionWidths } from '../../domain/wardrobe/shape/wardrobe-shape';
import type { EditorItem } from '../../domain/wardrobe/editor-design';
import type { EditorDesign } from '../../domain/wardrobe/editor-design';

type Unit = UnitPose & { readonly state: UnitPose['state'] & Pick<EditorDesign, 'n' | 'wt' | 'fin'> & { readonly secs: readonly (readonly EditorItem[])[] } };
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
  const plinthMaterial = (fin: EditorDesign['fin']) => plinths.get(fin) ?? plinths.set(fin, resources.wood(resources.shade(String(FIN[fin][0]), .72))).get(fin)!;
  let key = '';

  function clear() {
    group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    group.clear();
  }
  /** Section centres along a unit's width, cabinet-centred. */
  function sectionCentres(state: Unit['state']) {
    let x = -state.w / 2 + PANEL;
    return sectionWidths(state).map(w => { const c = x + w / 2; x += w + PANEL; return { c, w }; });
  }
  function build(units: readonly Unit[]) {
    clear();
    const spans = kitchenSpans(units);
    for (const span of spans) {
      const first = units.find(u => u.id === span.units[0]);
      spanSlab(span, span.kind === 'worktop' ? stone : plinthMaterial(first?.state.fin ?? 'Oak'), group);
    }
    // What sits in the worktop stands on top of it, over its own section.
    for (const unit of units) {
      if (!kitchenUnit(unit.state.unit).worktop || !spans.some(s => s.kind === 'worktop' && s.units.includes(unit.id))) continue;
      const frame = new THREE.Group(), top = unit.state.h + WORKTOP.thickness, centres = sectionCentres(unit.state);
      frame.position.set(unit.x, unit.y || 0, unit.z);
      frame.rotation.y = unit.angle * Math.PI / 180;
      unit.state.secs.slice(0, unit.state.n).forEach((items, i) => {
        for (const it of items) {
          if (!hasTrait(it.k, 'worktop')) continue;
          if (it.k === 'sink') sinkWithTap(frame, centres[i]!.c, top, centres[i]!.w, WORKTOP.overhang / 2, { steel, basin, drain: glass });
          else hob(frame, centres[i]!.c, top, centres[i]!.w, WORKTOP.overhang / 2, { glass, ring });
        }
      });
      if (frame.children.length) group.add(frame);
    }
  }
  /** Brings the shared parts up to date with the units; cheap when nothing a run depends on changed. */
  function sync(cabinets: readonly Unit[]) {
    const units = cabinets.filter(isKitchenUnit);
    let next = '';
    for (const u of units) {
      const pose = [u.x, u.y || 0, u.z, u.angle].map(v => v.toFixed(2)), size = [u.state.w, u.state.h, u.state.d, u.state.n, u.state.wt.join(':')];
      next += [u.id, ...pose, ...size, u.state.fin, u.state.unit, u.state.secs.map(s => s.map(it => it.k).join('.')).join('/')].join(',') + ';';
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
