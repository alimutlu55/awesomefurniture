export const COL = ['#58584c', '#b6ab94', '#e6dfd0', '#a49680', '#343831', '#827d70', '#c7bca5', '#727862'];
export const measureNumber = v => String(Math.round(Math.max(0, v) * 10) / 10);
export const capWord = w => w.charAt(0).toUpperCase() + w.slice(1);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const drawerN = p => p.sections.reduce((n, s) => n + s.items.filter(it => it.k === 'drawer' || it.k === 'sdrawer').length, 0);
export const zoneColor = it => it.k === 'void' || it.purpose === 'reserve' ? '#8b9bb0' : it.purpose === 'accessories' ? '#6f8fa3' : it.purpose === 'small' ? '#c0668a' : it.k === 'pants' || it.purpose === 'pants' ? '#9876ac' : ['short', 'long', 'lift'].includes(it.k) ? '#477fac' : ['seasonal', 'linen', 'luggage'].includes(it.purpose) || it.k === 'seasonal' ? '#b78a4d' : it.k === 'shoe' ? '#73869c' : it.k === 'basket' ? '#86928c' : '#4b9277';
export const zoneText = it => it.k === 'void' ? 'Free' : it.purpose === 'reserve' ? 'Adjustable' : it.purpose === 'accessories' ? 'Spare shelf' : it.purpose === 'small' ? 'Underwear & socks' : it.k === 'lift' ? 'Pull-down' : it.front ? 'Front hang' : it.k === 'long' ? 'Long hang' : it.k === 'short' ? 'Shirts' : it.purpose === 'pants' ? 'Trousers' : it.k === 'seasonal' ? 'Boxes' : it.k === 'shoe' ? 'Shoes' : it.k === 'drawer' ? 'Drawer' : it.k === 'basket' ? 'Basket' : 'Folded';
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
export const IBI = { rot: 'M19 8a8 8 0 1 0 1 8M19 3v5h-5', dup: 'M9 9h11v11H9zM4 15V4h11', del: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', mov: 'M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5', typ: 'M4 12h16M8 8l-4 4 4 4m8-8 4 4-4 4' };
export const ibIcon = k => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + IBI[k] + '"/></svg>';
export const ICONP = { "short": "M12 6.5a2 2 0 1 1 2 2l-2 1.2V12M12 12 3.5 17.2c-.9.6-.5 1.8.6 1.8h15.8c1.1 0 1.5-1.2.6-1.8z", "long": "M4 5h16M12 5v2M8 7h8l1.5 13h-11z", "drawer": "M4 6h16v12H4zM9.5 12h5", "shelf": "M3 18h18M7 18v-5h4v5M13 18V9h4v9", "shoe": "M3 17v-3c2 0 3-1 4-3l2 1.5c1 .8 2 1 4 1.5 3 .7 7 1 7 3.5V17zM3 20h18", "seasonal": "M3.5 8 12 4l8.5 4v8L12 20l-8.5-4zM3.5 8 12 12m0 0 8.5-4M12 12v8", "folded": "M4 20h16M6 20v-3h5v3M6 17v-3h5v3M6 14v-3h5v3M13 20v-3h5v3M13 17v-3h5v3", "pants": "M7 3h10l-1 18h-3.5L12 10l-.5 11H8z", "sdrawer": "M4 8h16v9H4zM4 5h16M10.5 12.5h3", "basket": "M4 10h16l-1.5 9h-13zM8 10l3-5M16 10l-3-5", "lift": "M12 4v12M7 11l5 5 5-5M5 20h14", "void": "M5 5h3M11 5h2M16 5h3M5 19h3M11 19h2M16 19h3M5 8v3M5 13v3M19 8v3M19 13v3M19 8v3", "menu": "M4 7h16M4 12h16M4 17h16", "chev": "M6 9l6 6 6-6", "more": "M5 12h.01M12 12h.01M19 12h.01", "undo": "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3", "redo": "m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3", "zin": "M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-4.2-4.2M11 8v6M8 11h6", "zout": "M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-4.2-4.2M8 11h6", "help": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5M12 17h.01", "sliders": "M5 7h8M17 7h2M5 17h2M11 17h8M15 4v6M9 14v6", "spark": "M5 19 17 7M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 12l.7 1.3L21 14l-1.3.7L19 16l-.7-1.3L17 14l1.3-.7z", "reset": "M4 12a8 8 0 1 0 3-6.2M4 4v4h4", "view": "M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" };
export const icon = n => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONP[n] + '"/></svg>';
export const RANKS = ['Apprentice', 'Joiner', 'Carpenter', 'Cabinetmaker', 'Master Builder', 'Legend'];
ICONP.plus = "M12 5v14M5 12h14";
ICONP.divider = "M9 4v16M15 4v16";
ICONP.material = "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7 9h.01M10 6h.01M15 7h.01M6 13h.01";
ICONP.reach = "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M4 4l6 6M20 4l-6 6M20 20l-6-6M4 20l6-6";
ICONP.doors = "M12 3 4 5v14l8 2V3h8v18h-8";
