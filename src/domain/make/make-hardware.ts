import type { Board } from '../drawings/cabinet-boards';
import { innerFrontBehindDoor, isFrontBoard, piecefronts, type Front } from '../drawings/fronts';
import { cornerFaceWidths } from '../drawings/corner-widths';
import type { PlacedPiece } from '../drawings/room-pieces';
import { isKitchen } from '../furniture/furniture';
import { kitchenUnit } from '../kitchen/kitchen-units';
import { resolveMaterials } from '../materials/configured-materials';
import { madeStyle } from '../wardrobe/front-styles';
import { getDecor } from '../materials/decor-catalog';
import { backFaceOf, plinthOf } from '../wardrobe/carcass';
import { PANEL } from '../wardrobe/catalog.js';
import { drawerExtension, runnerForSpace } from '../wardrobe/drawer-runners';
import { hinge as hingeOf, hingeFor, hingeStations } from '../wardrobe/hinges';
import { handlePlacement, resolveHandle } from '../wardrobe/handles';
import { completeDrawerHardware } from './drawer-installation';
import type { Fitting, Hole } from './make-joints';
import { heightsAt, thinAxis, type Vec3 } from './make-measures';
import { cargoPulloutGeometry } from '../kitchen/cargo-pullout';

/** The System 32 line: holes for plates, runners and pins sit 37 mm in from a board's front edge. */
export const SYSTEM_LINE = 3.7;
/** A drawer box stands this far in from each upright, for its runners. Cm. */
const RUNNER_CLEARANCE = 1.25;
/** One System 32 step: runner slots and shelf pin rows are this far apart. A runner screw hole, mm. */
const PITCH = 3.2, RUNNER_SCREW = { d: 5, depth: 12 } as const;

/** Whether a hole drilled into an upright's face at `at` (going in along x, `sign` the way it faces out) is in another
 * hole's way: one on the same face less than 2 mm from it (a hinge plate's), one right through the board (a connector's,
 * on both faces), or one from the other face that it would meet, their circles overlapping and together deeper than
 * the board less 1 mm. */
function inTheWay(holes: readonly Hole[], post: { b: Board; i: number }, at: Vec3, sign: 1 | -1, hole: { d: number; depth: number }) {
  const thick = (post.b.x1 - post.b.x0) * 10;
  return holes.some(h => {
    if (h.board !== post.i || h.axis !== 0) return false;
    const reach = Math.hypot(h.at[1] - at[1], h.at[2] - at[2]) * 10 - (h.d + hole.d) / 2;
    return h.sign === sign || h.depth === 0 ? reach < 2 : h.depth > 0 && reach < 0 && h.depth + hole.depth > thick - 1;
  });
}

const centre = (b: Board): Vec3 => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
const isUpright = (b: Board, h: number) => b.stock === 'carcass' && thinAxis(b) === 'x' && b.y1 - b.y0 > h * .2;
/** The uprights either side of a point, nearest first: the board whose face is left of `x` and the one right of it. */
function uprightsAround(boards: readonly Board[], x: number, y: number, h: number) {
  const ups = boards.map((b, i) => ({ b, i })).filter(({ b }) => isUpright(b, h) && b.y0 <= y && b.y1 >= y);
  const left = ups.filter(u => u.b.x1 <= x + .01).sort((p, q) => q.b.x1 - p.b.x1)[0];
  const right = ups.filter(u => u.b.x0 >= x - .01).sort((p, q) => p.b.x0 - q.b.x0)[0];
  return { left, right };
}
/** The cut front that is this board. */
const frontOf = (fronts: readonly Front[], b: Board) => fronts.find(f => isFrontBoard(f, b));

function box(name: string, stock: Board['stock'], x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, grain: 0 | 1 | 2, edges: string, decorId: string): Board {
  const e = [x1 - x0, y1 - y0, z1 - z0], order = [0, 1, 2].sort((a, b) => e[a]! - e[b]!), t = order[0]!;
  const along = grain === t ? order[2]! : grain, across = [0, 1, 2].find(a => a !== along && a !== t)!;
  return { name, stock, decorId, x0, x1, y0, y1, z0, z1, cut: { length: e[along]!, width: e[across]!, thickness: e[t]! }, edges, note: 'drawer box' };
}

/**
 * Drawer boxes for side-mount runners: two sides and two ends 18 mm thick, the ends between the sides, on a 6 mm
 * bottom; 12.5 mm clear of each upright for the runners, as long as the runner, 40 mm lower than the front and clear of
 * the boards under and over it.
 */
