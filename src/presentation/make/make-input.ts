import type { AssemblyExit, MakeExit } from '../../domain/analytics/analytics-events';
import type { FilmFacts, MakeNote } from '../../application/analytics/make-usage';
import type { MakePlayer } from './make-player';
import type { MakeViewPorts } from './make-view.ports';

type Target = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
interface Host {
  readonly dom: MakeViewPorts['dom'];
  readonly lifetime: MakeViewPorts['lifetime'];
  readonly resources: MakeViewPorts['resources'];
  readonly app: HTMLElement;
  readonly st: { readonly piece: unknown; readonly studio: boolean; readonly explore: boolean; readonly filming: boolean; readonly selected: number | null };
  readonly player: MakePlayer;
  readonly studio: { wake(): void };
  showFilm(): void;
  studioAction(action: string): void;
  select(n: number | null): void;
  step(by: number): void;
  leaveStudio(back?: boolean, exit?: AssemblyExit): void;
  close(exit?: MakeExit): void;
  historyChanged(e: Event): void;
  /** Product analytics: a note of what was done, and where the assembly film stands. */
  note(note: MakeNote): void;
  film(): FilmFacts;
}

/** Make's own pointer, history, page and keyboard handling while it is open, registered with the editor's lifetime. */
export function bindMakeInput(host: Host) {
  const { dom, lifetime, resources, app, st, player, studio } = host;
  const listen = lifetime.listen as (target: Target, event: string, handler: (e: Event) => void, options?: boolean | AddEventListenerOptions) => void;
  // Looking around while the film plays: the camera is the person's until they ask the director back (Follow).
  for (const type of ['pointerdown', 'wheel']) listen(resources.cv, type, e => {
    if (!st.studio) return;
    studio.wake();
    // Playback owns the camera. Explore uses the editor's proven orbit, pan and pinch handlers.
    if (!st.explore) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, { capture: true, passive: false });
  // Turning or tapping the 3D view outside the Studio, and zooming it (product analytics; one note per touch, not per move).
  listen(resources.cv, 'pointerdown', () => { if (st.piece && !st.studio) host.note({ kind: 'touch', zoom: false }); }, { passive: true });
  listen(resources.cv, 'wheel', () => { if (st.piece && !st.studio) host.note({ kind: 'touch', zoom: true }); }, { passive: true });
  // A button is pressed from the moment it is touched, and stays so while the work its click starts runs.
  const held = (e: Event) => st.piece ? (e.target as Element).closest<HTMLElement>('[data-editor-id="toolbar"] .tb, .make-panel button') : null;
  listen(app, 'pointerdown', e => held(e)?.classList.add('on'), true);
  for (const type of ['click', 'pointercancel']) listen(app, type, e => { const b = held(e); if (b) lifetime.frame(() => b.classList.remove('on')); }, true);
  listen(dom.window, 'popstate', host.historyChanged, true);
  // The page hidden or shown while Make is open: a visit is summed up before the page may close. On the window, while
  // capturing, so it is queued before the analytics client sends its queue for the same event.
  listen(dom.window, 'visibilitychange', () => {
    if (!st.piece) return;
    const hidden = app.ownerDocument.hidden;
    if (!hidden && st.studio) player.watchFrom();
    host.note(hidden ? { kind: 'hidden', film: st.studio ? host.film() : null } : { kind: 'shown', studio: st.studio });
  }, true);
  listen(app.ownerDocument, 'visibilitychange', () => { if (app.ownerDocument.hidden && st.studio) { player.pause(); host.showFilm(); studio.wake(); } });
  // While Make is open its keys come first, so the editor's shortcuts (delete, undo, nudge) never act on the design behind it.
  listen(dom.window, 'keydown', e => {
    const k = e as KeyboardEvent;
    const target = k.composedPath()[0] as Element | undefined;
    if (!st.piece || (target?.closest?.('input,select,textarea') && k.key !== 'Escape')) return;
    // The film: Space plays or pauses (a focused button keeps its own Space), the arrows go a step back or on.
    if (st.filming && k.key === ' ' && !target?.closest?.('button')) { host.studioAction('play'); }
    else if (st.filming && (k.key === 'ArrowRight' || k.key === 'ArrowLeft')) {
      host.note({ kind: 'studio', action: k.key === 'ArrowRight' ? 'next' : 'previous' });
      player.step(k.key === 'ArrowRight' ? 1 : -1); host.showFilm();
    }
    else if (k.key === 'Tab' || k.key === 'Enter' || k.key === ' ') return;
    else if (k.key === 'Escape') { if (st.selected !== null) host.select(null); else if (st.studio) host.leaveStudio(true, 'escape'); else host.close('escape'); }
    else if ((k.key === 'ArrowRight' || k.key === 'ArrowLeft') && st.selected !== null) host.step(k.key === 'ArrowRight' ? 1 : -1);
    k.preventDefault();
    k.stopImmediatePropagation();
  }, true);
}
