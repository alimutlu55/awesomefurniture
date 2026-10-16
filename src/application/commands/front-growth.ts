import type { WardrobeShape } from '../../domain/wardrobe/shape/wardrobe-shape';

/** Front height edits bring the rear towards the same height in either direction,
 * where physically possible. Every preview uses the gesture's original profile, so reversing or
 * cancelling never accumulates rear-height drift. Rear edits remain independent. */
export function growRearWithFront(original: WardrobeShape, requested: WardrobeShape, blocked: (shape: WardrobeShape) => boolean): WardrobeShape {
    if (!requested.back || original.top.length !== requested.top.length || blocked(requested)) return requested;
    const from = [...requested.back], targets = from.map((y, k) => {
        const next = requested.top[k]!.y, delta = next - original.top[k]!.y;
        return delta > .001 ? Math.max(y, next) : delta < -.001 ? Math.min(y, next) : y;
    });
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
    if (targets.filter((y, k) => Math.abs(y - from[k]!) > .001).length === 1) return { ...requested, back };
    for (let k = 0; k < requested.top.length; k++) {
        const height = targets[k]!, start = back[k]!;
        if (Math.abs(height - start) < .001) continue;
        const at = (height: number) => ({ ...requested, back: back.map((y, i) => i === k ? height : y) });
        if (!blocked(at(height))) { back[k] = height; continue; }
        let low = start, high = height;
        for (let n = 0; n < 16; n++) {
            const mid = (low + high) / 2;
            if (blocked(at(mid))) high = mid; else low = mid;
        }
        const rounded = Math.round(low * 10) / 10;
        const safe = blocked(at(rounded)) ? (height < start ? Math.ceil(low * 10) : Math.floor(low * 10)) / 10 : rounded;
        back[k] = height < start ? Math.min(start, safe) : Math.max(start, safe);
    }
    return { ...requested, back };
}
