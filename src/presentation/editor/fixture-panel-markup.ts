import type { Studio } from '../../domain/studio/studio';
import type { FixtureAnchor, FixtureEnclosure, StudioFixture } from '../../domain/studio/fixtures/fixture';
import { FIXTURE_FINISHES, fixtureDefinition, fixtureVariant, fixtureServices } from '../../domain/studio/fixtures/fixture-catalog';
import { fixturePose, enclosurePose } from '../../domain/studio/fixtures/fixture-geometry';
import { fixtureFindings } from '../../domain/studio/fixtures/fixture-validation';
import { esc } from './editor-format.js';
import { currentLengthUnit, lengthWithUnit, unitSuffix } from './length-unit-state';
import { fromCm } from '../../domain/geometry/length-units';
import type { Obstacle } from '../../domain/studio/studio-obstacles';

export type FixturePanelTab = 'type' | 'size' | 'installation' | 'finish';
export function numberField(key: string, label: string, value: number, extra = '', degrees = false) {
  return `<label class="fixture-field"><span>${esc(label)}</span><span><input type="number" inputmode="decimal" step="any" data-fixture-field="${key}"`
    + ` value="${degrees ? value : fromCm(value, currentLengthUnit(), true)}" ${extra}><small>${degrees ? '°' : unitSuffix()}</small></span></label>`;
}
const select = (key: string, label: string, values: readonly { value: string; name: string }[], current: string) =>
  `<label class="fixture-choice"><span>${esc(label)}</span><select data-fixture-select="${key}">`
  + values.map(v => `<option value="${esc(v.value)}"${v.value === current ? ' selected' : ''}>${esc(v.name)}</option>`).join('') + '</select></label>';
const colors = (key: string, label: string, color: string) => `<div class="fixture-finish"><b>${label}</b><div class="fixture-swatches">`
    + FIXTURE_FINISHES.map(f => `<button type="button" data-fixture-color="${key}" data-color="${f.color}" aria-label="${f.name}" title="${f.name}"`
      + ` aria-pressed="${color === f.color}" style="--swatch:${f.color}"></button>`).join('')
  + `</div><label class="fixture-custom-color">Custom color<input type="color" data-fixture-color-input="${key}" value="${esc(color)}"></label></div>`;

