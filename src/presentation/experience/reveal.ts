import { POSSESSIONS, possessionIcon } from '../../domain/wardrobe/possessions';
import type { SceneReport } from '../../application/spec/describe-scene';
import type { ExperienceDocument, ExperienceLifetime } from './lifetime.ports';

/** What a design holds of what was asked, summed over its wardrobes, possession by possession. Pure. */
export function fitSummary(report: Pick<SceneReport, 'wardrobes'>) {
  const rows = POSSESSIONS.map(p => {
    let asked = 0, holds = 0;
    for (const w of report.wardrobes) { asked += w.holds[p.key]?.asked ?? 0; holds += w.holds[p.key]?.holds ?? 0; }
    return { possession: p, asked, holds };
  }).filter(r => r.asked > 0);
  const asked = rows.reduce((s, r) => s + r.asked, 0), placed = rows.reduce((s, r) => s + Math.min(r.asked, r.holds), 0);
  const spare = rows.reduce((s, r) => s + Math.max(0, r.holds - r.asked), 0), short = rows.filter(r => r.holds < r.asked);
  return { rows, asked, placed, spare, short, all: !short.length };
}

export interface RevealPorts {
  readonly container: HTMLElement;
  readonly document: ExperienceDocument;
  readonly lifetime: ExperienceLifetime;
  night(): void;
  workshop(): void;
  autoDesign(): void;
}

const MOON = 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z', PLAN = 'M4 4h16v16H4zM4 9h16M9 9v11M13 13h4M13 16h4', SPARK = 'M5 19 17 7M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z';
const svg = (d: string) => `<svg class="xp-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

/** The moment a built design lands: how much of what was counted has a place, and where to go next. */
export function createReveal(ports: RevealPorts) {
  const { document: doc, lifetime } = ports;
  const card = doc.createElement('aside');
  card.className = 'xp-reveal';
  card.hidden = true;
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');
  ports.container.append(card);
  let hideTimer: unknown = null;

  function show(report: Pick<SceneReport, 'wardrobes'>) {
    const s = fitSummary(report);
    if (!s.rows.length) return;
    const lacking = s.short.map(r => `${r.asked - r.holds} ${r.possession.label.toLowerCase()}`).join(', ');
    const title = s.all ? 'Everything fits.' : s.placed / s.asked > .9 ? 'Almost everything fits.' : 'Most things fit.';
    const line = s.all
      ? `All ${s.asked} things have a place${s.spare ? `, with room for ${s.spare} more` : ''}.`
      : `Room for ${s.placed} of ${s.asked}. Still to place: ${lacking}.`;
    card.innerHTML = `<button type="button" class="xp-reveal-close" aria-label="Close">×</button>
      <p class="xp-kicker">${report.wardrobes.length > 1 ? `${report.wardrobes.length} wardrobes` : 'Your wardrobe'}, planned</p>
      <h2>${title}</h2><p class="xp-line">${line}</p>
      <ul>${s.rows.map((r, k) => `<li style="--d:${k * 70}ms" class="${r.holds < r.asked ? 'short' : ''}">${svg(possessionIcon(r.possession))}<span>${r.possession.label}</span>
        <b>${Math.min(r.holds, r.asked)}<small>/${r.asked}</small></b><i><i style="width:${Math.min(100, r.holds / r.asked * 100)}%"></i></i></li>`).join('')}</ul>
      <div class="xp-reveal-actions">${s.all ? '' : `<button type="button" data-go="auto">${svg(SPARK)}More layouts</button>`}
        <button type="button" data-go="night">${svg(MOON)}See it at night</button><button type="button" data-go="workshop">${svg(PLAN)}Workshop</button>
        <button type="button" class="xp-primary" data-go="close">Keep designing</button></div>`;
    card.classList.toggle('all', s.all);
    card.hidden = false;
    card.classList.remove('leaving');
  }
  function hide() {
    if (card.hidden) return;
    card.classList.add('leaving');
    lifetime.cancelTimeout(hideTimer);
    hideTimer = lifetime.timeout(() => { card.hidden = true; card.classList.remove('leaving'); }, 320);
  }
  lifetime.listen(card, 'click', e => {
    const go = (e.target as HTMLElement).closest<HTMLElement>('[data-go],.xp-reveal-close');
    if (!go) return;
    const where = go.dataset.go;
    if (where === 'night') ports.night();
    if (where === 'workshop') ports.workshop();
    if (where === 'auto') ports.autoDesign();
    hide();
  });
  /** Gives keyboard focus to Keep designing (after the welcome closed under it). */
  const focus = () => card.querySelector<HTMLElement>('.xp-primary')?.focus({ preventScroll: true });
  return { show, hide, focus, isOpen: () => !card.hidden, dispose() { card.remove(); } };
}
