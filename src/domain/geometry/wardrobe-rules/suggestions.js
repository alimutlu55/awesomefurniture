import { SHELF_POSSESSIONS, shelfFits, unitsOnShelf } from '../../wardrobe/possessions';
import { MODS, ADD_ORDER, r1, PANEL as T, PLINTH as PL } from '../../wardrobe/catalog.js';
/** @typedef {ReturnType<typeof import('./sizes.js').createSizesRules>} SizesRules */
/** @typedef {ReturnType<typeof import('./spaces.js').createSpacesRules>} SpacesRules */
/** Add item suggestions for the selected space: what fits, ranked.
 * Part of the wardrobe rules (see ../wardrobe-geometry.js). Centimetres; only the design is read.
 * @param {import('./context.js').GeometryContext} ctx
 * @param {SizesRules & SpacesRules} deps Rules from the modules created before this one. */
export function createSuggestionsRules(ctx, deps) {
    const { getDesign } = ctx;
    const { edgeGap, effectiveMin, itemFeasible, sectionSpaceMeasurements, spaceSpan } = deps;

    function addSuggestions() {
        const sp = sectionSpaceMeasurements(getDesign().sel), w = sp.w, H = sp.h, b = sp.y0, t = sp.y1, reach = getDesign().profile.reach, dMax = getDesign().profile.accessible ? 105 : Math.max(100, Math.min(135, Math.round(reach * .7))), onFloor = b - (PL + T) <= 1, high = b >= reach - 1, above = Math.max(0, t - Math.max(b, reach)), eng = !!getDesign().profile.engaged, need = { short: 'short', long: 'long', pants: 'pants', folded: 'folded', drawer: 'folded', shoe: 'shoes', sdrawer: 'small' }, list = [];
        [...ADD_ORDER, 'divider'].forEach((k, o) => {
            let fit = true, s = 0, why = '', hint = '', warn = false;
            if (k === 'divider') {
                fit = (w - T) / 2 >= 25;
                s = (w >= 100 ? 45 : 30) + (H >= 100 ? 8 : 0) - (high ? 15 : 0);
                why = 'Splits this space side by side';
                if (!fit) {
                    hint = 'Space too narrow';
                }
            }
            else {
                const m = MODS[k], mn = effectiveMin(k), front = (k === 'short' || k === 'long') && getDesign().d < 55, needW = front ? 55 : m.w, needD = front ? 35 : m.d;
                fit = itemFeasible(k, w) && ((mn <= H + .01 && !!spaceSpan(getDesign().sel, sp, mn, front ? 55 : m.w)) || !!edgeGap(k));
                if (!fit) {
                    hint = k === 'lift' && !getDesign().profile.allowLift ? 'Pull-down is off' : w < needW - .01 ? 'Needs ' + needW + ' cm width' : getDesign().d < needD ? 'Needs ' + needD + ' cm depth' : 'Needs ' + r1(mn) + ' cm height';
                }
                else {
                    const top = b + mn, ok = k === 'seasonal' || k === 'shelf' || k === 'void' ? true : k === 'short' || k === 'long' ? top - 6 <= reach + .03 : k === 'lift' ? top - 6 - 65 <= reach + .03 : ['drawer', 'sdrawer', 'basket'].includes(k) ? top <= Math.min(reach, dMax) + .03 : top <= reach + .03;
                    switch (k) {
                        case 'seasonal':
                            s = high ? 100 : above >= 34 ? (b >= reach - 60 ? 70 : 50) : b >= reach - 40 ? 25 : -10;
                            why = 'Occasional items belong above your reach';
                            break;
                        case 'shelf':
                            s = 40 + (high ? 25 : 0) + (above >= 34 ? 10 : 0) + (H >= 150 ? 10 : 0);
                            why = 'Flexible shelf';
                            break;
                        case 'short':
                            s = 55 + (H >= 100 ? 20 : 0) + (b >= 30 && b <= 130 ? 5 : 0);
                            why = 'Daily hanging';
                            break;
                        case 'long':
                            s = 40 + (onFloor ? 25 : b <= 50 ? 10 : -30) + (H >= 170 ? 5 : 0);
                            why = 'Long garments need floor-length hanging';
                            break;
                        case 'lift':
                            s = top - 6 > reach ? 50 : 10;
                            why = 'Brings a high rail down to reach';
                            break;
                        case 'pants':
                            s = 45 + (b <= 60 ? 20 : -10);
                            why = 'Trousers hang best low to mid';
                            break;
                        case 'shoe':
                            s = (onFloor ? 75 : b < 30 ? 55 : b < 60 ? 20 : -30) - (H >= 130 ? 25 : 0) + (H <= 60 ? 10 : 0);
                            why = 'Shoes sit best at floor level';
                            break;
                        case 'drawer':
                            s = 50 + (b >= 20 && b <= 90 ? 20 : 0) + (H <= 45 ? 15 : 0) - (b > 100 ? 20 : 0) - (H >= 130 ? 5 : 0);
                            why = 'Drawers keep folded clothes easy to reach';
                            break;
                        case 'sdrawer':
                            s = 30 + (b >= 60 && b <= 110 ? 25 : 0);
                            why = 'Small items sit best at hand height';
                            break;
                        case 'basket':
                            s = 35 + (onFloor ? 20 : b < 60 ? 10 : 0);
                            why = 'Low pull-out for laundry or bulky items';
                            break;
                        case 'folded':
                            s = 48 + (b >= 60 && b <= 150 ? 18 : 0) + (H <= 45 ? 10 : 0) - (H >= 140 ? 15 : 0);
                            why = 'Folded clothes work best at chest height';
                            break;
                    }
                    if (!ok) {
                        s -= 45;
                        warn = true;
                        why = 'Out of easy reach here';
                    }
                    const nk = need[k];
                    if (eng && nk) {
                        s += getDesign().profile.needs[nk] > 0 ? 8 : -8;
                    }
                    if (eng && k === 'seasonal' && getDesign().profile.upper === 'none') {
                        s -= 30;
                    }
                    hint = warn ? 'Out of reach' : '';
                }
            }
            list.push({ k, o, fit, s, why, hint, warn });
        });
        const intent = high ? '<b>High space</b>, above your ' + reach + ' cm reach. Best for seasonal boxes and occasional storage.'
            : onFloor && H >= 130 ? '<b>Full-height space.</b> Good for hanging, long garments and pull-outs.'
                : above >= 34 ? '<b>Reaches above your ' + reach + ' cm line.</b> Keep daily items below it and boxes on top.'
                    : onFloor && H <= 60 ? '<b>Low space at floor level.</b> Good for shoes, drawers and folded clothes.'
                        : H >= 100 ? '<b>Roomy space within reach.</b> Good for hanging and everyday storage.'
                            : b >= 100 ? '<b>Upper shelf zone.</b> Good for folded clothes and light storage.'
                                : '<b>Compact space.</b> Good for drawers, shelves and folded clothes.';
        // Possessions that stand on a shelf (handbags...): suggested where a shelf can hold them, ranked with the shelves.
        SHELF_POSSESSIONS.forEach((p, n) => {
            const fits = shelfFits(p.holder, w, H), minWidth = p.holder.pitch + p.holder.margin;
            list.push({ k: p.key, possession: p.key, o: ADD_ORDER.length + 1 + n, fit: fits, s: p.menu.score + (H >= 60 ? 6 : 0) - (high ? 15 : 0), why: p.menu.why, hint: fits ? '' : unitsOnShelf(p.holder, w) < 1 ? 'Needs ' + minWidth + ' cm width' : 'Needs ' + p.holder.height + ' cm height', warn: false });
        });
        return { list, intent };
    }
    return { addSuggestions };
}
