import { MIN_CABINET_DEPTH } from '../../domain/wardrobe/cabinet-limits';
import type { EditorScene } from '../projects/editor-scene';
import { createSceneCommands } from '../commands/scene-commands';
import { createDesignCommands } from '../commands/design-commands';
import { sceneToProject } from '../projects/editor-mapper';
import { describeScene, type SceneReport } from './describe-scene';
import { createProject, type ProjectDocument } from '../../domain/project/project';
import type { DesignSpec, SpecProblem } from '../../domain/spec/design-spec';
import { STUDIO_DEFAULTS, wallFace } from '../../domain/studio/studio';
import type { Studio, StudioWall } from '../../domain/studio/studio';
import { createStudio, rectangleStudio, studioTemplate } from '../../domain/studio/studio-templates';
import { addOpening, setOpeningSize, setWallSize } from '../../domain/studio/studio-edit';
import { addCeiling, setCeilingDepth } from '../../domain/studio/studio-ceiling';
import { studioProblems } from '../../domain/studio/studio-validation';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { generateDesignedLayouts } from '../../domain/planner/wardrobe-composer';
import { POSSESSION_KEYS } from '../../domain/wardrobe/possessions';
import type { ShapeTemplateId } from '../../domain/wardrobe/shape/wardrobe-shape';

export type SpecBuild = { ok: true; project: ProjectDocument; report: SceneReport } | { ok: false; problems: SpecProblem[] };

/** Sizes a wardrobe can be, as the editor's own size controls allow. */
const RANGE = { width: [80, 400], height: [40, 280], depth: [MIN_CABINET_DEPTH, 80] } as const;

/**
 * Builds a design from a spec (domain/spec/design-spec.ts) with the editor's own commands, in order: the
 * room, its openings, the ceilings that come down, then each wardrobe (against its wall, fitted under any
 * ceiling, planned by Auto design for what it should hold). The spec must already be checked by its codec.
 * Nothing half-built comes back: either the project document (saved like any other) and its report, or
 * every problem found, each with where it is in the spec and what to do. Pure: no storage, no screen.
 */
export function buildFromSpec(spec: DesignSpec, id: string): SpecBuild {
  const problems: SpecProblem[] = [];
  const scene: EditorScene = { wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1 };
  let said: string[] = [];
  const commands = createSceneCommands(() => scene, { report: m => said.push(m) });
  const wallId = (n: number) => 'w' + n;

  // The room, its openings and ceilings: each checked as it is added, so a problem says where it came from.
  if (spec.room) {
    const room = buildRoom(spec, problems);
    if (room) scene.studio = room;
  }
  spec.ceilings?.forEach((c, k) => {
    const path = `ceilings[${k}]`, room = scene.studio;
    if (!room) return problems.push({ path, message: 'A ceiling needs a room: add one under "room".' });
    const wall = room.walls.find(w => w.id === wallId(c.wall));
    if (!wall) return problems.push({ path: path + '.wall', message: `The room has no wall ${c.wall}; its walls are 1 to ${room.walls.length}.` });
    let next = addCeiling(room, wall.id, c.shape);
    if (!next) return problems.push({ path: path + '.shape', message: `Wall ${c.wall} is too short for that ceiling.` });
    const added = next.ceilings!.at(-1)!, face = wallFace(next, wall)!;
    if (c.points) {
      const start = added.run === 'along' ? face.start : 0;
      const profile = c.points.map(([t, y]) => ({ t: Math.round((start + t) * 10) / 10, y }));
      next = { ...next, ceilings: next.ceilings!.map(x => x === added ? { ...x, profile, depth: x.run === 'across' ? profile.at(-1)!.t : x.depth } : x) };
    }
    if (c.depth !== undefined) next = setCeilingDepth(next, added.id, c.depth) ?? next;
    const wrong = studioProblems(next);
    if (wrong.length) return problems.push({ path, message: wrong[0]! });
    scene.studio = next;
  });
  if (problems.length) return { ok: false, problems };

  // The wardrobes, one by one, each against its wall or beside the others.
  spec.wardrobes?.forEach((w, k) => {
    const path = `wardrobes[${k}]`;
    for (const [key, [lo, hi]] of Object.entries(RANGE)) {
      const v = w[key as keyof typeof RANGE];
      if (v !== undefined && (v < lo || v > hi)) problems.push({ path: `${path}.${key}`, message: `A wardrobe's ${key} must be ${lo}–${hi} cm.` });
    }
    if (w.against !== undefined && !scene.studio?.walls.some(x => x.id === wallId(w.against!))) {
      problems.push({ path: path + '.against', message: scene.studio ? `The room has no wall ${w.against}; its walls are 1 to ${scene.studio.walls.length}.` : 'A wardrobe against a wall needs a room: add one under "room".' });
    }
    if (problems.some(p => p.path.startsWith(path))) return;
    said = [];
    const fill = w.fill ?? w.width === undefined;
    const cabinet = commands.addCabinet(false, w.shape as ShapeTemplateId | undefined, w.against !== undefined ? wallId(w.against) : undefined,
      { ...(w.width !== undefined && !fill ? { w: w.width } : {}), ...(w.height !== undefined ? { h: w.height } : {}), ...(w.depth !== undefined ? { d: w.depth } : {}), ...(w.from !== undefined ? { from: w.from } : {}) });
    const refused = said.find(m => /does not fit|no free stretch|too low/.test(m));
    if (!cabinet) return problems.push({ path, message: refused ?? said.at(-1) ?? 'The wardrobe does not fit in this studio.' });
    if (refused) return problems.push({ path, message: refused.replace(' It went where there is room.', '') });
    const collides = createCabinetGeometry(() => scene.wardrobes, () => studioObstacles(scene.studio)).cabinetCollides(cabinet);
    if (collides) return problems.push({ path, message: 'It would run into a wall or another wardrobe. Give it a place on a wall with room for it.' });
    // What it should hold, then Auto design plans for exactly that.
    if (w.for) cabinet.state.profile.needs = Object.fromEntries(POSSESSION_KEYS.map(key => [key, Math.max(0, Math.floor(w.for![key] ?? 0))])) as never;
    if (w.autoDesign ?? !!w.for) {
      const geometry = createWardrobeGeometry(() => cabinet.state), best = generateDesignedLayouts(geometry.plannerConfig())[0];
      if (!best) return problems.push({ path: path + '.for', message: 'Auto design found no layout for this wardrobe. Make it larger or ask for less.' });
      createDesignCommands(() => cabinet.state).applyProposal(best as never);
    }
  });
  if (problems.length) return { ok: false, problems };

  const project = sceneToProject(createProject(id, spec.name?.trim() || 'Design'), scene);
  return { ok: true, project, report: describeScene(scene) };
}

