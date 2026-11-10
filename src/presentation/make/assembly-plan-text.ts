import type { EditorScene } from '../../application/projects/editor-scene';
import { type AssemblyPlan, assemblyPlan, type PlanCheck, type PlanFix, type PlanStep } from '../../domain/make/assembly-plan';
import type { MakePiece } from '../../domain/make/make-parts';
import { roomHeight } from '../../domain/studio/studio';
import { hardwareDisplay } from './make-panel-tabs';

/**
 * The assembly plan (domain/make/assembly-plan.ts) in words and markup: what Assembly Studio's guidance shows for the
 * step on screen, the card before the first step, and the lines the PDF prints. One wording for all three.
 */

/** The plan for a piece as it stands in the scene: under its room's ceiling, when it is in a room. */
export function planFor(piece: MakePiece, scene: EditorScene): AssemblyPlan {
  const room = scene.studio, wall = piece.piece.wall ? room?.walls.find(w => w.id === piece.piece.wall) : undefined;
  const height = room ? wall?.height ?? roomHeight(room) : undefined;
  return assemblyPlan(piece, { ceiling: height !== undefined && Number.isFinite(height) ? height : undefined });
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** A time someone plans by: minutes under an hour, then hours and quarters. */
export const duration = (minutes: number) => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 >= 8 ? ' ' + Math.round(minutes % 60 / 15) * 15 % 60 + ' min' : ''}`.replace(' 0 min', '');
const people = (n: number) => n === 1 ? '1 person' : n + ' people';
const figures = (values: readonly number[]) => values.map(v => String(v)).join(', ');

/** What a fix is, counted: "3 × Connector screw 7 × 50". */
export function fixName(f: PlanFix): string {
  const shown = hardwareDisplay({ kind: f.kind, ...(f.size ? { size: f.size } : {}) });
  return `${f.qty} × ${shown.name}${shown.size ? ' ' + shown.size : ''}`;
}
/** Which parts it joins or sits on: "through part 2 into part 4", "on part 9". */
export function fixParts(f: PlanFix): string {
  if (!f.parts.length) return '';
  if (f.kind === 'nail') return 'through part ' + f.parts[0];
  if (f.parts.length !== 2) return 'on part' + (f.parts.length > 1 ? 's ' : ' ') + f.parts.join(', ');
  // A screw goes through the first part into the second; a dowel, a bolt or a cam sits between the two.
  return f.kind === 'confirmat' || f.kind === 'screw' ? `through part ${f.parts[0]} into part ${f.parts[1]}` : `between part ${f.parts[0]} and part ${f.parts[1]}`;
}
/** Where to put the tape: "50, 297.5, 545 mm from the back edge of part 2, on a line 89 mm from its bottom edge". */
export function fixSetOut(f: PlanFix): string {
  if (!f.at) return '';
  return `${figures(f.at.mm)} mm from the ${f.at.from} of part ${f.at.on}` + (f.at.line ? `, on a line ${f.at.line.mm} mm from its ${f.at.line.from}` : '');
}
export const fixHeld = (f: PlanFix) => f.with.length ? 'Held by ' + f.with.map(w => `${w.qty} × ${w.size}`).join(' and ') : '';
export const checkLine = (c: PlanCheck) => c.text + (c.value === undefined ? '' : `: ${c.value} mm` + (c.tolerance ? `, within ${c.tolerance} mm` : '')) + '.';

/** A step as plain lines, for paper: its heading, each board going in with what fixes it, the hardware, the checks. */
export function stepLines(step: PlanStep): { readonly text: string; readonly level: 0 | 1 | 2 }[] {
  const out: { text: string; level: 0 | 1 | 2 }[] = [{ text: `${step.n}. ${step.title}  ·  about ${duration(step.minutes)}  ·  ${people(step.people)}`, level: 0 }];
  const fix = (f: PlanFix) => {
    out.push({ text: [fixName(f), fixParts(f), fixSetOut(f)].filter(Boolean).join(' · '), level: 2 });
    const more = [fixHeld(f), f.note].filter(Boolean).join('. ');
    if (more) out.push({ text: more, level: 2 });
  };
  for (const p of step.places) { out.push({ text: p.text, level: 1 }); step.fixes.filter(f => f.after === p.board).forEach(fix); }
  step.fixes.filter(f => f.after === undefined).forEach(fix);
  for (const c of step.checks) out.push({ text: 'Check: ' + checkLine(c), level: 1 });
  return out;
}

/** Before the first step: how it is built, how many hands, how long, and the tools. */
export function overviewMarkup(plan: AssemblyPlan): string {
  return `<div class="as-plan-start"><b>Before you start</b><span>${people(plan.people)} · about ${duration(plan.minutes)} · ${plan.steps.length} steps</span>`
    + `<p>${esc(plan.method.text)}</p><ul>${plan.tools.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
}

/** The step on screen, written out: each board in turn with the joints that fix it, the hardware fitted, what to check. */
export function stepMarkup(step: PlanStep): string {
  const fix = (f: PlanFix) => {
    const where = [fixParts(f), fixSetOut(f)].filter(Boolean).join(' · ');
    return `<li class="as-plan-fix"><b translate="no">${esc(fixName(f))}</b>${where ? `<span translate="no">${esc(where)}</span>` : ''}`
      + `${f.how ? `<small>${esc(f.how)}</small>` : ''}${fixHeld(f) ? `<small translate="no">${esc(fixHeld(f))}</small>` : ''}${f.note ? `<small>${esc(f.note)}</small>` : ''}</li>`;
  };
  const placed = step.places.map(p => {
    const mine = step.fixes.filter(f => f.after === p.board);
    return `<li>${esc(p.text)}${mine.length ? `<ul>${mine.map(fix).join('')}</ul>` : ''}</li>`;
  }).join('');
  const fitted = step.fixes.filter(f => f.after === undefined).map(fix).join('');
  const checks = step.checks.map(c => `<li>${esc(checkLine(c))}</li>`).join('');
  return `<div class="as-plan"><div class="as-plan-meta"><span>About ${duration(step.minutes)}</span><span>${people(step.people)}</span></div>`
    + (placed ? `<ol class="as-plan-places">${placed}</ol>` : '')
    + (fitted ? `<ul class="as-plan-fitted">${fitted}</ul>` : '')
    + (checks ? `<div class="as-plan-checks"><b>Check before going on</b><ul>${checks}</ul></div>` : '') + '</div>';
}
