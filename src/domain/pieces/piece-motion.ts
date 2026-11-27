/**
 * The motion rules every piece shares: how a turn snaps, and how far a move or turn goes before it would break a rule.
 * Pure; degrees and centimetres.
 */

/** Turns snap in 5° steps and catch a quarter turn within 5°; `free` (Shift) turns exactly. Always 0–360. */
export function snapTurn(angle: number, free = false): number {
  let a = angle;
  if (!free) {
    a = Math.round(a / 5) * 5;
    const right = Math.round(a / 90) * 90;
    if (Math.abs(a - right) <= 5) a = right;
  }
  return ((a % 360) + 360) % 360;
}

/** Moves toward `want` as far as the rules allow: the whole way if valid, else the furthest valid point between the
 * start (valid) and `want`, found by halving. `at(t)` builds the result at fraction t. */
export function furthestValid<T>(at: (t: number) => T | null, valid: (result: T) => boolean): { room: T | null; whole: boolean } {
  const whole = at(1);
  if (whole && valid(whole)) return { room: whole, whole: true };
  let lo = 0, hi = 1, best: T | null = null;
  for (let n = 0; n < 14; n++) {
    const mid = (lo + hi) / 2, cand = at(mid);
    if (cand && valid(cand)) { lo = mid; best = cand; } else hi = mid;
  }
  return { room: best, whole: false };
}

/** A piece's own axes at `angle`: `u` along its front (left to right as you face it), `f` towards its front. */
export function pieceAxes(angle: number) {
  const a = angle * Math.PI / 180;
  return { u: { x: Math.cos(a), z: -Math.sin(a) }, f: { x: Math.sin(a), z: Math.cos(a) } };
}
/** The floor point `s` along a piece's front from its middle and `t` towards its front. */
export function piecePoint(p: { readonly x: number; readonly z: number; readonly angle: number }, s: number, t: number) {
  const { u, f } = pieceAxes(p.angle);
  return { x: p.x + u.x * s + f.x * t, z: p.z + u.z * s + f.z * t };
}

/** The line of a gap beside a body, drawn from the middle of that side. The gap is the smallest of three readings along
 * the side; drawn where that reading was, it would jump from one end of the side to the other as the piece moves. */
export function steadyLine(b: { x: number; z: number; angle: number; width: number; depth: number }, side: string, distance: number, y = 2) {
  const { u, f } = pieceAxes(b.angle);
  const dir = side === 'left' ? [-u.x, -u.z, b.width] : side === 'right' ? [u.x, u.z, b.width]
    : side === 'front' ? [f.x, f.z, b.depth] : side === 'back' ? [-f.x, -f.z, b.depth] : null;
  if (!dir) return null;
  const [dx, dz, size] = dir as [number, number, number], from = { x: b.x + dx * size / 2, y, z: b.z + dz * size / 2 };
  return { from, to: { x: from.x + dx * distance, y, z: from.z + dz * distance } };
}
