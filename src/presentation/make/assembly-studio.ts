import { assemblyStageSpec } from '../../domain/hardware/hardware-registry';
import type { MakePiece } from '../../domain/make/make-parts';
import type { Stage } from '../../domain/make/make-assembly';
import type { MakePlayer } from './make-player';
import { fittingIcon, hardwareDisplay } from './make-panel-tabs';
import { chapterPreview } from './assembly-preview';
import { notesHtml, partText } from './assembly-notes';
import { stepNotes } from '../../domain/make/make-instructions';
import { unitSuffix } from '../editor/length-unit-state';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const names: Record<Stage, string> = { plinth: 'Foundation', carcass: 'Structure', partitions: 'Partitions', top: 'Top', back: 'Back', inside: 'Shelves & interior',
  'drawer-boxes': 'Drawer fronts & bottoms', 'drawer-sides': 'Drawer sides', 'drawer-back': 'Drawer backs', 'drawer-runners': 'Mount drawer runners',
  'cargo-frame': 'Prepare cargo frame', 'cargo-baskets': 'Hook on cargo baskets', drawers: 'Put the drawers on', 'drawer-lock': 'Lock the drawers', 'drawer-test': 'Test drawer travel', fronts: 'Fronts', doors: 'Doors', wall: 'Finishing' };
const cargoNames: Partial<Record<Stage, string>> = {
  'drawer-runners': 'Mount cargo slides (374 mm spacing)',
  'cargo-frame': 'Prepare cargo frame & slide brackets',
  'cargo-baskets': 'Hook on baskets & Separatory dividers',
  drawers: 'Insert & lock cargo mechanism (M4×6)',
  fronts: 'Mount, couple & 3D-adjust cargo front',
  'drawer-test': 'Test 430–450 mm extension & soft-close',
};
const instructions: Record<Stage, string> = {
  'cargo-frame': 'Stand the steel cargo frame outside the cabinet. Clip the 4 slide brackets (Mocowanie do prowadnicy) onto basket wires 2–3 (16 / 64 mm) and rear wires 16–17 (192 mm span) at the lower and upper slide levels.',
  'cargo-baskets': 'Rest each wire basket (Kosz 150/200, max load 15 kg) on its front support, lower the rear hooks onto the frame, and clip the 2 transverse wire dividers (Separatory) downward onto the basket gallery rails.',
  plinth: 'Join the plinth and base supports. Keep the frame square and level.',
  carcass: 'Position the base, then bring the side panels into place. Align the prepared holes before securing the joints.',
  partitions: 'Align each partition with the base. Secure the joints while keeping the panels upright.',
  top: 'Lower the top onto the uprights, align the edges and secure each connection.',
  back: 'Square the cabinet, then fit the back using the selected back fixing.',
  inside: 'Fit the supports at matching heights, then position the shelves and interior components.',
  'drawer-boxes': 'Lay each drawer front face down on a soft mat. Screw the cam bolts into its inner face, then slide the bottom into the front\'s groove: the same gap at both ends. Do not bend the bottom.',
  'drawer-sides': 'Tap the wooden dowels in. Set each side over the cam bolts and dowels with the bottom in its groove, then turn the cams clockwise to pull the joint tight.',
  'drawer-back': 'Hook the back\'s groove over the edge of the bottom, swing the back into place against the sides, and hammer the expanding dowels through it into the sides.',
  'drawer-runners': 'Hook each runner\'s rear peg into its 5 mm hole, level the rail, and fix its front bracket with two 4 × 12 mm screws in the pilot holes. Nothing is screwed to the drawer.',
  drawers: 'Pull both runners out. Lay a locking plate over each front pin, hook the drawer back onto the rear hooks, and lower the front so the pins come up through the bottom and plates.',
  'drawer-lock': 'Under each drawer, screw a locking lever up onto each front pin and turn it until it locks. The drawer can no longer lift off its runners.',
  'drawer-test': 'Open and close each drawer. The cabinet rails stay fixed and the drawer rails travel with the box. Check smooth travel, equal gaps and that both locks hold.',
  fronts: 'Align the decorative drawer front, then fasten it from inside the box with short front-fixing screws. Keep the front square and the gaps even.',
  doors: 'Fit the hinge plates on the 37 mm line, clip each door on, then adjust it: side, height and depth, to an even gap.',
  wall: 'Position the wall attachments. Use fixings suitable for your wall and follow the hardware manufacturer\'s instructions.',
};
/** The drawer chapters: their caption is shown, and their instruction is the drawer's own, whatever the phase. */
const DRAWER_STAGES: ReadonlySet<Stage> = new Set(['drawer-boxes', 'drawer-sides', 'drawer-back', 'drawer-runners', 'cargo-frame', 'cargo-baskets', 'drawers', 'drawer-lock', 'fronts', 'drawer-test']);
export const stageInstruction = (s: Stage) => instructions[s] ?? assemblyStageSpec(s)?.summary ?? '';
const cargoInstructions: Partial<Record<Stage, string>> = {
  'drawer-runners': 'Fix the lower full-extension slide (min 50 mm from interior floor, 45 mm front setback) and upper slide (374 mm above lower slide, 192 mm bracket span) to the mounting panel using 4×14 mm screws.',
  'cargo-frame': 'Stand the steel cargo frame outside the cabinet. Clip the 4 slide brackets (Mocowanie do prowadnicy) onto wires 2–3 (16 / 64 mm) and rear wires 16–17 (192 mm span) at the lower and upper slide levels.',
  'cargo-baskets': 'Seat each wire basket (Kosz 150/200, max load 15 kg) onto the frame crossbars, then clip the 2 transverse wire dividers (Separatory) downward onto the upper basket gallery rails.',
  drawers: 'Slide the loaded cargo basket frame onto the lower and upper cabinet slides (374 mm spacing) until the rear hooks engage, '
    + 'then drive 4 × M4×6 machine screws downward through the 4 slide brackets to lock the frame.',
  fronts: 'Screw the 2 front fittings (Mocowania frontu 103.5×36.5 mm, covers removed) to the door back with 4×14 mm screws '
    + '(78 mm horizontal spacing, 374 mm vertical spacing, lower fitting *142 mm from bottom). Couple the door to the frame, '
    + 'perform 3-axis 3D adjustment (Height ⇅, Side ⇄, Depth ⇕), and snap on the 2 "GTV move" protective covers.',
  'drawer-test': 'Pull the cargo unit out to full extension (430 mm travel on L=450 mm slides). Verify smooth telescoping travel, '
    + 'M4×6 bracket lock, Separator divider retention, even 3D-adjusted door reveals, and SLOW soft-close return.',
};
/** A step's instruction as the Studio and the saved drawings write it: a cargo pull-out's own where it has one. */
export const instructionFor = (s: Stage, isCargo: boolean) => (isCargo && cargoInstructions[s]) || stageInstruction(s);
export const stageName = (s: Stage, isCargo: boolean) => (isCargo && cargoNames[s]) || names[s];
/** The doors chapter says what each moment of it is, in the order a fitter works: cups and plate holes drilled, hinges
 * pressed into the doors, plates screwed to the side panel, each door clipped onto its plates, then adjusted. */