/** The room from its spec: a built-in one or a rectangle, its wall height and thickness, then its openings. */
function buildRoom(spec: DesignSpec, problems: SpecProblem[]): Studio | null {
  const r = spec.room!;
  let room: Studio;
  if (r.template !== undefined) {
    if (!studioTemplate(r.template) || r.template === 'custom') { problems.push({ path: 'room.template', message: `There is no built-in room "${r.template}".` }); return null; }
    room = createStudio(r.template as never);
  } else if (r.width !== undefined && r.depth !== undefined) {
    room = rectangleStudio(r.width, r.depth);
  } else {
    problems.push({ path: 'room', message: 'A room needs a "template", or a "width" and a "depth".' });
    return null;
  }
  const size: Partial<Pick<StudioWall, 'height' | 'thickness'>> = { ...(r.height !== undefined ? { height: r.height } : {}), ...(r.thickness !== undefined ? { thickness: r.thickness } : {}) };
  if (Object.keys(size).length) for (const w of room.walls) room = setWallSize(room, w.id, size) ?? room;
  const wrong = studioProblems(room);
  if (wrong.length) { problems.push({ path: 'room', message: wrong[0]! }); return null; }
  r.openings?.forEach((o, k) => {
    const path = `room.openings[${k}]`, wall = room.walls.find(w => w.id === 'w' + o.wall);
    if (!wall) return problems.push({ path: path + '.wall', message: `The room has no wall ${o.wall}; its walls are 1 to ${room.walls.length}.` });
    let next = addOpening(room, wall.id, o.kind);
    if (!next) return problems.push({ path, message: `Wall ${o.wall} has no room for a ${o.kind} there.` });
    const added = next.openings.at(-1)!, d = STUDIO_DEFAULTS[o.kind], width = o.width ?? d.width;
    next = setOpeningSize(next, added.id, { width, height: o.height ?? d.height, sill: o.sill ?? d.sill }) ?? next;
    if (o.from !== undefined) {
      const face = wallFace(next, wall)!;
      next = { ...next, openings: next.openings.map(x => x.id === added.id ? { ...x, offset: Math.round((face.start + o.from! + width / 2) * 10) / 10 } : x) };
    }
    const wrong = studioProblems(next);
    if (wrong.length) return problems.push({ path, message: wrong[0]! });
    room = next;
  });
  return room;
}
