import { esc } from './editor-format.js';

export const tags = (labels, tone = '') => '<div class="tag-row">' + labels.map(label => '<span class="pill' + (tone ? ' ' + tone : '') + '">' + esc(label) + '</span>').join('') + '</div>';

// Keep diagnostics in the domain; show the condition and location as concise tags.
export function issueTags(message) {
    const text = String(message), location = text.match(/(?:Bay|Board) \d+(?:, item \d+)?/);
    const dimensions = text.match(/\d+(?:\.\d+)?(?:–\d+)? cm/g) || [];
    /** @type {Array<[RegExp, string]>} */
    const rules = [
        [/Open folded shelves/, 'Back row hard to reach'],
        [/Some daily items/, 'Daily items hard to reach'],
        [/Occasional storage/, 'High storage'],
        [/Seasonal storage:/, 'Box shortfall'],
        [/Seasonal boxes need/, 'Insufficient box height'],
        [/garment drop/, 'Long hang above reach'],
        [/Pull-down access/, 'Check lift clearance'],
        [/Shallow hanging/, 'Front hanging'],
        [/narrower than one folded stack/, 'Too narrow for folding'],
        [/exceeds your/, 'Out of reach'],
        [/seasonal storage starts/, 'Boxes below reach line'],
        [/box count exceeds|allocation exceeds/, 'Box limit exceeded'],
        [/switched off/, 'Boxes disabled'],
        [/cost.*over/, 'Over budget'],
        [/overlap/, 'Overlap'],
        [/outside.*(?:geometry|space)|fixed coordinates/, 'Outside section'],
        [/contents exceed/, 'Height exceeded'],
        [/clearance|height is invalid/, 'Not enough item space'],
        [/width must|widths do not match/, 'Invalid section width'],
        [/depth|does not suit/, 'Wrong fitting size'],
        [/unknown fitting/, 'Unknown fitting'],
        [/purpose is required/, 'Choose storage type'],
        [/No storage bays/, 'No sections'],
    ];
    const label = rules.find(([pattern]) => pattern.test(text))?.[1] || 'Check fitting';
    return [...(location ? [location[0]] : []), label, ...new Set(dimensions)];
}

export function noticeLabels(message) {
    const text = String(message);
    if (/no longer fit and/.test(text)) return [(text.match(/^\d+/)?.[0] || '') + ' fittings removed', 'Size limit', 'Undo available'];
    if (/heights were compacted/.test(text)) return ['Heights adjusted', 'Undo available'];
    const placed = text.match(/^(.*?) placed in the empty (\d+) cm column/);
    if (placed) return [placed[1] + ' placed', placed[2] + ' cm', 'Undo available'];
    const shortage = text.match(/^(.*?) needs (\d+(?:\.\d+)?) cm of height but only (\d+(?:\.\d+)?) cm/);
    if (shortage) return [shortage[1], 'Needs ' + shortage[2] + ' cm', 'Free ' + shortage[3] + ' cm', 'Insufficient width'];
    const section = text.match(/section \d+/)?.[0];
    if (/wider than|too wide/.test(text)) return ['Too wide', ...(section ? [section] : []), 'Resize item'];
    if (/too shallow/.test(text)) return ['Insufficient depth'];
    if (/lose its required/.test(text)) return ['Not enough item space'];
    if (/No free space/.test(text)) return ['Insufficient space', ...(section ? [section] : []), ...(text.match(/\d+(?:\.\d+)? × \d+(?:\.\d+)? cm/) || [])];
    if (/Choose.*destination|Drop inside/.test(text)) return ['Pick section'];
    if (/Choose another item|Point at another item/.test(text)) return ['Pick swap item', 'Check fit'];
    if (/Choose a valid stack/.test(text)) return ['Pick position'];
    if (/Undo.*(?:back|restores|reverts)/.test(text)) return [text.split('. ')[0], 'Undo available'];
    if (/Open the doors before/.test(text)) return ['Open doors'];
    if (/Enter a distance/.test(text)) return ['Distance ≥ 0 cm'];
    if (/Distance limited/.test(text)) return ['Boundary reached'];
    if (/Setup changed/.test(text)) return ['Settings changed', 'Pick new design'];
    if (/storage requirements/.test(text)) return ['Storage shortfall'];
    if (/overlap/.test(text)) return ['Overlap', /wardrobe/.test(text) ? 'Move wardrobe' : 'Check placement'];
    if (/does not fit|not enough|No room/i.test(text)) return ['Insufficient space', ...(section ? [section] : [])];
    if (/Layout changed/.test(text)) return ['Layout changed', 'Try again'];
    if (/Move the dividers or items/.test(text)) return ['Resize blocked', 'Move dividers / items'];
    return text.split(' · ');
}
