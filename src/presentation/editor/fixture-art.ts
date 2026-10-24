import { FIXTURE_CATALOG, FIXTURE_CATEGORIES, FIXTURE_PRESETS, fixtureDefinition } from '../../domain/studio/fixtures/fixture-catalog';
import { esc } from './editor-format.js';

const art: Record<string, string> = {
  toilet: '<path d="M47 51h53c0 23-12 29-29 29H59v17H45V73q-8-8 2-22Z"/><path d="M39 20h38v31H39z"/><ellipse cx="75" cy="52" rx="27" ry="8"/>',
  basin: '<path d="M28 43h90q-3 34-45 34T28 43Z"/><ellipse cx="73" cy="43" rx="45" ry="12"/><path d="M73 77v17m-12 0h24"/>',
  faucet: '<path d="M63 91V35q0-18 17-18h24v12H83q-7 0-7 8v54Z"/><path d="M56 91h28M61 35H48"/>',
  vanity: '<path d="M27 40h92v56H27zM27 68h92M49 54h47M49 82h47"/><ellipse cx="73" cy="32" rx="32" ry="12"/><path d="M73 20V9h15"/>',
  mirror: '<rect x="39" y="12" width="68" height="87" rx="28"/><path d="m52 68 35-38m-23 52 29-34"/>',
  tray: '<path d="m20 62 64-34 45 31-63 36Z"/><path d="m29 61 55-25 35 23-53 27Z"/><path d="m61 54 15-6"/>',
  screen: '<path d="M35 17h77v80H35Z"/><path d="m49 73 43-40M35 97l-13 7m90-7 13 7"/>',
  shower: '<path d="M65 95V19h31v10M43 94h43M44 86V57h15m0 0v29"/><ellipse cx="96" cy="32" rx="18" ry="4"/>',
  bath: '<path d="M16 45h114q-3 42-28 42H41Q21 84 16 45Z"/><ellipse cx="73" cy="45" rx="57" ry="15"/><path d="m43 87-4 10m64-10 4 10"/>',
  rail: '<path d="M25 47h96v8H25Z"/><path d="M25 38v28m96-28v28M47 55v38h39V55"/>',
  laundry: '<rect x="36" y="12" width="75" height="89" rx="4"/><circle cx="73" cy="64" r="24"/><path d="M36 34h75m-64-12h18m26 0h8"/>',
  radiator: '<path d="M42 13v87m64-87v87M42 25h64M42 39h64M42 53h64M42 67h64M42 81h64M42 95h64"/>',
};
export function fixtureArt(kind: string) {
  const shape = fixtureDefinition(kind)?.shape ?? 'vanity';
  return '<svg class="product-art fixture-art" viewBox="0 0 146 110" aria-hidden="true"><g fill="#e4ddd0" stroke="#827965" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">'
    + (art[shape] ?? art.vanity) + '</g></svg>';
}
export function fixtureProducts() {
  const tools = '<div class="fixture-catalog-tools" data-product-category="fixtures" hidden><label>Find a fixture<input type="search" data-fixture-search placeholder="Toilet, sink, faucet…"></label>'
    + '<label>Room items<select data-fixture-filter><option value="">All fixtures</option>'
    + FIXTURE_CATEGORIES.map(c => `<option>${esc(c)}</option>`).join('') + '</select></label></div>';
  const kits = FIXTURE_PRESETS.map(p => `<button type="button" data-product-category="fixtures" data-fixture-preset="${p.key}" data-fixture-category="Bathroom"`
    + ` data-fixture-search-text="${esc(p.name + ' ' + p.description)}" hidden title="${esc(p.description)}">${fixtureArt(p.kind)}<span>${esc(p.name)}</span><small>Complete set</small></button>`).join('');
  const enclosure = '<button type="button" data-product-category="fixtures" data-add-enclosure data-fixture-category="Construction"'
    + ' data-fixture-search-text="installation enclosure prewall plaster wall boxing ledge cistern" hidden>'
    + fixtureArt('vanity') + '<span>Installation enclosure</span><small>Shared construction</small></button>';
  return tools + kits + enclosure + FIXTURE_CATALOG.map(d => `<button type="button" data-product-category="fixtures" data-add-fixture="${d.key}" data-fixture-category="${d.category}"`
    + ` data-fixture-search-text="${esc(d.name + ' ' + d.description + (d.key === 'basin' ? ' sink washbasin' : d.key === 'faucet' ? ' tap mixer' : d.key === 'toilet' ? ' WC' : ''))}" hidden`
    + ` title="${esc(d.description)}">${fixtureArt(d.key)}<span>${esc(d.name)}</span><small>${d.variants.length > 1 ? d.variants.length + ' types' : d.category}</small></button>`).join('');
}
