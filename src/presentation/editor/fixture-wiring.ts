import { createFixtureCommands } from '../../application/commands/fixture-commands';
import type { FixturePlacement } from '../../application/commands/fixture-commands';
import type { StudioEditorPorts } from './studio-editor.ports';
import type { createEditorDom } from './editor-dom.js';
import type { RoomSelection } from '../viewport/studio-renderer';
import type { FixtureAnchor, FixtureEnclosure, StudioFixture } from '../../domain/studio/fixtures/fixture';
import { fixturePose, enclosurePose, localPose } from '../../domain/studio/fixtures/fixture-geometry';
import { wallFace, wallLine } from '../../domain/studio/studio';
import { fixturePanelMarkup, type FixturePanelTab } from './fixture-panel-markup';
import { createFixtureDrag } from './fixture-drag';
import { takeMobilePanel } from './mobile-panel-owner.js';
import { currentLengthUnit, lengthWithUnit } from './length-unit-state';
import { toCm } from '../../domain/geometry/length-units';

interface Ports {
  dom: ReturnType<typeof createEditorDom>; model: StudioEditorPorts['model']; history: StudioEditorPorts['history'];
  selection(): RoomSelection; select(s: RoomSelection): void;
  picking: { groundPoint(e: PointerEvent): { x: number; z: number } | null };
  listen(target: EventTarget, type: string, handler: (e: Event) => void): void;
  refresh(): void; redraw(): void; report(message: string): void; hideCatalog(): void;
  viewed(): { placementWall?: string; placementAlong?: number };
  focus(bounds: { x: number; z: number; w: number; d: number; h: number }, az: number): void;
}
export function createFixtureWiring({ dom, model, history, selection, select, picking, listen, refresh, redraw, report, hideCatalog, viewed, focus }: Ports) {
  const commands = createFixtureCommands({ getScene: () => model.scene, checkpoint: () => history.checkpoint(model.snapshot()), report });
  const panel = dom.$('#left'), app = dom.$('#app'), root = dom.document.createElement('section');
  root.className = 'fixture-editor'; root.dataset.wardrobeControls = 'fixture'; root.dataset.studioResize = '';
  dom.$('#left-body').append(root);
  let tab: FixturePanelTab = 'installation', key = '';
  const selected = () => selection()?.kind === 'fixture' || selection()?.kind === 'enclosure';
  function item() {
    const s = selection(), studio = model.scene.studio;
    return s?.kind === 'fixture' ? studio?.fixtures?.find(f => f.id === s.id) : s?.kind === 'enclosure' ? studio?.enclosures?.find(f => f.id === s.id) : undefined;
  }
  function render() {
    const current = item(), studio = model.scene.studio;
    if (!current || !studio) {
      if (panel.dataset.fixturePanel !== undefined) {
        delete panel.dataset.fixturePanel; delete panel.dataset.roomResize; delete panel.dataset.contextSection;
        app.classList.remove('props-open'); app.classList.add('props-hidden');
      }
      key = ''; return;
    }
    if (panel.dataset.fixturePanel === undefined) return;
    const next = JSON.stringify([current, studio, tab, currentLengthUnit()]);
    if (key === next) return;
    key = next;
    const tabs: FixturePanelTab[] = ['type', 'size', 'installation', 'finish'];
    root.innerHTML = '<div class="fixture-panel-heading"><b>Fixture properties</b><div><button type="button" data-fixture-action="undo">Undo</button>'
      + '<button type="button" data-fixture-action="redo">Redo</button><button type="button" data-fixture-action="done">Done</button></div></div>'
      + '<div class="fixture-panel-tabs" role="tablist" aria-label="Fixture properties">'
      + tabs.map(t => `<button type="button" role="tab" data-fixture-tab="${t}" aria-selected="${t === tab}">${t[0]!.toUpperCase() + t.slice(1)}</button>`).join('')
      + '</div>' + fixturePanelMarkup(studio, current, tab, model.scene.wardrobes.map(c => ({
        id: 'cabinet:' + c.id, x: c.x, y: c.y, z: c.z, angle: c.angle, state: c.state,
      })))
      + ('kind' in current ? '<div class="fixture-panel-actions"><button type="button" data-fixture-action="select-assembly">Select set</button>'
        + '<button type="button" data-fixture-action="duplicate-assembly">Duplicate set</button>'
        + '<button type="button" data-fixture-action="remove-assembly">Remove set</button></div>' : '');
    dom.$('#left-title').textContent = tab === 'type' ? 'Fixture type' : tab === 'size' ? 'Fixture size' : tab === 'finish' ? 'Finish' : 'Installation';
  }
  function open(next: FixturePanelTab = tab) {
    if (!item()) return;
    tab = next; hideCatalog(); takeMobilePanel(dom, panel);
    panel.dataset.roomResize = ''; panel.dataset.fixturePanel = ''; panel.dataset.contextSection = 'fixture'; panel.dataset.sheetPosition = 'compact';
    app.classList.add('props-open'); app.classList.remove('props-hidden', 'inspecting', 'adding');
    key = ''; render(); panel.scrollTop = 0;
  }
  const activeEnclosure = (current: StudioFixture | FixtureEnclosure) => {
    if (!('kind' in current)) return current;
    const a = current.anchor;
    return a.kind === 'enclosure' ? model.scene.studio?.enclosures?.find(e => e.id === a.enclosure) : undefined;
  };
  function patch(field: string, value: string | number) {
    const current = item(), s = model.scene.studio;
    if (!current || !s) return;
    if (field.startsWith('enclosure.')) {
      const e = activeEnclosure(current), k = field.slice(10);
      if (e) commands.commit({ ...s, enclosures: s.enclosures!.map(x => x.id === e.id ? { ...x, [k]: value } : x) });
    } else if (field.startsWith('installation.') && 'kind' in current && current.installation) {
      commands.update(current.id, { installation: { ...current.installation, [field.slice(13)]: value } });
    } else {
      const direct = ['w', 'h', 'd', 'color', 'status'].includes(field);
      const update = direct ? { [field]: value } : { anchor: { ...current.anchor, [field]: value } as FixtureAnchor };
      if ('kind' in current) commands.update(current.id, update);
      else commands.commit({ ...s, enclosures: s.enclosures!.map(x => x.id === current.id ? { ...x, ...update } as FixtureEnclosure : x) });
    }
    key = ''; refresh(); render();
  }
  function host(value: string) {
    const f = item(), s = model.scene.studio;
    if (!f || !s) return;
    const p = 'kind' in f ? fixturePose(s, f) : enclosurePose(s, f);
    if (!p) return;
    let a: FixtureAnchor;
    if (value === 'floor') a = { kind: 'floor', ...p };
    else if (value.startsWith('wall:')) {
      const w = s.walls.find(w => w.id === value.slice(5)), line = w && wallLine(s, w), face = w && wallFace(s, w);
      if (!w || !line || !face) return;
      a = { kind: 'wall', wall: w.id, offset: Math.max(face.start + f.w / 2, Math.min(face.end - f.w / 2,
        (p.x - line.a.x) * line.ux + (p.z - line.a.z) * line.uz)), y: p.y, gap: 0 };
    } else if (value.startsWith('enclosure:')) {
      const e = s.enclosures?.find(e => e.id === value.slice(10)), ep = e && enclosurePose(s, e);
      if (!e || !ep) return;
      const angle = ep.angle * Math.PI / 180, at = (p.x - ep.x) * Math.cos(angle) - (p.z - ep.z) * Math.sin(angle);
      a = { kind: 'enclosure', enclosure: e.id, offset: Math.max(-e.w / 2 + f.w / 2, Math.min(e.w / 2 - f.w / 2, at)), y: Math.max(0, p.y - ep.y) };
    }
    else {
      const host = s.fixtures?.find(x => x.id === value.slice(8));
      a = { kind: 'fixture', fixture: value.slice(8), x: 0, z: 'kind' in f && f.kind === 'faucet' && host ? -host.d / 2 + f.d / 2 + 1 : 0, lift: 0 };
    }
    if ('kind' in f) commands.move(f.id, a);
    else commands.commit({ ...s, enclosures: s.enclosures!.map(e => e.id === f.id ? { ...e, anchor: a as FixtureEnclosure['anchor'] } : e) });
  }
  listen(root, 'change', event => {
    const input = event.target as HTMLInputElement | HTMLSelectElement, current = item();
    if (!current) return;
    if (input.dataset.fixtureField) {
      const n = Number(input.value);
      if (input.value.trim() && Number.isFinite(n)) patch(input.dataset.fixtureField, input.dataset.fixtureField === 'angle' ? n : toCm(n, currentLengthUnit()));
    } else if (input.dataset.fixtureColorInput) patch(input.dataset.fixtureColorInput, input.value);
    else if (input.dataset.fixtureSelect) {
      const k = input.dataset.fixtureSelect;
      if (k === 'variant') commands.variant(current.id, input.value);
      else if (k === 'installation') commands.installation(current.id, input.value);
      else if (k === 'host') host(input.value);
      else if (k.startsWith('service.') && 'kind' in current) {
        const role = k.slice(8), links = (current.connections ?? []).filter(c => c.role !== role);
        commands.update(current.id, { connections: input.value ? [...links, { role, utility: input.value }] : links });
      } else patch(k, input.value);
    }
    key = ''; refresh(); render();
  });
  listen(root, 'keydown', e => { if ((e as KeyboardEvent).key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') (e.target as HTMLInputElement).blur(); });
  listen(root, 'click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-fixture-color],[data-fixture-accessory],[data-fixture-tab],[data-fixture-action]');
    if (b?.dataset.fixtureTab) { tab = b.dataset.fixtureTab as FixturePanelTab; key = ''; render(); }
    else if (b?.dataset.fixtureAction) act(b.dataset.fixtureAction);
    else if (b?.dataset.fixtureColor) patch(b.dataset.fixtureColor, b.dataset.color!);
    else if (b?.dataset.fixtureAccessory) add(b.dataset.fixtureAccessory);
  });
  function placement(): FixturePlacement {
    const s = model.scene.studio, sel = selection(), view = viewed();
    const f = sel?.kind === 'fixture' ? s?.fixtures?.find(f => f.id === sel.id) : undefined;
    const a = f?.anchor;
    return { wall: sel?.kind === 'wall' ? sel.id : a?.kind === 'wall' ? a.wall : view.placementWall,
      along: a?.kind === 'wall' ? a.offset : view.placementAlong, support: f?.id,
      enclosure: sel?.kind === 'enclosure' ? sel.id : a?.kind === 'enclosure' ? a.enclosure : undefined };
  }
  function add(kind: string, preset = false) {
    const id = preset ? commands.preset(kind, placement()) : commands.add(kind, placement());
    if (id) {
      hideCatalog(); select({ kind: 'fixture', id }); refresh(); open('installation');
      const s = model.scene.studio!, f = s.fixtures!.find(f => f.id === id)!, p = fixturePose(s, f)!;
      focus({ x: p.x, z: p.z, w: Math.max(180, f.w * 1.8), d: Math.max(150, f.d * 1.8), h: Math.max(180, p.y + f.h) }, p.angle * Math.PI / 180 + .25);
    }
  }
  const filterCatalog = () => {
    const pop = dom.$('#pop2'), q = pop.querySelector<HTMLInputElement>('[data-fixture-search]')?.value.toLowerCase().trim() ?? '';
    const category = pop.querySelector<HTMLSelectElement>('[data-fixture-filter]')?.value ?? '';
    pop.querySelectorAll<HTMLElement>('[data-fixture-search-text]').forEach(b => {
      b.hidden = !!((q && !b.dataset.fixtureSearchText!.toLowerCase().includes(q)) || (category && b.dataset.fixtureCategory !== category));
    });
  };
  listen(dom.$('#pop2'), 'click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-add-fixture],[data-fixture-preset],[data-add-enclosure]');
    if (b?.hasAttribute('data-add-enclosure')) {
      const id = commands.addEnclosure(placement());
      if (id) { hideCatalog(); select({ kind: 'enclosure', id }); refresh(); open('installation'); }
    } else if (b) add(b.dataset.addFixture ?? b.dataset.fixturePreset!, !!b.dataset.fixturePreset);
  });
  listen(dom.$('#pop2'), 'input', e => { if ((e.target as HTMLElement).matches('[data-fixture-search]')) filterCatalog(); });
  listen(dom.$('#pop2'), 'change', e => { if ((e.target as HTMLElement).matches('[data-fixture-filter]')) filterCatalog(); });
  const drag = createFixtureDrag({ model, commands, selection, point: e => picking.groundPoint(e), checkpoint: s => history.checkpoint(s), refresh, redraw });
  function act(action: string) {
    if (action === 'done') { dom.$('#left-close').click(); return; }
    if (action === 'undo' || action === 'redo') { dom.$(action === 'undo' ? '#undo2' : '#redo2').click(); return; }
    const s = selection(), f = item();
    if (!s || !f) return;
    if (action.startsWith('fixture-')) { open(action.slice(8) as FixturePanelTab); return; }
    if (s.kind === 'fixture') {
      if (action === 'select-assembly') { select({ ...s, assembly: true }); report('Assembly selected. Drag it to move the complete set.'); }
      if (action === 'remove' || action === 'remove-assembly') { if (commands.remove(s.id, action === 'remove-assembly')) select(null); }
      if (action === 'duplicate' || action === 'duplicate-assembly') { const id = commands.duplicate(s.id, action === 'duplicate-assembly'); if (id) select({ kind: 'fixture', id }); }
    } else if (action === 'remove' && model.scene.studio) {
      const room = model.scene.studio;
      if (room.fixtures?.some(f => f.anchor.kind === 'enclosure' && f.anchor.enclosure === s.id)) report('Reattach the fixtures using this enclosure before removing it.');
      else if (commands.commit({ ...room, enclosures: room.enclosures!.filter(e => e.id !== s.id) })) select(null);
    }
    refresh(); render();
  }
  const measures = () => {
    const f = item(), s = model.scene.studio;
    const p = f && s && ('kind' in f ? fixturePose(s, f) : enclosurePose(s, f));
    return f && p ? [{ a: localPose(p, -f.w / 2, f.h + 4, f.d / 2), b: localPose(p, f.w / 2, f.h + 4, f.d / 2), text: lengthWithUnit(f.w), edit: 'fixture-size' }] : [];
  };
  return { selected, render, open, act, drag, measures };
}
