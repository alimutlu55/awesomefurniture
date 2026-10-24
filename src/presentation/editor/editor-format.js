import { SHELF_POSSESSIONS } from '../../domain/wardrobe/possessions';
import { FITTINGS, fitting } from '../../domain/wardrobe/fittings';
import { FIXTURES } from '../../domain/studio/fixtures/fixture-kinds';
import { purposeDef } from '../../domain/wardrobe/purposes';
import { resolveZone } from '../../domain/wardrobe/zone-style';
import { lengthText } from './length-unit-state';
export const COL = ['#58584c', '#b6ab94', '#e6dfd0', '#a49680', '#343831', '#827d70', '#c7bca5', '#727862'];
/** A length (centimetres) as a number in the unit the person chose (mm, cm or in); follow it with `unitSuffix()`. */
export const measureNumber = v => lengthText(v);
export { unitSuffix } from './length-unit-state';
export const capWord = w => w.charAt(0).toUpperCase() + w.slice(1);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const drawerN = p => p.sections.reduce((n, s) => n + s.items.filter(it => it.k === 'drawer' || it.k === 'sdrawer').length, 0);
/** Colour and label of a fitting's zone in layout diagrams. Styles come from fittings.ts and purposes.ts. */
const zoneOf = it => resolveZone(fitting(it.k)?.zone, purposeDef(it.purpose)?.zone, !!it.front, { color: '#4b9277', label: 'Folded' });
export const zoneColor = it => zoneOf(it).color;
export const zoneText = it => zoneOf(it).label;
export const zoneRuns = items => {
    const out = [];
    for (const it of items) {
        const key = zoneText(it) + '|' + zoneColor(it), last = out[out.length - 1];
        if (last && last.key === key) {
            last.h += it.h;
            last.n++;
        }
        else {
            out.push({ key, it, h: it.h, n: 1 });
        }
    }
    return out;
};
export const SHARED_NOTE = /^Open folded shelves are/;
export const IBI = { rot: 'M19 8a8 8 0 1 0 1 8M19 3v5h-5', dup: 'M9 9h11v11H9zM4 15V4h11', del: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', typ: 'M4 12h16M8 8l-4 4 4 4m8-8 4 4-4 4' };
export const ibIcon = k => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + IBI[k] + '"/></svg>';
export const ICONP = { "menu": "M4 7h16M4 12h16M4 17h16", "chev": "M6 9l6 6 6-6", "more": "M5 12h.01M12 12h.01M19 12h.01", "undo": "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3", "redo": "m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3", "zin": "M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-4.2-4.2M11 8v6M8 11h6", "zout": "M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-4.2-4.2M8 11h6", "help": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5M12 17h.01", "sliders": "M5 7h8M17 7h2M5 17h2M11 17h8M15 4v6M9 14v6", "spark": "M5 19 17 7M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 12l.7 1.3L21 14l-1.3.7L19 16l-.7-1.3L17 14l1.3-.7z", "reset": "M4 12a8 8 0 1 0 3-6.2M4 4v4h4", "view": "M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" };
export const icon = n => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONP[n] + '"/></svg>';
export const RANKS = ['Apprentice', 'Joiner', 'Carpenter', 'Cabinetmaker', 'Master Builder', 'Legend'];
ICONP.plus = "M12 5v14M5 12h14";
ICONP.divider = "M9 4v16M15 4v16";
// The room: walls, doors, windows and archways, drawn in plan or elevation.
ICONP["room-wall"] = "M3 9h18v6H3zM8 9v6M13 9v6M18 9v6";
ICONP["room-door"] = "M5 20V4h11v16M3 20h18M13 12h.01M16 4l3 2v14";
ICONP["room-window"] = "M4 5h16v12H4zM12 5v12M4 11h16M3 20h18";
ICONP["room-archway"] = "M5 20V10a7 7 0 0 1 14 0v10M3 20h4M17 20h4";
ICONP["room-water"] = "M7 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM17 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 13a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4 4h16v16H4z";
ICONP["room-socket"] = "M3 7h18v10H3zM8 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM16 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z";
ICONP["room-duct"] = "M4 4h16v16H4zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM8.5 10.5h7M8.5 13.5h7";
ICONP["room-gas"] = "M5 4h14v16H5zM12 9a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM12 9l4-3";
ICONP["room-radiator"] = "M3 6h18v12H3zM7 6v12M11 6v12M15 6v12M19 9h2";
ICONP["room-switch"] = "M5 5h14v14H5zM9 9h6v6H9zM12 9v6";
ICONP["room-stairs"] = "M3 4h18M3 20h18M7 4l12 12v4";
ICONP["flip"] = "M12 3v18M8 7 4 12l4 5M16 7l4 5-4 5";
ICONP["shape-edit"] = "M5 19V10l7-6 7 6v9zM5 10h.01M12 4h.01M19 10h.01M5 19h.01M19 19h.01";
ICONP.split = "M3 12h7M14 12h7M12 5v14M8 9l-3 3 3 3M16 9l3 3-3 3";
// A fixture is set up as a section through it: the wall, a boxing, and the bowl in front of it.
ICONP["fixture-type"] = "M4 3v18M4 21h17M4 9h4v12M8 13h8a3 3 0 0 1-3 3h-5";
// Fitting, possession and fixture icons come from their registries.
for (const f of FITTINGS) ICONP[f.key] = f.icon;
for (const f of FIXTURES) ICONP[f.key] = f.icon;
for (const p of SHELF_POSSESSIONS) ICONP[p.key] = p.look.icon;
ICONP.wardrobe = "M5 20V9l7-5 7 5v11zM12 6.5V20M10 12v2M14 12v2";
ICONP.material = "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7 9h.01M10 6h.01M15 7h.01M6 13h.01";
ICONP.reach = "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M4 4l6 6M20 4l-6 6M20 20l-6-6M4 20l6-6";
ICONP.doors = "M12 3 4 5v14l8 2V3h8v18h-8";
