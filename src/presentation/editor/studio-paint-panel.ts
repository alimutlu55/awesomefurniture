import { WALL_PAINTS, WALL_FINISHES, paintWalls, wallAppearance } from '../../domain/studio/studio-paint';
import type { Studio, WallFinish } from '../../domain/studio/studio';
import type { RoomSelection } from '../viewport/studio-renderer';

interface PaintPanelPorts {
    document: Pick<Document, 'createElement'>;
    getStudio(): Studio | undefined;
    getSelection(): RoomSelection;
    editStudio(edit: (studio: Studio) => Studio | null): boolean;
    refresh(): void;
    listen(target: EventTarget, event: string, handler: (e: Event) => void): void;
}

/** A live wall-paint picker. Scope is explicit and resets when a different wall is selected. */
export function createStudioPaintPanel({ document, getStudio, getSelection, editStudio, refresh, listen }: PaintPanelPorts) {
    const root = document.createElement('div');
    root.className = 'wall-paint-panel';
    root.innerHTML = '<p class="wall-paint-current"></p><div class="wall-paint-swatches" role="group" aria-label="Wall color">'
        + WALL_PAINTS.map(p => `<button type="button" data-paint-color="${p.color}" aria-label="${p.name}" aria-pressed="false" title="${p.name}"><i style="background:${p.color}"></i><span>${p.name}</span></button>`).join('')
        + '</div><b class="wall-finish-label">Surface finish</b><div class="wall-finish-options" role="group" aria-label="Surface finish">'
        + WALL_FINISHES.map(f => `<button type="button" data-wall-finish="${f.id}" aria-pressed="false">${f.name}</button>`).join('')
        + '</div><label class="wall-paint-scope"><input type="checkbox">Apply to all walls</label>';
    const scope = root.querySelector<HTMLInputElement>('input');
    function render() {
        const selection = getSelection();
        const wall = selection?.kind === 'wall' ? getStudio()?.walls.find(w => w.id === selection.id) : undefined;
        if (!wall) return;
        if (root.dataset.wall !== wall.id) { if (scope) scope.checked = false; root.dataset.wall = wall.id; }
        const paint = wallAppearance(wall);
        const label = root.querySelector('.wall-paint-current');
        if (label) label.textContent = WALL_PAINTS.find(p => p.color === paint.color)?.name ?? paint.color;
        root.querySelectorAll<HTMLElement>('[data-paint-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.paintColor === paint.color)));
        root.querySelectorAll<HTMLElement>('[data-wall-finish]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wallFinish === paint.finish)));
    }
    listen(root, 'click', e => {
        const button = (e.target as Element).closest<HTMLElement>('[data-paint-color],[data-wall-finish]');
        const selection = getSelection();
        if (!button || selection?.kind !== 'wall') return;
        const paint = button.dataset.paintColor ? { color: button.dataset.paintColor } : { finish: button.dataset.wallFinish as WallFinish };
        if (editStudio(studio => paintWalls(studio, selection.id, paint, scope?.checked ?? false))) refresh();
        render();
    });
    return { root, render };
}
