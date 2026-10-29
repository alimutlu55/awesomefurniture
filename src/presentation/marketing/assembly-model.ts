import type { StudyShape } from './study';

type Triple = readonly [number, number, number];
export interface AssemblyPart {
  kind: 'panel' | 'back' | 'rail' | 'drawer';
  size: Triple; position: Triple; rotation: Triple; spread: Triple;
  /** A shaped back is described in local XY coordinates. */
  outline?: readonly (readonly [number, number])[];
  flatPosition?: Triple;
}
export interface AssemblyPose { position: Triple; rotation: Triple }
const ease = (t: number) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Reversible, deterministic motion: flat packed → exploded construction → fitted furniture. */
export function assemblyPose(part: AssemblyPart, index: number, progress: number): AssemblyPose {
  if (progress >= 1) return { position: part.position, rotation: part.rotation };
  const unfold = ease(progress / .48);
  const start = part.position[1] < .13 ? .3 : part.kind === 'back' ? .35 : part.kind === 'drawer' ? .59
    : part.kind === 'rail' ? .52 : part.size[1] > .5 ? .37 : part.position[1] > 2.3 ? .56 : .45;
  const join = ease((progress - start) / (1 - start));
  const spread = part.position.map((v, axis) => v + part.spread[axis]!) as unknown as Triple;
  // The longest dimension lies horizontally in every stack.
  const flatRotation: Triple = part.size[0] < part.size[1] && part.size[0] < part.size[2] ? [0, 0, Math.PI / 2]
    : part.size[2] < part.size[1] ? [-Math.PI / 2, 0, 0] : [0, 0, 0];
  const flat: Triple = part.flatPosition ?? [0, .035 + index * .026, 0];
  // Joining overlaps the lift, so the exploded construction stays readable without a mid-animation hold.
  const position = part.position.map((v, axis) => mix(mix(flat[axis]!, spread[axis]!, unfold), v, join));
  const rotation = part.rotation.map((v, axis) => mix(flatRotation[axis]!, v, unfold)) as unknown as Triple;
  // A long board lifts before it turns upright; its corners never travel through the floor.
  const [rx, , rz] = rotation, a = Math.cos(rx) * Math.sin(rz), b = Math.cos(rx) * Math.cos(rz), c = -Math.sin(rx);
  const outline = part.outline ?? [
    [-part.size[0] / 2, -part.size[1] / 2], [part.size[0] / 2, -part.size[1] / 2],
    [-part.size[0] / 2, part.size[1] / 2], [part.size[0] / 2, part.size[1] / 2],
  ];
  const lowest = Math.min(...outline.map(([x, y]) => a * x! + b * y! - Math.abs(c) * part.size[2] / 2));
  position[1] = Math.max(position[1]!, -lowest + .002 * (1 - join));
  return { position: position as unknown as Triple, rotation };
}

/** Equal travel per unit of playback time, with a short acceleration and deceleration at the endpoints. */
export function assemblyTimeline(parts: readonly AssemblyPart[]): (progress: number) => number {
  const samples = 200, distances = [0];
  let previous = parts.map((part, index) => assemblyPose(part, index, 0));
  for (let n = 1; n <= samples; n++) {
    const next = parts.map((part, index) => assemblyPose(part, index, n / samples));
    const travel = next.reduce((sum, pose, index) => {
      const from = previous[index]!;
      return sum + Math.hypot(...pose.position.map((v, axis) => v - from.position[axis]!))
        + Math.hypot(...pose.rotation.map((v, axis) => v - from.rotation[axis]!));
    }, 0);
    distances.push(distances[n - 1]! + travel); previous = next;
  }
  return progress => {
    if (progress <= 0 || progress >= 1) return Math.max(0, Math.min(1, progress));
    const distance = progress < .1 ? progress ** 2 / .18
      : progress > .9 ? 1 - (1 - progress) ** 2 / .18 : (progress - .05) / .9;
    const target = distance * distances[samples]!;
    let low = 0, high = samples;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (distances[mid]! < target) low = mid; else high = mid;
    }
    return (low + (target - distances[low]!) / (distances[high]! - distances[low]! || 1)) / samples;
  };
}

