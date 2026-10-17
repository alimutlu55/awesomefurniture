import * as THREE from 'three';
import { kitchenSpans, isKitchenUnit, type KitchenSpan, type UnitPose } from '../../domain/kitchen/kitchen-runs';
import { WORKTOP, kitchenUnit } from '../../domain/kitchen/kitchen-units';
import { hasTrait } from '../../domain/wardrobe/fittings';
import { FIN, PANEL } from '../../domain/wardrobe/catalog.js';
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

  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  function clear() {
    group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    group.clear();
  }
  function slab(span: KitchenSpan, material: THREE.Material) {
    const m = mesh(new THREE.BoxGeometry(span.length, span.height, span.kind === 'plinth' ? PANEL : span.depth),
      material, group, span.x, span.y + span.height / 2, span.z);
    m.rotation.y = span.angle * Math.PI / 180;
    // A plinth is a board set back under the fronts: it stands at the front of its footprint.
    if (span.kind === 'plinth') {
      const a = span.angle * Math.PI / 180, shift = span.depth / 2 - PANEL / 2;
      m.position.x += Math.sin(a) * shift;
      m.position.z += Math.cos(a) * shift;
    }
    m.userData.kitchenSpan = span.kind;
  }
  /** Section centres along a unit's width, cabinet-centred. */
  function sectionCentres(state: Unit['state']) {
    const n = state.n, weights = state.wt.slice(0, n), total = weights.reduce((a, b) => a + b, 0), inner = state.w - (n + 1) * PANEL;
    let x = -state.w / 2 + PANEL;
    return weights.map(weight => { const w = inner * weight / total, c = x + w / 2; x += w + PANEL; return { c, w }; });
  }
  function sink(parent: THREE.Object3D, x: number, top: number, w: number) {
    const bw = Math.min(w - 8, 54), bd = 40, z = WORKTOP.overhang / 2;
    mesh(new THREE.BoxGeometry(bw, .3, bd), steel, parent, x, top + .15, z);
    mesh(new THREE.BoxGeometry(bw - 4, .32, bd - 5), basin, parent, x, top + .16, z + .5);
    mesh(new THREE.CylinderGeometry(1.8, 1.8, .34, 20), glass, parent, x, top + .17, z + .5);
    // The tap: a column behind the basin and a spout reaching over it.
    const tapZ = z - bd / 2 - 3;
    mesh(new THREE.CylinderGeometry(1.3, 1.6, 26, 18), steel, parent, x, top + 13, tapZ);
    const spout = mesh(new THREE.CylinderGeometry(1, 1, 16, 14), steel, parent, x, top + 25.5, tapZ + 8);
    spout.rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(1, 1, 4, 14), steel, parent, x, top + 23.5, tapZ + 15.5);
    const lever = mesh(new THREE.BoxGeometry(1.2, 1.2, 8), steel, parent, x + 3, top + 21, tapZ - 1);
    lever.rotation.x = -.5;
  }
  function hob(parent: THREE.Object3D, x: number, top: number, w: number) {
    const hw = Math.min(w - 4, 58), hd = 50, z = WORKTOP.overhang / 2;
    mesh(new THREE.BoxGeometry(hw, .6, hd), glass, parent, x, top + .3, z);
    for (const [dx, dz, r] of [[-.25, -.22, 9], [.25, -.22, 7], [-.25, .22, 7], [.25, .22, 9]] as const) {
      const burner = mesh(new THREE.RingGeometry(r - .6, r, 40), ring, parent, x + dx * hw, top + .62, z + dz * hd);
      burner.rotation.x = -Math.PI / 2;
    }
  }
  function build(units: readonly Unit[]) {
    clear();
    const spans = kitchenSpans(units);
    for (const span of spans) {
      const first = units.find(u => u.id === span.units[0]);
      slab(span, span.kind === 'worktop' ? stone : plinthMaterial(first?.state.fin ?? 'Oak'));
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
          if (it.k === 'sink') sink(frame, centres[i]!.c, top, centres[i]!.w);
          else hob(frame, centres[i]!.c, top, centres[i]!.w);
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