function position(a: FixtureAnchor) {
  if (a.kind === 'wall') return numberField('offset', 'Along wall from its start', a.offset) + numberField('y', 'Underside above finished floor', a.y)
    + numberField('gap', 'Gap from finished wall', a.gap);
  if (a.kind === 'enclosure') return numberField('offset', 'Across enclosure from its centre', a.offset) + numberField('y', 'Underside above enclosure base', a.y);
  if (a.kind === 'fixture') return numberField('x', 'Across support from its centre', a.x) + numberField('z', 'Depth on support from its centre', a.z)
    + numberField('lift', 'Height above supporting surface', a.lift);
  return numberField('x', 'Floor X', a.x) + numberField('z', 'Floor Z', a.z) + numberField('y', 'Underside above finished floor', a.y) + numberField('angle', 'Rotation', a.angle, '', true);
}
function enclosureFields(e: FixtureEnclosure) {
  return '<fieldset class="fixture-enclosure"><legend>' + esc(e.name) + '</legend><p>Finished outside size, including lining.</p>'
    + numberField('enclosure.w', 'Width', e.w)
    + numberField('enclosure.h', 'Height', e.h)
    + numberField('enclosure.d', 'Depth into room', e.d)
    + numberField('enclosure.lining', 'Lining thickness', e.lining)
    + select('enclosure.finish', 'Surface', ['paint', 'tile', 'panel'].map(v => ({ value: v, name: v === 'tile' ? 'Tiled' : v === 'paint' ? 'Painted plaster' : 'Finished panel' })), e.finish) + '</fieldset>';
}
export function fixturePanelMarkup(s: Studio, item: StudioFixture | FixtureEnclosure, tab: FixturePanelTab, others: readonly Obstacle[] = []) {
  const f = 'kind' in item ? item : undefined, anchor = f?.anchor;
  const e = !f ? item as FixtureEnclosure : anchor?.kind === 'enclosure' ? s.enclosures?.find(e => e.id === anchor.enclosure) : undefined;
  const def = f && fixtureDefinition(f.kind), v = f && fixtureVariant(f.kind, f.variant);
  const p = f ? fixturePose(s, f) : enclosurePose(s, item as FixtureEnclosure);
  let html = `<p class="fixture-summary">${esc(def?.name ?? (item as FixtureEnclosure).name)} · ${lengthWithUnit(item.w)} × ${lengthWithUnit(item.d)}`
    + (p ? ' · top ' + lengthWithUnit(p.y + item.h) : '') + '</p>';
  if (tab === 'type') {
    if (def && f) html += select('variant', 'Type', def.variants.map(v => ({ value: v.key, name: v.name })), f.variant);
    html += select('status', 'Construction', [{ value: 'new', name: 'New item' }, { value: 'existing', name: 'Existing item' }], item.status);
    if (f?.kind === 'basin') html += '<button type="button" class="fixture-add-accessory" data-fixture-accessory="faucet">Add a deck-mounted faucet</button>';
    if (f?.assembly) html += '<p>This item belongs to a complete set. More offers assembly duplication and removal.</p>';
  }
  if (tab === 'size') html += numberField('w', 'Width', item.w) + numberField('h', 'Body height', item.h)
    + numberField('d', f?.kind === 'faucet' ? 'Spout reach / overall depth' : 'Depth / projection', item.d)
    + '<p>Use Installation to set mounting height. Components keep independent sizes.</p>';
  if (tab === 'installation') {
    const host = item.anchor.kind === 'wall' ? 'wall:' + item.anchor.wall : item.anchor.kind === 'enclosure' ? 'enclosure:' + item.anchor.enclosure
      : item.anchor.kind === 'fixture' ? 'fixture:' + item.anchor.fixture : 'floor';
    const hosts = [
      ...(!v || v.mounting === 'floor' ? [{ value: 'floor', name: 'Free-standing on floor' }] : []),
      ...(v?.mounting !== 'surface' ? s.walls.map((w, i) => ({ value: 'wall:' + w.id, name: 'Wall ' + String.fromCharCode(65 + i) })) : []),
      ...(f && v?.mounting !== 'surface' ? (s.enclosures ?? []).map(e => ({ value: 'enclosure:' + e.id, name: e.name + ' · ' + e.id })) : []),
      ...(f && v?.mounting === 'surface' ? (s.fixtures ?? []).filter(x => f.kind === 'basin' ? x.kind === 'vanity' : x.kind === 'basin' || x.kind === 'vanity')
        .map(x => ({ value: 'fixture:' + x.id, name: fixtureDefinition(x.kind)!.name + ' · ' + x.id })) : []),
    ];
    html += select('host', 'Mounted on', hosts, host) + position(item.anchor);
    if (f?.installation) {
      const modes = [{ value: 'existing', name: 'Existing concealed installation · no new box' }, { value: 'local', name: 'New partial-height enclosure' },
        { value: 'full', name: 'New full-height lining' }, { value: 'module', name: 'Finished cistern module · no plaster boxing' },
        ...(s.enclosures ?? []).map(x => ({ value: x.id, name: 'Use ' + x.name + ' · ' + x.id }))];
      html += select('installation', 'Cistern and surrounding construction', modes, e?.id ?? 'existing');
      html += '<p>Reserved cistern / support volume</p>' + numberField('installation.w', 'Support width', f.installation.w)
        + numberField('installation.h', 'Support height', f.installation.h) + numberField('installation.d', 'Installation depth', f.installation.d);
      html += select('installation.access', 'Flush / service access', [{ value: 'front', name: 'Front face' }, { value: 'top', name: 'Top face / ledge' }], f.installation.access);
    }
    if (e) {
      html += enclosureFields(e);
      if (p && f) html += '<p class="fixture-total">Total projection from original wall: <b>' + lengthWithUnit(e.d + f.d) + '</b></p>';
    }
    if (f && def) for (const role of fixtureServices(f.kind, f.variant)) {
      const expected = role === 'power' ? 'socket' : role === 'vent' ? 'duct' : 'water';
      html += select('service.' + role, role[0]!.toUpperCase() + role.slice(1) + ' service', [{ value: '', name: 'Unconfirmed' },
        ...s.openings.filter(o => o.kind === expected).map(o => ({ value: o.id, name: o.kind + ' · ' + o.id }))], f.connections?.find(c => c.role === role)?.utility ?? '');
    }
  }
  if (tab === 'finish') {
    html += colors('color', 'Item finish', item.color);
    if (e) html += colors('enclosure.color', 'Enclosure front', e.color) + colors('enclosure.sideColor', 'Enclosure sides', e.sideColor)
      + colors('enclosure.topColor', 'Ledge / top', e.topColor);
  }
  if (f) html += '<ul class="fixture-findings" aria-label="Installation review">' + fixtureFindings(s, f.id, others).map(i => `<li>${esc(i.message)}</li>`).join('') + '</ul>';
  return html;
}
