import { expandedEndPanels } from '../kitchen/explicit-panel-fit';
import { installationCollisionSolids, installationPair } from '../kitchen/installation-collision';
import { automaticInstallationParts } from '../kitchen/automatic-installation';
import { cornerSweepSolids } from '../kitchen/corner-sweep';
import { SCENE_EXTENT } from '../furniture/piece-envelope';
import { worktopSolids } from '../kitchen/worktop-solids';
import { BOX_CONTACT as CONTACT, beforeBoxContact, boxAxes as cabinetAxes, boxGap as cabinetGap,
    boxRadius as cabinetRadius, boxesOverlap as cabinetOverlaps, firstBoxContact } from './box-collision';
/** Collision rules receive scene data explicitly; no editor or renderer state.
 * Wardrobes collide with each other and with fixed obstacles (the room's walls). Obstacles never move
 * and are not wardrobes: scene bounds and wardrobe lists ignore them.
 * @param {() => readonly { id: string | number; x: number; y?: number; z: number; angle: number; state: { w: number; d: number; h: number } }[]} getCabinets
 * @param {() => readonly import('../studio/studio-obstacles').Obstacle[]} [getObstacles] */
export function createCabinetGeometry(getCabinets, getObstacles = () => []) {
    /** Everything a wardrobe can bump into. */
    const bodies = candidate => expandedEndPanels(candidate ? [...getCabinets().filter(p => p.id !== candidate.id), candidate] : getCabinets());
    const panels = candidate => automaticInstallationParts(bodies(candidate));
    /** @param {Parameters<typeof cornerSweepSolids>[0]} poses
     * @param {Parameters<typeof cornerSweepSolids>[0]} context
     * @param {Parameters<typeof cornerSweepSolids>[0]} [guardTargets] */
    const solidParts = (poses, context, guardTargets = context) => [...installationCollisionSolids(poses, context), ...cornerSweepSolids(poses, guardTargets)];
    /** The candidate with its own panels, and everything else: each side carries the worktop over its base units. */
    const split = candidate => {
        const all = bodies(candidate), parts = panels(candidate), body = all.find(p => p.id === candidate.id) ?? candidate;
        const mine = [body, ...parts.filter(p => p.ownerId === candidate.id)];
        const rest = [...all.filter(p => p.id !== candidate.id), ...parts.filter(p => p.ownerId !== candidate.id)];
        return { all, mine, rest };
    };
    const solids = candidate => {
        if (!candidate) return solidParts([...bodies(), ...panels(), ...getObstacles()], bodies(), []);
        const { all, rest } = split(candidate);
        return [...solidParts([...all, ...panels(candidate).filter(p => p.ownerId !== candidate.id), ...getObstacles()], all, [candidate]), ...worktopSolids(rest)];
    };
    const owned = candidate => {
        const { all, mine } = split(candidate);
        return [...solidParts(mine, all), ...worktopSolids(mine)];
    };
    const assembly = candidate => {
        const { all, mine, rest } = split(candidate);
        return { moving: [...solidParts(mine, all), ...worktopSolids(mine)], fixed: [...solidParts([...rest, ...getObstacles()], all, [candidate]), ...worktopSolids(rest)] };
    };
    function cabinetBounds(w) {
        const a = w.angle * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
        return { x: w.x, z: w.z, hw: (w.state.w * c + w.state.d * s) / 2, hd: (w.state.w * s + w.state.d * c) / 2, h: w.state.h + (w.y || 0) };
    }
    function cabinetCollides(candidate) {
        const { moving, fixed } = assembly(candidate);
        return moving.some(part => fixed.some(other => installationPair(part, other) && cabinetOverlaps(part, other)));
    }
    /** Which kind of solid would block the cabinet in this pose. */
    function cabinetObstruction(candidate) {
        const { moving, fixed } = assembly(candidate);
        const hit = fixed.find(other => moving.some(part => installationPair(part, other) && cabinetOverlaps(part, other))), id = String(hit?.id);
        if (!hit) return null;
        if (id.startsWith('wall:')) return 'wall';
        if (id.startsWith('fixture:')) return 'fixture';
        return id.startsWith('furnishing:') ? 'furnishing' : 'wardrobe';
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
            if (other.id === w.id || (w.y || 0) + w.state.h <= (other.y || 0) + CONTACT ||
                (other.y || 0) + other.state.h <= (w.y || 0) + CONTACT) continue;
            let enter = -Infinity, leave = Infinity;
            for (const normal of [...cabinetAxes(next), ...cabinetAxes(other)]) {
                const offset = (next.x - other.x) * normal.x + (next.z - other.z) * normal.z;
                const velocity = axis.x * normal.x + axis.z * normal.z;
                const radius = cabinetRadius(next, normal) + cabinetRadius(other, normal);
                if (Math.abs(velocity) < 1e-10) {
                    if (Math.abs(offset) >= radius - CONTACT) { enter = Infinity; break; }
                } else {
                    const a = (-radius - offset) / velocity, b = (radius - offset) / velocity;
                    enter = Math.max(enter, Math.min(a, b));
                    leave = Math.min(leave, Math.max(a, b));
                }
            }
            if (enter < leave) for (const t of [enter, leave]) {
                if (Number.isFinite(t) && t >= -half - CONTACT && t <= half + CONTACT) candidates.push(Math.max(-half, Math.min(half, t)));
            }
        }
        for (const t of candidates.sort((a, b) => Math.abs(a) - Math.abs(b))) {
            const shifted = { ...pose, x: pose.x + axis.x * t, z: pose.z + axis.z * t };
            if (!cabinetCollides({ ...next, ...shifted })) return shifted;
        }
        return null;
    }
    function safeCabinetTranslation(w, target) {
        let currentPos = { x: w.x, y: w.y || 0, z: w.z };
        let remainingDelta = { x: target.x - currentPos.x, y: (target.y || 0) - currentPos.y, z: target.z - currentPos.z };
        for (let pass = 0; pass < 3; pass++) {
            const dist = Math.hypot(remainingDelta.x, remainingDelta.y, remainingDelta.z);
            if (dist < 1e-5) break;
            const targetPose = { ...w, x: currentPos.x + remainingDelta.x, y: currentPos.y + remainingDelta.y, z: currentPos.z + remainingDelta.z };
            const movingParts = owned(targetPose).map(p => ({ ...p, x: p.x - remainingDelta.x, y: (p.y || 0) - remainingDelta.y, z: p.z - remainingDelta.z }));
            const hit = firstBoxContact(movingParts, solids(targetPose), remainingDelta, (part, other) => other.id !== w.id && installationPair(part, other));
            const limit = hit?.fraction ?? 1, hitNormal = hit?.normal;
            const t = beforeBoxContact(limit);
            currentPos = { x: currentPos.x + remainingDelta.x * t, y: currentPos.y + remainingDelta.y * t, z: currentPos.z + remainingDelta.z * t };
            if (limit >= 1 || !hitNormal) break;
            const unspent = {
                x: remainingDelta.x * (1 - limit),
                y: remainingDelta.y * (1 - limit),
                z: remainingDelta.z * (1 - limit)
            };
            const vn = unspent.x * hitNormal.x + unspent.y * hitNormal.y + unspent.z * hitNormal.z;
            if (vn < 0) {
                remainingDelta = {
                    x: unspent.x - vn * hitNormal.x,
                    y: unspent.y - vn * hitNormal.y,
                    z: unspent.z - vn * hitNormal.z
                };
            } else {
                break;
            }
        }
        // Derived parts can change at a corner boundary. Validate the actual stopped pose too,
        // rather than committing a pose checked using only the pointer destination's parts.
        const travel = Math.hypot(currentPos.x - w.x, currentPos.y - (w.y || 0), currentPos.z - w.z);
        if (travel > CONTACT && cabinetCollides({ ...w, ...currentPos }) && !cabinetCollides(w)) {
            const at = t => ({ x: w.x + (currentPos.x - w.x) * t, y: (w.y || 0) + (currentPos.y - (w.y || 0)) * t,
                z: w.z + (currentPos.z - w.z) * t });
            let lo = 0, hi = 1;
            for (let n = 0; n < 40; n++) {
                const mid = (lo + hi) / 2;
                if (cabinetCollides({ ...w, ...at(mid) })) hi = mid; else lo = mid;
            }
            return at(lo);
        }
        return currentPos;
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
            const pose = { ...w, angle: start + delta * t }, gap = Math.min(...owned(pose).flatMap(p => solids(pose).filter(o => o.id !== w.id && installationPair(p, o)).map(o => cabinetGap(p, o)))), step = Math.min(1 - t, Math.max(1e-7, gap * .8 / speed)), next = t + step, candidate = { ...w, angle: start + delta * next };
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
        const clamp = (v, lo) => Math.max(lo, Math.min(SCENE_EXTENT, v));
        return { x: clamp(origin.x + (delta.x || 0), -SCENE_EXTENT), y: clamp((origin.y || 0) + (delta.y || 0), 0), z: clamp(origin.z + (delta.z || 0), -SCENE_EXTENT) };
    }
    return { cabinetBounds, cabinetAxes, cabinetRadius, cabinetGap, cabinetOverlaps, cabinetCollides, cabinetObstruction,
        cabinetResizePose, safeCabinetTranslation, safeCabinetRotation, sceneBounds, cabinetTranslation };
}
