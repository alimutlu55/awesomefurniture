interface FloorVector { readonly x: number; readonly z: number }
export interface BoxVector extends FloorVector { readonly y: number }
export interface CollisionBox extends FloorVector {
  readonly y?: number | undefined;
  readonly angle: number;
  readonly state: { readonly w: number; readonly h: number; readonly d: number };
}

/** Centimetres. Allow serialized transform noise at contact. */
export const BOX_CONTACT = 1e-5;

export function boxAxes(box: CollisionBox): readonly [FloorVector, FloorVector] {
  const angle = box.angle * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  return [{ x: cos, z: -sin }, { x: sin, z: cos }];
}

export function boxRadius(box: CollisionBox, axis: FloorVector): number {
  const [u, v] = boxAxes(box);
  return Math.abs(u.x * axis.x + u.z * axis.z) * box.state.w / 2 + Math.abs(v.x * axis.x + v.z * axis.z) * box.state.d / 2;
}

export function boxGap(a: CollisionBox, b: CollisionBox): number {
  if ((a.y || 0) + a.state.h <= (b.y || 0) + BOX_CONTACT || (b.y || 0) + b.state.h <= (a.y || 0) + BOX_CONTACT) return Infinity;
  return Math.max(...[...boxAxes(a), ...boxAxes(b)].map(axis => Math.abs((a.x - b.x) * axis.x + (a.z - b.z) * axis.z) - boxRadius(a, axis) - boxRadius(b, axis)));
}

export const boxesOverlap = (a: CollisionBox, b: CollisionBox) => boxGap(a, b) < -BOX_CONTACT;

interface Contact<T> { readonly obstacle: T; readonly fraction: number; readonly normal: BoxVector | null }

/** First contact along a translation of the moving boxes at their starting positions, including rotated and elevated boxes. */
export function firstBoxContact<M extends CollisionBox, T extends CollisionBox>(
  moving: readonly M[], fixed: readonly T[], delta: BoxVector, canCollide: (part: M, obstacle: T) => boolean = () => true,
): Contact<T> | null {
  const entryTolerance = BOX_CONTACT / Math.max(1, Math.hypot(delta.x, delta.y, delta.z));
  let first: Contact<T> | null = null;
  for (const part of moving) for (const obstacle of fixed) {
    if (!canCollide(part, obstacle)) continue;
    const constraints = [...boxAxes(part), ...boxAxes(obstacle)].map(axis => ({
      offset: (part.x - obstacle.x) * axis.x + (part.z - obstacle.z) * axis.z,
      velocity: delta.x * axis.x + delta.z * axis.z,
      radius: boxRadius(part, axis) + boxRadius(obstacle, axis),
      axis: { x: axis.x, y: 0, z: axis.z },
    }));
    constraints.push({
      offset: (part.y || 0) + part.state.h / 2 - (obstacle.y || 0) - obstacle.state.h / 2,
      velocity: delta.y,
      radius: (part.state.h + obstacle.state.h) / 2,
      axis: { x: 0, y: 1, z: 0 },
    });
    let enter = -Infinity, leave = Infinity, normal: BoxVector | null = null;
    for (const { offset, velocity, radius, axis } of constraints) {
      if (Math.abs(velocity) < 1e-10) {
        if (Math.abs(offset) >= radius - BOX_CONTACT) { enter = Infinity; break; }
      } else {
        const a = (-radius - offset) / velocity, b = (radius - offset) / velocity;
        if (Math.min(a, b) > enter) {
          enter = Math.min(a, b);
          const sign = velocity > 0 ? -1 : 1;
          normal = { x: axis.x * sign, y: axis.y * sign, z: axis.z * sign };
        }
        leave = Math.min(leave, Math.max(a, b));
      }
    }
    // A piece starting in contact or already overlapping can move out or along the surface.
    if (enter < 0 && leave > 0) {
      const gap = Math.max(...constraints.map(c => Math.abs(c.offset) - c.radius));
      const inward = constraints.find(c => Math.abs(c.offset) - c.radius >= gap - BOX_CONTACT && Math.sign(c.offset) * c.velocity < -1e-10);
      if (gap < -BOX_CONTACT && inward) {
        const sign = Math.sign(inward.offset), { x, y, z } = inward.axis;
        first = { obstacle, fraction: 0, normal: { x: x * sign, y: y * sign, z: z * sign } };
        continue;
      }
    }
    if (enter < leave - 1e-10 && leave > 1e-10 && enter <= (first?.fraction ?? 1) && enter >= -entryTolerance) {
      first = { obstacle, fraction: Math.max(0, enter), normal };
    }
  }
  return first;
}

export const beforeBoxContact = (fraction: number) => fraction < 1 ? Math.max(0, fraction - 1e-7) : 1;
