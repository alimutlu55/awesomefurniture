import { TOOLS } from '../../domain/hardware/tools';
import { drawerHand, type StepNotes } from '../../domain/make/make-instructions';
import type { MakePart, MakePiece } from '../../domain/make/make-parts';
import { hardwareDisplay } from './make-panel-tabs';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** A hardware count as a step lists it: name, size, how many. */
export function countText(c: { kind: Parameters<typeof hardwareDisplay>[0]['kind']; size?: string; qty: number }) {
  const d = hardwareDisplay(c);
  return `${d.name}${d.size ? ' ' + d.size : ''} ×${c.qty}`;
}
/** A part as a step names it: its number, its name, and which side of its drawer it is. */
export function partText(piece: MakePiece, part: MakePart) {
  const hand = drawerHand(piece, part);
  return `${part.n} · ${part.name}${hand ? ` (${hand === 'both' ? 'left or right' : hand})` : ''}`;
}
/** A runner's place, as its step writes it. */
export const runnerText = (r: StepNotes['runners'][number]) =>
  `Part ${r.part}, ${r.face} face: holes ${r.up} mm up from its lower end; screws ${r.screws.join(' and ')} mm and the peg ${r.peg} mm back from its front edge.`;

/**
 * The step's notes as the Studio's guidance shows them, the way a flat-pack manual frames each step: the tools first,
 * what one drawer takes (and for how many), where each runner goes, and what not to do, crossed out.
 */
export function notesHtml(notes: StepNotes): { tools: string; rest: string } {
  const tools = notes.tools.map(t => `<span title="${esc(TOOLS[t].name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${TOOLS[t].icon}"/></svg>${esc(TOOLS[t].name)}</span>`).join('');
  const kits = notes.kits.map(k => `<p class="as-kit"><b>${k.drawers > 1 ? `Each of ${k.drawers} drawers` : 'One drawer'}:</b> ${k.each.map(c => esc(countText(c))).join(' · ')}</p>`).join('');
  const runners = notes.runners.length ? `<ul class="as-places">${notes.runners.map(r => `<li>${esc(runnerText(r))}</li>`).join('')}</ul>` : '';
  const avoid = notes.avoid.length ? `<ul class="as-avoid">${notes.avoid.map(a => `<li><span aria-hidden="true">✕</span>${esc(a)}</li>`).join('')}</ul>` : '';
  return { tools: tools ? `<div class="as-tools" aria-label="Tools">${tools}</div>` : '', rest: kits + runners + avoid };
}