/** This is a visual construction study; manufacturing geometry remains owned by the editor. Units: metres. */
export function assemblyParts(width: number, shape: StudyShape): AssemblyPart[] {
  const w = width / 100, d = .58, t = .018, base = .09;
  const top = (x: number) => shape === 'under-stairs' ? Math.min(2.4, .88 + x / (w * .72) * 1.52)
    : shape === 'alcove' && x > w * .72 + .001 ? 2.05 : 2.4;
  const parts: AssemblyPart[] = [];
  const add = (kind: AssemblyPart['kind'], size: Triple, position: Triple, spread: Triple,
    rotation: Triple = [0, 0, 0]) => parts.push({ kind, size, position, spread, rotation });
  const n = w >= 2.6 ? 4 : 3;
  const divisions = Array.from({ length: n + 1 }, (_, i) => i * w / n);
  if (shape === 'alcove') divisions[n - 1] = w * .72;
  const outline: [number, number][] = [[-w / 2, base - 1.2], [w / 2, base - 1.2], [w / 2, top(w) - 1.2]];
  if (shape === 'under-stairs') outline.push([w * .22, 1.2]);
  if (shape === 'alcove') outline.push([w * .22, .85], [w * .22, 1.2]);
  outline.push([-w / 2, top(0) - 1.2]);
  parts.push({ kind: 'back', size: [w, 2.4 - base, .008], position: [0, 1.2, -d / 2],
    rotation: [0, 0, 0], spread: [0, .1, -.45], outline });
  add('panel', [w, t, d], [0, base, 0], [0, -.035, .12]);
  // Inset plinths keep the cabinet visibly grounded.
  for (const z of [-.22, .22]) add('panel', [w - .12, base - t / 2, t], [0, (base - t / 2) / 2, z], [0, 0, z * 1.7]);
  divisions.forEach((x, i) => {
    const h = shape === 'alcove' && i === n - 1 ? 2.4 : top(x);
    add('panel', [t, h - base - t / 2, d], [x - w / 2 + (i === 0 ? t / 2 : i === n ? -t / 2 : 0), (h + base) / 2, 0],
      [(x / w - .5) * 1.1, i === 0 || i === n ? .08 : .22, i % 2 ? .15 : -.08]);
  });
  const roofs = shape === 'regular' ? [[0, w, 2.4, 2.4]]
    : shape === 'alcove' ? [[0, w * .72, 2.4, 2.4], [w * .72, w, 2.05, 2.05]]
    : [[0, w * .72, .88, 2.4], [w * .72, w, 2.4, 2.4]];
  for (const [x1, x2, y1, y2] of roofs as [number, number, number, number][]) {
    add('panel', [Math.hypot(x2 - x1, y2 - y1), t, d], [(x1 + x2 - w) / 2, (y1 + y2) / 2, 0],
      [0, .65, 0], [0, 0, Math.atan2(y2 - y1, x2 - x1)]);
  }
  for (let i = 0; i < n; i++) {
    const left = divisions[i]!, right = divisions[i + 1]!, bw = right - left - t * (i === 0 || i === n - 1 ? 1.5 : 1);
    const x = (left + right - w) / 2, h = Math.min(top(left + .002), top(right - .002));
    const shelf = (y: number, offset: number) => add('panel', [bw, t, d - .015], [x, y, .005], [(i - (n - 1) / 2) * .16, offset, .32]);
    if (i === 1 && h > 1.65) {
      shelf(h - .37, .25); shelf(.54, -.08);
      add('rail', [bw - .04, .018, .018], [x, h - .47, .015], [0, .2, .6]);
    } else {
      const count = Math.max(2, Math.floor((h - base) / .43));
      for (let j = 1; j < count; j++) shelf(base + (h - base) * j / count, (j / count - .4) * .4);
    }
    if (i === 0 && h > 1.45) {
      for (let j = 0; j < 2; j++) {
        const y = base + .12 + j * .225;
        add('drawer', [bw - .012, .213, t], [x, y, d / 2 + .008], [-.12, j * .08, .8 + j * .1]);
      }
    }
  }
  // Give the back its own place and pack the remaining boards into two adjacent stacks.
  // Their footprints stay separate, and every layer rests above the previous one.
  const span = Math.max(w, 2.4), stackHeight = [.025, .025];
  return parts.map((part, i) => {
    const stack = i % 2, thickness = Math.min(...part.size);
    const y = stackHeight[stack]! + thickness / 2;
    if (i > 0) stackHeight[stack]! += thickness + .009;
    const flatPosition: Triple = i === 0 ? [-span / 2 - .06, .025, 0]
      : [span / 2 + .06, y, stack === 0 ? -.52 : .52];
    return { ...part, flatPosition };
  });
}
