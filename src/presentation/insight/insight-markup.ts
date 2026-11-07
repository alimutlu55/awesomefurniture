import type { ChangeEntry } from '../../application/engine/engine-service';
import type { Quote, QuoteGroup } from '../../domain/engine/catalog/quote';
import type { Passport } from '../../domain/engine/passport';
import type { EngineFinding, Evaluation, Fix, Severity } from '../../domain/engine/rules/engine-rules';
import type { CreditCurrency } from '../../domain/credits/credit-catalog';

/** The Insight panel's markup, from the engine's data. Pure: strings in, strings out; every text from data is escaped. */

export const escape = (value: string) => value.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/** An amount the way its buyers write it: zloty the Polish way, any other currency in the reader's format. */
export const money = (amount: number, currency: string, digits = 0) => new Intl.NumberFormat(currency === 'pln' ? 'pl-PL' : undefined,
  { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: digits, minimumFractionDigits: digits }).format(amount);

export const hours = (minutes: number) => minutes < 90 ? Math.round(minutes) + ' min' : Math.round(minutes / 6) / 10 + ' h';

const SEVERITY: Readonly<Record<Severity, { label: string; plural: string }>> = {
  blocking: { label: 'Must fix', plural: 'to fix before building' },
  warning: { label: 'Check', plural: 'to check' },
  advice: { label: 'Note', plural: 'notes' },
};

/** The headline: ready to build, or what stands in the way. */
export function statusMarkup(e: Evaluation | null): string {
  if (!e) return '<p class="in-status">Add furniture to check it.</p>';
  if (!e.findings.length) return '<p class="in-status ok"><i class="in-dot"></i><b>Ready to build</b><span>Manufacturing, drilling and loads checked.</span></p>';
  const parts = (['blocking', 'warning', 'advice'] as const).filter(s => e.counts[s]).map(s => `${e.counts[s]} ${SEVERITY[s].plural}`);
  return `<p class="in-status ${e.ready ? 'warn' : 'bad'}"><i class="in-dot"></i><b>${e.ready ? 'Can be built' : 'Not ready to build'}</b><span>${parts.join(' · ')}</span></p>`;
}

function fixButton(f: Fix, finding: number, k: number): string {
  const primary = f.action.kind !== 'select-piece';
  return `<button type="button" class="${primary ? 'in-fix primary' : 'in-fix'}" data-finding="${finding}" data-fix="${k}">${escape(f.label)}</button>`;
}

function meter(f: EngineFinding): string {
  if (!f.measured || !f.limit || f.measured.unit !== f.limit.unit || f.limit.value <= 0) return '';
  const share = f.measured.value / f.limit.value;
  return `<span class="in-meter" title="${escape(f.measured.value + ' of ' + f.limit.value + ' ' + f.limit.unit)}"><i style="width:${Math.min(100, share * 100)}%"></i></span>`;
}

/** Findings with the same severity and words (three shelves of one bay, each too long) show as one card with a count. */
function grouped(e: Evaluation): { finding: EngineFinding; index: number; count: number }[] {
  const out: { finding: EngineFinding; index: number; count: number }[] = [];
  e.findings.forEach((finding, index) => {
    const same = out.find(g => g.finding.severity === finding.severity && g.finding.title === finding.title);
    if (same) same.count++; else out.push({ finding, index, count: 1 });
  });
  return out;
}

export function findingsMarkup(e: Evaluation | null): string {
  if (!e) return '';
  if (!e.findings.length) return '<p class="in-empty">Nothing to fix. Every board is within the stock sheet, every shelf within its span and load, every hole clear of the next.</p>';
  return '<ul class="in-findings">' + grouped(e).map(({ finding: f, index: i, count }) => `<li class="in-finding ${f.severity}">
    <span class="in-tag">${SEVERITY[f.severity].label}${count > 1 ? ` <em>× ${count}</em>` : ''}</span><b>${escape(f.title)}</b>${meter(f)}
    <small>${escape(f.why)}</small>${f.fixes.length ? `<span class="in-fixes">${f.fixes.map((x, k) => fixButton(x, i, k)).join('')}</span>` : ''}</li>`).join('') + '</ul>';
}

