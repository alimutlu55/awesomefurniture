/**
 * Handles: every kind of handle a front can take, the sizes each comes in, and the finishes.
 *
 * THIS IS THE ONLY PLACE THAT DEFINES A HANDLE KIND, SIZE OR FINISH. Saved materials, the Fronts panel, the 3D view,
 * the hardware list and Make ask it; never copy its keys or sizes into another file.
 *
 * Sizes are the centre-to-centre distance between a handle's two screws, in millimetres, as handles are sold; `full`
 * runs the length of the front. Values are generic common practice (decision D5), labelled HANDLE_SOURCE wherever a
 * person reads them.
 */

export const HANDLE_SOURCE = 'common practice; check the maker\'s template';

/** Handle finishes, and the colour the 3D view gives each. Push-to-open has no handle at all: a latch opens the front. */
export const HANDLE_FINISH_DEFS = [
  { key: 'matte_black', name: 'Matte black', colour: '#242426' },
  { key: 'brushed_brass', name: 'Brushed brass', colour: '#b99a57' },
  { key: 'anodized_champagne', name: 'Anodized champagne', colour: '#c2b69c' },
  { key: 'handleless_tip_on', name: 'Handleless · push-to-open', colour: '#242426' },
] as const;
export const HANDLE_FINISHES = HANDLE_FINISH_DEFS.map(f => f.key) as unknown as readonly [HandleFinish, ...HandleFinish[]];
export type HandleFinish = typeof HANDLE_FINISH_DEFS[number]['key'];
/** The finish with no handle: fronts open on a push latch. */
export const PUSH_TO_OPEN: HandleFinish = 'handleless_tip_on';

export type HandleSize = number | 'full';
/** How a handle is fixed: two screws through the front, one, two into the back of the front near its edge, or none (a
 * pocket routed into the front, or a profile set into its edge). */
export type HandleFixing = 'through' | 'single' | 'back' | 'none';
export interface HandleDef {
  readonly key: string;
  readonly name: string;
  /** Sizes it comes in, smallest first; an empty list for a knob (one screw). */
  readonly sizes: readonly HandleSize[];
  readonly fixing: HandleFixing;
  /** How far it stands proud of the front's face, mm. */
  readonly projectionMm: number;
}
const CENTRES = [96, 128, 160, 192, 320] as const;

export const HANDLES = [
  { key: 'bar', name: 'Bar handle', sizes: CENTRES, fixing: 'through', projectionMm: 30 },
  { key: 'knob', name: 'Knob', sizes: [], fixing: 'single', projectionMm: 28 },
  { key: 'edge', name: 'Edge pull', sizes: CENTRES, fixing: 'back', projectionMm: 15 },
  { key: 'recessed', name: 'Recessed pull', sizes: [96, 128, 160, 192], fixing: 'none', projectionMm: 0 },
  { key: 'profile', name: 'Profile pull', sizes: ['full'], fixing: 'none', projectionMm: 0 },
  { key: 'full', name: 'Full-height bar', sizes: ['full'], fixing: 'through', projectionMm: 30 },
] as const satisfies readonly HandleDef[];
export type HandleKind = typeof HANDLES[number]['key'];
export const HANDLE_KINDS = HANDLES.map(h => h.key) as readonly HandleKind[];
export const handleKind = (key: string | undefined): HandleDef => (HANDLES as readonly HandleDef[]).find(h => h.key === key) ?? HANDLES[0];

/** What a design without a handle choice has: today's 128 mm bar. */
export const DEFAULT_HANDLE = Object.freeze({ kind: 'bar', size: 128 } as const satisfies { kind: HandleKind; size: HandleSize });

/** Whether `size` is one `kind` comes in (a knob takes none). */
export const handleSizeFits = (kind: HandleKind, size: HandleSize | undefined) => {
  const sizes = handleKind(kind).sizes as readonly HandleSize[];
  return sizes.length === 0 ? size === undefined : size !== undefined && sizes.includes(size);
};

/** A design's handle: its kind, size and finish, with the defaults (128 mm bar) for designs saved before handles had a
 * kind. A size the kind does not come in falls back to the kind's nearest. */
export function resolveHandle(materials: { handleKind?: HandleKind | undefined; handleSize?: HandleSize | undefined; handleFinish: HandleFinish } | undefined) {
  const kind = handleKind(materials?.handleKind ?? DEFAULT_HANDLE.kind), sizes = kind.sizes as readonly HandleSize[];
  const asked = materials?.handleKind ? materials.handleSize : DEFAULT_HANDLE.size;
  const size: HandleSize | undefined = sizes.length === 0 ? undefined : asked !== undefined && sizes.includes(asked) ? asked : sizes[0];
  const finish = materials?.handleFinish ?? 'brushed_brass';
  return { kind, size, finish, none: finish === PUSH_TO_OPEN };
}

/** The screw centres along the front, from the handle's centre, in centimetres; `length` is the run of the front the
 * handle lies along (a door's height for a vertical handle). A full-height handle stops 5 cm short of each end. */
export function handleCentres(kind: HandleDef, size: HandleSize | undefined, length: number): number[] {
  if (kind.fixing === 'none') return [];
  if (kind.fixing === 'single' || size === undefined) return [0];
  const span = size === 'full' ? Math.max(0, length - 10) : size / 10;
  return [-span / 2, span / 2];
}

/** How a handle is named on a list: "Bar handle 128 mm · brushed brass". */
export function handleLabel(handle: ReturnType<typeof resolveHandle>): string {
  const size = handle.size === undefined ? '' : handle.size === 'full' ? ' full height' : ` ${handle.size} mm`;
  return handle.kind.name + size + ' · ' + handle.finish.replaceAll('_', ' ');
}
