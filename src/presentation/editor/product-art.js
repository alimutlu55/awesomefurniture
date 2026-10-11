import { shelfPossession } from '../../domain/wardrobe/possessions';
/** Illustration of a fitting kind (or a shelf possession) on an Add item card. Kinds without their own
 * drawing borrow a close one; anything else is drawn as a shelf.
 * @param {string} k */
export function productArt(k) {
    const shelf = '<path d="M16 58 93 39 130 53 52 75Z" fill="#d9bd91"/><path d="M16 58v9l36 17v-9Z" fill="#ad8a5e"/><path d="M52 75 130 53v9L52 84Z" fill="#c3a073"/><path d="m24 59 69-16m-55 23 68-17" stroke="#f4ddba" opacity=".45"/>';
    const hanger = x => `<g transform="translate(${x},0)"><path d="M60 26c-8-8 6-12 6-4 0 4-6 5-6 10v5" fill="none" stroke="#a79881" stroke-width="2"/><path d="M60 37 39 65q-2 4 3 4l40-6q5-1 1-4Z" fill="none" stroke="#b39568" stroke-width="5" stroke-linejoin="round"/></g>`;
    const trouserRack = '<path d="M18 24 94 6 130 20 54 39Z" fill="#dcc49f"/><path d="M18 24v5l36 15v-5Z" fill="#b99b71"/><path d="M54 39 130 20v5L54 44Z" fill="#c5aa83"/>'
        + '<g fill="none" stroke-linecap="round"><path d="m20 37 77-19m-43 36 77-19" stroke="#73766f" stroke-width="5"/><path d="m20 36 77-19m-43 36 77-19" stroke="#e8e9e3" stroke-width="2"/><path d="m18 43 78-19m-42 36 78-19" stroke="#a2a59d" stroke-width="3"/></g>'
        + ['#4c5965', '#b9af9e', '#757d6d', '#d1c8b6', '#676962', '#465361'].map((color, i) => {
            const t = (5 - i) / 5, x = 36 + t * 68, y = 48 - t * 18;
            return `<g><path d="M${x} ${y}q7-3 14-3l1 44-6 2-2-23-1 24-6 2Z" fill="${color}"/><path d="m${x + 7} ${y + 3} 0 20m-4 4-1 16m9-18 1 17" fill="none" stroke="#202b33" stroke-opacity=".22" stroke-width=".8"/><path d="m${x} ${y} 14-3" stroke="#f7f4eb" stroke-opacity=".4" stroke-width="1.4"/><path d="m${x - 15} ${y - 10} 32 14" stroke="#797d76" stroke-width="3" stroke-linecap="round"/><path d="m${x - 15} ${y - 11} 32 14" stroke="#e7e8e0" stroke-width="1" stroke-linecap="round"/></g>`;
        }).join('')
        + '<path d="m18 43 36 17 78-19" fill="none" stroke="#73786f" stroke-width="4" stroke-linejoin="round"/><path d="m18 42 36 17 78-19" fill="none" stroke="#e7e9e2" stroke-width="1.3"/><path d="m72 57 30-7" stroke="#4f554f" stroke-width="5" stroke-linecap="round"/><path d="m72 56 30-7" stroke="#92988e" stroke-width="1" stroke-linecap="round"/>';
    // A shelf possession uses its registry line icon, drawn at card size.
    const possessionArt = p => '<svg class="product-art" viewBox="0 0 146 110" aria-hidden="true"><g transform="translate(46,25) scale(3.2)" fill="none" stroke="' + p.look.stroke + '" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"><path d="' + p.look.icon + '"/></g></svg>';
    const art = { short: '<path d="M17 24 128 15" stroke="#8c8980" stroke-width="5" stroke-linecap="round"/><path d="M17 23 128 14" stroke="#f8f6ee" stroke-width="2"/>' + hanger(-19) + hanger(2) + hanger(23),
        shelf,
        folded: shelf + '<path d="M38 54 74 45 92 52 56 61Z" fill="#e7e1d4"/><path d="M38 54v5l18 8v-6Z" fill="#b8b09c"/><path d="M56 61 92 52v5L56 67Z" fill="#cfc7b4"/><path d="M40 47 76 38 94 45 58 54Z" fill="#8a9a82"/><path d="M40 47v5l18 7v-5Z" fill="#6d7c66"/><path d="M58 54 94 45v5L58 59Z" fill="#7b8b73"/>',
        pants: trouserRack,
        drawer: '<path d="M23 42 96 26 126 40 52 58Z" fill="#b5976f"/><path d="m30 43 64-13 24 10-65 14Z" fill="#8c7051"/><path d="M23 42v33l29 17V58Z" fill="#ba9869"/><path d="M52 58 126 40v33L52 92Z" fill="#d8b98a"/><path d="m74 70 30-7" stroke="#796248" stroke-width="2"/><path d="m56 61 64-16" stroke="#f4ddb8"/>',
        shoe: '<g fill="none" stroke="#ada99b" stroke-width="2"><path d="m22 49 77-18 49 18-78 24Zm0 0v24m26 0v20m78-44v25M22 73l26 20 78-19M32 47l27 23m-7-28 27 23m-8-28 27 24m-8-28 27 23"/></g><path d="m47 41 8-14q3-3 7 2l9 17q7 9-1 11l-12 2Z" fill="#817460"/><path d="m70 37 8-14q3-3 7 2l9 17q7 9-1 11l-12 2Z" fill="#a0927a"/>',
        basket: '<g fill="#d7d0c330" stroke="#aaa397" stroke-width="1.5"><path d="m23 37 70-16 35 16-70 19Z"/><path d="m23 37 7 40 29 15 62-18 7-37-70 19Z"/></g><g stroke="#aaa397" fill="none">' + [0, 1, 2, 3, 4, 5, 6].map(i => `<path d="m${60 + i * 10} ${56 - i * 2.7} -1 33M${24 + i * 5} ${39 + i * 3} l7 39"/>`).join('') + '<path d="m25 48 34 17 67-19M27 59l32 16 64-18M29 69l30 15 63-18"/></g>',
        seasonal: '<path d="M24 62 56 54 84 66 52 75Z" fill="#d2c4a4"/><path d="M24 62v22l28 12V75Z" fill="#a99b7c"/><path d="M52 75 84 66v22L52 96Z" fill="#bbad8e"/><path d="M40 70h8" stroke="#f3eee4" stroke-width="2"/><path d="M66 34 98 26 126 38 94 46Z" fill="#d9ccae"/><path d="M66 34v22l28 12V46Z" fill="#b2a485"/><path d="M94 46 126 38v22L94 68Z" fill="#c4b697"/><path d="M80 44h8" stroke="#f3eee4" stroke-width="2"/>',
        divider: '<path d="m71 22 6-2v72l-6 2Z" fill="#a28e73"/><path d="m71 22-35 13v51l35 8Z" fill="#dfd5c4"/><path d="m77 20 34 17v48L77 92Z" fill="#b5aa96"/>',
    };
    if (shelfPossession(k)) return possessionArt(shelfPossession(k));
    return '<svg class="product-art" viewBox="0 0 146 110" aria-hidden="true">' + (art[k] || art[{ long: 'short', sdrawer: 'drawer', lift: 'short' }[k]] || shelf) + '</svg>';
}
