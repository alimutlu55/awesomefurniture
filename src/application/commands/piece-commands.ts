import { noopAnalytics, type TrackEvent } from '../analytics/analytics-port';
import { createCabinetPieceCommands } from './cabinet-piece-commands';
import type { createKitchenCommands } from './kitchen-commands';
import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { furnitureKind } from '../../domain/furniture/furniture';
import { presetSize } from '../../domain/furniture/piece-presets';
import { kitchenPreset } from '../../domain/kitchen/kitchen-design';
import { snapTurn } from '../../domain/pieces/piece-motion';
import { PIECE_KINDS, cabinetPiece, fixturePiece, furnishingPiece, newFixturePiece, newFurnishingPiece, roomOf, studioPiece } from '../../domain/pieces/pieces';
import type { Duplicable, PieceKey, Placement, Pose, Size } from '../../domain/pieces/piece-model';
import type { Studio, StudioFixture } from '../../domain/studio/studio';
import { studioProblems } from '../../domain/studio/studio-validation';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { fixtureKind } from '../../domain/studio/fixtures/fixture-kinds';
import { addFixture, duplicateFixture, removeFixture, setFixtureFinish, setFixtureSize, setFixtureType } from '../../domain/studio/fixtures/fixture-edit';
import { applySetup, standsOnFloor } from '../../domain/studio/fixtures/fixture-setup';
import { fixtureProblems } from '../../domain/studio/fixtures/fixture-validation';
import { addFurnishing, duplicateFurnishing, moveFurnishing, removeFurnishing, setFurnishingFinish, setFurnishingSize, setFurnishingType } from '../../domain/studio/furnishings/furnishing-edit';

interface PieceCommandOptions {
  checkpoint: () => void;
  report: (message: string) => void;
  track?: TrackEvent | undefined;
  addKitchenUnit: ReturnType<typeof createKitchenCommands>['addKitchenUnit'];
  cabinet: Omit<Parameters<typeof createCabinetPieceCommands>[1], 'checkpoint' | 'report'>;
}
export type PieceEdit =
  | { action: 'size'; axis: keyof Size; value: number }
  | { action: 'move'; to: Pose; free?: boolean }
  | { action: 'turn'; angle?: number; from?: Pick<Pose, 'x' | 'z'>; free?: boolean }
  | { action: 'type'; id: string }
  | { action: 'finish'; group: string; id: string };
const cabinetAxis = { width: 'w', depth: 'd', height: 'h' } as const;

type Family = Exclude<PieceKey['family'], 'cabinet'>;
type Result = { studio: Studio; note?: string | undefined };
type Edit = (studio: Studio) => Studio | Result | null;
const fixtureOf = (studio: Studio | undefined, id: string) => studio?.fixtures?.find(f => f.id === id);
const furnishingOf = (studio: Studio | undefined, id: string) => studio?.furnishings?.find(f => f.id === id);
const fixtureName = (kind: string) => fixtureKind(kind)?.name.toLowerCase() ?? 'fixture';
/** Whether a fixture would stand half in front of a boxing and half against the bare wall: buildable, but nobody plans
 * a basin that way, so a new one goes there only when nowhere else fits. */
