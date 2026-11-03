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

/** Whether a handle stands on the front's edge (an edge or profile pull) rather than in from it. */
export const handleOnEdge = (kind: HandleDef) => kind.key === 'edge' || kind.key === 'profile';
/** How far in from the free edge a handle's centre stands on a door. Cm. */
const FROM_EDGE = 4;
/** Door handles sit at this height from the floor where the leaf spans it, so the handles of a piece line up. Cm. */
export const HANDLE_HEIGHT = 100;

/**
 * Where a front's handle is, and its screws: the one place the 3D view and Make read it from. A door's handle stands
 * upright FROM_EDGE in from its free edge (an edge or profile pull on the edge), at HANDLE_HEIGHT where the leaf spans
 * it, else near the leaf's end nearer that height, so the doors of a piece share one handle line; a full-height handle
 * is centred. A drawer's lies level, centred across the front, 6 cm under its top (centred on a front under 20 cm; an
 * edge pull on the top edge). Screws are through the front, or from the back 1 cm in from the edge for an edge pull.
 * Coordinates are the front's own (any origin: the result is in the same frame). Centimetres.
 */
export function handlePlacement(front: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly door: boolean;
  readonly hinge?: 'left' | 'right' | undefined; readonly outline?: readonly { x: number; y: number }[] | undefined },
  handle: { readonly kind: HandleDef; readonly size: HandleSize | undefined }) {
  const { x0, x1, y0, door } = front, onEdge = handleOnEdge(handle.kind), back = handle.kind.fixing === 'back';
  let y1 = front.y1;
  if (door && front.outline) {
    const inset = back ? 1 : onEdge ? 0 : FROM_EDGE, x = front.hinge === 'right' ? x0 + inset : x1 - inset;
    const heights = front.outline.flatMap((p, i, points) => {
      const q = points[(i + 1) % points.length]!;
      return p.x !== q.x && x >= Math.min(p.x, q.x) && x <= Math.max(p.x, q.x)
        ? [p.y + (q.y - p.y) * (x - p.x) / (q.x - p.x)] : [];
    });
    if (heights.length) y1 = Math.min(y1, Math.max(...heights));
  }
  const along = handleCentres(handle.kind, handle.size, door ? y1 - y0 : x1 - x0);
  if (door) {
    const right = front.hinge === 'right', inset = onEdge ? 0 : FROM_EDGE, x = right ? x0 + inset : x1 - inset;
    const y = handle.size === 'full' ? (y0 + y1) / 2 : y0 >= HANDLE_HEIGHT + 20 ? y0 + 8 : y1 <= HANDLE_HEIGHT ? y1 - 8 : Math.min(y1 - 10, Math.max(y0 + 10, HANDLE_HEIGHT));
    const sx = back ? (right ? x0 + 1 : x1 - 1) : x;
    return { x, y, vertical: true, back, screws: along.map(t => [sx, y + t] as const) };
  }
  const x = (x0 + x1) / 2, y = onEdge ? y1 : y1 - y0 < 20 ? (y0 + y1) / 2 : y1 - 6;
  return { x, y, vertical: false, back, screws: along.map(t => [x + t, back ? y1 - 1 : y] as const) };
}