const hanging = {
  drill: 'Drill the 35 mm hinge cups in the back of each door, and the plate holes in the side panel on the 37 mm line.',
  hinge: 'Press each hinge into its cup, arm towards the door\'s edge, and screw it down.',
  plate: 'Screw a mounting plate to the inside of the side panel, on the 37 mm line, level with each hinge.',
  hang: 'Hold the door just in front of the cabinet, slide each hinge arm onto its plate and press until it clicks.',
  adjust: 'Turn the hinge screws, side, height and depth, until the gaps round the doors are even.',
};
const paths = {
  back: 'm14 5-7 7 7 7M7 12h14', play: 'm9 5 10 7-10 7z', pause: 'M8 5v14M16 5v14',
  prev: 'M6 5v14m13-14-10 7 10 7z', next: 'M18 5v14M5 5l10 7-10 7z',
  reverse: 'm12 6-8 6 8 6V6m8 0-8 6 8 6V6', chapters: 'M4 5h16M4 12h16M4 19h16',
  explore: 'm12 3 9 5v8l-9 5-9-5V8l9-5zm0 9 9-4m-9 4L3 8m9 4v9',
  fit: 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5', info: 'M12 11v6m0-10v1M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', close: 'm6 6 12 12M6 18 18 6',
};
const icon = (key: keyof typeof paths) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[key]}"/></svg>`;
const button = (action: string, label: string, key: keyof typeof paths, extra = '') => `<button type="button" data-studio="${action}" aria-label="${label}" title="${label}" ${extra}>${icon(key)}</button>`;

