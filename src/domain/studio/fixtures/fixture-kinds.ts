/**
 * Fixtures: what is built into a room and plumbed in, such as a toilet or a basin. THIS IS THE ONLY PLACE TO ADD
 * ONE: append an entry to FIXTURES. The catalogue, its drawings, the 3D model, saving, sizes and validation all
 * follow from it. Plain data in scene centimetres.
 *
 * A fixture stands against a wall, or against what stands in front of the wall there: a boxing that hides a
 * cistern frame or pipes (a floor-standing shape on the wall, see studio-ceiling.ts). How it is fitted is a
 * `setup`: a choice of its own type and of that boxing, so "wall-hung, in a half-height boxing" is one choice.
 */

export interface FixtureSize { readonly width: number; readonly depth: number; readonly height: number }
type Range = readonly [number, number];

/** A kind's variant: its default size and its limits. */
export interface FixtureType {
  readonly id: string;
  readonly name: string;
  readonly note: string;
  readonly size: FixtureSize;
  readonly limits: { readonly width: Range; readonly depth: Range; readonly height: Range };
  /** Where its solid starts and stops above the floor, from its size: what it runs into, and what it stands in front of. */
  readonly extent: (size: FixtureSize) => { readonly bottom: number; readonly top: number };
  /** Has a cabinet under it, with fronts to finish. */
  readonly cabinet?: boolean;
}

/** What stands behind a fixture: nothing (the wall, or a frame inside it), or a boxing of this height. */
export type Boxing = 'none' | 'low' | 'half' | 'full';
/** Boxing heights in centimetres; a full-height boxing reaches the ceiling over it. */
export const BOXING = Object.freeze({ low: 85, half: 120, depth: 20, width: 90, minWidth: 20,
  /** A gap this narrow between a new boxing and a wall's end is closed: nobody could clean or tile it. */
  closeGap: 20 });

/** How a fixture is fitted: its type, and the boxing behind it. Chosen as one. */
export interface FixtureSetup {
  readonly id: string;
  readonly name: string;
  readonly note: string;
  readonly type: string;
  readonly boxing: Boxing;
}

export type FinishGroup = 'ceramic' | 'metal' | 'front';
export interface Finish { readonly id: string; readonly name: string; readonly color: string; readonly roughness: number; readonly metalness: number }

export const FINISHES: Readonly<Record<FinishGroup, readonly Finish[]>> = Object.freeze({
  ceramic: [
    { id: 'gloss-white', name: 'Gloss white', color: '#f6f5f1', roughness: .12, metalness: 0 },
    { id: 'matt-white', name: 'Matt white', color: '#ecebe6', roughness: .55, metalness: 0 },
    { id: 'stone', name: 'Stone grey', color: '#b9b4ab', roughness: .5, metalness: 0 },
    { id: 'matt-black', name: 'Matt black', color: '#2f2f2e', roughness: .5, metalness: 0 },
  ],
  metal: [
    { id: 'chrome', name: 'Chrome', color: '#e3e6e8', roughness: .08, metalness: 1 },
    { id: 'brushed-steel', name: 'Brushed steel', color: '#b9b9b3', roughness: .35, metalness: 1 },
    { id: 'brushed-brass', name: 'Brushed brass', color: '#c9a66b', roughness: .32, metalness: 1 },
    { id: 'matt-black', name: 'Matt black', color: '#2a2a29', roughness: .45, metalness: .4 },
  ],
  front: [
    { id: 'white', name: 'White', color: '#f1efe9', roughness: .5, metalness: 0 },
    { id: 'oak', name: 'Oak', color: '#c9a273', roughness: .6, metalness: 0 },
    { id: 'walnut', name: 'Walnut', color: '#6e4c35', roughness: .55, metalness: 0 },
    { id: 'sage', name: 'Sage', color: '#9da995', roughness: .55, metalness: 0 },
    { id: 'charcoal', name: 'Charcoal', color: '#45484a', roughness: .5, metalness: 0 },
  ],
});
export const FINISH_NAMES: Readonly<Record<FinishGroup, string>> = Object.freeze({ ceramic: 'Ceramic', metal: 'Metal', front: 'Cabinet' });

/** Where a basin's tap sits: on the basin (or its worktop), or on the wall above it. */
export const TAPS = [
  { id: 'deck', name: 'On the basin', note: 'Mixer on the basin' },
  { id: 'wall', name: 'On the wall', note: 'Valve hidden in the wall' },
] as const;
export type TapPlace = typeof TAPS[number]['id'];

export interface FixtureKind {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  /** Catalogue and menu icon: an SVG path on a 24 × 24 grid. */
  readonly icon: string;
  readonly types: readonly FixtureType[];
  /** How it is fitted, when that includes a boxing behind it. Without setups, its types are the choice. */
  readonly setups?: readonly FixtureSetup[];
  /** The setup a new one starts with (else its first type). */
  readonly start?: string;
  /** What its height field sets, and the field's hint. */
  readonly height: { readonly label: string; readonly hint: string };
  /** Free floor in front of it to use it, and from its side to a wall: advice, never enforced. Centimetres. */
  readonly use: number;
  readonly side: number;
  readonly finishes: readonly FinishGroup[];
  /** Offers a tap on the basin or on the wall. */
  readonly tap?: boolean;
}

