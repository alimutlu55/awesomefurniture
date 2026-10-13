import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { measureAround } from '../commands/align-commands';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import { roomHeight, wallFace, wallLine } from '../../domain/studio/studio';
import type { Studio } from '../../domain/studio/studio';
import { ceilingFrame } from '../../domain/studio/studio-ceiling';
import { resolveShape } from '../../domain/wardrobe/shape/wardrobe-shape';

/**
 * What a design is, as a carpenter would describe it, for agents and anything else that reads designs
 * without looking at them: the room's walls (inside lengths) and openings, the ceilings that come down, and
 * each wardrobe with its size, top, sections, fittings, the gaps around it, what it holds of what it was
 * planned for, and warnings. Plain, versioned JSON, in the same terms as the design spec (walls numbered from
 * 1, "from" measured inside from a wall's left end), so a report can be checked against the spec it came from.
 * Centimetres, rounded to a millimetre.
 */
export const SCENE_REPORT_VERSION = 1;

const r1 = (v: number) => Math.round(v * 10) / 10;
const wallNumber = (id: string) => Number(id.replace(/^w/, '')) || id;

export interface SceneReport {
  readonly reportVersion: typeof SCENE_REPORT_VERSION;
  readonly room: null | {
    readonly height: number;
    readonly walls: readonly { wall: number | string; length: number; height: number; thickness: number; openings: readonly { kind: string; from: number; width: number; height: number; sill: number }[] }[];
  };
  readonly ceilings: readonly { wall: number | string; run: 'along' | 'across'; depth: number; points: readonly (readonly [number, number])[] }[];
  readonly wardrobes: readonly WardrobeReport[];
}
export interface WardrobeReport {
  readonly wardrobe: number;
  readonly name: string;
  readonly against: number | string | null;
  readonly from: number | null;
  readonly width: number; readonly height: number; readonly depth: number;
  /** The top across the width, [from the left side, height] (two points when flat). */
  readonly top: readonly (readonly [number, number])[];
  readonly sections: readonly { width: number; fittings: readonly { kind: string; purpose: string | null; width: number; height: number; from: number }[] }[];
  /** Gaps to the walls, neighbours and ceiling; null where nothing is near. */
  readonly gaps: Readonly<Record<'left' | 'right' | 'back' | 'front' | 'top', number | null>>;
  /** For each possession it was planned for: how many it holds of how many asked. */
  readonly holds: Readonly<Record<string, { asked: number; holds: number }>>;
  readonly warnings: readonly string[];
}

/** The wall a wardrobe stands flush and square against, and where along it. */
function placeOnWall(studio: Studio | undefined, c: EditorCabinet) {
  for (const w of studio?.walls ?? []) {
    const line = wallLine(studio!, w), face = wallFace(studio!, w);
    if (!line || !face) continue;
    const turn = ((c.angle - line.angle) % 360 + 360) % 360, a = c.angle * Math.PI / 180;
    const bx = c.x - Math.sin(a) * c.state.d / 2 - line.a.x, bz = c.z - Math.cos(a) * c.state.d / 2 - line.a.z;
    const along = bx * line.ux + bz * line.uz, out = bx * line.nx + bz * line.nz - w.thickness / 2;
    if ((turn < .5 || turn > 359.5) && Math.abs(out) < 2 && along > face.start - 1 && along < face.end + 1) return { against: wallNumber(w.id), from: r1(along - c.state.w / 2 - face.start) };
  }
  return { against: null, from: null };
}

function describeWardrobe(scene: EditorScene, c: EditorCabinet, k: number): WardrobeReport {
  const state = c.state, geometry = createWardrobeGeometry(() => state), widths = geometry.widths();
  const sections = widths.map((width, i) => ({
    width: r1(width),
    fittings: geometry.computeLayout(i).map((q, j) => ({ kind: state.secs[i]![j]!.k, purpose: state.secs[i]![j]!.purpose ?? null, width: r1(q.w), height: r1(q.h), from: r1(q.relY0) })),
  }));
  const { gaps } = measureAround(scene, c, ['left', 'right', 'back', 'front', 'top']), gap = (side: string) => {
    const g = gaps.find(x => x.side === side);
    return g ? r1(g.distance) : null;
  };
  // What it holds of what it was planned for, counted as Auto design counts.
  const asked = Object.entries(state.profile.needs ?? {}).filter(([, n]) => Number(n) > 0) as [string, number][], holds: Record<string, { asked: number; holds: number }> = {};
  if (asked.length) {
    const metrics = WardrobePlanner.analyze(geometry.currentLayout(), geometry.plannerConfig());
    for (const [key, n] of asked) holds[key] = { asked: n, holds: Math.floor(metrics.capacities[key] ?? 0) };
  }
  const warnings: string[] = [];
  const front = gap('front');
  if (front !== null && front < 60) warnings.push(`${front} cm in front: hinged doors need 60 cm to open.`);
  for (const [key, h] of Object.entries(holds)) if (h.holds < h.asked) warnings.push(`Room for ${h.holds} of ${h.asked} ${key}.`);
  if (widths.some((_, i) => !geometry.sectionFits(i))) warnings.push('Some fittings rise into the top.');
  return {
    wardrobe: k + 1, name: c.name, ...placeOnWall(scene.studio, c),
    width: state.w, height: r1(state.h), depth: state.d,
    top: resolveShape(state).top.map(p => [r1(p.x), r1(p.y)] as const),
    sections,
    // Fitted under a ceiling that comes down, it meets the ceiling: no gap above.
    gaps: { left: gap('left'), right: gap('right'), back: gap('back'), front, top: state.shape?.template === 'room' ? 0 : gap('top') },
    holds, warnings,
  };
}

/** The report for a scene (the editor's or one built from a spec). */
export function describeScene(scene: EditorScene): SceneReport {
  const studio = scene.studio;
  const room = studio ? {
    height: roomHeight(studio),
    walls: studio.walls.map(w => {
      const face = wallFace(studio, w);
      return {
        wall: wallNumber(w.id), length: r1(face?.length ?? 0), height: w.height, thickness: w.thickness,
        openings: studio.openings.filter(o => o.wall === w.id).map(o => ({ kind: o.kind, from: r1(o.offset - o.width / 2 - (face?.start ?? 0)), width: o.width, height: o.height, sill: o.sill })),
      };
    }),
  } : null;
  const ceilings = (studio?.ceilings ?? []).map(c => {
    const fr = ceilingFrame(studio!, c), start = c.run === 'along' ? fr?.face.start ?? 0 : 0;
    return { wall: wallNumber(c.wall), run: c.run, depth: r1(c.depth), points: c.profile.map(p => [r1(p.t - start), r1(p.y)] as const) };
  });
  return { reportVersion: SCENE_REPORT_VERSION, room, ceilings, wardrobes: scene.wardrobes.map((c, k) => describeWardrobe(scene, c, k)) };
}
