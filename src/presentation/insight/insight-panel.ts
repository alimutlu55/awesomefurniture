import type { InsightPanelPorts } from './insight-panel.ports';
import { CREDIT_CURRENCIES, type CreditCurrency } from '../../domain/credits/credit-catalog';
import { mountMobileSheet } from '../editor/mobile-sheet.js';
import { animateMobileSheetClose } from '../editor/mobile-sheet-motion.js';
import { changesMarkup, findingsMarkup, passportMarkup, priceMarkup, statusMarkup } from './insight-markup';

/**
 * Insight: what the engine knows about the design, in one of the editor's panels. Check (every finding with its fix),
 * Price (the design built three ways), Passport (the numbers a workshop quotes by) and Changes (what changed, newest
 * first). Opened from the menu, where its item shows how many things stand in the way of building.
 *
 * The engine runs only while someone looks: when the menu opens (for its count) and, while the panel is open, after the
 * design has stayed the same for a moment (so a drag is never interrupted by a re-check).
 */

const TABS = ['check', 'price', 'passport', 'changes'] as const;
type Tab = typeof TABS[number];
const TAB_LABEL: Readonly<Record<Tab, string>> = { check: 'Check', price: 'Price', passport: 'Passport', changes: 'Changes' };
/** How often the open panel looks for a change, and how long a design must stay the same before it is re-checked. */
const POLL_MS = 400, SETTLE_MS = 600;
const ICON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>';

/** The currency prices start in, from the page's language: zloty in Polish, euro in the euro countries' languages, else dollars.
 * The person can change it in the Price tab. */
export function currencyForLanguage(language: string): CreditCurrency {
  const code = language.toLowerCase().split('-')[0];
  return code === 'pl' ? 'pln' : ['de', 'fr', 'es', 'pt', 'it', 'nl'].includes(code ?? '') ? 'eur' : 'usd';
}

export function bindInsightPanel(ports: InsightPanelPorts) {
  const { dom, lifetime, engine } = ports, doc = dom.host.ownerDocument, menu = dom.$('#menu');
  const item = doc.createElement('button');
  item.className = 'mi insight-item'; item.type = 'button'; item.setAttribute('role', 'menuitem'); item.setAttribute('aria-haspopup', 'dialog');
  item.innerHTML = ICON + '<span>Design check</span><b class="insight-count" hidden></b>';
  const group = menu.querySelector('[data-menu-group="design"]') ?? menu;
  group.insertBefore(item, group.querySelector('[data-editor-id="share-menu"]'));

  const panel = doc.createElement('div');
  panel.className = 'pop editor-panel insight';
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Design check');
  panel.innerHTML = '<div class="ph"><b>Design check</b><span class="pbtns"><button type="button" class="insight-close" aria-label="Close" title="Close">×</button></span></div>'
    + '<div class="in-head" role="status" aria-live="polite"></div>'
    + `<div class="in-tabs" role="tablist">${TABS.map(t => `<button type="button" role="tab" data-tab="${t}">${TAB_LABEL[t]}</button>`).join('')}</div>`
    + '<div class="in-body" role="tabpanel"></div>';
  dom.$('#app').append(panel);
  const docked = doc.defaultView?.matchMedia('(min-width:901px)') ?? { matches: true };
  mountMobileSheet({ document: doc, lifetime, panel, name: 'Design check', close: () => hide(), bottom: true, scene: dom.$('#app'), docked });
  const head = panel.querySelector<HTMLElement>('.in-head')!, body = panel.querySelector<HTMLElement>('.in-body')!;

  let tab: Tab = 'check', way = 0, currency: CreditCurrency = ports.currency, timer: ReturnType<typeof lifetime.timeout> = 0, seen = '', since = 0;
  const open = () => panel.classList.contains('show');

  /** Re-checks the design if it changed; true when the view needs drawing again. */
  function refresh(): boolean {
    return ports.scene().wardrobes.length ? engine.refresh(ports.scene()) : false;
  }
  function badge() {
    const e = engine.current()?.evaluation, count = item.querySelector<HTMLElement>('.insight-count')!;
    const n = e ? e.counts.blocking || e.counts.warning : 0;
    count.hidden = !e || !n;
    count.textContent = String(n);
    count.className = 'insight-count' + (e && e.counts.blocking ? ' bad' : '');
  }
  function draw() {
    const empty = !ports.scene().wardrobes.length, inspection = empty ? null : engine.current();
    head.innerHTML = statusMarkup(inspection?.evaluation ?? null);
    panel.querySelectorAll<HTMLElement>('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (!inspection) { body.innerHTML = ''; badge(); return; }
    if (tab === 'check') body.innerHTML = findingsMarkup(inspection.evaluation);
    if (tab === 'price') body.innerHTML = priceMarkup(engine.quotes(), way, currency, CREDIT_CURRENCIES);
    if (tab === 'passport') body.innerHTML = passportMarkup(inspection.passport);
    if (tab === 'changes') body.innerHTML = changesMarkup(engine.history(), Date.now());
    badge();
  }
  /** While open: re-check once the design has stayed the same for SETTLE_MS. */
  function poll() {
    timer = 0;
    if (!open()) return;
    const key = engine.keyOf(ports.scene()), now = Date.now();
    if (key !== seen) { seen = key; since = now; }
    else if (now - since >= SETTLE_MS && refresh()) draw();
    timer = lifetime.timeout(poll, POLL_MS);
  }
  function show() {
    ports.closeMenu();
    refresh();
    seen = engine.keyOf(ports.scene()); since = 0;
    draw();
    panel.dataset.sheetPosition = 'compact';
    panel.classList.add('show');
    item.setAttribute('aria-expanded', 'true');
    if (!timer) timer = lifetime.timeout(poll, POLL_MS);
  }
  function hide() {
    if (!open()) return;
    animateMobileSheetClose(panel);
    panel.classList.remove('show');
    item.setAttribute('aria-expanded', 'false');
    if (timer) { lifetime.cancelTimeout(timer); timer = 0; }
  }

  lifetime.listen(item, 'click', () => open() ? hide() : show());
  // Opening the menu brings its count up to date, just after the menu has opened (never delaying it).
  lifetime.listen(dom.$('#menu-btn'), 'click', () => { lifetime.timeout(() => { refresh(); badge(); }, 0); });
  lifetime.listen(panel, 'click', (event: Event) => {
    const target = event.target as HTMLElement;
    if (target.closest('.insight-close')) { hide(); return; }
    const tabButton = target.closest<HTMLElement>('[data-tab]');
    if (tabButton) { tab = tabButton.dataset.tab as Tab; draw(); return; }
    const wayButton = target.closest<HTMLElement>('[data-way]');
    if (wayButton) { way = Number(wayButton.dataset.way); draw(); return; }
    const money = target.closest<HTMLElement>('[data-currency]');
    if (money) { currency = money.dataset.currency as CreditCurrency; ports.setCurrency(currency); refresh(); draw(); return; }
    const fix = target.closest<HTMLElement>('[data-fix]');
    if (fix) {
      const finding = engine.current()?.evaluation.findings[Number(fix.dataset.finding)], action = finding?.fixes[Number(fix.dataset.fix)]?.action;
      if (!action || !ports.fix(action)) { ports.toast('The design changed. Check it again.'); }
      if (refresh()) draw();
    }
  });

  return { open: show, close: hide, refresh: () => { if (refresh()) draw(); } };
}
