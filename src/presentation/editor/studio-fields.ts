import { STUDIO_LIMITS as L, roomHeight, wallFace, wallLine } from '../../domain/studio/studio';
import type { Studio } from '../../domain/studio/studio';
import { moveOpening, setInsideLength, setOpeningSize, setWallSize } from '../../domain/studio/studio-edit';
import { ceilingFrame, moveCeilingPoint, setCeilingDepth } from '../../domain/studio/studio-ceiling';
import { measureNumber } from './editor-format.js';
import type { RoomSelection } from '../viewport/studio-renderer';
import { esc } from './editor-format.js';

interface StudioFieldsPorts {
    readonly document: { createElement: Document['createElement']; activeElement?: Element | null };
    readonly getStudio: () => Studio | undefined;
    readonly getSelection: () => RoomSelection;
    readonly editStudio: (edit: (room: Studio) => Studio | null) => boolean;
    readonly refresh: () => void;
    readonly listen: (target: EventTarget, type: string, handler: (e: Event) => void) => void;
}
type Field = { key: string; label: string; value: number; min: number; max: number; hint?: string };

const round = (v: number) => Math.round(v * 10) / 10;

/** Exact sizes for the selected wall or opening, shown in the toolbar's Size popover. Typing a value
 * and pressing Enter (or leaving the field) applies it as one undo step; a refused value springs back
 * and the reason shows as usual. Lengths are inside the room, as a tape measure reads them. */
export function createStudioFields({ document, getStudio, getSelection, editStudio, refresh, listen }: StudioFieldsPorts) {
    const root = document.createElement('div');
    root.className = 'room-fields';

    function fields(): Field[] {
        const studio = getStudio(), s = getSelection();
        if (!studio || !s) return [];
        if (s.kind === 'ceiling') {
            const c = studio.ceilings?.find(x => x.id === s.id), fr = c && ceilingFrame(studio, c);
            if (!c || !fr) return [];
            // Each point's height, named by where it is: from the wall's start, or from the wall for a sloped roof.
            const where = (t: number) => measureNumber(Math.round(c.run === 'along' ? t - fr.face.start : t)) + ' cm ' + (c.run === 'along' ? 'along' : 'out');
            return [
                ...c.profile.map((p, k) => ({ key: 'p' + k, label: 'Height ' + (k + 1), value: p.y, min: L.minCeilingHeight, max: roomHeight(studio), hint: where(p.t) })),
                { key: 'depth', label: 'Into the room', value: c.depth, min: L.minCeilingDepth, max: L.maxWallLength },
            ];
        }
        if (s.kind === 'wall') {
            const w = studio.walls.find(x => x.id === s.id), face = w && wallFace(studio, w);
            if (!w || !face) return [];
            return [
                { key: 'length', label: 'Length', value: face.length, min: L.minWallLength, max: L.maxWallLength, hint: 'Inside the room' },
                { key: 'height', label: 'Height', value: w.height, min: L.minHeight, max: L.maxHeight },
                { key: 'thickness', label: 'Thickness', value: w.thickness, min: L.minThickness, max: L.maxThickness },
            ];
        }
        const o = studio.openings.find(x => x.id === s.id), w = o && studio.walls.find(x => x.id === o.wall), face = w && wallFace(studio, w);
        if (!o || !w || !face) return [];
        return [
            { key: 'width', label: 'Width', value: o.width, min: L.minOpeningWidth, max: Math.max(L.minOpeningWidth, face.length) },
            { key: 'height', label: 'Height', value: o.height, min: 30, max: w.height },
            ...(o.kind === 'window' ? [{ key: 'sill', label: 'Sill height', value: o.sill, min: 0, max: w.height }] : []),
            { key: 'left', label: 'From left end', value: o.offset - o.width / 2 - face.start, min: 0, max: face.length },
        ];
    }

    function render() {
        const list = fields();
        const shape = list.map(x => x.key + ':' + (x.hint ?? '')).join();
        if (root.dataset.shape !== shape) {
            root.dataset.shape = shape;
            root.innerHTML = list.map(x => '<label class="shape-field"><span>' + esc(x.label) + '</span><span class="shape-input"><input type="number" inputmode="decimal" step="1" data-room-field="' + x.key
                + '" min="' + x.min + '" max="' + x.max + '" aria-label="' + esc(x.label) + '"><small>cm</small></span>' + (x.hint ? '<small class="room-field-hint">' + esc(x.hint) + '</small>' : '') + '</label>').join('');
        }
        for (const x of list) {
            const input = root.querySelector<HTMLInputElement>('[data-room-field="' + x.key + '"]');
            if (input && document.activeElement !== input) input.value = String(round(x.value));
        }
    }

    /** Applies one field; the edit functions validate nothing, editStudio refuses with the reason. */
    function apply(key: string, value: number) {
        const s = getSelection();
        if (!s || !Number.isFinite(value)) return;
        if (s.kind === 'ceiling') {
            if (key === 'depth') editStudio(r => setCeilingDepth(r, s.id, value));
            else editStudio(r => { const k = Number(key.slice(1)), p = r.ceilings?.find(x => x.id === s.id)?.profile[k]; return p ? moveCeilingPoint(r, s.id, k, p.t, value) : null; });
        } else if (s.kind === 'wall') {
            if (key === 'length') editStudio(r => setInsideLength(r, s.id, value));
            else editStudio(r => setWallSize(r, s.id, { [key]: value }));
        } else if (key === 'left') {
            editStudio(r => {
                const o = r.openings.find(x => x.id === s.id)!, w = r.walls.find(x => x.id === o.wall)!, face = wallFace(r, w);
                return face && wallLine(r, w) ? moveOpening(r, s.id, face.start + value + o.width / 2) : null;
            });
        } else editStudio(r => setOpeningSize(r, s.id, { [key]: value }));
        refresh();
        render();
    }

    listen(root, 'change', e => {
        const input = e.target as HTMLInputElement;
        if (input.dataset.roomField) apply(input.dataset.roomField, input.valueAsNumber);
    });
    listen(root, 'keydown', e => {
        const input = e.target as HTMLInputElement;
        if ((e as KeyboardEvent).key === 'Enter' && input.dataset.roomField) input.blur();
    });

    return { root, render };
}