/** A view over the existing player. It owns no renderer, geometry, playback clock or design state. */
export function createAssemblyStudio(doc: Document, act: (action: string, value?: number) => void) {
  const root = doc.createElement('section');
  root.className = 'assembly-studio'; root.hidden = true;
  root.setAttribute('aria-label', 'Assembly Studio');
  root.innerHTML = `<header class="as-header">${button('exit', 'Return to Furniture', 'back')}<div><b>Assembly Studio</b><span class="as-mode-label">PLAYBACK</span></div>${button('fit', 'Frame assembly', 'fit')}</header>
    <div class="as-explore-hint" hidden>Drag to orbit · Pinch to zoom and pan · Tap a part</div>
    <div class="as-inspector" hidden></div>
    <div class="as-bottom">
      <section class="as-chapters" aria-label="Assembly chapters" hidden><div class="as-section-title"><b>Chapters</b>${button('chapters', 'Close chapters', 'close')}</div><div class="as-chapter-list"></div></section>
      <section class="as-guide" aria-label="Step guidance" hidden><div class="as-guide-content"></div></section>
      <div class="as-console">
        <div class="as-caption"><button type="button" data-studio="chapters" aria-expanded="false"><span class="as-eyebrow">ASSEMBLY</span><strong class="as-step-title"></strong></button>
          <span class="as-step-count"></span>${button('guide', 'Step guidance', 'info', 'aria-expanded="false"')}</div>
        <p class="as-drawer-caption" role="status" hidden></p>
        <div class="as-track"><input type="range" class="as-scrub" min="0" max="1000" step="0.01" value="0" aria-label="Assembly timeline"><div class="as-markers" aria-hidden="true"></div></div>
        <div class="as-times" translate="no"><span class="as-time">0:00</span><span class="as-duration"></span></div>
        <div class="as-transport">${button('previous', 'Previous step', 'prev')}${button('reverse', 'Reverse playback', 'reverse', 'aria-pressed="false"')}
          ${button('play', 'Play', 'play', 'class="as-play"')}${button('next', 'Next step', 'next')}
          <button type="button" class="as-explore" data-studio="mode" aria-pressed="false">${icon('explore')}<span>Explore</span></button></div>
      </div>
    </div>`;
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const text = (selector: string, value: string) => { const el = q(selector); if (el.textContent !== value) el.textContent = value; };
  let showing = '', selection = '', chapters = false, guide = false, touched = 0;
  const now = () => doc.defaultView!.performance.now();
  const wake = () => { touched = now(); root.classList.remove('as-quiet'); };
  const toggle = (which: 'chapters' | 'guide') => {
    if (which === 'chapters') { chapters = !chapters; guide = false; }
    else { guide = !guide; chapters = false; }
    q('.as-chapters').hidden = !chapters; q('.as-guide').hidden = !guide;
    q('[data-studio="chapters"]').setAttribute('aria-expanded', String(chapters));
    q('.as-caption [data-studio="chapters"]').setAttribute('aria-expanded', String(chapters));
    q('[data-studio="guide"]').setAttribute('aria-expanded', String(guide));
    wake();
    if (chapters || guide) act('pause');
  };
  root.addEventListener('click', e => {
    const target = (e.target as Element).closest<HTMLElement>('[data-studio]');
    if (!target) return;
    const action = target.dataset.studio!; wake();
    if (action === 'chapters' || action === 'guide') toggle(action);
    else { if (action === 'part' && guide) toggle('guide'); if (action === 'chapter') { chapters = true; toggle('chapters'); } act(action, Number(target.dataset.value)); }
  });
  root.addEventListener('input', e => { if (e.target === q('.as-scrub')) { wake(); act('seek', Number((e.target as HTMLInputElement).value) / 1000); } });
  root.addEventListener('pointerdown', wake);
  root.addEventListener('focusin', wake);
  return {
    root, wake,
    load(piece: MakePiece, player: MakePlayer) {
      showing = ''; selection = ''; chapters = false; guide = false;
      q('.as-chapters').hidden = true; q('.as-guide').hidden = true; q('.as-inspector').hidden = true;
      root.querySelectorAll('[aria-expanded]').forEach(e => e.setAttribute('aria-expanded', 'false'));
      q('.as-duration').textContent = time(player.duration);
      q('.as-markers').innerHTML = player.starts.map(t => `<i style="left:${t / player.duration * 100}%"></i>`).join('');
      const isCargo = piece.fittings.some(f => f.size?.includes('cargo'));
      q('.as-chapter-list').innerHTML = piece.steps.map((step, k) => {
        const preview = chapterPreview(piece, k);
        const itemNames = step.fittings.map(f => hardwareDisplay(f).name);
        const extra = itemNames.length > 2 ? ` +${itemNames.length - 2}` : '';
        const itemPill = itemNames.length
          ? `<span class="as-chapter-items" style="display:block;font-size:10.5px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(itemNames.slice(0, 2).join(', '))}${extra}</span>`
          : '';
        return `<button type="button" class="as-chapter" data-studio="chapter" data-value="${k}"><span class="as-preview">${preview}</span>
          <small>${String(k + 1).padStart(2, '0')} · ${time(player.starts[k] ?? 0)}</small><b>${stageName(step.stage, isCargo)}</b>${itemPill}</button>`;
      }).join('');
      wake();
    },
    update(piece: MakePiece, player: MakePlayer, explore: boolean) {
      const step = piece.steps[player.head.step]; if (!step) return;
      const paused = !player.playing;
      const active = (root.getRootNode() as ShadowRoot).activeElement;
      const keep = active && root.contains(active) && active.matches(':focus-visible');
      root.classList.toggle('as-quiet', now() - touched > 4000 && !paused && !explore && !chapters && !guide && !keep);
      root.classList.toggle('as-exploring', explore);
      text('.as-mode-label', explore ? 'EXPLORE' : paused ? 'PAUSED' : player.rate < 0 ? 'REVERSE' : 'PLAYBACK');
      q('.as-explore-hint').hidden = !explore;
      q('[data-studio="mode"]').setAttribute('aria-pressed', String(explore));
      text('[data-studio="mode"] span', explore ? 'Playback' : 'Explore');
      q('[data-studio="reverse"]').setAttribute('aria-pressed', String(player.rate < 0));
      const isCargo = piece.fittings.some(f => f.size?.includes('cargo'));
      const title = stageName(step.stage, isCargo);
      const play = q('[data-studio="play"]');
      if (play.dataset.playing !== String(player.playing)) { play.dataset.playing = String(player.playing); play.innerHTML = icon(paused ? 'play' : 'pause');
        play.setAttribute('aria-label', paused ? 'Play' : 'Pause'); play.title = paused ? 'Play' : 'Pause'; }
      q<HTMLInputElement>('.as-scrub').value = String(player.time / (player.duration || 1) * 1000);
      q('.as-scrub').setAttribute('aria-valuetext', `${time(player.time)} of ${time(player.duration)}, ${title}`);
      q('.as-track').style.setProperty('--played', `${player.time / (player.duration || 1) * 100}%`);
      text('.as-time', time(player.time));
      text('.as-step-count', `${player.head.step + 1} / ${piece.steps.length}`);
      text('.as-step-title', `${String(player.head.step + 1).padStart(2, '0')}. ${title}`);
      root.querySelectorAll<HTMLElement>('.as-chapter').forEach(el => el.setAttribute('aria-current', String(Number(el.dataset.value) === player.head.step)));
      const fixing = player.fixing(), adjusting = player.adjusting();
      const phase = fixing ? 'fix' : player.head.drill < 1 ? 'drill' : player.head.place < 1 ? 'place' : player.head.hang < 1 ? 'hang'
        : adjusting ? 'adjust' : 'complete';
      const drawerCaption = q('.as-drawer-caption');
      drawerCaption.hidden = !DRAWER_STAGES.has(step.stage);
      const captions: Partial<Record<Stage, string>> = {
        'drawer-boxes': 'Front face down on a soft mat · cam bolts in · bottom slid into the groove, centred.',
        'drawer-sides': 'Dowels in · sides over the bolts, bottom in their grooves · turn the cams to lock.',
        'drawer-back': 'Hook the back over the bottom · swing it in · hammer the expanding dowels.',
        'drawer-runners': isCargo ? 'Lower slide at min 50 mm · Upper slide +374 mm above · 45 mm front setback (4×14 mm screws).' : 'Rear peg in its hole · two screws through the front bracket · nothing on the drawer.',
        'cargo-frame': 'Stand steel chassis outside cabinet · Clip 4 slide brackets onto wires 2–3 and 16–17 (192 mm span).',
        'cargo-baskets': 'Hook wire baskets (Kosz 150/200, max 15 kg) onto frame · Clip 2 transverse Separatory dividers onto rails.',
        drawers: isCargo
          ? (phase === 'fix'
            ? 'Lock all 4 basket slide brackets (2–3 & 16–17 pręt) to slides from above with 4 × M4×6 machine screws.'
            : 'Slide loaded cargo frame onto lower & upper slides (374 mm spacing), then lock with 4 × M4×6 screws.')
          : 'Runners out · plates over the front pins · hook the back on, lower the front onto the pins.',
        'drawer-lock': 'Under each drawer: lever onto each front pin, turn to lock.',
        fronts: isCargo
          ? (phase === 'adjust'
            ? `3D Front Adjustment (REGULACJA): tune ${adjusting?.way === 'height' ? 'Height ⇅ (top screw)' : adjusting?.way === 'side' ? 'Side ⇄ (lateral screws)' : 'Depth ⇕ (clamping screws)'} · Snap on "GTV move" covers.`
            : phase === 'place' ? 'Couple front fittings onto cargo frame upright tongues · Lock & snap on "GTV move" protective covers.'
            : 'Screw 2 front fittings (103.5×36.5 mm, 78 mm screw pattern, 374 mm vertical spacing, *142 mm from floor) with 4×14 mm screws.')
          : 'Align decorative front, then fasten from inside with front-fixing screws.',
        'drawer-test': isCargo ? 'Pull cargo out (430–450 mm FULL extension) · Check 15 kg stability, Separatory dividers & SLOW soft-close.' : 'Open and close each drawer: smooth travel, even gaps, both locks holding.',
      };
      text('.as-drawer-caption', captions[step.stage] ?? '');
      const hardware = fixing?.hardware ?? step.fittings;
      const key = `${step.n}:${phase}:${JSON.stringify(hardware)}`;
      if (key !== showing) {
        showing = key;
        const parts = piece.parts.filter(p => p.ids.some(id => step.boards.includes(id)));
        const kinds = new Set(hardware.map(f => f.kind)), doors = step.stage === 'doors';
        const instruction = doors && phase === 'fix' && (kinds.has('hinge') || kinds.has('plate')) ? hanging[kinds.has('hinge') ? 'hinge' : 'plate']
          : doors && (phase === 'drill' || phase === 'hang' || phase === 'adjust') ? hanging[phase] : doors && phase === 'place' ? hanging.hang
          : isCargo && cargoInstructions[step.stage] ? cargoInstructions[step.stage]!
          : DRAWER_STAGES.has(step.stage) && step.stage !== 'fronts' ? stageInstruction(step.stage)
          : phase === 'drill' ? 'Prepare the marked holes. The camera shows the drilling sequence.' : phase === 'fix' ? 'Align the indicated connection and install the hardware shown.' : stageInstruction(step.stage);
        const hardwareHtml = hardware.map(f => {
          const disp = hardwareDisplay(f);
          return `<span title="${esc(disp.name)}">${fittingIcon(f.kind)}<span>${esc(disp.name)}`
            + `${disp.size ? ` · ${esc(disp.size)}` : ''}<b> ×${f.qty}</b></span></span>`;
        }).join('');
        const partsHtml = parts.map(p => `<button type="button" data-studio="part" data-value="${p.n}">${esc(partText(piece, p))}`
          + ` <b>×${p.ids.filter(id => step.boards.includes(id)).length}</b></button>`).join('');
        // As a flat-pack manual frames a step: what to do, the tools, the hardware and parts, then the notes.
        const notes = notesHtml(stepNotes(piece, player.head.step));
        q('.as-guide-content').innerHTML = `<div class="as-section-title"><b>${phase === 'drill' ? 'Prepare' : phase === 'fix' ? 'Connect' : 'Install'} · ${title}</b>`
          + `${button('connection', 'Close-up of connection', 'fit')}</div><p>${esc(instruction)}</p>${notes.tools}`
          + `<div class="as-required">${hardwareHtml}</div><div class="as-required">${partsHtml}</div>${notes.rest}`;
      }
    },
    inspect(piece: MakePiece, n: number | null, length: (cm: number) => string, material: (id: string) => string) {
      const part = piece.parts.find(p => p.n === n), box = q('.as-inspector'); box.hidden = !part;
      if (!part) { selection = ''; return; }
      const key = `${n}:${length(part.cut.length)}`; if (selection === key) return; selection = key;
      const connections = piece.fittings.filter(f => f.boards.some(b => part.ids.includes(b))).length;
      box.innerHTML = `<div class="as-section-title"><b>${part.n} · ${esc(part.name)}</b>${button('deselect', 'Clear selection', 'close')}</div>
        <p translate="no">${length(part.cut.length)} × ${length(part.cut.width)} × ${length(part.cut.thickness)}${unitSuffix()}</p>
        <small>${esc(material(part.decorId))} · ${connections} connections</small>
        <button type="button" class="as-part-stage" data-studio="part-stage" data-value="${part.n}">View assembly stage →</button>`;
    },
  };
}
