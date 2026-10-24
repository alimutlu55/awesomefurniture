/**
 * Wall-mounted utilities, fixtures and obstacles on a room's walls: water pipes (hot, cold and drain),
 * electrical points (sockets), extractor vents, gas points, radiators and light switches. They share
 * `StudioOpening`'s position (`offset`, `sill`) and size (`width`, `height`) on a wall, but sit on the
 * wall's room face instead of cutting a structural opening through the wall.
 */

export type WallUtilityKind = 'water' | 'socket' | 'duct' | 'gas' | 'radiator' | 'switch';
export type StructuralOpeningKind = 'door' | 'window' | 'archway';
export type OpeningKind = StructuralOpeningKind | WallUtilityKind;

export interface WallUtilitySpec {
  readonly kind: WallUtilityKind;
  readonly name: string;
  readonly description: string;
  readonly width: number;
  readonly height: number;
  readonly sill: number;
  /** How far the fixture stands proud of the wall's room face, in centimetres. */
  readonly depth: number;
}

export const WALL_UTILITIES: readonly WallUtilitySpec[] = [
  { kind: 'water', name: 'Water pipes', description: 'Hot and cold supply valves and waste pipe on a wall', width: 24, height: 20, sill: 50, depth: 5 },
  { kind: 'socket', name: 'Electrical point', description: 'Power socket outlet on a wall', width: 16, height: 10, sill: 110, depth: 2 },
  { kind: 'duct', name: 'Extractor vent', description: 'Air duct outlet for an extractor hood or fan', width: 18, height: 18, sill: 215, depth: 3 },
  { kind: 'gas', name: 'Gas point', description: 'Gas shut-off valve and connection point', width: 12, height: 16, sill: 65, depth: 4 },
  { kind: 'radiator', name: 'Radiator', description: 'Wall-mounted heating radiator panel', width: 80, height: 60, sill: 15, depth: 10 },
  { kind: 'switch', name: 'Light switch', description: 'Wall switch plate', width: 10, height: 10, sill: 105, depth: 2 },
];

export const WALL_UTILITY_KINDS = WALL_UTILITIES.map(u => u.kind) as readonly WallUtilityKind[];
export const OPENING_KINDS = ['door', 'window', 'archway', ...WALL_UTILITY_KINDS] as const;

const BY_KIND = new Map<string, WallUtilitySpec>(WALL_UTILITIES.map(u => [u.kind, u]));

export const isWallUtility = (kind: string): kind is WallUtilityKind => BY_KIND.has(kind);
export const wallUtilitySpec = (kind: string): WallUtilitySpec | undefined => BY_KIND.get(kind);

/** Lowercase noun for messages and checks ("door", "water pipes", "electrical point"). */
export function openingNoun(kind: OpeningKind): string {
  return BY_KIND.get(kind)?.name.toLowerCase() ?? kind;
}

/** Minimum size and wall margins (centimetres) for an opening or wall utility. */
export function openingLimits(kind: OpeningKind) {
  return isWallUtility(kind)
    ? { minWidth: 6, minHeight: 6, endMargin: 2, topMargin: 2, gap: 2 }
    : { minWidth: 40, minHeight: 40, endMargin: 5, topMargin: 5, gap: 5 };
}

/** Whether two openings/utilities on the same wall overlap in 2D (along the wall and vertically). */
export function openingsOverlap(
  a: { offset: number; width: number; sill: number; height: number },
  b: { offset: number; width: number; sill: number; height: number },
  gap = 2,
): boolean {
  const along = Math.min(a.offset + a.width / 2, b.offset + b.width / 2) - Math.max(a.offset - a.width / 2, b.offset - b.width / 2);
  const up = Math.min(a.sill + a.height, b.sill + b.height) - Math.max(a.sill, b.sill);
  return along > -gap && up > -gap;
}
