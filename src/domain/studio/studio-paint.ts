import type { Studio, StudioWall, WallFinish } from './studio';

export const WALL_PAINTS = [
    { name: 'Warm White', color: '#e2d9cc' }, { name: 'Soft White', color: '#f4f1eb' },
    { name: 'Sage Green', color: '#9da995' }, { name: 'Sand', color: '#d4cabc' },
    { name: 'Stone', color: '#b6b6ae' }, { name: 'Slate Blue', color: '#637380' },
    { name: 'Clay', color: '#c7aaa0' }, { name: 'Charcoal', color: '#45484a' },
] as const;
export const WALL_FINISHES = [
    { id: 'matte', name: 'Matte', roughness: .92, reflection: .35 },
    { id: 'eggshell', name: 'Eggshell', roughness: .65, reflection: .45 },
    { id: 'satin', name: 'Satin', roughness: .35, reflection: .65 },
] as const;
export const wallAppearance = (wall?: Pick<StudioWall, 'color' | 'finish'>) => ({
    color: wall?.color?.toLowerCase() ?? WALL_PAINTS[0].color, finish: wall?.finish ?? 'matte' as WallFinish,
});

/** Appearance edits cannot introduce collisions or require furniture to follow a new ceiling. */
export function sameStudioStructure(before: Studio | undefined, after: Studio | undefined): boolean {
    const structure = (room: Studio | undefined) => room && ({ ...room,
        walls: room.walls.map(({ color: _color, finish: _finish, ...wall }) => wall) });
    return JSON.stringify(structure(before)) === JSON.stringify(structure(after));
}

/** Paint changes never change room geometry. One scope can cover the selected wall or every wall. */
export function paintWalls(studio: Studio, id: string, paint: { color?: string; finish?: WallFinish }, all = false): Studio | null {
    if (!studio.walls.some(w => w.id === id)) return null;
    if (paint.color !== undefined && !/^#[0-9a-f]{6}$/i.test(paint.color)) return null;
    if (paint.finish !== undefined && !WALL_FINISHES.some(f => f.id === paint.finish)) return null;
    let changed = false;
    const walls = studio.walls.map(w => {
        if (!all && w.id !== id) return w;
        const before = wallAppearance(w), next = { ...before, ...paint };
        next.color = next.color.toLowerCase();
        if (before.color === next.color && before.finish === next.finish) return w;
        changed = true;
        return { ...w, ...(paint.color !== undefined ? { color: next.color } : {}),
            ...(paint.finish !== undefined ? { finish: next.finish } : {}) };
    });
    return changed ? { ...studio, walls } : null;
}
