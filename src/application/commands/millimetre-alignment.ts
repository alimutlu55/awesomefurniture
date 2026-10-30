import type { EditorCabinet } from '../projects/editor-scene';

/** Furthest movement of a corresponding corner during a resize. Rotated and anchored growth use physical distance. */
export function cabinetResizeTravel(a: EditorCabinet, b: EditorCabinet): number {
    const angle = a.angle * Math.PI / 180, dx = b.x - a.x, dz = b.z - a.z;
    const across = Math.abs(dx * Math.cos(angle) - dz * Math.sin(angle)) + Math.abs(b.state.w - a.state.w) / 2;
    const along = Math.abs(dx * Math.sin(angle) + dz * Math.cos(angle)) + Math.abs(b.state.d - a.state.d) / 2;
    const y = (b.y || 0) - (a.y || 0), vertical = Math.max(Math.abs(y), Math.abs(y + b.state.h - a.state.h));
    return Math.hypot(across, along, vertical);
}
