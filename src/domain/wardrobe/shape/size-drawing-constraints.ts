import type { ProfileVertex } from '../../geometry/profile-polygon';
import { profileExtent } from '../../geometry/profile-polygon';

/** An outer wardrobe corner resizes an upright side or the level base with it.
 * Interior roof points remain free. Keeping the connected base/side corners together
 * makes the drawing match the same buildable carcass as the model. */
export function constrainWardrobeDrawing(original: readonly ProfileVertex[], requested: readonly ProfileVertex[]): ProfileVertex[] {
  if (original.length !== requested.length) return [...requested];
  const changed = requested.flatMap((p, i) => Math.abs(p.x - original[i]!.x) + Math.abs(p.y - original[i]!.y) > .00001 ? [i] : []);
  if (changed.length !== 1) return [...requested];
  const i = changed[0]!, from = original[i]!, to = requested[i]!, box = profileExtent(original);
  const near = (a: number, b: number) => Math.abs(a - b) < .00001;
  const side = near(from.x, box.minX) || near(from.x, box.maxX), base = near(from.y, box.minY);
  return requested.map((p, j) => ({ ...p,
    ...(side && near(original[j]!.x, from.x) ? { x: to.x } : {}),
    ...(base && near(original[j]!.y, box.minY) ? { y: to.y } : {}),
  }));
}