function straddles(room: Studio, f: StudioFixture) {
  const l = f.offset - f.width / 2, r = f.offset + f.width / 2;
  return (room.ceilings ?? []).some(c => {
    if (c.wall !== f.wall || !standsOnFloor(c)) return false;
    const ts = c.outline!.map(p => p.t), from = Math.min(...ts), to = Math.max(...ts);
    return (from > l + .5 && from < r - .5) || (to > l + .5 && to < r - .5);
  });
}
/** Validate and save Studio pieces through one command set. The placement search stays specific to how each piece stands. */
export function createPieceCommands(getScene: () => EditorScene, { checkpoint, report, track = noopAnalytics.track, cabinet, addKitchenUnit: addKitchen }: PieceCommandOptions) {
  const roomWith = (studio = getScene().studio) => roomOf(studio, getScene().wardrobes);
  const cabinets = createCabinetPieceCommands(getScene, { ...cabinet, checkpoint, report });
  const cabinetOf = (id: string) => getScene().wardrobes.find(piece => String(piece.id) === id);

  function cabinetAdded(created: EditorCabinet | null, preset: string | null, placement: 'wall' | 'duplicate' | 'beside', previousCount: number) {
    const total = getScene().wardrobes.length;
    if (created && total > previousCount) {
      try { track('furniture_piece_added', { product: furnitureKind(created.state), preset_id: preset, placement, total_pieces_in_scene: total }); }
      catch { /* Counting never breaks an edit. */ }
    }
    return created;
  }
  const addCabinet: typeof cabinets.addCabinet = (copy, template, wall, size, source) => {
    const previousCount = getScene().wardrobes.length;
    return cabinetAdded(cabinets.addCabinet(copy, template, wall, size, source), copy ? null : size?.preset ?? template ?? 'regular',
      copy ? 'duplicate' : 'wall', previousCount);
  };
  const addKitchenUnit: typeof addKitchen = (preset, placement) => {
    const previousCount = getScene().wardrobes.length;
    return cabinetAdded(addKitchen(preset, placement), preset, placement?.beside ? 'beside' : 'wall', previousCount);
  };

  function problem(next: Studio, key: PieceKey, before?: Studio): string | null {
    const first = studioProblems(next)[0];
    if (first) return first;
    const piece = studioPiece(next, key);
    if (key.family === 'fixture') {
      // The fixture and its boxing may both have moved. Check the cabinets against the whole room.
      const solids = createCabinetGeometry(() => [], () => studioObstacles(next));
      const affected = piece ?? studioPiece(before, key);
      return getScene().wardrobes.some(c => solids.cabinetCollides(c))
        ? `A wardrobe or cabinet stands in the way${affected ? ' of the ' + affected.noun : ''}. Move it first.` : null;
    }
    return piece?.clashes({ studio: next, bodies: getScene().wardrobes.map(c => cabinetPiece(c).body(next)) })[0] ?? null;
  }

  function save(next: Studio, recordHistory: boolean) {
    if (recordHistory) checkpoint();
    getScene().studio = next;
  }

  /** Preview uses the same validation as a commit. The gesture owns its undo checkpoint. */
  function edit(key: PieceKey, change: Edit, recordHistory = true, quiet = false): boolean {
    const studio = getScene().studio, result = studio && change(studio);
    if (!studio || !result) return false;
    const out: Result = 'corners' in result ? { studio: result } : result;
    const why = problem(out.studio, key, studio);
    if (why) { if (!quiet) report(why); return false; }
    const changed = JSON.stringify(out.studio) !== JSON.stringify(studio);
    if (changed) save(out.studio, recordHistory);
    if (!quiet && out.note) report(out.note);
    return changed;
  }

  function creationProblem(next: Studio, family: Family) {
    const item = (family === 'fixture' ? next.fixtures : next.furnishings)!.at(-1)!;
    return problem(next, { family, id: item.id });
  }

  /** Called only for the accepted placement, so probes, previews and failures never count. */
  function created(next: Studio, family: Family): string {
    const item = (family === 'fixture' ? next.fixtures : next.furnishings)!.at(-1)!;
    save(next, true);
    try { track('studio_room_edited', { action: family + '_added', detail_kind: item.kind }); } catch { /* Counting never breaks an edit. */ }
    return item.id;
  }

  const editFixture = (id: string, change: Edit, recordHistory = true, quiet = false) =>
    edit({ family: 'fixture', id }, change, recordHistory, quiet);
  const editFurnishing = (id: string, change: Edit, recordHistory = true, quiet = false) =>
    edit({ family: 'furnishing', id }, change, recordHistory, quiet);
  const fixtureProblem = (next: Studio, id: string) => problem(next, { family: 'fixture', id });
  const furnishingProblem = (next: Studio, id: string) => problem(next, { family: 'furnishing', id });

  /** Adds a fixture of `kind`, fitted the way its kind starts (a toilet wall-hung, in a half-height boxing): on `wallId`
   * near `near` along it, else at the free spot nearest the wall's middle, else on the longest wall with room. Its id,
   * or null with the reason. */
  function addStudioFixture(kind: string, wallId?: string, near?: number): string | null {
    const room = getScene().studio, k = fixtureKind(kind), piece = newFixturePiece(kind);
    if (!k || !piece) return null;
    if (!room?.walls.length) { report(`Add walls first, then the ${piece.noun}.`); return null; }
    let reason: string | null = null;
    const scene = roomWith(room);
    for (const strict of [true, false]) {
      let accepted: Studio | null = null;
      const placed = piece.place(scene, { wallId, near, accept: candidate => {
        const draft = addFixture(room, candidate.wallId!, kind, candidate.offset!, piece.data.type);
        if (!draft) return false;
        const f = draft.fixtures!.at(-1)!;
        if (fixtureProblems(draft, f).length || (strict && straddles(draft, f))) return false;
        const fitted = k.setups && k.start ? applySetup(draft, f.id, k.start) : { studio: draft };
        if (!fitted) return false;
        const why = creationProblem(fitted.studio, 'fixture');
        if (why) { reason ??= why; return false; }
        accepted = fitted.studio;
        return true;
      } });
      if (placed && accepted) return created(accepted, 'fixture');
    }
    report(wallId ? `This wall has no free stretch for a ${fixtureName(kind)}. Move a door, a wardrobe or another fixture, or choose another wall.`
      : reason ?? `No wall has room for a ${fixtureName(kind)}.`);
    return null;
  }

  /** Fits it the way a setup says (type and boxing). */
  function setFixtureSetup(id: string, setup: string) {
    const ok = editFixture(id, room => applySetup(room, id, setup) ?? null);
    const studio = getScene().studio;
    if (!ok && studio && !applySetup(studio, id, setup)) report('There is no room for a boxing here. Move it along the wall first.');
    return ok;
  }

  function copyRoomPiece(room: Studio, family: Family, piece: Duplicable, at: (pose: Placement) => Studio | null, message: string): string | null {
    let accepted: Studio | null = null;
    const pose = piece.copyPose(roomWith(room), { accept: candidate => {
      const next = at(candidate);
      if (!next || creationProblem(next, family)) return false;
      accepted = next;
      return true;
    } });
    if (pose && accepted) return created(accepted, family);
    report(message);
    return null;
  }

  /** A copy beside it on the same wall, nearest first on the right. Its id, or null with the reason. */
  function duplicateStudioFixture(id: string): string | null {
    const room = getScene().studio, f = fixtureOf(room, id);
    if (!room || !f) return null;
    return copyRoomPiece(room, 'fixture', fixturePiece(f), p => duplicateFixture(room, id, p.offset!), `There is no room for another ${fixtureName(f.kind)} on this wall.`);
  }

  function removeStudioFixture(id: string) {
    return editFixture(id, room => removeFixture(room, id));
  }

  /** Places each furnishing using its kind's placement rules. */
  function addStudioFurnishing(kind: string, wallId?: string, near?: number): string | null {
    const room = getScene().studio, piece = newFurnishingPiece(kind);
    if (!piece) return null;
    if (!room?.walls.length) { report(`Add a room first, then the ${piece.noun}.`); return null; }
    let accepted: Studio | null = null;
    const pose = piece.place(roomWith(room), { wallId, near, accept: p => {
      const next = addFurnishing(room, kind, p, piece.data.type);
      if (!next || creationProblem(next, 'furnishing')) return false;
      accepted = next;
      return true;
    } });
    if (!pose || !accepted) { report(`There is no free floor for a ${piece.noun}. Move a wardrobe or make the room bigger.`); return null; }
    return created(accepted, 'furnishing');
  }

  /** Turns it to `angle` (snapped unless `free`), or a quarter turn, about its middle: the turn every piece shares, which
   * slides it out of a wall it would turn into. `recordHistory` false is a live preview while a handle is dragged. */
  function turnStudioFurnishing(id: string, angle?: number, free = false, recordHistory = true): boolean {
    const studio = getScene().studio, f = furnishingOf(studio, id);
    if (!studio || !f) return false;
    const piece = furnishingPiece(f), pose = angle === undefined ? piece.quarterTurn(roomWith(studio)) : piece.turn(roomWith(studio), angle, free);
    return editFurnishing(id, r => moveFurnishing(r, id, pose), recordHistory, !recordHistory);
  }

  /** A copy beside it: to its right, its left, in front, else wherever its kind goes. Its id, or null with the reason. */
  function duplicateStudioFurnishing(id: string): string | null {
    const room = getScene().studio, f = furnishingOf(room, id);
    if (!room || !f) return null;
    const piece = furnishingPiece(f);
    return copyRoomPiece(room, 'furnishing', piece, pose => duplicateFurnishing(room, id, pose), `There is no room for another ${piece.noun}.`);
  }

  function removeStudioFurnishing(id: string) {
    return editFurnishing(id, room => removeFurnishing(room, id));
  }

  function editPiece(key: PieceKey, change: PieceEdit, recordHistory: boolean): boolean {
    const { family, id } = key;
    if (family === 'cabinet') {
      const c = cabinetOf(id);
      if (!c) return false;
      if (change.action === 'size') return cabinets.setCabinetSize(cabinetAxis[change.axis], change.value, recordHistory, c);
      if (change.action === 'move') return recordHistory ? cabinets.commitCabinetMove(c, change.to)
        : cabinets.previewTranslation(c.id, { x: change.to.x, y: change.to.y ?? c.y, z: change.to.z });
      if (change.action === 'turn') {
        const angle = change.angle === undefined ? (c.angle + 90) % 360 : snapTurn(change.angle, change.free ?? true);
        return recordHistory ? cabinets.commitCabinetTurn(c, angle, change.from ?? c) : cabinets.previewRotation(c.id, angle, change.from);
      }
      return change.action === 'finish' && cabinets.setCabinetFinish(c, change.group, change.id, recordHistory);
    }
    if (change.action === 'type') {
      const apply = family === 'fixture' ? setFixtureType : setFurnishingType;
      return edit(key, studio => apply(studio, id, change.id), recordHistory, !recordHistory);
    }
    if (change.action === 'finish') {
      const apply = family === 'fixture' ? setFixtureFinish : setFurnishingFinish;
      return edit(key, studio => apply(studio, id, change.group, change.id), recordHistory, !recordHistory);
    }
    if (change.action === 'size') {
      const model = roomWith(), piece = studioPiece(model.studio, key);
      if (!piece) return false;
      const size = { [change.axis]: change.value }, resized = piece.resize(model, size, family === 'furnishing' ? 'back' : 'middle');
      if (!resized.value) {
        if (recordHistory && resized.reason) report(resized.reason);
        return false;
      }
      const apply = family === 'fixture' ? setFixtureSize : setFurnishingSize;
      return edit(key, studio => apply(studio, id, { [change.axis]: resized.value![change.axis] }), recordHistory, !recordHistory);
    }
    if (change.action === 'turn') return family === 'furnishing' && turnStudioFurnishing(id, change.angle, change.free, recordHistory);
    return edit(key, studio => {
      const piece = studioPiece(studio, key);
      if (!piece) return null;
      const at = (pose: Pose) => {
        if (family === 'furnishing') return moveFurnishing(studio, id, pose);
        return 'slide' in piece && 'offset' in pose && typeof pose.offset === 'number' ? piece.slide(studio, pose.offset) : null;
      };
      const moved = piece.move(roomWith(studio), change.to, { free: change.free ?? true, problem: pose => {
        const next = at(pose);
        return next ? problem(next, key) : 'Choose a wall for the fixture.';
      } });
      if (!moved.value && moved.reason && recordHistory) report(moved.reason);
      return moved.value ? at(moved.value) : null;
    }, recordHistory, !recordHistory);
  }

  function pieceProblem(key: PieceKey): string | null {
    const studio = getScene().studio;
    if (key.family !== 'cabinet') return studio ? problem(studio, key) : null;
    const c = cabinetOf(key.id);
    return c ? cabinetPiece(c).clashes(roomWith())[0] ?? null : null;
  }

  function addPiece(kind: PieceKey, hint: { wallId?: string | undefined; near?: number | undefined; beside?: boolean } = {}): PieceKey | null {
    const { family, id } = kind;
    if (!PIECE_KINDS[family].some(entry => entry.id === id)) return null;
    if (family !== 'cabinet') {
      const add = family === 'fixture' ? addStudioFixture : addStudioFurnishing, added = add(id, hint.wallId, hint.near);
      return added === null ? null : { family, id: added };
    }
    const key = id === 'kitchen' ? 'base' : id;
    const added = kitchenPreset(key) ? addKitchenUnit(key, {
      ...(hint.wallId === undefined ? {} : { placementWall: hint.wallId }),
      ...(hint.near === undefined ? {} : { placementAlong: hint.near }),
      ...(hint.beside === undefined ? {} : { beside: hint.beside }),
    }) : addCabinet(false, undefined, undefined, {
      ...presetSize(id), fallbackToRoom: true,
      ...(hint.wallId === undefined ? {} : { placementWall: hint.wallId }), ...(hint.near === undefined ? {} : { placementAlong: hint.near }),
    });
    return added ? { family, id: String(added.id) } : null;
  }

  function duplicatePiece(key: PieceKey): PieceKey | null {
    const { family, id } = key, source = family === 'cabinet' ? cabinetOf(id) : undefined;
    const added = family === 'fixture' ? duplicateStudioFixture(id) : family === 'furnishing' ? duplicateStudioFurnishing(id)
      : source ? addCabinet(true, undefined, undefined, undefined, source)?.id : undefined;
    return added == null ? null : { family, id: String(added) };
  }

  function removePiece(key: PieceKey) {
    const { family, id } = key;
    return family === 'cabinet' ? !!cabinets.removeCabinet(Number(id)) : family === 'fixture' ? removeStudioFixture(id) : removeStudioFurnishing(id);
  }

  return { ...cabinets, addCabinet, addKitchenUnit, addPiece, duplicatePiece, removePiece, pieceProblem,
    previewPiece: (key: PieceKey, change: PieceEdit) => editPiece(key, change, false),
    commitPiece: (key: PieceKey, change: PieceEdit) => editPiece(key, change, true),
    addStudioFixture, editFixture, fixtureProblem, setFixtureSetup, duplicateStudioFixture, removeStudioFixture,
    addStudioFurnishing, editFurnishing, furnishingProblem, turnStudioFurnishing, duplicateStudioFurnishing, removeStudioFurnishing };
}
