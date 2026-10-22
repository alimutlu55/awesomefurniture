import { STUDIO_LIMITS as L, roomHeight, wallFace, wallLine } from '../../domain/studio/studio';
import type { Studio } from '../../domain/studio/studio';
import { setDoorOperation, moveOpening, moveOpening2D, setInsideLength, setOpeningSize, setWallSize } from '../../domain/studio/studio-edit';
import { isWallUtility, openingLimits } from '../../domain/studio/wall-utilities';
import { ceilingFrame, moveCeilingPoint, setCeilingDepth } from '../../domain/studio/studio-ceiling';
import { ceilingBoundary } from '../../domain/studio/studio-boundary';
import { measureNumber, unitSuffix } from './editor-format.js';
import type { RoomSelection } from '../viewport/studio-renderer';
import { mountResizeFields, syncResizeFields } from './resize-fields.js';
import type { StudioEditorPorts } from './studio-editor.ports';
import { sizeControlMarkup, bindSizeNumber } from './size-control';

interface StudioFieldsPorts {
    readonly document: { createElement: Document['createElement']; activeElement?: Element | null };
    readonly getStudio: () => Studio | undefined;
    readonly getSelection: () => RoomSelection;
    readonly editStudio: (edit: (room: Studio) => Studio | null) => boolean;
    readonly refresh: () => void;
    readonly listen: (target: EventTarget, type: string, handler: (e: Event) => void) => void;
    readonly resize?: { model: StudioEditorPorts['model']; history: { checkpoint(snapshot: string): void };
        preview(edit: (room: Studio) => Studio | null): boolean; commit(): void; active(): boolean };
    readonly rendered?: () => void;
}
type Field = { key: string; label: string; value: number; min: number; max: number; hint?: string };

const round = (v: number) => Math.round(v * 10) / 10;

