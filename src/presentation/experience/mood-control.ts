import type { SceneLook } from '../viewport/scene-looks';
import { TIMES_OF_DAY } from '../viewport/daylight';
import type { ExperienceDocument, ExperienceLifetime } from './lifetime.ports';
import { mountMobileSheet } from '../editor/mobile-sheet.js';

export interface Mood { look: SceneLook; time: string; sounds: boolean; apart: number; flat: boolean }

export interface MoodControlPorts {
  /** Where the button goes (the top bar's right group). */
  readonly bar: HTMLElement;
  /** The editor's own element: the panel belongs to it, as the menu does, whatever the screen width. */
  readonly container: HTMLElement;
  readonly document: ExperienceDocument;
  readonly lifetime: ExperienceLifetime;
  /** Matches while panels are docked beside the view (desktop). */
  readonly docked: { readonly matches: boolean };
  mood(): Mood;
  change(next: Partial<Mood>): void;
  drawings(): void;
}

const LOOKS: readonly { id: SceneLook; name: string; hint: string }[] = [
  { id: 'living', name: 'Living', hint: 'As it will look at home' },
  { id: 'maquette', name: 'Maquette', hint: 'A white card model' },
  { id: 'workshop', name: 'Workshop', hint: 'Blueprint and parts' },
];
/** Little skies for the times of day, and the sun's place on its arc (0 to 1 across, 0 to 1 up). */
const SKIES: Record<string, { sky: string; sun: [number, number]; moon?: boolean }> = {
  midday: { sky: 'linear-gradient(#bcd6ef,#f2ece2)', sun: [.5, .86] },
  morning: { sky: 'linear-gradient(#dfe8f6,#f6efe4)', sun: [.18, .45] },
  golden: { sky: 'linear-gradient(#f4b47e,#f8dcbc)', sun: [.84, .22] },
  night: { sky: 'linear-gradient(#141c33,#2a3150)', sun: [.7, .78], moon: true },
};
const SUN = 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z';
const MOON = 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z';
const BLUEPRINT = 'M4 4h16v16H4zM4 9h16M9 9v11M13 13h4M13 16h4';
const MAQUETTE = 'M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9';
const svg = (d: string) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

/** The button that sets the mood of the scene (how it is drawn and the time of day), and its panel. */
export function createMoodControl(ports: MoodControlPorts) {
  const { document: doc, lifetime } = ports;
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'tb xp-mood-button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  ports.bar.prepend(button);
  const panel = doc.createElement('div');
  panel.className = 'dd r xp-mood';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Look and light');
  panel.innerHTML = `<section><h2>Look</h2><div class="xp-looks" role="radiogroup" aria-label="Look">${LOOKS.map(l => `<button type="button" role="radio" data-look="${l.id}">
      <i class="xp-swatch look-${l.id}" aria-hidden="true"></i><b>${l.name}</b><small>${l.hint}</small></button>`).join('')}</div></section>
    <section class="xp-times-section"><h2>Light</h2><div class="xp-times" role="radiogroup" aria-label="Time of day">${TIMES_OF_DAY.map(t => {
      const s = SKIES[t.id]!;
      return `<button type="button" role="radio" data-time="${t.id}" title="${t.hint}"><i class="xp-sky${s.moon ? ' moon' : ''}" style="background:${s.sky}" aria-hidden="true">
        <i style="left:${s.sun[0] * 100}%;bottom:${s.sun[1] * 100}%"></i></i><b>${t.name}</b></button>`;
    }).join('')}</div></section>
    <section class="xp-workshop-tools"><h2>Workshop</h2>
      <label class="xp-apart"><span>Take apart</span><input type="range" min="0" max="100" value="0" aria-label="Take the wardrobe apart"></label>
      <label class="xp-switch"><input type="checkbox" class="xp-flat"><span>Flat front elevation</span></label>
      <button type="button" class="xp-drawings">${svg(BLUEPRINT)}Open shop drawings</button></section>
    <footer><label class="xp-switch"><input type="checkbox" class="xp-sounds"><span>Sounds</span></label></footer>`;
  ports.container.append(panel);
  // The same dropdown as the menu: on phones it closes with its handle, a pull down or a tap.
  mountMobileSheet({ document: doc, lifetime, panel, name: 'Look and light', close: () => toggle(false), docked: ports.docked });
  const $ = <T extends Element = HTMLElement>(s: string) => panel.querySelector(s) as T;

  function render() {
    const m = ports.mood(), time = TIMES_OF_DAY.find(t => t.id === m.time) ?? TIMES_OF_DAY[0];
    const label = m.look === 'workshop' ? 'Workshop' : m.look === 'maquette' ? 'Maquette' : time.name;
    button.innerHTML = svg(m.look === 'workshop' ? BLUEPRINT : m.look === 'maquette' ? MAQUETTE : m.time === 'night' ? MOON : SUN) + `<span>${label}</span>`;
    button.setAttribute('aria-label', `Look and light: ${label}`);
    button.title = 'Look and light';
    for (const b of panel.querySelectorAll<HTMLElement>('[data-look]')) b.setAttribute('aria-checked', String(b.dataset.look === m.look));
    for (const b of panel.querySelectorAll<HTMLElement>('[data-time]')) b.setAttribute('aria-checked', String(b.dataset.time === m.time));
    panel.dataset.shows = m.look;
    $<HTMLInputElement>('.xp-apart input').value = String(Math.round(m.apart * 100));
    $<HTMLInputElement>('.xp-flat').checked = m.flat;
    $<HTMLInputElement>('.xp-sounds').checked = m.sounds;
    $('.xp-times-section').classList.toggle('muted', m.look === 'workshop');
  }
  function toggle(show: boolean = panel.hidden === true) {
    panel.hidden = !show;
    button.setAttribute('aria-expanded', String(show));
    button.classList.toggle('on', show);
    if (show) { render(); (panel.querySelector<HTMLElement>('[aria-checked="true"]') ?? panel).focus?.({ preventScroll: true }); }
  }
  lifetime.listen(button, 'click', () => toggle());
  lifetime.listen(panel, 'click', e => {
    const t = e.target as HTMLElement, look = t.closest<HTMLElement>('[data-look]'), time = t.closest<HTMLElement>('[data-time]');
    if (look) ports.change({ look: look.dataset.look as SceneLook });
    else if (time) ports.change({ time: time.dataset.time!, ...(ports.mood().look === 'workshop' ? { look: 'living' as const } : {}) });
    else if (t.closest('.xp-drawings')) { toggle(false); ports.drawings(); return; }
    else return;
    render();
  });
  lifetime.listen(panel, 'input', e => {
    const t = e.target as HTMLInputElement;
    if (t.matches('.xp-apart input')) ports.change({ apart: Number(t.value) / 100 });
  });
  lifetime.listen(panel, 'change', e => {
    const t = e.target as HTMLInputElement;
    if (t.matches('.xp-flat')) ports.change({ flat: t.checked });
    if (t.matches('.xp-sounds')) ports.change({ sounds: t.checked });
  });
  // Closes on a tap elsewhere, and on Escape.
  lifetime.listen(doc, 'pointerdown', e => {
    if (panel.hidden) return;
    const path = e.composedPath();
    if (!path.includes(panel) && !path.includes(button)) toggle(false);
  });
  lifetime.listen(panel, 'keydown', e => { if ((e as KeyboardEvent).key === 'Escape') { toggle(false); button.focus(); } });
  render();
  return { render, close: () => toggle(false), dispose() { button.remove(); panel.remove(); } };
}
