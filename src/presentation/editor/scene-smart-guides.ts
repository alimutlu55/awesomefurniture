import type { EditorCabinet, EditorScene } from '../../application/projects/editor-scene';
import { measureAround } from '../../application/commands/align-commands';
import { wallLine } from '../../domain/studio/studio';
import { resolveShape, partitionPositions } from '../../domain/wardrobe/shape/wardrobe-shape';
import { profileAt, type ShapeSide } from '../../domain/wardrobe/shape/shape-handle-edit';
import { axisGuide, type GuidePoint, type SmartGuide } from './smart-guides';

export function cabinetFrame(c: EditorCabinet, depth = c.state.d / 2 + 1) {
    const a = c.angle * Math.PI / 180;
    return (x: number, y: number): GuidePoint => ({ x: c.x + x * Math.cos(a) + depth * Math.sin(a),
        y: (c.y || 0) + y, z: c.z - x * Math.sin(a) + depth * Math.cos(a) });
}

/** Neighbour edges, levels, centres and room contact, independent of the precision movement commands. */
export function cabinetSmartGuides(scene: EditorScene, c: EditorCabinet, dimension?: string): SmartGuide[] {
    const out: SmartGuide[] = [], s = c.state, frame = cabinetFrame(c), a = c.angle * Math.PI / 180;
    const u = { x: Math.cos(a), z: -Math.sin(a) }, f = { x: Math.sin(a), z: Math.cos(a) }, y0 = c.y || 0;
    const x = (p: { x: number; z: number }) => (p.x - c.x) * u.x + (p.z - c.z) * u.z;
    const z = (p: { x: number; z: number }) => (p.x - c.x) * f.x + (p.z - c.z) * f.z;
    const across = !dimension || dimension === 'w', up = !dimension || dimension === 'h' || dimension === 'y';
    for (const o of scene.wardrobes) {
        if (o.id === c.id) continue;
        const turn = ((o.angle - c.angle) % 360 + 360) % 360;
        if (Math.min(turn, 360 - turn, Math.abs(turn - 180)) > .5) continue;
        const ox = x(o), oz = z(o), oy = (o.y || 0) - y0, ow = o.state.w, od = o.state.d;
        if (Math.abs(ox) > (s.w + ow) / 2 + 150 || Math.abs(oz) > (s.d + od) / 2 + 150) continue;
        if (across) {
            for (const [i, v] of [-s.w / 2, 0, s.w / 2].entries()) {
                for (const [j, t] of [ox - ow / 2, ox, ox + ow / 2].entries()) {
                    out.push(axisGuide(`cab:${o.id}:x:${i}:${j}`, j === 1 && i === 1 ? 'Centres aligned' : 'Sides aligned',
                        'x', v, t, [0, Math.max(s.h, oy + o.state.h)], frame));
                }
            }
        }
        if (up) for (const [i, v] of (dimension === 'h' ? [s.h] : [0, s.h]).entries()) {
            for (const [j, t] of [oy, oy + o.state.h].entries()) {
                out.push(axisGuide(`cab:${o.id}:y:${i}:${j}`, j === 0 ? 'Bases level' : 'Tops level', 'y', v, t,
                    [Math.min(-s.w / 2, ox - ow / 2), Math.max(s.w / 2, ox + ow / 2)], frame));
            }
        }
        if (!dimension || dimension === 'd') {
            const depthFrame = (v: number, along: number): GuidePoint => ({ x: c.x + along * u.x + v * f.x, y: y0 + 2,
                z: c.z + along * u.z + v * f.z });
            out.push(axisGuide(`cab:${o.id}:front`, 'Fronts aligned', 'x', s.d / 2, oz + od / 2,
                [Math.min(-s.w / 2, ox - ow / 2), Math.max(s.w / 2, ox + ow / 2)], depthFrame, 'depth'));
            out.push(axisGuide(`cab:${o.id}:back`, 'Backs aligned', 'x', -s.d / 2, oz - od / 2,
                [Math.min(-s.w / 2, ox - ow / 2), Math.max(s.w / 2, ox + ow / 2)], depthFrame, 'depth'));
        }
    }
    const { gaps } = measureAround(scene, c, ['left', 'right', 'back', 'front', 'top', 'bottom']);
    for (const g of gaps) {
        const horizontal = g.side === 'left' || g.side === 'right', vertical = g.side === 'top' || g.side === 'bottom';
        if (dimension && !(horizontal && across || vertical && up || !horizontal && !vertical && dimension === 'd')) continue;
        const shift = { x: g.to.x - g.from.x, y: g.to.y - g.from.y, z: g.to.z - g.from.z };
        const tangent = horizontal ? { x: 0, y: 35, z: 0 } : { x: u.x * s.w / 2, y: 0, z: u.z * s.w / 2 };
        const target = { x: g.from.x + shift.x, y: g.from.y + shift.y, z: g.from.z + shift.z };
        out.push({ id: `gap:${g.side}`, group: horizontal ? 'x' : vertical ? 'y' : 'depth', label: 'Flush with ' + g.target,
            a: { x: target.x - tangent.x, y: target.y - tangent.y, z: target.z - tangent.z },
            b: { x: target.x + tangent.x, y: target.y + tangent.y, z: target.z + tangent.z },
            current: g.from, target, delta: Math.hypot(shift.x, shift.y, shift.z) });
    }
    for (const [lo, hi, axis] of [['left', 'right', 'x'], ['bottom', 'top', 'y']] as const) {
        if (dimension && !(axis === 'x' && across || axis === 'y' && up)) continue;
        const l = gaps.find(g => g.side === lo), r = gaps.find(g => g.side === hi);
        if (!l || !r) continue;
        const distance = (g: typeof l) => Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y, g.to.z - g.from.z);
        const move = (distance(r) - distance(l)) / 2;
        out.push(axisGuide(`gap:centre:${axis}`, 'Equal spacing', axis, axis === 'x' ? 0 : s.h / 2,
            (axis === 'x' ? 0 : s.h / 2) + move, axis === 'x' ? [0, s.h] : [-s.w / 2, s.w / 2], frame));
    }
    return out;
}

