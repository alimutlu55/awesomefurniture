import type { MakePiece } from '../../domain/make/make-parts';
import type { Stage } from '../../domain/make/make-assembly';
import type { MakePlayer } from './make-player';
import { FITTING_NAMES, fittingIcon, sold } from './make-panel-tabs';
import { chapterPreview } from './assembly-preview';
import { unitSuffix } from '../editor/length-unit-state';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const names: Record<Stage, string> = { plinth: 'Foundation', carcass: 'Structure', partitions: 'Partitions', top: 'Top', back: 'Back', inside: 'Shelves & interior',
  'drawer-boxes': 'Build drawer boxes', 'drawer-runners': 'Mount drawer runners',
  drawers: 'Insert drawers', 'drawer-test': 'Test drawer travel', fronts: 'Fronts', doors: 'Doors', wall: 'Finishing' };
const instructions: Record<Stage, string> = {
  plinth: 'Join the plinth and base supports. Keep the frame square and level.',
  carcass: 'Position the base, then bring the side panels into place. Align the prepared holes before securing the joints.',
  partitions: 'Align each partition with the base. Secure the joints while keeping the panels upright.',
  top: 'Lower the top onto the uprights, align the edges and secure each connection.',
  back: 'Square the cabinet, then fit the back using the selected back fixing.',
  inside: 'Fit the supports at matching heights, then position the shelves and interior components.',
  'drawer-boxes': 'Assemble each drawer box outside the cabinet. Join the ends between the sides, fit the bottom and check the box is square.',
  'drawer-runners': 'Separate the removable inner members. Fix the outer rails level and parallel inside the cabinet; screw the inner members to the drawer sides. Use short mounting screws.',
  drawers: 'Bring the assembled boxes to the cabinet. Align both drawer members with the cabinet rails, support the box level and push evenly until both sides engage.',
  'drawer-test': 'Open and close each drawer. The outer rail stays fixed, the middle rail telescopes and the inner member travels with the box. Check smooth travel, equal gaps and secure engagement on both sides.',
  fronts: 'Align the decorative drawer front, then fasten it from inside the box with short front-fixing screws. Keep the front square and the gaps even.',
  doors: 'Fit the hinge plates on the 37 mm line, clip each door on, then adjust it: side, height and depth, to an even gap.',
  wall: 'Position the wall attachments. Use fixings suitable for your wall and follow the hardware manufacturer’s instructions.',
};
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
        <div class="as-drawer-controls" hidden><button type="button" data-studio="drawer-open">Open drawer</button>
          <button type="button" data-studio="drawer-close">Close drawer</button></div>
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
      q('.as-chapter-list').innerHTML = piece.steps.map((step, k) => {
        const preview = chapterPreview(piece, k);
        return `<button type="button" class="as-chapter" data-studio="chapter" data-value="${k}"><span class="as-preview">${preview}</span>
          <small>${String(k + 1).padStart(2, '0')} · ${time(player.starts[k] ?? 0)}</small><b>${names[step.stage]}</b></button>`;
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
      const play = q('[data-studio="play"]');
      if (play.dataset.playing !== String(player.playing)) { play.dataset.playing = String(player.playing); play.innerHTML = icon(paused ? 'play' : 'pause');
        play.setAttribute('aria-label', paused ? 'Play' : 'Pause'); play.title = paused ? 'Play' : 'Pause'; }
      q<HTMLInputElement>('.as-scrub').value = String(player.time / (player.duration || 1) * 1000);
      q('.as-scrub').setAttribute('aria-valuetext', `${time(player.time)} of ${time(player.duration)}, ${names[step.stage]}`);
      q('.as-track').style.setProperty('--played', `${player.time / (player.duration || 1) * 100}%`);
      text('.as-time', time(player.time));
      text('.as-step-count', `${player.head.step + 1} / ${piece.steps.length}`);
      text('.as-step-title', `${String(player.head.step + 1).padStart(2, '0')}. ${names[step.stage]}`);
      root.querySelectorAll<HTMLElement>('.as-chapter').forEach(el => el.setAttribute('aria-current', String(Number(el.dataset.value) === player.head.step)));
      q('.as-drawer-controls').hidden = step.stage !== 'drawer-test';
      const drawerCaption = q('.as-drawer-caption');
      drawerCaption.hidden = !['drawer-boxes', 'drawer-runners', 'drawers', 'drawer-test'].includes(step.stage);
      const captions: Partial<Record<Stage, string>> = {
        'drawer-boxes': 'Build and square the box outside the cabinet.',
        'drawer-runners': 'Cutaway view · Outer rail → cabinet · Inner rail → drawer box',
        drawers: 'Align both rails. Push the supported box evenly into the cabinet.',
        'drawer-test': 'Outer rail stays fixed · Middle rail telescopes · Inner rail moves with the drawer',
      };
      text('.as-drawer-caption', captions[step.stage] ?? '');
      const fixing = player.fixing(), phase = fixing ? 'fix' : player.head.drill < 1 ? 'drill' : player.head.place < 1 ? 'place' : player.head.hang < 1 ? 'hang'
        : player.adjusting() ? 'adjust' : 'complete';
      const hardware = fixing?.hardware ?? step.fittings;
      const key = `${step.n}:${phase}:${JSON.stringify(hardware)}`;
      if (key !== showing) {
        showing = key;
        const parts = piece.parts.filter(p => p.ids.some(id => step.boards.includes(id)));
        const kinds = new Set(hardware.map(f => f.kind)), doors = step.stage === 'doors';
        const instruction = doors && phase === 'fix' && (kinds.has('hinge') || kinds.has('plate')) ? hanging[kinds.has('hinge') ? 'hinge' : 'plate']
          : doors && (phase === 'drill' || phase === 'hang' || phase === 'adjust') ? hanging[phase] : doors && phase === 'place' ? hanging.hang
          : ['drawer-boxes', 'drawer-runners', 'drawers', 'drawer-test'].includes(step.stage) ? instructions[step.stage]
          : phase === 'drill' ? 'Prepare the marked holes. The camera shows the drilling sequence.' : phase === 'fix' ? 'Align the indicated connection and install the hardware shown.' : instructions[step.stage];
        const hardwareHtml = hardware.map(f => `<span title="${esc(FITTING_NAMES[f.kind])}">${fittingIcon(f.kind)}<span>${FITTING_NAMES[f.kind]}`
          + `${f.size ? ` · ${esc(sold(f.size))}` : ''}<b> ×${f.qty}</b></span></span>`).join('');
        const partsHtml = parts.map(p => `<button type="button" data-studio="part" data-value="${p.n}">${esc(p.name)}`
          + ` <b>×${p.ids.filter(id => step.boards.includes(id)).length}</b></button>`).join('');
        q('.as-guide-content').innerHTML = `<div class="as-section-title"><b>${phase === 'drill' ? 'Prepare' : phase === 'fix' ? 'Connect' : 'Install'} · ${names[step.stage]}</b>`
          + `${button('connection', 'Close-up of connection', 'fit')}</div><p>${esc(instruction)}</p>`
          + `<div class="as-required">${hardwareHtml}</div><div class="as-required">${partsHtml}</div>`;
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
