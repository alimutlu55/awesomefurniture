import { createAddSuggestions } from './add-suggestions.js';
import { productArt } from './product-art.js';
import { shelfPossession } from '../../domain/wardrobe/possessions';
import { fitting } from '../../domain/wardrobe/fittings';
import { tags } from './storage-tags.js';
import { MODS } from '../../domain/wardrobe/catalog.js';
import { esc, icon } from './editor-format.js';
import { shapeTemplates, templateArt } from './shape-art';
/** The Add item panel: suggestion cards for the selected space, the More items list and the phone
 * catalogue with its categories. Cards only render here; their clicks are bound in bindings/add-menu.js.
 * @param {{ $: ReturnType<typeof import('./editor-dom.js').createEditorDom>['$'];
 *   model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
 *   selectionState: { addKey: number | null };
 *   geometry: Parameters<typeof createAddSuggestions>[1];
 *   addCabinet: (copy?: boolean, template?: string) => unknown;
 *   roomProducts?: () => string }} ports */
export function createAddMenuPresenter({ $, model, selectionState, geometry, addCabinet, roomProducts = () => '' }) {
    const addMenu = createAddSuggestions(() => model.activeCabinet().state, geometry);
    function renderAddChoices() {
        selectionState.addKey = model.activeCabinet().state.sel;
        const { list, intent } = addMenu.addSuggestions(), ranked = list.slice().sort((a, c) => (Number(c.fit) - Number(a.fit)) || c.s - a.s || a.o - c.o), feat = ranked.slice(0, 6);
        const set = new Set(feat.map(x => x.k)), rest = list.filter(x => !set.has(x.k)).sort((a, c) => (Number(c.fit) - Number(a.fit)) || c.s - a.s || a.o - c.o), nm = k => k === 'divider' ? 'Divider' : shelfPossession(k) ? shelfPossession(k).label : fitting(k)?.menu?.label ?? MODS[k].n, attr = x => x.k === 'divider' ? 'data-a="divider"' : shelfPossession(x.k) ? 'data-possession="' + x.k + '"' : 'data-m="' + x.k + '"';
        $('#add-intent').innerHTML = tags([(intent.match(/<b>(.*?)<\/b>/)?.[1] || '').replace(/\.$/, '').replace('Low space at floor level', 'Floor zone').replace('Roomy space within reach', 'Within reach').replace('Reaches above your ', 'Above reach ')]);
        $('#padd').innerHTML = feat.map(x => '<button type="button" ' + attr(x) + (!x.fit ? ' class="no" aria-disabled="true"' : x.warn ? ' class="warn"' : '') + ' title="' + esc(nm(x.k) + (x.fit ? (x.warn ? ' · ' + x.hint : '') : ' · ' + x.hint)) + '">' + productArt(x.k) + '<span>' + nm(x.k) + '</span>' + (x.hint ? '<small>' + esc(x.hint) + '</small>' : '') + '</button>').join('');
        $('#padd2').innerHTML = rest.map(x => '<button type="button" ' + attr(x) + ' class="' + (!x.fit ? 'no' : x.warn ? 'warn' : '') + '" aria-disabled="' + !x.fit + '" title="' + esc(nm(x.k) + (x.hint ? ' · ' + x.hint : '')) + '">' + icon(x.k) + '<span>' + nm(x.k) + '</span>' + (x.hint ? '<small>' + esc(x.hint) + '</small>' : '') + '</button>').join('');
        $('#more-count').textContent = String(rest.length);
        const browser = $('#pop2').querySelector('.mobile-add-browser');
        const categories = browser.querySelector('.mobile-add-categories'), products = browser.querySelector('.mobile-add-products');
        // Menu groups and phone order come from the fittings registry (fittings.ts, `menu`).
        const group = k => k === 'divider' ? 'shelves' : fitting(k)?.menu?.group ?? 'storage';
        const shapes = shapeTemplates(), shapeButton = (t, extra) => '<button type="button" class="shape-product" data-add-shape="' + t.id + '"' + extra + ' title="' + esc('New ' + t.name.toLowerCase() + ' wardrobe · ' + t.description) + '">' + templateArt(t.id) + '<span>' + esc(t.name) + '</span></button>';
        $('#padd-shapes').innerHTML = shapes.map(t => shapeButton(t, '')).join('');
        categories.innerHTML = [['all','Add item','plus'],['wardrobe','Wardrobe','wardrobe'],['storage','Storage','seasonal'],['hanging','Hanging','short'],['drawers','Drawers','drawer'],['shelves','Shelves','shelf'],['room','Walls','room-wall']].map(([key,name,ic]) => '<button type="button" data-category="'+key+'" aria-pressed="'+(key==='all')+'">'+icon(ic)+'<span>'+name+'</span></button>').join('') + '<button type="button" data-auto-design>'+icon('spark')+'<span>Auto design</span></button>';
        const wardrobeArt = '<svg class="product-art" viewBox="0 0 146 110" aria-hidden="true"><path d="M42 17 92 10 112 24 62 32Z" fill="#e0c49b"/><path d="M42 17v80l20 10V32Z" fill="#b59261"/><path d="M62 32 112 24v72l-50 11Z" fill="#cfad79"/><path d="m87 28 0 74m-5-43v10m10-12v10" stroke="#8d734f" stroke-width="1.5"/></svg>';
        const order = k => fitting(k)?.menu?.mobileRank ?? 4;
        products.innerHTML = '<button type="button" data-product-category="storage" data-add-wardrobe>'+wardrobeArt+'<span>Wardrobe</span></button>' + shapes.map(t => shapeButton(t, ' data-product-category="wardrobe" hidden')).join('') + list.slice().sort((a,b) => order(a.k) - order(b.k)).map(x => '<button type="button" '+attr(x)+' data-product-category="'+group(x.k)+'" aria-disabled="'+!x.fit+'" class="'+(!x.fit?'no':x.warn?'warn':'')+'" title="'+esc(nm(x.k)+(x.hint?' · '+x.hint:''))+'">'+productArt(x.k)+'<span>'+nm(x.k)+'</span></button>').join('') + roomProducts();
        (/** @type {HTMLButtonElement} */ (browser.querySelector('[data-add-wardrobe]'))).onclick = () => addCabinet();
        // Wardrobe templates add a new wardrobe that starts from that skeleton.
        (/** @type {NodeListOf<HTMLButtonElement>} */ ($('#pop2').querySelectorAll('[data-add-shape]'))).forEach(button => { button.onclick = () => addCabinet(false, button.dataset.addShape); });
        (/** @type {HTMLButtonElement} */ (categories.querySelector('[data-auto-design]'))).onclick = () => $('#launch-wizard').click();
        (/** @type {NodeListOf<HTMLButtonElement>} */ (categories.querySelectorAll('[data-category]'))).forEach(button => {
            button.onclick = () => {
                const category = button.dataset.category;
                categories.querySelectorAll('[data-category]').forEach(tab => tab.setAttribute('aria-pressed',String(tab===button)));
                (/** @type {NodeListOf<HTMLButtonElement>} */ (products.querySelectorAll('[data-product-category]'))).forEach(product => { product.hidden = category === 'all' ? ['wardrobe', 'room'].includes(product.dataset.productCategory) : product.dataset.productCategory !== category; });
                products.scrollLeft = 0;
            };
        });
    }
    return { renderAddChoices };
}
