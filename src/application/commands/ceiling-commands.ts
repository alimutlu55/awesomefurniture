import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { createDesignCommands } from './design-commands';
import { ceilingTop } from '../../domain/studio/studio-fit';
import { ceilingClearance } from '../../domain/studio/studio-clearance';
import { maxHeight, regularShape, resolveShape, type WardrobeShape } from '../../domain/wardrobe/shape/wardrobe-shape';

type Top = readonly { x: number; y: number }[];
/** Height of a top at x: at a step, the higher side (`high`) or the lower. */
function heightAt(top: Top, x: number, high: boolean) {
  let out: number | null = null;
  for (let k = 0; k < top.length - 1; k++) {
    const a = top[k]!, b = top[k + 1]!;
    if (x < a.x - 1e-6 || x > b.x + 1e-6) continue;
    const y = b.x - a.x < 1e-6 ? (high ? Math.max(a.y, b.y) : Math.min(a.y, b.y)) : a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
    out = out === null ? y : high ? Math.max(out, y) : Math.min(out, y);
  }
  return out ?? top[0]!.y;
}
/** Whether a top rises into the ceiling's: more than half a centimetre above it anywhere. */
export function risesAbove(top: Top, ceiling: Top, w: number) {
  // Between profile vertices both heights are linear. Check both ends of each
  // interval, on its own side of a step, including bends less than 1 cm apart.
  const xs = [...new Set([0, w, ...top.map(p => p.x), ...ceiling.map(p => p.x)])].filter(x => x >= 0 && x <= w).sort((a, b) => a - b);
  for (let k = 1; k < xs.length; k++) {
    const a = xs[k - 1]!, b = xs[k]!, inset = Math.min(1e-5, (b - a) / 4);
    for (const x of [a + inset, b - inset]) if (heightAt(top, x, true) > heightAt(ceiling, x, false) + .5) return true;
  }
  return false;
}

/** Wardrobes follow the room's ceiling: one standing under a staircase, a landing, a sloped roof or a beam
 * takes its shape (studio-fit.ts), and one leaving it stands regular again at its tallest point. A shape
 * someone chose themselves stays as long as it keeps under the ceiling. */
export function createCeilingCommands(getScene: () => EditorScene, report: (message: string) => void) {
  const placed = (c: EditorCabinet) => ({ x: c.x, z: c.z, angle: c.angle, y: c.y || 0, w: c.state.w, d: c.state.d });
  const current = (c: EditorCabinet): WardrobeShape => c.state.shape ? resolveShape(c.state) : regularShape(c.state.w, c.state.h);

  /** Brings one wardrobe in line with the ceiling over it. `refit` false is a live preview: fittings are
   * left alone until the change is committed. Returns why it cannot stand there, or null. */
  function follow(cabinet: EditorCabinet, refit = true): string | null {
    const fit = ceilingTop(getScene().studio, placed(cabinet)), state = cabinet.state;
    if (fit && 'problem' in fit) return fit.problem;
    const under = fit && 'shape' in fit ? fit.shape : null;
    let next: WardrobeShape | null | undefined;
    if (under) next = state.shape?.template === 'room' || ceilingClearance(getScene().studio, placed(cabinet))(current(cabinet)) ? under : undefined;
    // Out from under it: a fitted wardrobe stands regular at its tallest point.
    else if (state.shape?.template === 'room') next = null;
    const changed = next !== undefined && JSON.stringify(next) !== JSON.stringify(state.shape ?? null);
    if (changed) {
      if (next) { state.shape = structuredClone(next); state.h = maxHeight(next); } else delete state.shape;
      state.proposal = null;
    }
    // A commit after live previews refits what the previews reshaped (a no-op when everything fits).
    if (refit && (changed || state.shape?.template === 'room')) createDesignCommands(() => cabinet.state, { report }).fitToShape();
    return null;
  }
  /** Every wardrobe in the room, after the room or its ceilings changed. */
  function followAll(refit = true) {
    let changed = false;
    for (const c of getScene().wardrobes) {
      const before = JSON.stringify(c.state.shape ?? null);
      follow(c, refit);
      changed ||= before !== JSON.stringify(c.state.shape ?? null);
    }
    return changed;
  }
  /** Why a shape someone picks does not fit under the ceiling over the wardrobe, or null. */
  let clearanceKey: string | undefined, clearance: ReturnType<typeof ceilingClearance> = () => false;
  function shapeBlocked(cabinet: EditorCabinet, shape: WardrobeShape): string | null {
    const room = getScene().studio, pose = placed(cabinet), key = JSON.stringify([room, pose]);
    // A handle's boundary search checks many shapes in the same space. Prepare
    // its ceiling planes once; any room, pose or footprint change invalidates them.
    if (key !== clearanceKey) {
      clearance = ceilingClearance(room, pose);
      clearanceKey = key;
    }
    return clearance(shape) ? 'The ceiling above is lower than that. This wardrobe follows the ceiling.' : null;
  }
  return { follow, followAll, shapeBlocked };
}
