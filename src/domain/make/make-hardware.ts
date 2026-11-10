import type { Board } from '../drawings/cabinet-boards';
import { innerFrontBehindDoor, isFrontBoard, piecefronts, type Front } from '../drawings/fronts';
import { cornerFaceWidths } from '../drawings/corner-widths';
import type { PlacedPiece } from '../drawings/room-pieces';
import { isKitchen } from '../furniture/furniture';
import { kitchenUnit } from '../kitchen/kitchen-units';
import { resolveMaterials } from '../materials/configured-materials';
import { madeStyle } from '../wardrobe/front-styles';
import { getDecor } from '../materials/decor-catalog';
import {
  APPLIANCE_KIT_ENTRY,
  CABINET_HANGER_ENTRY,
  CARGO_MECHANISM_ENTRY,
  HANDLE_ENTRY,
  LEG_ENTRY,
  RAIL_ENTRY,
  RUNNER_ENTRY,
  SCREW_ENTRY,
  SHELF_BRACKET_ENTRY,
  SHELF_PIN_ENTRY,
  WALL_BRACKET_ENTRY,
  hardware as hardwareEntry,
} from '../hardware/hardware-registry';
import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { installationKind } from '../kitchen/kitchen-units';
import { PANEL } from '../wardrobe/catalog.js';
import { fitting, FITTING_HARDWARE_KEYS, type FittingHardware } from '../wardrobe/fittings';
import { plinthOf } from '../wardrobe/carcass';
import { drawerExtension } from '../wardrobe/drawer-runners';
import { hinge as hingeOf, hingeFor, hingeStations } from '../wardrobe/hinges';
import { handlePlacement, resolveHandle } from '../wardrobe/handles';
import { boreIsClear } from './bore-clearance';
import { completeDrawerHardware } from './drawer-installation';
import { connectorStations, type Fitting, type Hole } from './make-joints';
import { heightsAt, thinAxis, type Vec3 } from './make-measures';
import { cargoPulloutGeometry } from '../kitchen/cargo-pullout';

/** The System 32 line: holes for plates, runners and pins sit 37 mm in from a board's front edge. */
export const SYSTEM_LINE = (RUNNER_ENTRY.rules.systemLineMm ?? 37) / 10;
/** One System 32 step: runner slots and shelf pin rows are this far apart. A runner screw hole, mm. */
const PITCH = (RUNNER_ENTRY.rules.pitchMm ?? 32) / 10;
const HANDLE_THROUGH_HOLE = HANDLE_ENTRY.drilling[0]!;
const HANDLE_BACK_HOLE = HANDLE_ENTRY.drilling[1]!;
const RUNNER_HOLE = RUNNER_ENTRY.drilling[0]!;
const RUNNER_SCREW = { d: RUNNER_HOLE.dMm, depth: RUNNER_HOLE.depthMm } as const;

/** Whether a hole drilled into an upright's face at `at` (going in along x, `sign` the way it faces out) is in another
 * hole's way: any bore already in that board that it would come within 2 mm of, in three dimensions (bore-clearance.ts):
 * one beside it on the same face, a connector's right through the board or run in from its end, or one from the other
 * face that it would meet. */
function inTheWay(boards: readonly Board[], holes: readonly Hole[], post: { b: Board; i: number }, at: Vec3, sign: 1 | -1, hole: { d: number; depth: number }, kind: Hole['kind'] = 'runner') {
  return !boreIsClear(boards, holes, { board: post.i, kind, at, axis: 0, sign, d: hole.d, depth: hole.depth });
}

/** Whether a fitting's hardware is a set bought whole and mounted as one thing (the registry sells it as a set). The
 * cargo mechanism is one too, but Make sets it out part by part above. */
const isSet = (key: FittingHardware) => key !== 'cargoMechanism' && hardwareEntry(FITTING_HARDWARE_KEYS[key])?.unit === 'set';
/** The screw a fixed panel is held by, through the board beside it: 18 mm of that board, then 12 mm into the panel. */
const PANEL_SCREW = SCREW_ENTRY.variants?.find(v => v.key === '4x30')?.sizeLabel ?? '4 × 30';
/** Where a fixed panel's screws go: two rows up its length, 5 cm in from each end and no more than 30 cm apart, on
 * the lines a quarter of its width in from each long edge (one row down the middle of a strip under 10 cm wide). */
