import { categoriesForSpace, createAddSuggestions, menuGroup, orderForSpace } from './add-suggestions.js';
import { productArt as wardrobeFittingArt } from './product-art.js';
import { kitchenFittingArt } from './kitchen-art';
import { fittingProduct } from '../../domain/wardrobe/fittings';
import { FURNITURE, furnitureKind, furnitureModule } from '../../domain/furniture/furniture';
/** Card art: a kitchen fitting's front, or the wardrobe fitting's drawing. @param {string} k */
const productArt = k => fittingProduct(k) === 'kitchen' ? kitchenFittingArt(k) : wardrobeFittingArt(k);
import { shelfPossession } from '../../domain/wardrobe/possessions';
import { fitting } from '../../domain/wardrobe/fittings';
import { tags } from './storage-tags.js';
import { MODS } from '../../domain/wardrobe/catalog.js';
import { esc, icon } from './editor-format.js';
import { shapeTemplates, templateArt } from './shape-art';
/** Phone catalogue categories that add to the scene (the room, a wardrobe, kitchen cabinets) rather than into the selected space. */
const SCENE_CATEGORIES = ['room', 'wall', 'wardrobe', 'kitchen', 'utilities', 'openings', 'ceilings', 'fixtures'];
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
        const group = menuGroup;
        const shapes = shapeTemplates(), shapeButton = (t, extra) => '<button type="button" class="shape-product" data-add-shape="' + t.id + '"' + extra + ' title="' + esc('New ' + t.name.toLowerCase() + ' wardrobe · ' + t.description) + '">' + templateArt(t.id) + '<span>' + esc(t.name) + '</span></button>';
        $('#padd-shapes').innerHTML = shapes.map(t => shapeButton(t, '')).join('');
        // The phone sheet follows the selected space: products and category pills in the order that suits it.
        const forSpace = orderForSpace(list), pillOf = { storage: ['Storage', 'seasonal'], hanging: ['Hanging', 'short'], drawers: ['Drawers', 'drawer'], shelves: ['Shelves', 'shelf'], doors: ['Doors', 'cupboard'], appliances: ['Appliances', 'oven'] };
        // Only the categories this furniture offers anything in (a kitchen cabinet has no hanging, a wardrobe no appliances).
        const offered = Object.keys(pillOf).filter(key => forSpace.some(x => menuGroup(x.k) === key));
        const pills = categoriesForSpace(forSpace, offered).map(key => [key, ...pillOf[key]]);
        // Auto design takes the Add item pill's place in this row. Add item stays as the hidden "all" filter the sheet opens on.
        // Only furniture that Auto design can plan offers it (wardrobes, not cabinets).
        const autoDesign = furnitureModule(model.activeCabinet().state).autoDesign ? '<button type="button" data-auto-design>'+icon('spark')+'<span>Auto design</span></button>' : '';
        // Add furniture (the 'furniture' context) shows one tab per kind of furniture, from the registry.
        const tab = key => FURNITURE.some(m => m.key === key) ? ' data-furniture-tab' : '';
        const wallTab = key => ['utilities', 'openings', 'ceilings', 'fixtures'].includes(key) ? ' data-wall-tab' : '';
        const wallPills = [['utilities', 'Utilities', 'room-water'], ['openings', 'Openings', 'room-door'], ['ceilings', 'Ceiling', 'room-stairs'], ['fixtures', 'Fixtures', 'toilet']];
        const scenePills = [['room', 'Walls', 'room-wall'], ['wardrobe', 'Wardrobe', 'wardrobe'], ['kitchen', 'Cabinets', 'cupboard'], ...wallPills];
        categories.innerHTML = autoDesign + [['all', 'All', 'plus'], ...scenePills, ...pills].map(([key, name, ic]) => '<button type="button" data-category="' + key + '" aria-pressed="' + (key === 'all') + '"' + tab(key) + wallTab(key) + (key === 'all' || SCENE_CATEGORIES.includes(key) ? ' hidden' : '') + '>' + icon(ic) + '<span>' + name + '</span></button>').join('');
        const wardrobeArt = '<svg class="product-art" viewBox="0 0 146 110" aria-hidden="true"><path d="M42 17 92 10 112 24 62 32Z" fill="#e0c49b"/><path d="M42 17v80l20 10V32Z" fill="#b59261"/><path d="M62 32 112 24v72l-50 11Z" fill="#cfad79"/><path d="m87 28 0 74m-5-43v10m10-12v10" stroke="#8d734f" stroke-width="1.5"/></svg>';
        products.innerHTML = '<button type="button" data-product-category="wardrobe" data-add-wardrobe>'+wardrobeArt+'<span>Wardrobe</span></button>' + shapes.map(t => shapeButton(t, ' data-product-category="wardrobe" hidden')).join('') + forSpace.map(x => '<button type="button" '+attr(x)+' data-product-category="'+group(x.k)+'" aria-disabled="'+!x.fit+'" class="'+(!x.fit?'no':x.warn?'warn':'')+'" title="'+esc(nm(x.k)+(x.hint?' · '+x.hint:''))+'">'+productArt(x.k)+'<span>'+nm(x.k)+'</span></button>').join('') + roomProducts();
        (/** @type {HTMLButtonElement} */ (browser.querySelector('[data-add-wardrobe]'))).onclick = () => addCabinet();
        // Wardrobe templates add a new wardrobe that starts from that skeleton.
        (/** @type {NodeListOf<HTMLButtonElement>} */ ($('#pop2').querySelectorAll('[data-add-shape]'))).forEach(button => { button.onclick = () => addCabinet(false, button.dataset.addShape); });
        (/** @type {HTMLButtonElement | null} */ (categories.querySelector('[data-auto-design]')))?.addEventListener('click', () => $('#launch-wizard').click());
        const show = category => {
            categories.querySelectorAll('[data-category]').forEach(tab => tab.setAttribute('aria-pressed', String(tab.getAttribute('data-category') === category)));
            (/** @type {NodeListOf<HTMLButtonElement>} */ (products.querySelectorAll('[data-product-category]'))).forEach(product => {
                const kind = product.dataset.productCategory;
                const match = category === 'all' ? !SCENE_CATEGORIES.includes(kind)
                    : kind === category;
                product.hidden = !match;
            });
            products.scrollLeft = 0;
        };
        (/** @type {NodeListOf<HTMLButtonElement>} */ (categories.querySelectorAll('[data-category]'))).forEach(button => { button.onclick = () => show(button.dataset.category); });
        // Add item shows what goes into the wardrobe; Walls and Wardrobe only their own products, under their name.
        const context = $('#pop2').dataset.addContext, heading = categories.ownerDocument.createElement('b');
        heading.className = 'add-context-title';
        const titles = { fixtures: 'Fixtures', ceilings: 'Ceiling', wall: 'Add to wall', room: 'Walls', kitchen: 'Add a cabinet', furniture: 'Add furniture' };
        heading.textContent = titles[context] ?? 'Add a wardrobe';
        categories.prepend(heading);
        if (context === 'furniture') categories.querySelectorAll('[data-furniture-tab]').forEach(t => t.removeAttribute('hidden'));
        if (context === 'wall') categories.querySelectorAll('[data-wall-tab]').forEach(t => t.removeAttribute('hidden'));
        // Add furniture opens on the kind last worked on; wall opens on utilities.
        show(context === 'furniture' ? furnitureKind(model.activeCabinet().state) : context === 'wall' ? 'utilities' : context ?? 'all');
    }
    return { renderAddChoices };
}
