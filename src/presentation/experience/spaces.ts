import { DESIGN_SPEC_VERSION } from '../../domain/spec/design-spec';
import type { DesignSpec, SpecWardrobe } from '../../domain/spec/design-spec';
import { POSSESSIONS } from '../../domain/wardrobe/possessions';

/** What a person owns, by possession key, as they counted it. */
export type Belongings = Readonly<Record<string, number>>;

/** A place a wardrobe can live, offered when a design starts: the room (a built-in one, a rectangle, a ceiling
 * that comes down) and where the wardrobes stand, each with its share of the belongings. */
export interface Space {
  readonly id: string;
  readonly name: string;
  readonly line: string;
  readonly room?: DesignSpec['room'];
  readonly ceilings?: DesignSpec['ceilings'];
  readonly wardrobes: readonly (Omit<SpecWardrobe, 'for' | 'autoDesign'> & { readonly share: number })[];
}

/** The spaces, most common first. Rooms and shapes are the registries' own names. */
export const SPACES: readonly Space[] = [
  { id: 'bedroom', name: 'Bedroom wall', line: 'A 2.4 m wardrobe on the bedroom wall', room: { template: 'bedroom' }, wardrobes: [{ against: 1, width: 240, from: 80, share: 1 }] },
  { id: 'alcove', name: 'Alcove', line: 'Fitted wall to wall in a recess', room: { template: 'alcove' }, wardrobes: [{ against: 3, share: 1 }] },
  { id: 'walk-in', name: 'Walk-in', line: 'A dressing room, wardrobes on two walls', room: { template: 'walk-in' },
    wardrobes: [{ against: 1, share: .62 }, { against: 4, from: 0, width: 120, share: .38 }] },
  { id: 'attic', name: 'Attic eaves', line: 'Shaped under a sloping roof', room: { width: 420, depth: 320, height: 250 },
    ceilings: [{ wall: 1, shape: 'slope' }], wardrobes: [{ against: 2, share: 1 }] },
  { id: 'stairs', name: 'Under the stairs', line: 'Every centimetre below a staircase', room: { template: 'under-stairs' }, wardrobes: [{ against: 1, share: 1 }] },
  { id: 'free', name: 'Just the wardrobe', line: 'Freestanding, 2 m wide', wardrobes: [{ width: 200, share: 1 }] },
];
export const space = (id: string) => SPACES.find(s => s.id === id) ?? SPACES[0]!;

/** Ways of living, to start the counting from: a scale on everyone's usual counts, and how many bags to stand. */
export const PERSONAS = [
  { id: 'light', name: 'Travel light', scale: .55, shelf: 0 },
  { id: 'everyday', name: 'Everyday', scale: 1, shelf: 0 },
  { id: 'lover', name: 'Clothes lover', scale: 1.8, shelf: 6 },
  { id: 'two', name: 'Two of us', scale: 1.9, shelf: 3 },
] as const;
export type PersonaId = typeof PERSONAS[number]['id'];

/** The counts a way of living starts from, for every possession, within what each can count to. Pure. */
export function personaBelongings(id: string): Record<string, number> {
  const persona = PERSONAS.find(p => p.id === id) ?? PERSONAS[1];
  return Object.fromEntries(POSSESSIONS.map(p => {
    const n = p.engine === 'shelf' ? persona.shelf : Math.round(p.need.default * persona.scale);
    return [p.key, Math.max(0, Math.min(p.need.max, n))];
  }));
}

/** How many things in all. Pure. */
export const countBelongings = (b: Belongings) => Object.values(b).reduce((sum, n) => sum + Math.max(0, n || 0), 0);

/** Shares the belongings between wardrobes, in whole items that add back up to what was counted. Pure. */
export function shareBelongings(b: Belongings, shares: readonly number[]): Record<string, number>[] {
  const total = shares.reduce((a, s) => a + s, 0) || 1, out = shares.map(() => ({} as Record<string, number>));
  for (const p of POSSESSIONS) {
    const n = Math.max(0, Math.round(b[p.key] ?? 0));
    let given = 0;
    shares.forEach((s, k) => {
      const part = k === shares.length - 1 ? n - given : Math.round(n * s / total);
      out[k]![p.key] = part;
      given += part;
    });
  }
  return out;
}

/** The design spec for a space: with belongings, every wardrobe is planned by Auto design for its share; without,
 * the room and the empty wardrobes, to preview the space. Pure. */
export function spaceSpec(s: Space, belongings?: Belongings): DesignSpec {
  const shared = belongings ? shareBelongings(belongings, s.wardrobes.map(w => w.share)) : null;
  return {
    specVersion: DESIGN_SPEC_VERSION,
    name: s.name,
    ...(s.room ? { room: s.room } : {}),
    ...(s.ceilings ? { ceilings: s.ceilings } : {}),
    wardrobes: s.wardrobes.map(({ share: _share, ...w }, k) => shared ? { ...w, for: shared[k]! } : { ...w, autoDesign: false }),
  };
}