function fixedPanelStations(b: Board): Vec3[] {
  const t = ({ x: 0, y: 1, z: 2 } as const)[thinAxis(b)], lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
  const [u, v] = ([0, 1, 2] as const).filter(k => k !== t).sort((p, q) => (hi[q]! - lo[q]!) - (hi[p]! - lo[p]!)) as [0 | 1 | 2, 0 | 1 | 2];
  const wide = hi[v]! - lo[v]!, rows = wide < 10 ? [lo[v]! + wide / 2] : [lo[v]! + wide / 4, hi[v]! - wide / 4];
  return rows.flatMap(row => connectorStations(hi[u]! - lo[u]!).map(s => { const p = [0, 0, 0]; p[t] = lo[t]!; p[u] = lo[u]! + s; p[v] = row; return p as unknown as Vec3; }));
}

export const centre = (b: Board): Vec3 => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
// A divider is an upright however short (a drawer stack's side); a drawer box's own sides are not.
const isUpright = (b: Board, h: number) => b.stock === 'carcass' && thinAxis(b) === 'x' && b.note !== 'drawer box' && (b.y1 - b.y0 > h * .2 || b.name === 'Divider');
/** The uprights either side of a point, nearest first: the board whose face is left of `x` and the one right of it. */
export function uprightsAround(boards: readonly Board[], x: number, y: number, h: number) {
  const ups = boards.map((b, i) => ({ b, i })).filter(({ b }) => isUpright(b, h) && b.y0 <= y && b.y1 >= y);
  const left = ups.filter(u => u.b.x1 <= x + .01).sort((p, q) => q.b.x1 - p.b.x1)[0];
  const right = ups.filter(u => u.b.x0 >= x - .01).sort((p, q) => p.b.x0 - q.b.x0)[0];
  return { left, right };
}
/** The cut front that is this board. */
export const frontOf = (fronts: readonly Front[], b: Board) => fronts.find(f => isFrontBoard(f, b));

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
      const clear = (y: number) => !post || [-pitch / 2, pitch / 2].every(dy => !inTheWay(boards, [...drilled, ...holes], post, [face, y + dy, z], sign, plate.screw, 'plate'));
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
      const holeSpec = back ? HANDLE_BACK_HOLE : HANDLE_THROUGH_HOLE;
      if (!glass(b)) for (const [x, y] of at.screws) holes.push({ board: i, kind: 'handle', at: [x, y, z], axis: 2, sign: back ? 1 : -1, d: holeSpec.dMm, depth: holeSpec.depthMm, of: fittings.length });
      const size = handle.kind.key === 'bar' ? String(handle.size) : handle.kind.name + (handle.size === undefined ? '' : handle.size === 'full' ? ' full height' : ' ' + handle.size);
      fittings.push({ kind: 'handle', at: [at.x, at.y, b.z1], axis: 2, boards: [i], size });
    }
  });
  // Cargo pull-out hardware: GTV Cargo Movix 150/200 runners (374 mm vertical spacing), 4 slide brackets + M4×6 locking screws,
  // 2 3D-adjustable front fittings (78 mm screw pattern, 374 mm vertical spacing, "GTV move" covers), 4×14 screws, and pilot holes.
  boards.forEach((b, i) => {
    if (b.name !== 'Cargo front') return;
    const [cx, cy] = centre(b), { left, right } = uprightsAround(boards, cx, cy, h);
    const { cargoPullouts } = piecefronts(design, cornerFaceWidths(piece, pieces));
    const cargo = cargoPullouts.find(c => Math.abs(c.cx - cx) < 1 && Math.abs(c.y0 - b.y0) < 5)
      ?? cargoPulloutGeometry(cx, b.y0, b.x1 - b.x0, b.y1 - b.y0, design.d);
    const runner = cargo.runners.length * 10;
    const sideMounted = cargo.mount !== 'bottom';
    const base = boards.findIndex(q => q.name === 'Base'), top = boards.findIndex(q => q.name === 'Top');
    const lower = sideMounted ? (cargo.mount === 'right' ? right : left)?.i ?? -1 : base;
    const fixed = [lower, ...(cargo.isTall && top >= 0 ? [top] : [])].filter(idx => idx >= 0);
    fittings.push({
      kind: 'runner',
      cargo,
      at: [cx, cargo.runners.bottom.y0, (cargo.runners.bottom.z0 + cargo.runners.bottom.z1) / 2],
      axis: sideMounted ? 0 : 1,
      boards: [i, ...fixed],
      size: String(runner),
      runner: { moving: fixed.map(() => i), fixed },
    });
    const cargoSlideDrill = CARGO_MECHANISM_ENTRY.drilling[0]!;
    const cargoSlideFix = CARGO_MECHANISM_ENTRY.fixings[0]!;
    const cargoLockFix = CARGO_MECHANISM_ENTRY.fixings[1]!;
    const cargoFrontDrill = CARGO_MECHANISM_ENTRY.drilling[1]!;
    const cargoFrontFix = CARGO_MECHANISM_ENTRY.fixings[2]!;
    const cargoFrontSetback = (cargoSlideDrill.lineMm ?? 45) / 10;
    for (const host of fixed) {
      const q = boards[host]!, upper = host === top;
      const axis = sideMounted && !upper ? 0 as const : 1 as const;
      const sign = axis === 0 ? (cargo.mount === 'right' ? 1 as const : -1 as const) : upper ? 1 as const : -1 as const;
      // Side-mounted Cargo Movix uses both lower slide (min 50 mm) and upper slide (+374 mm) on the carcass side wall.
      const slideLevels = sideMounted && !upper && cargo.runners.top
        ? [(cargo.runners.bottom.y0 + cargo.runners.bottom.y1) / 2, (cargo.runners.top.y0 + cargo.runners.top.y1) / 2]
        : [cargo.runners.bottom.y0 + 1.5];
      for (const slideY of slideLevels) {
        for (const distance of [cargoFrontSetback, runner / 10 - 5]) {
          const at: Vec3 = [
            axis === 0 ? (sign < 0 ? q.x1 : q.x0) : cx,
            axis === 1 ? (upper ? q.y0 : q.y1) : slideY,
            cargo.runners.bottom.z1 - distance,
          ];
          const of = fittings.length;
          fittings.push({ kind: 'screw', at, axis, boards: [host], size: cargoSlideFix.size, purpose: cargoSlideFix.purpose ?? 'runner-mount' });
          holes.push({ board: host, kind: 'runner', at, axis, sign, d: cargoSlideDrill.dMm, depth: cargoSlideDrill.depthMm, of });
        }
      }
    }

    fittings.push({
      kind: 'support',
      at: [cx, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2],
      axis: 2,
      boards: [i],
      cargo,
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
        cargo,
        size: `cargo basket:${cargo.basketStyle}`,
      });
    }

    // 4 × M4 × 6 machine screws locking the 4 basket slide brackets (2–3 pręt & 16–17 pręt) to the slides (Manual Page 4 Step 3).
    for (const sb of cargo.slideBrackets) {
      fittings.push({
        kind: 'screw',
        at: sb.screwAt,
        axis: 1,
        boards: [i],
        size: cargoLockFix.size,
        purpose: cargoLockFix.purpose ?? 'cargo-lock',
      });
    }

    // 2 × 3D-adjustable front fittings (Mocowania frontu 103.5 × 36.5 mm, 78 mm screw spacing) + 4 × 4×14 screws (Manual Page 5 Step 4).
    for (const br of cargo.brackets) {
      fittings.push({ kind: 'plate', at: [cx, br.y, b.z0], axis: 2, boards: [i], size: 'cargo front bracket' });
      for (const s of br.screws) {
        const screwOf = fittings.length;
        fittings.push({ kind: 'screw', at: [s[0], s[1], b.z0], axis: 2, boards: [i], size: cargoFrontFix.size, purpose: cargoFrontFix.purpose ?? 'drawer-front' });
        holes.push({ board: i, kind: 'pilot', at: [s[0], s[1], b.z0], axis: 2, sign: 1, d: cargoFrontDrill.dMm, depth: cargoFrontDrill.depthMm, of: screwOf });
      }
    }
  });
  // Runners: a pair for every drawer box, bottom-mounted: each rail stands in the gap under a box side and is screwed to
  // the upright through its front bracket (two System 32 holes); its rear peg sits in a System 32 hole near its end.
  const rearPeg = (RUNNER_ENTRY.drilling[1]?.stationsMm?.[0] ?? 20) / 10, foot = (RUNNER_ENTRY.rules.clearanceMm.bottomGap ?? 15) / 20;
  boards.forEach((b, i) => {
    if (b.name !== 'Box side') return;
    // The runner is as long as the box: from its front face to the back's rear face.
    const back = boards.find(q => q.name === 'Box back' && Math.abs(q.y0 - b.y0) < .01 && q.x0 <= b.x0 + .01 && q.x1 >= b.x1 - .01);
    const boxFront = boards.find(q => q.name === 'Box front' && Math.abs(q.y0 - b.y0) < .01 && q.x0 <= b.x0 + .01 && q.x1 >= b.x1 - .01);
    const runner = Number((((boxFront?.z1 ?? b.z1) - (back?.z0 ?? b.z0)) * 10).toPrecision(12));
    const [cx, cy] = centre(b), { left, right } = uprightsAround(boards, cx, cy, h);
    if (!left || !right) return;
    const post = b.x0 - left.b.x1 < right.b.x0 - b.x1 ? left : right;
    const face = post === left ? post.b.x1 : post.b.x0, sign = post === left ? -1 : 1, y = b.y0 - foot;
    // One fitting is the pair: the left side adds it, the right side's holes are for it too.
    if (post === left) fittings.push({ kind: 'runner', at: [face, y, (back?.z0 ?? b.z0) + runner / 20], axis: 0, boards: [i, post.i], size: String(runner) });
    const of = fittings.map((f, k) => f.kind === 'runner' && Math.abs(f.at[1] - y) < .01 ? k : -1).reduce((m, k) => Math.max(m, k), -1);
    const stationsCm = (RUNNER_HOLE.stationsMm ?? [0, 32]).map(mm => mm / 10);
    // The rear peg's hole: the System 32 slot nearest `rearPeg` in from the runner's rear end.
    const rear = Math.round((runner / 10 - rearPeg - SYSTEM_LINE) / PITCH) * PITCH;
    for (const back of [...stationsCm, rear]) {
      // A screw in another hole's way (a hinge plate's, or a runner's from the other face of a partition with drawers
      // level either side) goes in the runner's next free slot back, a System 32 step at a time, or else forward.
      const z = post.b.z1 - SYSTEM_LINE - back, free = (z: number) => !inTheWay(boards, [...drilled, ...holes], post, [face, y, z], sign, RUNNER_SCREW);
      const slots = [0, -1, -2, -3, 1, 2].map(k => z + k * PITCH).filter(s => s >= post.b.z0 + 2 && s <= post.b.z1 - 2);
      holes.push({ board: post.i, kind: 'runner', at: [face, y, slots.find(free) ?? z], axis: 0, sign, ...RUNNER_SCREW, of });
    }
  });
  // Shelf pins: four under every adjustable shelf, in a row of five either side to move it up or down. A row that
  // would run into a connector or a plate screw moves a System 32 step back or forward; a row that meets the row of a
  // shelf at the same height on the other face of a partition is drilled right through, one hole for both pins
  // (two 10 mm holes would leave nothing between them in an 18 mm board).
  const pinHole = SHELF_PIN_ENTRY.drilling[0]!;
  const pinStationsCm = (pinHole.stationsMm ?? [-64, -32, 0, 32, 64]).map(mm => mm / 10);
  boards.forEach((b, i) => {
    if (b.note !== 'adjustable') return;
    const { left, right } = uprightsAround(boards, (b.x0 + b.x1) / 2, b.y0, h);
    for (const [post, face, sign] of [[left, left?.b.x1, -1], [right, right?.b.x0, 1]] as const) {
      if (!post || face === undefined) continue;
      const far = sign < 0 ? post.b.x0 : post.b.x1;
      for (const line of [b.z0 + SYSTEM_LINE, b.z1 - SYSTEM_LINE]) {
        const row = (z: number): Hole[] => pinStationsCm.map(dy => ({ board: post.i, kind: 'pin' as const, at: [face, b.y0 + dy, z] as Vec3, axis: 0 as const, sign, d: pinHole.dMm, depth: pinHole.depthMm, of: fittings.length }));
        // The row opposite, from the other face: the same holes seen from behind.
        const opposite = (p: Hole) => (o: Hole) => o.board === post.i && o.kind === 'pin' && o.axis === 0 && o.sign === -sign
          && Math.abs(o.at[1] - p.at[1]) < .005 && Math.abs(o.at[2] - p.at[2]) < .005 && Math.abs(o.at[0] - far) < .005;
        const all = () => [...drilled, ...holes];
        const free = (z: number) => row(z).every(p => boreIsClear(boards, all(), p, opposite(p), true));
        const z = [0, PITCH, -PITCH, 2 * PITCH, -2 * PITCH].map(step => line + step).find(free) ?? line;
        for (const p of row(z)) {
          const met = holes.findIndex(opposite(p));
          if (met >= 0) { holes[met] = { ...holes[met]!, depth: 0 }; holes.push({ ...p, depth: 0 }); } else holes.push(p);
        }
        fittings.push({ kind: 'pin', at: [face, b.y0, z], axis: 0, boards: [i, post.i] });
      }
    }
  });
  // Hanging rails with an end support at each side, cut 4 mm shorter than the bay.
  const railCutShortMm = RAIL_ENTRY.rules.clearanceMm.endCutShort ?? 4;
  for (const r of inside.filter(x => x.kind === 'rail')) {
    const y = r.y0, at: Vec3 = [(r.x0 + r.x1) / 2, y, design.d / 2];
    fittings.push({ kind: 'rail', at, axis: 0, boards: [], size: String(Math.round((r.x1 - r.x0) * 10) - railCutShortMm) });
    // Each end support is screwed to the upright it stands against.
    const { left, right } = uprightsAround(boards, at[0], y, h), on = (post: typeof left) => post ? [post.i] : [];
    fittings.push({ kind: 'support', at: [r.x0, y, design.d / 2], axis: 0, boards: on(left) }, { kind: 'support', at: [r.x1, y, design.d / 2], axis: 0, boards: on(right) });
  }
  // Sets bought whole and mounted by their maker's template (pull-down rails, trouser racks, baskets, flap lifts, corner
  // mechanisms): one for each fitting that names it, on the uprights of its bay, with its screws from the registry.
  const editing = { ...design, sel: 0, item: -1, divider: -1, space: null }, geometry = createWardrobeGeometry(() => editing), floor = kitchen ? 0 : plinthOf(design) + PANEL;
  let bayLeft = PANEL;
  if (!installationKind(design) && !piece.fixture) geometry.widths().forEach((sw: number, i: number) => {
    geometry.computeLayout(i).forEach((pos: { off: number; w: number; y0: number }, j: number) => {
      const it = design.secs[i]?.[j];
      for (const key of (it ? fitting(it.k)?.hardware ?? [] : []) as readonly FittingHardware[]) {
        if (!isSet(key)) continue;
        const kind = FITTING_HARDWARE_KEYS[key] as Fitting['kind'];
        const x = bayLeft + pos.off + pos.w / 2, y = floor + pos.y0 + (it?.h ?? 0) / 2, { left, right } = uprightsAround(boards, x, y, h);
        const front = boards.findIndex(b => b.stock === 'front' && b.x0 <= x && b.x1 >= x && b.y0 <= y && b.y1 >= y);
        const base = boards.findIndex(b => b.name === 'Base');
        const on = kind === 'cornerMechanism' ? (base >= 0 ? [base] : []) : [...(kind === 'liftFitting' && front >= 0 ? [front] : []), ...[left, right].flatMap(u => u ? [u.i] : [])];
        fittings.push({ kind, at: [x, y, design.d / 2], axis: kind === 'cornerMechanism' ? 1 : 0, boards: on, size: 'for ' + Math.round(pos.w * 10) + ' wide' });
      }
    });
    bayLeft += sw + PANEL;
  });
  // An integrated appliance's door is carried by the appliance, on the fixing kit that comes with it.
  boards.forEach((b, i) => {
    const f = b.stock === 'front' ? frontOf(fronts, b) : undefined;
    if (f?.label && (f.opens === 'side' || f.opens === 'down')) fittings.push({ kind: 'applianceKit', at: centre(b), axis: 2, boards: [i], size: APPLIANCE_KIT_ENTRY.display.listLine.defaultSpec });
    // A front that does not open (a blind corner panel, a filler cover) is screwed on from inside the carcass.
    else if (f?.opens === 'fixed') for (const at of fixedPanelStations(b)) fittings.push({ kind: 'screw', at, axis: 2, boards: [i], size: PANEL_SCREW, purpose: 'front-fixing' });
  });
  // A filler strip or an end panel is one board, screwed on from inside the cabinet beside it; a wall shelf stands on
  // brackets, one at each end and one more every 800 mm.
  if (installationKind(design) && boards.length === 1) {
    const slab = boards[0]!, axis = ({ x: 0, y: 1, z: 2 } as const)[thinAxis(slab)];
    for (const at of fixedPanelStations(slab)) fittings.push({ kind: 'screw', at, axis, boards: [0], size: PANEL_SCREW, purpose: 'front-fixing' });
  }
  if (piece.fixture === 'shelf' && boards.length === 1) {
    const b = boards[0]!, count = 2 + Math.floor((Math.round((b.x1 - b.x0) * 10) - 1) / (SHELF_BRACKET_ENTRY.rules.maxSpacingMm ?? 800)), inset = Math.min(5, (b.x1 - b.x0) / 4);
    for (let k = 0; k < count; k++) fittings.push({ kind: 'shelfBracket', at: [b.x0 + inset + (b.x1 - b.x0 - 2 * inset) * k / (count - 1), b.y0, b.z0], axis: 1, boards: [0], size: 'for ' + Math.round(design.d * 10) + ' deep' });
  }
  // Standing, hanging and fixing: legs under a kitchen floor unit, hangers on a wall unit, brackets on tall pieces.
  const unit = kitchen ? kitchenUnit(design.unit) : null, base = boards.findIndex(b => b.name === 'Base');
  const legInset = (LEG_ENTRY.rules.edgeInsetMm ?? 50) / 10;
  // Legs are screwed under a base: a filler strip or an end panel, one board with no base, stands on none.
  if (unit?.plinth && plinthOf(design) > 0 && base >= 0) for (const [x, z] of [[legInset, legInset], [design.w - legInset, legInset], [legInset, design.d - legInset], [design.w - legInset, design.d - legInset]] as const) {
    fittings.push({ kind: 'leg', at: [x, 0, z], axis: 1, boards: base >= 0 ? [base] : [], size: String(Math.round(plinthOf(design) * 10)) });
  }
  const hangerDrop = (CABINET_HANGER_ENTRY.rules.clearanceMm.topDrop ?? 30) / 10;
  // A wall shelf stands on its brackets (below); only a cabinet hangs on hangers.
  if (piece.hung && piece.fixture !== 'shelf') fittings.push({ kind: 'hanger', at: [design.w / 2, design.h - hangerDrop, 0], axis: 2, boards: [], size: CABINET_HANGER_ENTRY.display.listLine.defaultSpec });
  const bracketInset = (WALL_BRACKET_ENTRY.rules.edgeInsetMm ?? 100) / 10;
  if (!kitchen || (unit && !unit.worktop && unit.plinth)) for (const x of [bracketInset, design.w - bracketInset]) {
    const roof = boards.findIndex(b => b.name === 'Top' && b.x0 <= x && b.x1 >= x);
    if (roof >= 0) fittings.push({ kind: 'bracket', at: [x, heightsAt(boards[roof]!, x)[0], 0], axis: 2, boards: [roof] });
  }
  completeDrawerHardware(boards, fittings, holes);
  return { holes, fittings };
}