export function drawerBoxes(piece: PlacedPiece, boards: readonly Board[]): Board[] {
  const { design } = piece, out: Board[] = [], h = design.h;
  const m = resolveMaterials(design), decor = m.drawerDecorId ?? m.carcassDecorId, bottomDecor = m.backingDecorId ?? decor;
  const fronts = piecefronts(design).fronts;
  for (const f of boards) {
    const opening = frontOf(fronts, f)?.opens;
    if (!(f.name === 'Drawer front' || (f.stock === 'front' && opening === 'pull' && !f.name.startsWith('Cargo') && !f.name.startsWith('Pantry')))) continue;
    const [cx, cy] = centre(f), { left, right } = uprightsAround(boards, cx, cy, h);
    if (!left || !right) continue;
    const x0 = left.b.x1 + RUNNER_CLEARANCE, x1 = right.b.x0 - RUNNER_CLEARANCE;
    const z1 = Math.min(f.z0, left.b.z1, right.b.z1) - .2, length = runnerForSpace(z1 - backFaceOf(design) - 1);
    if (length === undefined) continue;
    const z0 = z1 - length;
    // Between the boards under and over it: the base or a shelf below, the top or a shelf above.
    const across = boards.filter(b => b.stock === 'carcass' && thinAxis(b) === 'y' && b.x0 < x1 && b.x1 > x0);
    const floor = Math.max(f.y0, left.b.y0, ...across.filter(b => b.y1 <= cy).map(b => b.y1));
    const ceiling = Math.min(f.y1, left.b.y1, ...across.filter(b => b.y0 >= cy).map(b => b.y0));
    const y0 = floor + 1.5, yb = y0 + .6, tall = Math.min(25, f.y1 - f.y0 - 4, ceiling - yb - 1.5);
    if (x1 - x0 < 4 * PANEL || z1 - z0 < 10 || tall < 6) continue;
    out.push(box('Box side', 'carcass', x0, x0 + PANEL, yb, yb + tall, z0, z1, 2, 'L1', decor), box('Box side', 'carcass', x1 - PANEL, x1, yb, yb + tall, z0, z1, 2, 'L1', decor),
      box('Box end', 'carcass', x0 + PANEL, x1 - PANEL, yb, yb + tall, z1 - PANEL, z1, 0, 'L1', decor),
      box('Box end', 'carcass', x0 + PANEL, x1 - PANEL, yb, yb + tall, z0, z0 + PANEL, 0, 'L1', decor),
      box('Box bottom', 'back', x0, x1, y0, yb, z0, z1, 0, '—', bottomDecor));
  }
  return out;
}

/** Hinges, runners, shelf pins and handles, with the holes each needs, and the rails, legs, hangers and wall brackets.
 * `drilled`: the holes the joints already have, which runner screws keep clear of. */