/** Relative angle references use actual wall/unit orientations, including non-cardinal walls. */
export function rotationSmartGuides(scene: EditorScene, c: EditorCabinet): SmartGuide[] {
    const targets = [{ angle: 0, label: 'Square to room' }];
    for (const o of scene.wardrobes) if (o.id !== c.id) targets.push({ angle: o.angle, label: 'Parallel with ' + o.name });
    for (const w of scene.studio?.walls ?? []) {
        const line = wallLine(scene.studio!, w);
        if (line) targets.push({ angle: Math.atan2(-line.uz, line.ux) * 180 / Math.PI, label: 'Parallel with wall' });
    }
    const radius = Math.max(c.state.w / 2 + 20, 60), centre = { x: c.x, y: (c.y || 0) + 2, z: c.z };
    const point = (angle: number, r: number): GuidePoint => ({ x: c.x + Math.cos(angle * Math.PI / 180) * r,
        y: centre.y, z: c.z - Math.sin(angle * Math.PI / 180) * r });
    return targets.map((t, i) => {
        const quarter = Math.round((c.angle - t.angle) / 90), angle = t.angle + quarter * 90;
        const delta = ((c.angle - angle + 540) % 360) - 180;
        return { id: `angle:${i}:${quarter}`, group: 'angle', label: quarter % 2 ? t.label.replace('Parallel', 'Perpendicular') : t.label,
            a: point(angle, -radius), b: point(angle, radius), current: point(c.angle, radius), target: point(angle, radius), delta, unit: 'angle' as const };
    });
}

/** Outline handles and typed front/rear point and panel fields use the same references. */
export function outlineSmartGuides(scene: EditorScene, c: EditorCabinet, index: number, side: ShapeSide, axis?: string): SmartGuide[] {
    const s = c.state, profile = profileAt(resolveShape(s), side), point = profile.top[index];
    if (!point) return [];
    const face = cabinetFrame(c, side === 'rear' ? -s.d / 2 - 1 : s.d / 2 + 1);
    const frame = (x: number, y: number) => face(x - s.w / 2, y), out: SmartGuide[] = [];
    if (axis === 'angle') {
        const end = profile.top[index + 1];
        if (!end) return [];
        const length = Math.hypot(end.x - point.x, end.y - point.y), angle = Math.atan2(end.y - point.y, end.x - point.x);
        const targets = [0, ...profile.top.flatMap((p, i) => {
            const q = profile.top[i + 1]; return q && i !== index ? [Math.atan2(q.y - p.y, q.x - p.x)] : [];
        })];
        return targets.map((t, i) => {
            const target = frame(point.x + Math.cos(t) * length, point.y + Math.sin(t) * length);
            return { id: `profile:angle:${i}`, group: 'angle', label: 'Panel angle aligned', a: frame(point.x, point.y), b: target,
                current: frame(end.x, end.y), target, delta: (angle - t) * 180 / Math.PI, unit: 'angle' as const };
        });
    }
    if (!axis || axis === 'y' || axis === 'rise') {
        const heights = [...profile.top.filter((_, i) => i !== index).map(p => p.y),
            ...scene.wardrobes.filter(o => o.id !== c.id).map(o => (o.y || 0) + o.state.h - (c.y || 0)),
            ...(scene.studio?.walls ?? []).map(w => w.height - (c.y || 0))];
        heights.forEach((y, i) => out.push(axisGuide(`outline:y:${i}`, 'Heights aligned', 'y', point.y, y, [0, s.w], frame)));
    }
    if (!axis || axis === 'x') {
        const xs = [0, s.w / 2, s.w, ...partitionPositions(s), ...profile.top.filter((_, i) => i !== index).map(p => p.x)];
        xs.forEach((x, i) => out.push(axisGuide(`outline:x:${i}`, 'Outline position aligned', 'x', point.x, x, [0, s.h], frame)));
    }
    return out;
}
