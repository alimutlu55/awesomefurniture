import { POSSESSIONS, possessionIcon } from '../../domain/wardrobe/possessions';
import { PERSONAS, SPACES, countBelongings, personaBelongings, space as spaceById, type Belongings, type Space } from './spaces';
import { spaceArt } from './space-art';
import type { ExperienceDocument, ExperienceLifetime } from './lifetime.ports';

export interface WelcomePorts {
  /** The editor's own element, which the welcome lies over. */
  readonly container: HTMLElement;
  readonly document: ExperienceDocument;
  readonly lifetime: ExperienceLifetime;
  /** The page's window, for observing the welcome's size. */
  readonly view: (Window & typeof globalThis) | null;
  /** Shows the space in 3D behind the welcome, its wardrobes still empty. */
  preview(space: Space): void;
  /** Starts building ahead, so Build answers at once. */
  prepare(space: Space, belongings: Belongings): void;
  /** Builds the design and shows it going together; answers why not when it cannot be built. */
  build(space: Space, belongings: Belongings): Promise<{ ok: true } | { ok: false; message: string }>;
  /** The person starts without it: back to the design as it was. */
  skip(): void;
  /** Where the welcome is drawn changed: the editor keeps the room in view beside or above it. */
  layout(rect: DOMRect | null): void;
}

const icon = (path: string) => '<svg class="xp-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const BUILD_ICON = 'M4 20h16M6 20V9l6-5 6 5v11M10 20v-6h4v6';
const BUSY = ['Measuring the space…', 'Planning thousands of layouts…', 'Choosing rails, drawers and shelves…', 'Cutting the boards…'];

/**
 * The welcome: where will the wardrobe live, what goes inside, then Build. The room shows in 3D behind it as a
 * space is chosen; the design itself is planned by Auto design for exactly what was counted, built ahead while
 * the person counts, and assembled in front of them.
 */
