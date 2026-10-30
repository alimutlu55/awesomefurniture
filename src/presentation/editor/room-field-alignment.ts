import { AUTO_ALIGN_CM } from '../../domain/geometry/alignment';
import type { Studio } from '../../domain/studio/studio';
import type { RoomSelection } from '../viewport/studio-renderer';
import { roomSmartGuides } from './room-smart-guides';
import type { Standing } from './studio-align';

/** Numeric and slider edits resolve the same physical target as their guides. Probe the pure edit to account for
 * centred widths, reversed gap fields and ceiling profiles without guessing which end the edit moves. */
export function alignRoomField(room: Studio, selection: RoomSelection, key: string, value: number,
    edit: (room: Studio, value: number) => Studio | null, valid: (room: Studio) => boolean, standing: readonly Standing[] = []): Studio | null {
    const requested = edit(room, value);
    if (!requested) return null;
    const guides = roomSmartGuides(requested, selection, key, standing)
        .filter(g => Math.abs(g.delta) <= AUTO_ALIGN_CM + 1e-6).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
    if (!guides.length) return requested;
    const probe = edit(room, value + .2) ?? edit(room, value - .2);
    if (!probe) return requested;
    const plus = edit(room, value + .2) !== null, step = plus ? .2 : -.2;
    const references = roomSmartGuides(probe, selection, key, standing);
    for (const guide of guides) {
        const reference = references.find(g => g.id === guide.id);
        const derivative = reference ? (reference.delta - guide.delta) / step : 0;
        if (Math.abs(derivative) < 1e-6) continue;
        if (Math.abs(guide.delta) < 1e-6) return requested;
        const next = edit(room, value - guide.delta / derivative);
        if (!next || !valid(next)) continue;
        const aligned = roomSmartGuides(next, selection, key, standing).find(g => g.id === guide.id);
        if (aligned && Math.abs(aligned.delta) < .001) return next;
    }
    return requested;
}
