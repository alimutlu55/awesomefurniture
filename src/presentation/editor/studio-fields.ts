import { corner, wall, wallLine, STUDIO_LIMITS as L, type Studio } from '../../domain/studio/studio';
import {
    addOpening, moveCorner, moveOpening, removeOpening, removeWall, setOpeningSize, setWallLength, setWallSize, splitWall,
} from '../../domain/studio/studio-edit';
import { openingRange } from '../../domain/studio/studio-validation';
import { esc } from './editor-format.js';

export type StudioSelection = { kind: 'wall' | 'corner' | 'opening'; id: string } | null;

const raw = (value: number) => String(Math.round(value * 10) / 10);

function field(key: string, label: string, value: number, min?: number, max?: number) {
    const limits = (min === undefined ? '' : ' min="' + raw(min) + '"') + (max === undefined ? '' : ' max="' + raw(max) + '"');
    return '<label class="shape-field"><span>' + esc(label) + '</span><span class="shape-input">'
        + '<input type="number" inputmode="decimal" step="1" data-room-field="' + esc(key) + '" value="' + raw(value) + '"'
        + limits + ' aria-label="' + esc(label + ' in centimetres') + '"><small>cm</small></span></label>';
}

function action(key: string, label: string, title = label) {
    return '<button type="button" class="shape-action studio-field-action" data-room-action="' + esc(key) + '"'
        + ' title="' + esc(title) + '" aria-label="' + esc(title) + '">' + esc(label) + '</button>';
}

function row(title: string, fields: string, actions = '', help = '') {
    return '<div class="shape-row studio-row"><div class="shape-row-head"><b>' + esc(title) + '</b></div>'
        + '<div class="shape-fields">' + fields + '</div>'
        + (actions ? '<div class="shape-actions studio-field-actions">' + actions + '</div>' : '')
        + (help ? '<p class="shape-summary">' + esc(help) + '</p>' : '') + '</div>';
}

/** Room fields use the same controls as the wardrobe shape editor. All values are centimetres. */
export function studioFields(room: Studio, selection: StudioSelection): string {
    if (!selection) return '<p class="shape-summary">Select a wall, corner, door or window to edit its measurements.</p>';
    if (selection.kind === 'wall') {
        const w = wall(room, selection.id), line = w && wallLine(room, w);
        if (!w || !line) return '';
        const fields = field('length', 'Length', line.length, L.minWallLength, L.maxWallLength)
            + field('height', 'Height', w.height, L.minHeight, L.maxHeight)
            + field('thickness', 'Thickness', w.thickness, L.minThickness, L.maxThickness);
        const actions = action('split', 'Split', 'Split wall into two sections')
            + action('add-door', '+ Door', 'Add a door to this wall')
            + action('add-window', '+ Window', 'Add a window to this wall')
            + action('add-archway', '+ Archway', 'Add an archway to this wall')
            + action('delete', 'Delete', 'Delete wall and its openings');
        return row('Wall ' + (room.walls.indexOf(w) + 1), fields, actions, 'Drag the wall to move it. Length moves its end corner.');
    }
    if (selection.kind === 'corner') {
        const c = corner(room, selection.id);
        if (!c) return '';
        return row('Corner ' + (room.corners.indexOf(c) + 1), field('x', 'Position X', c.x) + field('z', 'Position Z', c.z), '',
            'Moving this corner stretches every wall joined to it.');
    }
    const o = room.openings.find(item => item.id === selection.id), w = o && wall(room, o.wall), line = w && wallLine(room, w);
    if (!o || !w || !line) return '';
    const range = openingRange(line.length, o.width), name = o.kind[0]!.toUpperCase() + o.kind.slice(1);
    const fields = field('offset', 'Centre from wall start', o.offset, range.min, range.max)
        + field('width', 'Width', o.width, L.minOpeningWidth, line.length - 2 * L.openingMargin)
        + field('height', 'Height', o.height, 30, w.height - o.sill - 2)
        + (o.kind === 'window' ? field('sill', 'Sill above floor', o.sill, 0, w.height - o.height - 2) : '');
    return row(name, fields, action('delete', 'Delete', 'Delete ' + o.kind), 'Drag the opening along its wall to move it.');
}

/** Prepare an edit; application commands remain responsible for validation and undo. */
export function studioFieldEdit(room: Studio, selection: StudioSelection, key: string, value: number): Studio | null {
    if (!selection || !Number.isFinite(value)) return null;
    const { kind, id } = selection;
    if (kind === 'wall') {
        if (key === 'length') return setWallLength(room, id, value);
        if (key === 'height' || key === 'thickness') return setWallSize(room, id, { [key]: value });
    } else if (kind === 'corner') {
        const c = corner(room, id);
        if (c && (key === 'x' || key === 'z')) return moveCorner(room, id, key === 'x' ? value : c.x, key === 'z' ? value : c.z);
    } else {
        if (key === 'offset') return moveOpening(room, id, value);
        if (key === 'width' || key === 'height' || key === 'sill') return setOpeningSize(room, id, { [key]: value });
    }
    return null;
}

export function studioActionEdit(room: Studio, selection: StudioSelection, name: string): Studio | null {
    if (!selection) return null;
    if (selection.kind === 'wall') {
        if (name === 'split') return splitWall(room, selection.id);
        if (name === 'delete') return removeWall(room, selection.id);
        if (name === 'add-door') return addOpening(room, selection.id, 'door');
        if (name === 'add-window') return addOpening(room, selection.id, 'window');
        if (name === 'add-archway') return addOpening(room, selection.id, 'archway');
    }
    if (selection.kind === 'opening' && name === 'delete') return removeOpening(room, selection.id);
    return null;
}
