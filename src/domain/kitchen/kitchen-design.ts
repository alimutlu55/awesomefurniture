import type { EditorDesign, EditorItem } from '../wardrobe/editor-design';
import type { ItemKind } from '../wardrobe/wardrobe';
import { createInitialDesign } from '../wardrobe/default-design';
import { defaultMaterials } from '../materials/configured-materials';
import { fitting, hasTrait } from '../wardrobe/fittings';
import { PANEL } from '../wardrobe/catalog.js';
import { plinthOf } from '../wardrobe/carcass';
import { kitchenUnit, type KitchenUnitKey } from './kitchen-units';

/**
 * Kitchen presets: a unit and what it holds, offered in the Cabinets add panel. Each part is
 * [kind, share]; parts share the unit's inside height in proportion, from the floor up. The plain
 * units start empty, to be filled with Add item; the others come ready made.
 * A preset only names a unit and its contents: sizes and rules come from the unit and fittings registries.
 */
export const KITCHEN_PRESETS = [
  { key: 'filler', unit: 'filler', name: 'Installation strip', parts: [] },
  { key: 'end-panel', unit: 'end-panel', name: 'End/Separator pane', parts: [] },
  { key: 'base', unit: 'base', name: 'Base cabinet', parts: [] },
  { key: 'drawers', unit: 'base', name: 'Drawer unit', parts: [['pan', 3], ['pan', 3], ['cutlery', 2]] },
  { key: 'oven-under', unit: 'base', name: 'Oven unit', parts: [['cutlery', 1], ['oven', 5]] },
  { key: 'sink-top', unit: 'sink-top', name: 'Sink', parts: [] },
  { key: 'hob-top', unit: 'hob-top', name: 'Hob', parts: [] },
  { key: 'dishwasher', unit: 'base', name: 'Dishwasher', parts: [['dishwasher', 1]] },
  { key: 'fridge-under', unit: 'base', name: 'Under-counter fridge', parts: [['fridge', 1]] },
  { key: 'upper', unit: 'upper', name: 'Wall cabinet', parts: [] },
  { key: 'shelf', unit: 'shelf', name: 'Wall shelf', parts: [] },
  { key: 'lift', unit: 'upper', name: 'Lift-up wall cabinet', parts: [['flap', 1]], size: { w: 80, h: 40 } },
  { key: 'microwave', unit: 'upper', name: 'Microwave wall unit', parts: [['microwave', 1]], size: { w: 60, h: 48 } },
  { key: 'hood', unit: 'upper', name: 'Cooker hood', parts: [['hood', 1]], size: { w: 60, h: 40 } },
  { key: 'cargo', unit: 'base', name: 'Cargo pull-out', parts: [['cargo', 1]], size: { w: 30 } },
  { key: 'corner', unit: 'base', name: 'Corner pull-out', parts: [['corner', 1]], size: { w: 100 } },
  { key: 'tall', unit: 'tall', name: 'Tall cabinet', parts: [] },
  { key: 'cargo-tall', unit: 'tall', name: 'Tall cargo', parts: [['cargo', 160], ['cupboard', 43.4]], size: { w: 40 } },
  { key: 'fridge', unit: 'tall', name: 'Fridge housing', parts: [['fridge', 1]] },
  { key: 'fridge-tall', unit: 'tall', name: 'Tall fridge-freezer', parts: [['fridge', 1]], size: { h: 190 } },
  { key: 'oven-tower', unit: 'tall', name: 'Oven tower', parts: [['pan', 28], ['cupboard', 52.4], ['oven', 60], ['microwave', 38], ['cupboard', 25]] },
  { key: 'larder', unit: 'tall', name: 'Pantry', parts: [['pantry', 160], ['cupboard', 43.4]] },
] as const satisfies readonly { key: string; unit: KitchenUnitKey; name: string; parts: readonly (readonly [string, number])[]; size?: { w?: number; h?: number } }[];
export type KitchenPresetKey = typeof KITCHEN_PRESETS[number]['key'];
export const kitchenPreset = (key: string | undefined) => KITCHEN_PRESETS.find(p => p.key === key);
/** A preset's own width and height where it differs from its unit's default (a wide, low lift-up cabinet). */
export const presetSize = (preset: object | undefined): { w?: number; h?: number } => (preset && 'size' in preset ? (preset as { size: { w?: number; h?: number } }).size : {});

/** Clear height inside a unit, between its bottom and top boards. */
export const kitchenInside = (h: number, unitKey: KitchenUnitKey = 'base') => Math.round((h - plinthOf({ product: 'kitchen', unit: unitKey }) - 2 * PANEL) * 100) / 100;

