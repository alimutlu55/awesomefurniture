import type { WardrobeShape } from '../../domain/wardrobe/shape/wardrobe-shape';

/** Raising a front point fills its rear up to the same height where physically
 * possible. Every preview uses the gesture's original profile, so reversing or
 * cancelling never accumulates rear-height drift. Rear edits remain independent. */
export function growRearWithFront(original: WardrobeShape, requested: WardrobeShape, blocked: (shape: WardrobeShape) => boolean): WardrobeShape {
    if (!requested.back || original.top.length !== requested.top.length || blocked(requested)) return requested;
    const from = [...requested.back], targets = from.map((y, k) => requested.top[k]!.y > original.top[k]!.y + .001 ? Math.max(y, requested.top[k]!.y) : y);
    const together = (t: number) => ({ ...requested, back: from.map((y, k) => y + (targets[k]! - y) * t) });
    if (!blocked(together(1))) return together(1);
    // Grow adjoining points together first, so a temporary steep rear segment
    // cannot stop a whole flat edge from rising into otherwise clear space.
    let lowAll = 0, highAll = 1;
    for (let n = 0; n < 16; n++) {
        const mid = (lowAll + highAll) / 2;
        if (blocked(together(mid))) highAll = mid; else lowAll = mid;
    }
    let back = together(lowAll).back.map(y => Math.round(y * 10) / 10);
    if (blocked({ ...requested, back })) back = together(lowAll).back;
    if (targets.filter((y, k) => y > from[k]! + .001).length === 1) return { ...requested, back };
    for (let k = 0; k < requested.top.length; k++) {
        const height = targets[k]!, start = back[k]!;
        if (height <= start + .001) continue;
        const at = (height: number) => ({ ...requested, back: back.map((y, i) => i === k ? height : y) });
        if (!blocked(at(height))) { back[k] = height; continue; }
        let low = start, high = height;
        for (let n = 0; n < 16; n++) {
            const mid = (low + high) / 2;
            if (blocked(at(mid))) high = mid; else low = mid;
        }
        const rounded = Math.round(low * 10) / 10;
        back[k] = Math.max(start, blocked(at(rounded)) ? Math.floor(low * 10) / 10 : rounded);
    }
    return { ...requested, back };
}