/** Shared sizing rows for walls, ceilings and openings. Lengths are inside the room. */
export function createStudioFields({ document, getStudio, getSelection, editStudio, refresh, listen, resize, rendered }: StudioFieldsPorts) {
    const root = document.createElement('div');
    root.className = 'room-fields';

    function fields(): Field[] {
        const studio = getStudio(), s = getSelection();
        if (!studio || !s) return [];
        if (s.kind === 'ceiling') {
            const c = studio.ceilings?.find(x => x.id === s.id), fr = c && ceilingFrame(studio, c);
            if (!c || !fr) return [];
            // Each point's height, named by where it is: from the wall's start, or from the wall for a sloped roof.
            const where = (t: number) => measureNumber(Math.round(c.run === 'along' ? t - fr.face.start : t)) + unitSuffix() + ' ' + (c.run === 'along' ? 'along' : 'out');
            return [
                ...ceilingBoundary(studio, c).map((p, k) => ({ key: 'p' + k, label: 'Height ' + (k + 1), value: p.y, min: L.minCeilingHeight, max: roomHeight(studio), hint: where(p.t) })),
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
        const lim = openingLimits(o.kind), util = isWallUtility(o.kind), hasSill = o.kind === 'window' || util;
        return [
            { key: 'width', label: 'Width', value: o.width, min: lim.minWidth, max: Math.max(lim.minWidth, face.length) },
            { key: 'height', label: 'Height', value: o.height, min: util ? lim.minHeight : 30, max: w.height },
            { key: 'left', label: 'From left end', value: o.offset - o.width / 2 - face.start, min: 0, max: face.length },
            { key: 'right', label: 'From right end', value: face.end - (o.offset + o.width / 2), min: 0, max: face.length },
            ...(hasSill ? [
                { key: 'sill', label: util ? 'From floor' : 'Sill height', value: o.sill, min: 0, max: w.height },
                { key: 'top', label: 'From ceiling', value: w.height - o.sill - o.height, min: lim.topMargin, max: w.height },
            ] : []),
        ];
    }

    listen(root, 'change', event => {
        const select = event.target as HTMLSelectElement, key = select.dataset.roomDoor, selection = getSelection();
        if (!key || selection?.kind !== 'opening') return;
        const value = select.value;
        if (key === 'hinge' && (value === '' || value === 'left' || value === 'right'))
            editStudio(r => setDoorOperation(r, selection.id, { hinge: value || undefined }));
        if (key === 'swing' && (value === '' || value === 'in' || value === 'out'))
            editStudio(r => setDoorOperation(r, selection.id, { swing: value || undefined }));
        refresh(); render();
    });
    function render() {
        const list = resize?.active() ? fields() : [];
        const selection = getSelection(), opening = selection?.kind === 'opening' ? getStudio()?.openings.find(o => o.id === selection.id) : undefined;
        const door = opening?.kind === 'door' ? opening : undefined;
        const shape = JSON.stringify([getSelection(), list.map(x => x.key), !!door]);
        if (root.dataset.shape !== shape) {
            root.dataset.shape = shape;
            root.innerHTML = list.map(x => sizeControlMarkup({ label: x.label, min: x.min, max: x.max, hint: x.hint, hintKey: x.key,
                inputAttributes: { 'data-room-field': x.key, 'aria-label': x.label } })).join('');
            if (door) root.innerHTML += ( '<p>Door handing · viewed from inside the room</p>'
                + '<label>Hinge side<select data-room-door="hinge" aria-label="Door hinge side"><option value="">Unconfirmed</option>'
                + '<option value="left">Left</option><option value="right">Right</option></select></label>'
                + '<label>Opening direction<select data-room-door="swing" aria-label="Door opening direction"><option value="">Unconfirmed</option>'
                + '<option value="in">Into room</option><option value="out">Out of room</option></select></label>');
            if (resize && list.length) {
                mountResizeFields({ dom: { document }, lifetime: { listen }, model: resize.model, history: resize.history, commit: resize.commit,
                    fields: list.map(x => ({ input: root.querySelector<HTMLInputElement>('[data-room-field="' + x.key + '"]')!, axis: x.key })),
                    preview: (input: HTMLInputElement, value: number) => apply(input.dataset.roomField!, value, true), refresh: () => { refresh(); render(); } });
                for (const x of list) bindSizeNumber({ input: root.querySelector<HTMLInputElement>('[data-room-field="' + x.key + '"]')!,
                    lifetime: { listen }, commit: value => apply(x.key, value), finished: render });
            }
        }
        for (const x of list) {
            const input = root.querySelector<HTMLInputElement>('[data-room-field="' + x.key + '"]');
            if (input) { input.min = String(x.min); input.max = String(x.max); if (document.activeElement !== input) input.value = String(round(x.value)); }
            const hint = root.querySelector('[data-room-hint="' + x.key + '"]');
            if (hint) hint.textContent = x.hint ?? '';
        }
        if (door) for (const key of ['hinge', 'swing'] as const) {
            const select = root.querySelector<HTMLSelectElement>('[data-room-door="' + key + '"]');
            if (select) select.value = door[key] ?? '';
        }
        if (list.length) syncResizeFields(root);
        rendered?.();
    }

    /** Applies one field; the edit functions validate nothing, editStudio refuses with the reason. */
    function apply(key: string, value: number, preview = false) {
        const s = getSelection();
        if (!s || !Number.isFinite(value)) return;
        const write = preview && resize ? resize.preview : editStudio;
        if (s.kind === 'ceiling') {
            if (key === 'depth') write(r => setCeilingDepth(r, s.id, value));
            else write(r => {
                const k = Number(key.slice(1)), c = r.ceilings?.find(x => x.id === s.id), p = c && ceilingBoundary(r, c)[k];
                return p ? moveCeilingPoint(r, s.id, k, p.t, value) : null;
            });
        } else if (s.kind === 'wall') {
            if (key === 'length') write(r => setInsideLength(r, s.id, value));
            else write(r => setWallSize(r, s.id, { [key]: value }));
        } else if (key === 'left' || key === 'right') {
            write(r => {
                const o = r.openings.find(x => x.id === s.id)!, w = r.walls.find(x => x.id === o.wall)!, face = wallFace(r, w);
                if (!face || !wallLine(r, w)) return null;
                return moveOpening(r, s.id, key === 'left' ? face.start + value + o.width / 2 : face.end - value - o.width / 2);
            });
        } else if (key === 'sill' || key === 'top') {
            write(r => {
                const o = r.openings.find(x => x.id === s.id)!, w = r.walls.find(x => x.id === o.wall)!;
                return o && w ? moveOpening2D(r, s.id, o.offset, key === 'sill' ? value : w.height - o.height - value) : null;
            });
        } else write(r => setOpeningSize(r, s.id, { [key]: value }));
        if (!preview) { refresh(); render(); }
    }

    return { root, render };
}