const GROUP_LABEL: Readonly<Record<QuoteGroup, string>> = { boards: 'Boards', edging: 'Edge banding', hardware: 'Hardware', services: 'Panel shop', labour: 'Workshop' };

export function priceMarkup(quotes: readonly Quote[], chosen: number, currency: CreditCurrency, currencies: readonly CreditCurrency[]): string {
  if (!quotes.length) return '';
  const q = quotes[Math.min(chosen, quotes.length - 1)]!;
  const symbols: Readonly<Record<CreditCurrency, string>> = { pln: 'zł', eur: '€', usd: '$' };
  const lines = (Object.keys(GROUP_LABEL) as QuoteGroup[]).filter(g => q.groups[g] > 0).map(g => `<details class="in-group"><summary><span>${GROUP_LABEL[g]}</span>`
    + `<b>${money(q.groups[g], currency)}</b></summary><table>${q.lines.filter(l => l.group === g).map(l => `<tr><td>${escape(l.label)}</td>`
    + `<td>${escape(l.qty + ' ' + l.unit)}</td><td>${money(l.total, currency)}</td></tr>`).join('')}</table></details>`).join('');
  return `<div class="in-currency" role="radiogroup" aria-label="Currency">${currencies.map(c => `<button type="button" role="radio" data-currency="${c}" aria-checked="${c === currency}">${symbols[c]}</button>`).join('')}</div>
    <div class="in-ways" role="radiogroup" aria-label="Who builds it">${quotes.map((x, i) => `<button type="button" role="radio" class="in-way" data-way="${i}" aria-checked="${i === chosen}">
      <span>${escape(x.profile.label)}</span><b>${money(x.total, currency)}</b><small>${x.ownMinutes ? 'about ' + hours(x.ownMinutes) + ' of your time' : 'no time of yours'}</small></button>`).join('')}</div>
    <p class="in-sub">${escape(q.profile.summary)}</p>${lines}
    <p class="in-note">Estimate before VAT from a price list dated ${escape(q.asOf)}. Boards are charged by the sheets the cut layout uses, so a design that saves a sheet saves its price.</p>`;
}

export function passportMarkup(p: Passport | null): string {
  if (!p || !p.pieces) return '';
  const stat = (value: string, label: string) => `<div class="in-stat"><b>${value}</b><span>${label}</span></div>`;
  const hardest = p.hardest ? `<p class="in-sub">Hardest working part: ${Math.round(p.hardest.utilisation * 100)}% of its limit (${escape(p.hardest.kind.replace('-', ' '))}).</p>` : '';
  return `<div class="in-stats">${[
    stat(String(p.parts), p.parts === 1 ? 'part' : 'different parts'), stat(String(p.boards), 'boards'),
    stat(p.sheets + ' · ' + Math.round(p.yield * 100) + '%', 'sheets · yield'), stat(p.edgeBandingM + ' m', 'edge banding'),
    stat(String(p.holes), 'holes'), stat(String(p.hardwareCount), 'hardware items'),
    stat(Math.round(p.kg) + ' kg', 'empty weight'), stat(Math.round(p.contentsKg) + ' kg', 'planned contents'),
    stat(hours(p.assemblyMinutes), 'to assemble'),
  ].join('')}</div>${hardest}<p class="in-note">Counted from the parts Make builds: the same boards, holes and hardware as the cutting list and drawings.</p>`;
}

export function changesMarkup(entries: readonly ChangeEntry[], now: number): string {
  if (!entries.length) return '<p class="in-empty">Changes appear here as you design.</p>';
  const ago = (at: number) => { const s = Math.round((now - at) / 1000); return s < 45 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago'; };
  return '<ol class="in-changes">' + [...entries].reverse().map(e => `<li><time>${ago(e.at)}</time>${e.changes.map(c => `<span>${escape(c.text)}</span>`).join('')}</li>`).join('') + '</ol>';
}
