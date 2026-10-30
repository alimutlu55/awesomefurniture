import type { Studio } from '../../domain/studio/studio';
import { wallFace, wallLine } from '../../domain/studio/studio';
import { ceilingFrame } from '../../domain/studio/studio-ceiling';
import { surfaceProfile } from '../../domain/studio/surface-profile';
import { fixturePlace } from '../../domain/studio/fixtures/fixture-place';
import { outerEdgeHeight } from '../../domain/studio/ceiling-edge';
import type { RoomSelection } from '../viewport/studio-renderer';
import { depthTargets, heightTargets, neighbourPoints, type Standing } from './studio-align';
import { axisGuide, type SmartGuide } from './smart-guides';

/** Size fields use the same scene references as dragging, without changing the requested numeric value. */
export function roomSmartGuides(room: Studio, selection: RoomSelection, field: string, standing: readonly Standing[] = []): SmartGuide[] {
    if (!selection) return [];
    const s = selection, out: SmartGuide[] = [];
    const opening = s.kind === 'opening' ? room.openings.find(o => o.id === s.id) : undefined;
    const fixture = s.kind === 'fixture' ? room.fixtures?.find(o => o.id === s.id) : undefined;
    const ceiling = s.kind === 'ceiling' ? room.ceilings?.find(o => o.id === s.id) : undefined;
    const wall = room.walls.find(w => w.id === (s.kind === 'wall' ? s.id : opening?.wall ?? fixture?.wall ?? ceiling?.wall));
    const line = wall && wallLine(room, wall), face = wall && wallFace(room, wall);
    if (!wall || !line || !face) return [];
    const frame = (x: number, y: number) => ({ x: line.a.x + x * line.ux + (wall.thickness / 2 + 1) * line.nx,
        y, z: line.a.z + x * line.uz + (wall.thickness / 2 + 1) * line.nz });
    let xs: number[] = [], ys: number[] = [], points: { x: number; y: number }[] = [];
    if (opening) {
        xs = [opening.offset - opening.width / 2, opening.offset, opening.offset + opening.width / 2];
        ys = [opening.sill, opening.sill + opening.height];
        for (const o of room.openings) if (o.wall === wall.id && o.id !== opening.id) {
            points.push({ x: o.offset - o.width / 2, y: o.sill }, { x: o.offset, y: o.sill + o.height },
                { x: o.offset + o.width / 2, y: o.sill + o.height });
        }
    } else if (fixture) {
        const place = fixturePlace(room, fixture);
        if (!place) return [];
        xs = [fixture.offset - fixture.width / 2, fixture.offset, fixture.offset + fixture.width / 2];
        ys = [place.extent.bottom, place.extent.top];
        for (const o of room.fixtures ?? []) if (o.wall === wall.id && o.id !== fixture.id) {
            const p = fixturePlace(room, o);
            points.push({ x: o.offset - o.width / 2, y: p?.extent.top ?? o.height },
                { x: o.offset, y: p?.extent.bottom ?? 0 }, { x: o.offset + o.width / 2, y: p?.extent.top ?? o.height });
        }
        for (const o of room.openings) if (o.wall === wall.id) points.push({ x: o.offset, y: o.sill }, { x: o.offset, y: o.sill + o.height });
        if (field === 'depth') {
            const depthFrame = (x: number, y: number) => ({ x: line.a.x + fixture.offset * line.ux + x * line.nx,
                y, z: line.a.z + fixture.offset * line.uz + x * line.nz });
            for (const o of room.fixtures ?? []) if (o.wall === wall.id && o.id !== fixture.id) {
                const p = fixturePlace(room, o);
                out.push(axisGuide(`fixture:${o.id}:depth`, 'Fronts aligned', 'x', place.back + fixture.depth,
                    (p?.back ?? 0) + o.depth, [0, Math.max(fixture.height, o.height)], depthFrame));
            }
            return out;
        }
    } else {
        const profile = surfaceProfile(room, { kind: s.kind === 'wall' ? 'wall' : 'ceiling', id: s.id }, 'front');
        if (!profile) return [];
        xs = profile.points.map(p => p.x); ys = profile.points.map(p => p.y);
        points = neighbourPoints(room, profile, standing);
        if (ceiling && field === 'depth') {
            const fr = ceilingFrame(room, ceiling);
            if (!fr) return [];
            const depthFrame = (x: number, y: number) => ({ ...fr.at((fr.along.from + fr.along.to) / 2, x), y });
            return depthTargets(room, ceiling, standing).map((t, i) => axisGuide(`ceiling:depth:${i}`, t.label,
                'x', ceiling.depth, t.v, [Math.min(...ys), Math.max(...ys)], depthFrame));
        }
        if (ceiling) points.push(...heightTargets(room, ceiling, standing).map(t => ({ x: (face.start + face.end) / 2, y: t.v })));
        if (s.kind === 'wall') {
            if (field === 'height') ys = [wall.height];
            for (const w of room.walls) if (w.id !== wall.id) {
                points.push({ x: face.start + (wallFace(room, w)?.length ?? 0), y: w.height });
            }
            if (field === 'thickness') {
                const thicknessFrame = (x: number, y: number) => ({ x: line.a.x + x * line.nx, y, z: line.a.z + x * line.nz });
                return room.walls.filter(w => w.id !== wall.id).map(w => axisGuide(`wall:${w.id}:thickness`, 'Same wall thickness',
                    'x', wall.thickness, w.thickness, [0, wall.height], thicknessFrame));
            }
        }
    }
    if (!xs.length || !ys.length) return out;
    if (opening || fixture) {
        const neighbours = opening ? { ...room, openings: room.openings.filter(o => o.id !== opening.id) } : room;
        const wallProfile = surfaceProfile(neighbours, { kind: 'wall', id: wall.id }, 'front');
        if (wallProfile) points.push(...neighbourPoints(neighbours, wallProfile, standing));
    }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const horizontal = ['width', 'left', 'right', 'length', 'offset'].includes(field);
    const vertical = !horizontal;
    // Stationary anchors must not win over the edge currently being adjusted.
    if (field === 'length') xs = [x1];
    if (field === 'height' && opening) ys = [opening.sill + opening.height];
    else if (field === 'height' && fixture) ys = [y1];
    else if (field === 'outer' && ceiling) ys = [outerEdgeHeight(ceiling)];
    else if (/^p\d+$/.test(field) && ceiling) ys = [ceiling.profile[Number(field.slice(1))]?.y ?? y1];
    else if (/^b\d+$/.test(field)) ys = [ys[Number(field.slice(1))] ?? y1];
    else if (field === 'sill') ys = [y0];
    else if (field === 'top') ys = [y1];
    const referenceHeight = s.kind === 'wall' ? Math.max(0, ...room.walls.filter(w => w.id !== wall.id).map(w => w.height)) : wall.height;
    const targets = [{ x: face.start, y: 0 }, { x: face.end, y: referenceHeight },
        { x: (face.start + face.end) / 2, y: referenceHeight / 2 }, ...points];
    targets.forEach((p, i) => {
        if (horizontal) for (const [k, v] of (field === 'length' ? xs : [x0, (x0 + x1) / 2, x1]).entries()) {
            out.push(axisGuide(`room:x:${i}:${k}`, i < 3 ? 'Aligned with wall' : 'Aligned with neighbour', 'x', v, p.x, [y0, y1], frame));
        }
        if (vertical) for (const [k, v] of ys.entries()) {
            out.push(axisGuide(`room:y:${i}:${k}`, i < 3 ? 'Aligned with room level' : 'Height aligned', 'y', v, p.y, [x0, x1], frame));
        }
    });
    return out;
}