export function frontHardware(piece: PlacedPiece, pieces: readonly PlacedPiece[], boards: readonly Board[], drilled: readonly Hole[] = []) {
  const { design } = piece, holes: Hole[] = [], fittings: Fitting[] = [], h = design.h, kitchen = isKitchen(design);
  const { fronts, inside } = piecefronts(design, cornerFaceWidths(piece, pieces)), handle = resolveHandle(resolveMaterials(design)), handles = !handle.none;
  // Glass and mirror doors hang on their own hinges, clamped to the glass: nothing is drilled in them.
  // A wardrobe door says whether it is glass (leafGlass); another front by its decor.
  const glass = (b: Board) => { try { return frontOf(fronts, b)?.glass ?? getDecor(b.decorId ?? resolveMaterials(design).frontDecorId).category === 'glass_mirror'; } catch { return false; } };
  boards.forEach((b, i) => {
    if (b.stock !== 'door' && b.stock !== 'front') return;
    const f = frontOf(fronts, b);
    if (f?.opens === 'side' && !f.label) {
      // Hinges along the hinge edge: a cup in the door's back, a plate on the upright it hangs from.
      const hinge = f.hinge ?? 'left', edgeX = hinge === 'left' ? b.x0 : b.x1, { left, right } = uprightsAround(boards, hinge === 'left' ? edgeX + 3 : edgeX - 3, b.y0 + 10, h);
      // Under a slope the upright it hangs from can end below the door's top: hinges go along what they share.
      const post = hinge === 'left' ? left : right, edgeTop = Math.min(b.y1, post?.b.y1 ?? b.y1);
      // The leaf's hinge (hingeFor: set, glass clamp, zero-protrusion, wide by a wall, else standard): its cup in the door
      // (none in glass) and its plate's two screws on the upright, a pitch apart on its System 32 line.
      const kind = hingeOf(hingeFor(f, design, glass(b), piece.sides)), { plate } = kind, pitch = plate.pitch / 10;
      const face = post ? (hinge === 'left' ? post.b.x1 : post.b.x0) : 0, sign = hinge === 'left' ? -1 : 1, z = post ? post.b.z1 - plate.line / 10 : 0;
      // A partition with doors hinged on both faces (a pair either side of it): a plate whose screws would meet the other
      // face's, or a connector, inside the board steps one System 32 pitch along it.
      const clear = (y: number) => !post || [-pitch / 2, pitch / 2].every(dy => !inTheWay([...drilled, ...holes], post, [face, y + dy, z], sign, plate.screw));
      for (const s of hingeStations(edgeTop - b.y0)) {
        const y = b.y0 + s + ([0, PITCH, -PITCH, 2 * PITCH, -2 * PITCH].find(dy => clear(b.y0 + s + dy)) ?? 0);
        const inset = (kind.cup?.fromEdge ?? 22.5) / 10, cup: Vec3 = [edgeX + (hinge === 'left' ? inset : -inset), y, b.z0];
        if (kind.cup) holes.push({ board: i, kind: 'cup', at: cup, axis: 2, sign: 1, d: kind.cup.d, depth: kind.cup.depth, of: fittings.length });
        fittings.push({ kind: 'hinge', at: cup, axis: 2, boards: post ? [i, post.i] : [i], size: kind.size });
        if (!post) continue;
        for (const dy of [-pitch / 2, pitch / 2]) holes.push({ board: post.i, kind: 'plate', at: [face, y + dy, z], axis: 0, sign, ...plate.screw, of: fittings.length });
        fittings.push({ kind: 'plate', at: [face, y, z], axis: 0, boards: [post.i] });
      }
    }
    // A drawer's own front behind closed doors has a finger grip, not a handle (D4).
    const grip = !f && !!b.kind && innerFrontBehindDoor(design, { k: b.kind });
    // A handle-rail door is its own grip (madeStyle): no handle drilled.
    const rail = f?.opens === 'side' && !!madeStyle({ ...design, materials: resolveMaterials(design) }, b.decorId).grip;
    if (handles && !grip && !rail && f?.opens !== 'fixed' && !f?.label && (f || b.name === 'Drawer front')) {
      // The design's handle where handlePlacement puts it (as the 3D view draws it), with its screws: through the front, an
      // edge pull's from the back near the edge, none for a recessed or profile pull.
      const at = handlePlacement({ ...b, door: f?.opens === 'side', hinge: f?.hinge }, handle), back = at.back, z = back ? b.z0 : b.z1;
      if (!glass(b)) for (const [x, y] of at.screws) holes.push({ board: i, kind: 'handle', at: [x, y, z], axis: 2, sign: back ? 1 : -1, d: back ? 4 : 5, depth: back ? 10 : 0, of: fittings.length });
      const size = handle.kind.key === 'bar' ? String(handle.size) : handle.kind.name + (handle.size === undefined ? '' : handle.size === 'full' ? ' full height' : ' ' + handle.size);
      fittings.push({ kind: 'handle', at: [at.x, at.y, b.z1], axis: 2, boards: [i], size });
    }
  });
  // Cargo pull-out hardware: runners, front fixing brackets, screws, and pilot holes in the door.
  boards.forEach((b, i) => {
    if (b.name !== 'Cargo front') return;
    const [cx, cy] = centre(b), { left, right } = uprightsAround(boards, cx, cy, h);
    const { cargoPullouts } = piecefronts(design, cornerFaceWidths(piece, pieces));
    const cargo = cargoPullouts.find(c => Math.abs(c.cx - cx) < 1 && Math.abs(c.y0 - b.y0) < 5)
      ?? cargoPulloutGeometry(cx, b.y0, b.x1 - b.x0, b.y1 - b.y0, design.d);
    const runner = cargo.runners.length * 10;
    const sideMounted = cargo.mount !== 'bottom';
    const base = boards.findIndex(q=>q.name==='Base'), top = boards.findIndex(q=>q.name==='Top');
    const lower = sideMounted ? (cargo.mount==='right' ? right : left)?.i ?? -1 : base;
    const fixed = [lower, ...(cargo.isTall && top>=0 ? [top] : [])].filter(i=>i>=0);
    fittings.push({kind:'runner',at:[cx,cargo.runners.bottom.y0,(cargo.runners.bottom.z0+cargo.runners.bottom.z1)/2],axis:sideMounted ? 0 : 1,
      boards:[i,...fixed],size:String(runner),runner:{moving:fixed.map(()=>i),fixed}});
    for(const host of fixed) {
      const q=boards[host]!, upper=host===top;
      const axis = sideMounted && !upper ? 0 as const : 1 as const;
      const sign = axis===0 ? (cargo.mount==='right' ? 1 as const : -1 as const) : upper ? 1 as const : -1 as const;
      for(const distance of [5,runner/10-5]) {
        const at:Vec3=[axis===0 ? sign<0 ? q.x1 : q.x0 : cx,axis===1 ? upper ? q.y0 : q.y1 : cargo.runners.bottom.y0+1.5,cargo.runners.bottom.z1-distance];
        const of=fittings.length;
        fittings.push({kind:'screw',at,axis,boards:[host],size:'4 × 12',purpose:'runner-mount'});
        holes.push({board:host,kind:'runner',at,axis,sign,d:2.5,depth:12,of});
      }
    }

    fittings.push({
      kind: 'support',
      at: [cx, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2],
      axis: 2,
      boards: [i],
      size: `cargo frame:${cargo.tiers}:${cargo.basketStyle}:${cargo.mount}`,
    });

    for (let k = 0; k < cargo.baskets.length; k++) {
      const bkt = cargo.baskets[k]!;
      const bz = (bkt.base.z0 + bkt.base.z1) / 2;
      fittings.push({
        kind: 'rail',
        at: [cx, bkt.base.y0, bz],
        axis: 2,
        boards: [i],
        size: `cargo basket:${cargo.basketStyle}`,
      });
    }

    for (const br of cargo.brackets) {
      fittings.push({ kind: 'plate', at: [cx, br.y, b.z0], axis: 2, boards: [i], size: 'cargo front bracket' });
      for (const s of br.screws) {
        const screwOf = fittings.length;
        fittings.push({ kind: 'screw', at: [s[0], s[1], b.z0], axis: 2, boards: [i], size: '4 × 16', purpose: 'drawer-front' });
        holes.push({ board: i, kind: 'pilot', at: [s[0], s[1], b.z0], axis: 2, sign: 1, d: 2.5, depth: 10, of: screwOf });
      }
    }
  });
  // Runners: a pair for every drawer box, screwed to the uprights on the System 32 line.
  boards.forEach((b, i) => {
    if (b.name !== 'Box side') return;
    const runner = Number(((b.z1-b.z0)*10).toPrecision(12));
    const [cx, cy] = centre(b), { left, right } = uprightsAround(boards, cx, cy, h);
    if (!left || !right) return;
    const post = b.x0 - left.b.x1 < right.b.x0 - b.x1 ? left : right;
    const face = post === left ? post.b.x1 : post.b.x0, sign = post === left ? -1 : 1, y = b.y0 + 3.2;
    // One fitting is the pair: the left side adds it, the right side's holes are for it too.
    if (post === left) fittings.push({ kind: 'runner', at: [face, y, (b.z0 + b.z1) / 2], axis: 0, boards: [i, post.i], size: String(runner) });
    const of = fittings.map((f, k) => f.kind === 'runner' && Math.abs(f.at[1] - y) < .01 ? k : -1).reduce((m, k) => Math.max(m, k), -1);
    for (const back of [0, 22.4, ...(runner >= 500 ? [44.8] : [])]) {
      // A screw in another hole's way (a hinge plate's, or a runner's from the other face of a partition with drawers
      // level either side) goes in the runner's next free slot back, a System 32 step at a time, or else one forward.
      const z = post.b.z1 - SYSTEM_LINE - back, free = (z: number) => !inTheWay([...drilled, ...holes], post, [face, y, z], sign, RUNNER_SCREW);
      const slots = [0, 1, 2, 3].map(k => z - k * PITCH).filter(s => s >= post.b.z0 + 2);
      holes.push({ board: post.i, kind: 'runner', at: [face, y, slots.find(free) ?? z + PITCH], axis: 0, sign, ...RUNNER_SCREW, of });
    }
  });
  // Shelf pins: four under every adjustable shelf, in a row of five either side to move it up or down.
  boards.forEach((b, i) => {
    if (b.note !== 'adjustable') return;
    const { left, right } = uprightsAround(boards, (b.x0 + b.x1) / 2, b.y0, h);
    for (const [post, face, sign] of [[left, left?.b.x1, -1], [right, right?.b.x0, 1]] as const) {
      if (!post || face === undefined) continue;
      for (const z of [b.z0 + SYSTEM_LINE, b.z1 - SYSTEM_LINE]) {
        for (let k = -2; k <= 2; k++) holes.push({ board: post.i, kind: 'pin', at: [face, b.y0 + 3.2 * k, z], axis: 0, sign, d: 5, depth: 10, of: fittings.length });
        fittings.push({ kind: 'pin', at: [face, b.y0, z], axis: 0, boards: [i, post.i] });
      }
    }
  });
  // Hanging rails with an end support at each side, cut 4 mm shorter than the bay.
  for (const r of inside.filter(x => x.kind === 'rail')) {
    const y = r.y0, at: Vec3 = [(r.x0 + r.x1) / 2, y, design.d / 2];
    fittings.push({ kind: 'rail', at, axis: 0, boards: [], size: String(Math.round((r.x1 - r.x0) * 10) - 4) });
    fittings.push({ kind: 'support', at: [r.x0, y, design.d / 2], axis: 0, boards: [] }, { kind: 'support', at: [r.x1, y, design.d / 2], axis: 0, boards: [] });
  }
  // Standing, hanging and fixing: legs under a kitchen floor unit, hangers on a wall unit, brackets on tall pieces.
  const unit = kitchen ? kitchenUnit(design.unit) : null, base = boards.findIndex(b => b.name === 'Base');
  if (unit?.plinth && plinthOf(design) > 0) for (const [x, z] of [[5, 5], [design.w - 5, 5], [5, design.d - 5], [design.w - 5, design.d - 5]] as const) {
    fittings.push({ kind: 'leg', at: [x, 0, z], axis: 1, boards: base >= 0 ? [base] : [], size: String(Math.round(plinthOf(design) * 10)) });
  }
  if (piece.hung) fittings.push({ kind: 'hanger', at: [design.w / 2, design.h - 3, 0], axis: 2, boards: [], size: 'pair' });
  if (!kitchen || (unit && !unit.worktop && unit.plinth)) for (const x of [10, design.w - 10]) {
    const roof = boards.findIndex(b => b.name === 'Top' && b.x0 <= x && b.x1 >= x);
    if (roof >= 0) fittings.push({ kind: 'bracket', at: [x, heightsAt(boards[roof]!, x)[0], 0], axis: 2, boards: [roof] });
  }
  completeDrawerHardware(boards, fittings, holes);
  return { holes, fittings };
}

