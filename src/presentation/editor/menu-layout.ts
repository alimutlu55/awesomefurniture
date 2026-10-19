interface Ports {
  dom: { $(selector: string): HTMLElement; document: { createElement(tag: 'div'): HTMLElement } };
  lifetime: { cleanup(callback: () => void): void };
}

/** The menu's rows in the groups they are shown in, top to bottom, each with the colour of its icon's tile: what goes out
 * of the editor (share, drawings), how it measures (units, max reach), help, and Reset on its own, last. */
const GROUPS = [
  [['[data-editor-id="share-menu"]', 'blue'], ['.drawings-menu', 'indigo', 'nav']],
  [['.unit-row', 'orange'], ['.reach-menu-row', 'teal']],
  [['[data-editor-id="help-menu"]', 'grey', 'nav']],
  [['[data-editor-id="reset-scene"]', 'red', 'destructive']],
] as const;

/**
 * The editor menu (the three dots) laid out as Apple's settings are: its rows in groups, an icon on a coloured tile at
 * the start of each, a chevron on a row that opens something, Reset alone at the bottom in red. On a phone the groups are
 * inset cards on the sheet; on a computer, sections of the dropdown between hairlines (menu.css). Run once every row is
 * in the menu: it only moves rows into groups, so their listeners stay as they are.
 */
export function arrangeMenu({ dom, lifetime }: Ports) {
  const menu = dom.$('#menu'), made: HTMLElement[] = [];
  for (const group of GROUPS) {
    const box = dom.document.createElement('div');
    box.className = 'menu-group';
    box.setAttribute('role', 'group');
    for (const [selector, tile, kind] of group as readonly (readonly [string, string, string?])[]) {
      const row = menu.querySelector<HTMLElement>(selector);
      if (!row) continue;
      row.dataset.tile = tile;
      if (kind) row.classList.add('mi-' + kind);
      box.append(row);
    }
    if (box.childElementCount) { menu.append(box); made.push(box); }
  }
  lifetime.cleanup(() => made.forEach(box => box.remove()));
}
