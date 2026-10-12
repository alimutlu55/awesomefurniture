import { STUDIO_LIMITS as L, SOLID_LIMITS, wallFace, wallLine } from '../../domain/studio/studio';
import type { Studio } from '../../domain/studio/studio';
import { moveOpening, setInsideLength, setOpeningSize, setWallSize, setWallAngle } from '../../domain/studio/studio-edit';
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
type Field = { key: string; label: string; value: number; min: number; max: number; hint?: string; unit?: string };

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
        if (s.kind === 'wall') {
            const w = studio.walls.find(x => x.id === s.id), face = w && wallFace(studio, w);
            if (!w || !face) return [];
            const size = w.independent ? SOLID_LIMITS : L, line = wallLine(studio, w)!;
            return [
                { key: 'length', label: 'Length', value: face.length, min: L.minWallLength, max: L.maxWallLength, hint: w.independent ? 'Width of the solid' : 'Inside the room' },
                { key: 'height', label: 'Height', value: w.height, min: size.minHeight, max: size.maxHeight },
                { key: 'thickness', label: 'Depth', value: w.thickness, min: size.minThickness, max: size.maxThickness },
                { key: 'y', label: 'Elevation', value: w.y ?? 0, min: 0, max: 5000, hint: 'Bottom above the floor' },
                ...(w.independent ? [{ key: 'angle', label: 'Rotation', value: line.angle, min: -360, max: 360, unit: '°', hint: 'Turn on the floor' }] : []),
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
        const ceiling = list.some(x => x.key === 'angle');
        const shape = list.map(x => x.key).join();
        if (root.dataset.shape !== shape) {
            root.dataset.shape = shape;
            root.innerHTML = list.map(x => '<label class="shape-field"><span>' + esc(x.label) + '</span><span class="shape-input"><input type="number" inputmode="decimal" step="1" data-room-field="' + x.key
                + '" min="' + x.min + '" max="' + x.max + '" aria-label="' + esc(x.label) + '"><small>' + (x.unit ?? 'cm') + '</small></span>'
                + (x.hint ? '<small class="room-field-hint">' + esc(x.hint) + '</small>' : '') + '</label>').join('')
                + (ceiling ? '<button type="button" class="room-ceiling-preset" data-room-ceiling>Make ceiling</button>'
                    + '<small class="room-ceiling-hint">A thin slab above the floor. Adjust its depth and elevation to fit.</small>' : '');
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
        if (s.kind === 'wall') {
            if (key === 'length') editStudio(r => setInsideLength(r, s.id, value));
            else if (key === 'angle') editStudio(r => setWallAngle(r, s.id, value));
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

    listen(root, 'click', e => {
        if (!(e.target as Element).closest('[data-room-ceiling]')) return;
        const s = getSelection();
        if (s?.kind !== 'wall') return;
        editStudio(r => {
            const w = r.walls.find(w => w.id === s.id);
            return w?.independent ? setWallSize(r, w.id, {
                height: Math.min(12, w.height), thickness: Math.max(w.height, w.thickness), y: Math.max(w.y ?? 0, w.height),
            }) : null;
        });
        refresh();
        render();
    });

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