/** How a board moves when the piece is opened: a door swings about its hinge edge (`pivot` x and z in the piece's
 * frame; `dir` +1 turns it out to the right), a drawer front and its box slide out `by` centimetres. */
export type Motion = { readonly kind: 'swing'; readonly pivot: readonly [number, number]; readonly dir: 1 | -1 } | { readonly kind: 'slide'; readonly by: number };
const OPEN_PULL_RATIO = RUNNER_ENTRY.motion?.kind === 'telescope' ? RUNNER_ENTRY.motion.openPullRatio : .7;
/** How far a drawer is pulled out to be seen open: 70% of its runners' extension, for a piece `depth` deep. Cm. */
export const drawerPull = (depth: number) => Math.round(drawerExtension(depth) * OPEN_PULL_RATIO);

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
      const cargoRunner = boards[i]!.name === 'Cargo front' ? cargoPulloutGeometry((b.x0+b.x1)/2,b.y0,b.x1-b.x0,b.y1-b.y0,piece.design.d).runners.length : undefined;
      const travel = cargoRunner !== undefined ? cargoRunner * OPEN_PULL_RATIO : side ? Math.round((side.z1-side.z0)*OPEN_PULL_RATIO) : pull;
      out[i] = { kind: 'slide', by: travel };
      boards.forEach((x, k) => { if (x.note === 'drawer box' && x.x0 >= b.x0 - 1 && x.x1 <= b.x1 + 1 && x.y0 >= b.y0 - 1 && x.y1 <= b.y1 + 1) out[k] = { kind: 'slide', by: travel }; });
    }
  });
  return out;
}