/** How a board moves when the piece is opened: a door swings about its hinge edge (`pivot` x and z in the piece's
 * frame; `dir` +1 turns it out to the right), a drawer front and its box slide out `by` centimetres. */
export type Motion = { readonly kind: 'swing'; readonly pivot: readonly [number, number]; readonly dir: 1 | -1 } | { readonly kind: 'slide'; readonly by: number };
/** How far a drawer is pulled out to be seen open: 70% of its runners' extension, for a piece `depth` deep. Cm. */
export const drawerPull = (depth: number) => Math.round(drawerExtension(depth) * .7);

export function frontMotions(piece: PlacedPiece, pieces: readonly PlacedPiece[], boards: readonly Board[]): (Motion | null)[] {
  const { fronts } = piecefronts(piece.design, cornerFaceWidths(piece, pieces)), out: (Motion | null)[] = boards.map(() => null);
  const pull = drawerPull(piece.design.d);
  boards.forEach((b, i) => {
    if (b.stock !== 'door' && b.stock !== 'front') return;
    const f = frontOf(fronts, b);
    if (f?.opens === 'side' && !f.label) {
      const left = (f.hinge ?? 'left') === 'left';
      out[i] = { kind: 'swing', pivot: [left ? b.x0 : b.x1, b.z0], dir: left ? 1 : -1 };
    } else if (f?.opens === 'pull' || b.name === 'Drawer front') {
      // The front and the box behind it: the box's boards stand within the front's width and height.
      const side = boards.find(x=>x.name==='Box side' && x.x0>=b.x0-1 && x.x1<=b.x1+1 && x.y0>=b.y0-1 && x.y1<=b.y1+1);
      const travel = side ? Math.round((side.z1-side.z0)*.7) : pull;
      out[i] = { kind: 'slide', by: travel };
      boards.forEach((x, k) => { if (x.note === 'drawer box' && x.x0 >= b.x0 - 1 && x.x1 <= b.x1 + 1 && x.y0 >= b.y0 - 1 && x.y1 <= b.y1 + 1) out[k] = { kind: 'slide', by: travel }; });
    }
  });
  return out;
}