/** Whether a kitchen unit holds only a fixed filler or corner cover panel, so it can narrow down to 5 cm. */
export const isCoverUnit = (design: { readonly product?: EditorDesign['product']; readonly n?: number | undefined; readonly secs?: readonly (readonly EditorItem[])[] | undefined }) =>
  design.product === 'kitchen' && (design.secs?.[0]?.length ?? 0) > 0 && (design.secs ?? []).slice(0, design.n ?? 1).every(s => s.length > 0 && s.every(it => hasTrait(it.k, 'filler')));

/** An empty filler or corner cover unit matching `from` in height, depth and finish, at `width` cm wide. */
export function createKitchenCover(from: EditorDesign, width: number): EditorDesign {
  const unitKey = from.unit ?? 'base', inside = kitchenInside(from.h, unitKey), def = fitting('cover')!;
  const secs: EditorItem[][] = [[{ k: 'cover', h: Math.max(def.min, Math.min(def.max, inside)), purpose: def.purpose }], [], [], [], [], []];
  return { ...structuredClone(from), w: Math.round(width * 10) / 10, n: 1, wt: [100, 100, 100, 100, 100, 100], secs, dividers: [],
    leftPanelThickness: undefined, rightPanelThickness: undefined, endPanelSides: undefined, endPanelThickness: undefined };
}

/** Items that share `height` in proportion to their parts, rounded so they fill it exactly. */
function shareHeight(parts: readonly (readonly [string, number])[], height: number): EditorItem[] {
  const total = parts.reduce((s, [, share]) => s + share, 0);
  let used = 0;
  return parts.map(([k, share], i) => {
    const h = i === parts.length - 1 ? Math.round((height - used) * 100) / 100 : Math.round(height * share / total * 100) / 100;
    used += h;
    const def = fitting(k)!;
    return { k: k as ItemKind, h: Math.max(def.min, Math.min(def.max, h)), purpose: def.purpose };
  });
}

/** A new kitchen unit with the contents of a preset (or the unit's plain storage). */
export function createKitchenDesign(unitKey: KitchenUnitKey, presetKey?: string): EditorDesign {
  const unit = kitchenUnit(unitKey), preset = kitchenPreset(presetKey);
  const design = createInitialDesign();
  const secs: EditorItem[][] = [[], [], [], [], [], []];
  const own = preset && preset.unit === unitKey ? preset : undefined, size = presetSize(own), h = size.h ?? unit.h;
  secs[0] = shareHeight(own ? own.parts : unit.storage, kitchenInside(h, unitKey));
  return { ...design, w: size.w ?? unit.w, h, d: unit.d, n: 1, secs, fin: 'White', materials: defaultMaterials('White'), doors: 'none', product: 'kitchen', unit: unitKey };
}

/**
 * Plain storage in place of an appliance, at the same height so the unit keeps its look: a drawer for a
 * shallow front, pan drawers for one lower than a cupboard door in a floor unit, a cupboard door otherwise.
 */
export function plainStorageFor(item: EditorItem, unitKey: KitchenUnitKey | undefined): EditorItem[] {
  const drawer = fitting('cutlery')!, pan = fitting('pan')!, door = fitting('cupboard')!;
  if (item.h <= drawer.max) return [{ k: 'cutlery', h: Math.max(drawer.min, item.h), purpose: drawer.purpose }];
  if (unitKey !== 'upper' && item.h < door.height) {
    const n = Math.ceil(item.h / pan.max), h = Math.round(item.h / n * 100) / 100;
    return Array.from({ length: n }, () => ({ k: 'pan' as ItemKind, h, purpose: pan.purpose }));
  }
  return [{ k: 'cupboard', h: Math.max(door.min, Math.min(door.max, item.h)), purpose: door.purpose }];
}

/** A duplicated unit keeps its size, sections and finish; appliances (sink, hob, oven, fridge) become plain storage. */
export function duplicateKitchenDesign<T extends EditorDesign>(design: T): T {
  const copy = structuredClone(design);
  copy.secs = copy.secs.map(items => items.flatMap(item => {
    if (!hasTrait(item.k, 'appliance')) return [item];
    let y = item.y;
    // Same place in the bay: its width and alignment, and a pinned height stacks the parts from there.
    return plainStorageFor(item, copy.unit).map(plain => {
      const placed: EditorItem = { ...plain, ...(item.w !== undefined ? { w: item.w } : {}), ...(item.x !== undefined ? { x: item.x } : {}),
        ...(item.ax ? { ax: item.ax } : {}), ...(item.hinge ? { hinge: item.hinge } : {}), ...(y !== undefined ? { y } : {}) };
      if (y !== undefined) y = Math.round((y + plain.h) * 100) / 100;
      return placed;
    });
  }));
  return copy;
}
