import { expandedEndPanels } from '../kitchen/explicit-panel-fit';
import { installationCollisionSolids, installationPair } from '../kitchen/installation-collision';
import { automaticInstallationParts } from '../kitchen/automatic-installation';
// Centimetres: tolerate only 0.0001 mm of serialized transform noise, never a real 1 mm joint.
const CONTACT = 1e-5;
/** Collision rules receive scene data explicitly; no editor or renderer state.
 * Wardrobes collide with each other and with fixed obstacles (the room's walls). Obstacles never move
 * and are not wardrobes: scene bounds and wardrobe lists ignore them.
 * @param {() => readonly { id: string | number; x: number; y?: number; z: number; angle: number; state: { w: number; d: number; h: number } }[]} getCabinets
 * @param {() => readonly import('../studio/studio-obstacles').Obstacle[]} [getObstacles] */
export function createCabinetGeometry(getCabinets, getObstacles = () => []) {
    /** Everything a wardrobe can bump into. */
    const bodies = candidate => expandedEndPanels(candidate ? [...getCabinets().filter(p => p.id !== candidate.id), candidate] : getCabinets());
    const panels = candidate => automaticInstallationParts(bodies(candidate));
    const solids = candidate => installationCollisionSolids([...bodies(candidate), ...panels(candidate).filter(p => p.ownerId !== candidate?.id), ...getObstacles()], bodies(candidate));
    const owned = candidate => installationCollisionSolids([bodies(candidate).find(p => p.id === candidate.id) ?? candidate, ...panels(candidate).filter(p => p.ownerId === candidate.id)], bodies(candidate));
    const assembly = candidate => {
        const parts = panels(candidate);
        return { moving: installationCollisionSolids([bodies(candidate).find(p => p.id === candidate.id) ?? candidate, ...parts.filter(p => p.ownerId === candidate.id)], bodies(candidate)),
            fixed: installationCollisionSolids([...bodies(candidate).filter(p => p.id !== candidate.id), ...parts.filter(p => p.ownerId !== candidate.id), ...getObstacles()], bodies(candidate)) };
    };
    function cabinetBounds(w) {
        const a = w.angle * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
        return { x: w.x, z: w.z, hw: (w.state.w * c + w.state.d * s) / 2, hd: (w.state.w * s + w.state.d * c) / 2, h: w.state.h + (w.y || 0) };
    }
    function cabinetAxes(w) {
        const a = w.angle * Math.PI / 180;
        return [{ x: Math.cos(a), z: -Math.sin(a) }, { x: Math.sin(a), z: Math.cos(a) }];
    }
    function cabinetRadius(w, axis) {
        const [u, v] = cabinetAxes(w);
        return Math.abs(u.x * axis.x + u.z * axis.z) * w.state.w / 2 + Math.abs(v.x * axis.x + v.z * axis.z) * w.state.d / 2;
    }
    function cabinetGap(a, b) {
        if ((a.y || 0) + a.state.h <= (b.y || 0) + CONTACT || (b.y || 0) + b.state.h <= (a.y || 0) + CONTACT) {
            return Infinity;
        }
        return Math.max(...[...cabinetAxes(a), ...cabinetAxes(b)].map(axis => Math.abs((a.x - b.x) * axis.x + (a.z - b.z) * axis.z) - cabinetRadius(a, axis) - cabinetRadius(b, axis)));
    }
    function cabinetOverlaps(a, b) {
        return cabinetGap(a, b) < -CONTACT;
    }
    function cabinetCollides(candidate) {
        const { moving, fixed } = assembly(candidate);
        return moving.some(part => fixed.some(other => installationPair(part, other) && cabinetOverlaps(part, other)));
    }
    /** What a wardrobe in this pose would run into: 'wall', 'fixture' (a toilet, a basin), 'wardrobe', or null. */
    function cabinetObstruction(candidate) {
        const { moving, fixed } = assembly(candidate);
        const hit = fixed.find(other => moving.some(part => installationPair(part, other) && cabinetOverlaps(part, other))), id = String(hit?.id);
        return !hit ? null : id.startsWith('wall:') ? 'wall' : id.startsWith('fixture:') ? 'fixture' : 'wardrobe';
    }
    /** Size fields normally grow around the centre. At a wall, distribute growth
     * across the available gaps. Each growing candidate contains the old footprint. */
    function cabinetResizePose(w, key, value, slide = false) {
        const pose = { x: w.x, y: w.y || 0, z: w.z }, next = { ...w, state: { ...w.state, [key]: value } };
        const prepared = bodies(next).find(p => p.id === next.id);
        if (prepared && Math.abs(prepared.state[key] - value) > CONTACT) return null;
        if (!cabinetCollides(next)) return pose;
        const growth = value - w.state[key];
        if ((key !== 'w' && key !== 'd') || growth <= 0) return null;
        const axis = cabinetAxes(w)[key === 'w' ? 0 : 1];
        if (!slide && !getObstacles().some(wall => cabinetOverlaps(next, wall))) return null;
        const half = growth / 2, candidates = [0, -half, half];
        // Intersect the separating-axis constraints to find each solid's forbidden
        // translation interval. Its endpoints are exact contact poses, unlike a
        // fixed-step search, which can skip the only pose that fills an opening.
        for (const other of solids(w)) {
            if (other.id === w.id || (w.y || 0) + w.state.h <= (other.y || 0) + 1e-8 ||
                (other.y || 0) + other.state.h <= (w.y || 0) + 1e-8) continue;
            let enter = -Infinity, leave = Infinity;
            for (const normal of [...cabinetAxes(next), ...cabinetAxes(other)]) {
                const offset = (next.x - other.x) * normal.x + (next.z - other.z) * normal.z;
                const velocity = axis.x * normal.x + axis.z * normal.z;
                const radius = cabinetRadius(next, normal) + cabinetRadius(other, normal);
                if (Math.abs(velocity) < 1e-10) {
                    if (Math.abs(offset) >= radius - 1e-8) { enter = Infinity; break; }
                } else {
                    const a = (-radius - offset) / velocity, b = (radius - offset) / velocity;
                    enter = Math.max(enter, Math.min(a, b));
                    leave = Math.min(leave, Math.max(a, b));
                }
            }
            if (enter < leave) for (const t of [enter, leave]) {
                if (Number.isFinite(t) && t >= -half - 1e-8 && t <= half + 1e-8) candidates.push(Math.max(-half, Math.min(half, t)));
            }
        }
        for (const t of candidates.sort((a, b) => Math.abs(a) - Math.abs(b))) {
            const shifted = { ...pose, x: pose.x + axis.x * t, z: pose.z + axis.z * t };
            if (!cabinetCollides({ ...next, ...shifted })) return shifted;
        }
        return null;
    }
    function safeCabinetTranslation(w, target) {
        const start = { x: w.x, y: w.y || 0, z: w.z }, delta = { x: target.x - start.x, y: (target.y || 0) - start.y, z: target.z - start.z };
        let limit = 1;
        const targetPose = { ...w, ...target };
        const movingParts = owned(targetPose).map(p => ({ ...p, x: p.x - delta.x, y: (p.y || 0) - delta.y, z: p.z - delta.z }));
        for (const part of movingParts) for (const other of solids(targetPose)) {
            if (other.id === w.id || !installationPair(part, other)) {
                continue;
            }
            let enter = -Infinity, leave = Infinity;
            const constraints = [...cabinetAxes(part), ...cabinetAxes(other)].map(axis => ({
                offset: (part.x - other.x) * axis.x + (part.z - other.z) * axis.z,
                velocity: delta.x * axis.x + delta.z * axis.z, radius: cabinetRadius(part, axis) + cabinetRadius(other, axis) }));
            constraints.push({ offset: (part.y || 0) + part.state.h / 2 - (other.y || 0) - other.state.h / 2, velocity: delta.y, radius: (part.state.h + other.state.h) / 2 });
            for (const { offset, velocity, radius } of constraints) {
                if (Math.abs(velocity) < 1e-10) {
                    if (Math.abs(offset) >= radius - 1e-8) {
                        enter = Infinity;
                        break;
                    }
                }
                else {
                    const a = (-radius - offset) / velocity, b = (radius - offset) / velocity;
                    enter = Math.max(enter, Math.min(a, b));
                    leave = Math.min(leave, Math.max(a, b));
                }
            }
            if (enter < leave - 1e-10 && leave > 1e-10 && enter <= limit && enter >= -CONTACT / Math.max(1, Math.hypot(delta.x, delta.y, delta.z))) {
                limit = Math.max(0, enter);
            }
        }
        // A tiny numerical margin avoids jitter without introducing a visible gap.
        const t = limit < 1 ? Math.max(0, limit - 1e-7) : 1;
        return { x: start.x + delta.x * t, y: start.y + delta.y * t, z: start.z + delta.z * t };
    }
    function safeCabinetRotation(w, target) {
        const start = w.angle, delta = ((target - start + 540) % 360) - 180;
        if (Math.abs(delta) < 1e-8) {
            return start;
        }
        const radius = Math.max(...owned(w).map(p => Math.hypot(p.x - w.x, p.z - w.z) + Math.hypot(p.state.w, p.state.d) / 2)), speed = Math.abs(delta) * Math.PI / 180 * radius;
        let t = 0;
        // Conservative advancement: no corner travels farther than the available gap.
        for (let i = 0; i < 512 && t < 1; i++) {
            const pose = { ...w, angle: start + delta * t }, gap = Math.min(...owned(pose).flatMap(p => solids(pose).filter(o => o.id !== w.id).map(o => cabinetGap(p, o)))), step = Math.min(1 - t, Math.max(1e-7, gap * .8 / speed)), next = t + step, candidate = { ...w, angle: start + delta * next };
            if (cabinetCollides(candidate)) {
                let lo = t, hi = next;
                for (let n = 0; n < 24; n++) {
                    const mid = (lo + hi) / 2;
                    if (cabinetCollides({ ...w, angle: start + delta * mid })) {
                        hi = mid;
                    }
                    else {
                        lo = mid;
                    }
                }
                t = lo;
                break;
            }
            t = next;
        }
        return ((start + delta * t) % 360 + 360) % 360;
    }
    function sceneBounds() {
        const bs = [...getCabinets(), ...panels()].map(cabinetBounds);
        if (!bs.length) return { x: 0, z: 0, w: 0, d: 0, h: 0 };
        const x0 = Math.min(...bs.map(b => b.x - b.hw)), x1 = Math.max(...bs.map(b => b.x + b.hw)), z0 = Math.min(...bs.map(b => b.z - b.hd)), z1 = Math.max(...bs.map(b => b.z + b.hd));
        return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: Math.max(...bs.map(b => b.h)) };
    }
    function cabinetTranslation(origin, delta) {
        return { x: Math.max(-5000, Math.min(5000, origin.x + (delta.x || 0))), y: Math.max(0, Math.min(5000, (origin.y || 0) + (delta.y || 0))), z: Math.max(-5000, Math.min(5000, origin.z + (delta.z || 0))) };
    }
    return { cabinetBounds, cabinetAxes, cabinetRadius, cabinetGap, cabinetOverlaps, cabinetCollides, cabinetObstruction,
        cabinetResizePose, safeCabinetTranslation, safeCabinetRotation, sceneBounds, cabinetTranslation };
}