export function createWelcome(ports: WelcomePorts) {
  const { document: doc, lifetime } = ports, listen = lifetime.listen;
  let step: 'space' | 'things' | 'building' = 'space', chosen: Space = SPACES[0]!, persona = 'everyday', belongings = personaBelongings(persona);
  let open = false, prepareTimer: unknown = null;
  const root = doc.createElement('section');
  root.className = 'xp-welcome';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-labelledby', 'xp-welcome-title');
  root.innerHTML = `<div class="xp-sheet" tabindex="-1">
    <header class="xp-head"><span class="xp-brand">Wardrobe Forge</span>
      <ol class="xp-steps" aria-label="Steps"><li data-for="space">Space</li><li data-for="things">Belongings</li><li data-for="building">Build</li></ol>
      <button type="button" class="xp-skip">Start empty</button></header>
    <div class="xp-body">
      <div class="xp-step" data-step="space">
        <h1 class="xp-title" id="xp-welcome-title">Tell us what you own.<em>We’ll build the wardrobe around it.</em></h1>
        <p class="xp-lede">First, where will it live?</p>
        <div class="xp-spaces" role="radiogroup" aria-label="Space">${SPACES.map(s => `<button type="button" class="xp-space" role="radio" data-space="${s.id}" aria-checked="false">
          ${spaceArt(s.id)}<b>${esc(s.name)}</b><small>${esc(s.line)}</small></button>`).join('')}</div>
      </div>
      <div class="xp-step" data-step="things" hidden>
        <h1 class="xp-title" tabindex="-1">What goes inside?<em>Rough counts are fine. You can change them any time.</em></h1>
        <div class="xp-personas" role="radiogroup" aria-label="Start from">${PERSONAS.map(p => `<button type="button" role="radio" data-persona="${p.id}" aria-checked="false">${esc(p.name)}</button>`).join('')}</div>
        <ul class="xp-things">${POSSESSIONS.map(p => `<li class="xp-thing" data-thing="${p.key}">${icon(possessionIcon(p))}<span>${esc(p.label)}</span>
          <div class="xp-count"><button type="button" data-step-by="-1" aria-label="Fewer ${esc(p.label.toLowerCase())}">−</button>
          <input type="number" inputmode="numeric" min="0" max="${p.need.max}" aria-label="${esc(p.label)}"><button type="button" data-step-by="1" aria-label="More ${esc(p.label.toLowerCase())}">+</button></div></li>`).join('')}</ul>
      </div>
      <div class="xp-step xp-building" data-step="building" hidden>
        <div class="xp-loom" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <h1 class="xp-title" tabindex="-1">Building your wardrobe</h1><p class="xp-lede xp-busy" role="status" aria-live="polite"></p>
      </div>
      <p class="xp-problem" role="alert" hidden></p>
    </div>
    <footer class="xp-foot"><span class="xp-total" aria-live="polite"></span>
      <button type="button" class="xp-back">Back</button><button type="button" class="xp-next"></button></footer>
  </div>`;
  ports.container.append(root);
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as T;
  const $$ = <T extends Element = HTMLElement>(s: string) => [...root.querySelectorAll(s)] as T[];

  function render() {
    for (const el of $$('.xp-step')) el.hidden = el.dataset.step !== step;
    const order = ['space', 'things', 'building'];
    for (const li of $$('.xp-steps li')) {
      const k = order.indexOf(li.dataset.for!), at = order.indexOf(step);
      li.classList.toggle('done', k < at);
      if (k === at) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    }
    for (const b of $$('.xp-space')) b.setAttribute('aria-checked', String(b.dataset.space === chosen.id));
    for (const b of $$('[data-persona]')) b.setAttribute('aria-checked', String(b.dataset.persona === persona));
    for (const li of $$('.xp-thing')) {
      const input = li.querySelector('input')!, value = String(belongings[li.dataset.thing!] ?? 0);
      if (input.value !== value && doc.activeElement !== input) input.value = value;
      li.classList.toggle('none', !(belongings[li.dataset.thing!] ?? 0));
    }
    const total = countBelongings(belongings);
    $('.xp-total').textContent = step === 'things' ? `${total} ${total === 1 ? 'thing' : 'things'} to find a home for` : step === 'space' ? chosen.line : '';
    $('.xp-back').hidden = step !== 'things';
    $('.xp-next').innerHTML = step === 'space' ? 'Next: what goes inside' : icon(BUILD_ICON) + 'Build my wardrobe';
    $('.xp-next').hidden = step === 'building';
    $('.xp-skip').hidden = step === 'building';
    root.dataset.step = step;
  }
  function go(next: typeof step) {
    step = next;
    $('.xp-problem').hidden = true;
    render();
    $('.xp-body').scrollTop = 0;
    if (next === 'things') { warm(0); ($('[data-step="things"] .xp-title')).focus({ preventScroll: true }); }
    queueLayout();
  }
  /** Builds the current choice ahead, a moment after the counting stops. */
  function warm(delay = 450) {
    lifetime.cancelTimeout(prepareTimer);
    prepareTimer = lifetime.timeout(() => ports.prepare(chosen, belongings), delay);
  }
  function setCount(key: string, value: number) {
    const p = POSSESSIONS.find(x => x.key === key);
    if (!p) return;
    belongings = { ...belongings, [key]: Math.max(0, Math.min(p.need.max, Math.round(Number.isFinite(value) ? value : 0))) };
    persona = '';
    render();
    warm();
  }
  async function build() {
    if (!countBelongings(belongings)) { problem('Count at least one thing to plan for.'); return; }
    go('building');
    let k = 0;
    const busy = $('.xp-busy'), tick = () => { if (step === 'building') { busy.textContent = BUSY[k++ % BUSY.length]!; lifetime.timeout(tick, 1100); } };
    tick();
    const result = await ports.build(chosen, belongings);
    if (result.ok) { close(); return; }
    go('things');
    problem(result.message);
  }
  function problem(message: string) {
    const p = $('.xp-problem');
    p.textContent = message;
    p.hidden = false;
  }

  listen(root, 'click', e => {
    const target = e.target as HTMLElement;
    const card = target.closest<HTMLElement>('.xp-space');
    if (card) { chosen = spaceById(card.dataset.space!); render(); ports.preview(chosen); return; }
    const chip = target.closest<HTMLElement>('[data-persona]');
    if (chip) { persona = chip.dataset.persona!; belongings = personaBelongings(persona); render(); warm(); return; }
    if (target.closest('.xp-next')) { if (step === 'space') go('things'); else void build(); return; }
    if (target.closest('.xp-back')) { go('space'); return; }
    if (target.closest('.xp-skip')) { close(); ports.skip(); }
  });
  // Press and hold − or + to count quickly: it repeats, faster the longer it is held.
  let hold: unknown = null;
  const release = () => { lifetime.cancelTimeout(hold); hold = null; };
  listen(root, 'pointerdown', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-step-by]');
    if (!b) return;
    e.preventDefault();
    const key = b.closest<HTMLElement>('.xp-thing')!.dataset.thing!, by = Number(b.dataset.stepBy);
    let wait = 380, repeats = 0;
    const bump = () => { setCount(key, (belongings[key] ?? 0) + by * (repeats > 12 ? 5 : 1)); repeats++; hold = lifetime.timeout(bump, wait); wait = Math.max(45, wait * .78); };
    bump();
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) listen(root, type, release);
  listen(root, 'keydown', e => {
    const k = e as KeyboardEvent, b = (k.target as HTMLElement).closest?.<HTMLElement>('[data-step-by]');
    if (b && (k.key === 'Enter' || k.key === ' ')) { k.preventDefault(); const key = b.closest<HTMLElement>('.xp-thing')!.dataset.thing!; setCount(key, (belongings[key] ?? 0) + Number(b.dataset.stepBy)); }
    if (k.key === 'Escape' && step !== 'building') { close(); ports.skip(); }
  });
  listen(root, 'input', e => {
    const input = e.target as HTMLInputElement, row = input.closest<HTMLElement>('.xp-thing');
    if (row && input.value !== '') setCount(row.dataset.thing!, Number(input.value));
  });
  listen(root, 'focusout', e => { if ((e.target as HTMLElement).matches('.xp-thing input')) render(); });

  let layoutFrame: unknown = null;
  function queueLayout() {
    lifetime.cancelFrame(layoutFrame);
    layoutFrame = lifetime.frame(() => ports.layout(open ? $('.xp-sheet').getBoundingClientRect() : null));
  }
  const Observer = ports.view?.ResizeObserver;
  if (Observer) lifetime.observe(new Observer(queueLayout), root);

  function show() {
    if (open) return;
    open = true;
    step = 'space';
    root.hidden = false;
    ports.container.classList.add('xp-welcoming');
    render();
    root.classList.remove('leaving');
    ports.preview(chosen);
    queueLayout();
    ($('.xp-sheet')).focus({ preventScroll: true });
  }
  function close() {
    if (!open) return;
    open = false;
    lifetime.cancelTimeout(prepareTimer);
    root.classList.add('leaving');
    ports.container.classList.remove('xp-welcoming');
    lifetime.timeout(() => { if (!open) root.hidden = true; }, 420);
    ports.layout(null);
  }
  return { open: show, close, isOpen: () => open, dispose() { root.remove(); } };
}
