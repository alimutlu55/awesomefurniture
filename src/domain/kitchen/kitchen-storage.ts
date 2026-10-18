import { fitting, hasTrait } from '../wardrobe/fittings';
import type { EditorItem } from '../wardrobe/editor-design';
import { kitchenAlong, kitchenSpans, type UnitPose } from './kitchen-runs';
import { KITCHEN_UNIT_KEYS, kitchenUnit, type KitchenUnitKey } from './kitchen-units';

type Unit = UnitPose & { readonly state: UnitPose['state'] & { readonly n: number; readonly secs: readonly (readonly EditorItem[])[] } };

/** What a kitchen holds, for the Storage panel: how many of each kind of front, the appliances, the worktop
 * length and the units, with notes on what a working kitchen still lacks. Counts the whole kitchen along the
 * selected unit's wall, since a kitchen is used as one. Plain data; the panel words it. */
export function kitchenStorage(scene: readonly Unit[], selected: Unit) {
  const kitchen = kitchenAlong(scene, selected) as Unit[];
  const items = kitchen.flatMap(u => u.state.secs.slice(0, u.state.n).flat());
  const count = (test: (it: EditorItem) => boolean) => items.filter(test).length;
  const drawers = count(it => hasTrait(it.k, 'pullout') && hasTrait(it.k, 'front') && !hasTrait(it.k, 'appliance') && (fitting(it.k)?.height ?? 0) < 60);
  const doors = count(it => hasTrait(it.k, 'front') && !hasTrait(it.k, 'pullout') && !hasTrait(it.k, 'appliance'));
  const open = count(it => hasTrait(it.k, 'openShelf'));
  const tall = count(it => hasTrait(it.k, 'pullout') && (fitting(it.k)?.height ?? 0) >= 60);
  const appliances = [...new Set(items.filter(it => hasTrait(it.k, 'appliance')).map(it => fitting(it.k)!.name))];
  const worktop = kitchenSpans(kitchen).filter(s => s.kind === 'worktop').reduce((sum, s) => sum + s.length, 0);
  const units = Object.fromEntries(KITCHEN_UNIT_KEYS.map(k => [k, kitchen.filter(u => kitchenUnit(u.state.unit).key === k).length])) as Record<KitchenUnitKey, number>;
  const has = (kind: string) => items.some(it => it.k === kind);
  const notes: string[] = [];
  if (!has('sink')) notes.push('No sink yet: add one to a base cabinet with Add item.');
  if (!has('hob')) notes.push('No hob yet: add one to a base cabinet, under the worktop.');
  const empty = kitchen.filter(u => !u.state.secs.slice(0, u.state.n).some(s => s.length)).length;
  if (empty) notes.push(empty + (empty === 1 ? ' cabinet is' : ' cabinets are') + ' still empty: select a space and use Add item.');
  return { drawers, doors, open, tall, appliances, worktop: Math.round(worktop), units, notes };
}
