/**
 * The furniture taxonomy: one category tree every piece the Add sheet offers is filed under, as shops and product
 * catalogues file them. Categories are data: the Add sheet's tiles, their names and the room filter all come from here,
 * so a new kind of furniture is one entry here and one item pointing at it, never a change to menu code.
 *
 * - `parent` makes the tree (Furniture › Cabinets and storage › Wardrobes...); only categories with items are shown.
 * - `rooms` is an attribute to filter by, not a category: a wardrobe belongs in a bedroom and a hallway.
 * - `google` is the matching Google Product Taxonomy path where one exists, for shopping feeds and analytics.
 * Names follow furniture retail (IKEA: "Chests of drawers", "Sideboards", "Shoe cabinets"); see docs/furniture.md.
 */
export const ROOMS = [
  { key: 'bedroom', label: 'Bedroom' },
  { key: 'living', label: 'Living room' },
  { key: 'hallway', label: 'Hallway' },
  { key: 'kitchen', label: 'Kitchen' },
] as const;
export type RoomKey = typeof ROOMS[number]['key'];

export interface FurnitureCategory {
  readonly id: string;
  readonly label: string;
  readonly parent: string | null;
  readonly rooms: readonly RoomKey[];
  readonly google?: string;
}

export const FURNITURE_CATEGORIES = [
  { id: 'furniture', label: 'Furniture', parent: null, rooms: [], google: 'Furniture' },
  { id: 'cabinets-storage', label: 'Cabinets and storage', parent: 'furniture', rooms: [], google: 'Furniture > Cabinets & Storage' },
  { id: 'wardrobe', label: 'Wardrobes', parent: 'cabinets-storage', rooms: ['bedroom', 'hallway'],
    google: 'Furniture > Cabinets & Storage > Armoires & Wardrobes' },
  { id: 'chests', label: 'Chests of drawers', parent: 'cabinets-storage', rooms: ['bedroom'] },
  { id: 'sideboards', label: 'Sideboards and TV units', parent: 'cabinets-storage', rooms: ['living'],
    google: 'Furniture > Cabinets & Storage > Buffets & Sideboards' },
  { id: 'shoe-cabinets', label: 'Shoe cabinets', parent: 'cabinets-storage', rooms: ['hallway'] },
  { id: 'kitchen', label: 'Kitchen cabinets', parent: 'cabinets-storage', rooms: ['kitchen'] },
] as const satisfies readonly FurnitureCategory[];

export type FurnitureCategoryId = typeof FURNITURE_CATEGORIES[number]['id'];

export function furnitureCategory(id: string): FurnitureCategory | undefined {
  return (FURNITURE_CATEGORIES as readonly FurnitureCategory[]).find(c => c.id === id);
}

/** Categories with no children: the ones furniture is filed under, in the tree's order. */
export function leafCategories(): FurnitureCategory[] {
  const all = FURNITURE_CATEGORIES as readonly FurnitureCategory[];
  return all.filter(c => !all.some(child => child.parent === c.id));
}

/** The labels from the root down to a category's parent: where it sits ("Furniture", "Cabinets and storage"). */
export function categoryPath(id: string): string[] {
  const path: string[] = [];
  for (let c = furnitureCategory(furnitureCategory(id)?.parent ?? ''); c; c = furnitureCategory(c.parent ?? '')) path.unshift(c.label);
  return path;
}