const TOILET_LIMITS = { width: [33, 45], depth: [45, 72], height: [38, 50] } as const;

export const FIXTURES = [
  {
    key: 'toilet', name: 'Toilet', description: 'A toilet, wall-hung or floor-standing, with its cistern hidden or on show',
    icon: 'M7 3h6v7H7zM5 12h12a5 5 0 0 1-5 5h-1l1 4H8l1-4a5 5 0 0 1-4-5zM10 6h.01',
    types: [
      { id: 'wall-hung', name: 'Wall-hung', note: 'Hung on a frame in the wall or a boxing', size: { width: 36, depth: 53, height: 42 },
        limits: TOILET_LIMITS, extent: s => ({ bottom: s.height - 33, top: s.height + 2 }) },
      { id: 'back-to-wall', name: 'Back to wall', note: 'Stands on the floor, cistern hidden behind it', size: { width: 36, depth: 54, height: 42 },
        limits: TOILET_LIMITS, extent: s => ({ bottom: 0, top: s.height + 2 }) },
      { id: 'close-coupled', name: 'Visible cistern', note: 'Stands on the floor, its cistern on the bowl', size: { width: 37, depth: 66, height: 42 },
        limits: TOILET_LIMITS, extent: s => ({ bottom: 0, top: s.height + 38 }) },
    ],
    setups: [
      { id: 'visible', name: 'Visible cistern', note: 'On the floor, no boxing', type: 'close-coupled', boxing: 'none' },
      { id: 'back-to-wall', name: 'Back to wall', note: 'Cistern in a low box', type: 'back-to-wall', boxing: 'low' },
      { id: 'wall-hung', name: 'Wall-hung', note: 'Half-height boxing', type: 'wall-hung', boxing: 'half' },
      { id: 'wall-hung-full', name: 'Wall-hung', note: 'Full-height wall', type: 'wall-hung', boxing: 'full' },
      { id: 'wall-hung-in-wall', name: 'Wall-hung', note: 'Frame in the wall', type: 'wall-hung', boxing: 'none' },
    ],
    start: 'wall-hung',
    height: { label: 'Seat height', hint: 'Top of the seat' },
    use: 60, side: 20, finishes: ['ceramic', 'metal'],
  },
  {
    key: 'basin', name: 'Basin', description: 'A washbasin with its tap: on the wall, on a pedestal or on a vanity unit',
    icon: 'M3 9h18l-2 5a4 4 0 0 1-4 3H9a4 4 0 0 1-4-3zM12 9V5h4M12 17v4',
    types: [
      { id: 'wall-hung', name: 'Wall-hung', note: 'Fixed to the wall', size: { width: 60, depth: 46, height: 85 },
        limits: { width: [35, 120], depth: [25, 60], height: [70, 100] }, extent: s => ({ bottom: s.height - 18, top: s.height }) },
      { id: 'pedestal', name: 'Pedestal', note: 'On a column to the floor', size: { width: 56, depth: 45, height: 85 },
        limits: { width: [40, 80], depth: [30, 60], height: [75, 95] }, extent: s => ({ bottom: 0, top: s.height }) },
      { id: 'vanity', name: 'Vanity unit', note: 'Basin set into a floating cabinet', size: { width: 80, depth: 46, height: 85 },
        limits: { width: [45, 180], depth: [35, 60], height: [75, 100] }, extent: s => ({ bottom: s.height - 52, top: s.height }), cabinet: true },
      { id: 'countertop', name: 'Countertop', note: 'A bowl on a floating worktop', size: { width: 90, depth: 46, height: 92 },
        limits: { width: [50, 180], depth: [35, 60], height: [80, 105] }, extent: s => ({ bottom: s.height - 62, top: s.height }), cabinet: true },
    ],
    height: { label: 'Rim height', hint: 'Top of the basin' },
    use: 70, side: 20, finishes: ['ceramic', 'metal', 'front'], tap: true,
  },
] as const satisfies readonly FixtureKind[];

export type FixtureKey = typeof FIXTURES[number]['key'];
export const FIXTURE_KEYS = FIXTURES.map(k => k.key) as readonly FixtureKey[];

const BY_KEY = new Map<string, FixtureKind>(FIXTURES.map(k => [k.key, k]));
export const fixtureKind = (key: string): FixtureKind | undefined => BY_KEY.get(key);
export const fixtureType = (key: string, type: string): FixtureType | undefined => BY_KEY.get(key)?.types.find(t => t.id === type);
export const finish = (group: FinishGroup, id: string | undefined): Finish => FINISHES[group].find(f => f.id === id) ?? FINISHES[group][0]!;
