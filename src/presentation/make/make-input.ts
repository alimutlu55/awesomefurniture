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
  leaveStudio(): void;
  close(): void;
  historyChanged(e: Event): void;
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
  // A button is pressed from the moment it is touched, and stays so while the work its click starts runs.
  const held = (e: Event) => st.piece ? (e.target as Element).closest<HTMLElement>('[data-editor-id="toolbar"] .tb, .make-panel button') : null;
  listen(app, 'pointerdown', e => held(e)?.classList.add('on'), true);
  for (const type of ['click', 'pointercancel']) listen(app, type, e => { const b = held(e); if (b) lifetime.frame(() => b.classList.remove('on')); }, true);
  listen(dom.window, 'popstate', host.historyChanged, true);
  listen(app.ownerDocument, 'visibilitychange', () => { if (app.ownerDocument.hidden && st.studio) { player.pause(); host.showFilm(); studio.wake(); } });
  // While Make is open its keys come first, so the editor's shortcuts (delete, undo, nudge) never act on the design behind it.
  listen(dom.window, 'keydown', e => {
    const k = e as KeyboardEvent;
    const target = k.composedPath()[0] as Element | undefined;
    if (!st.piece || (target?.closest?.('input,select,textarea') && k.key !== 'Escape')) return;
    // The film: Space plays or pauses (a focused button keeps its own Space), the arrows go a step back or on.
    if (st.filming && k.key === ' ' && !target?.closest?.('button')) { host.studioAction('play'); }
    else if (st.filming && (k.key === 'ArrowRight' || k.key === 'ArrowLeft')) { player.step(k.key === 'ArrowRight' ? 1 : -1); host.showFilm(); }
    else if (k.key === 'Tab' || k.key === 'Enter' || k.key === ' ') return;
    else if (k.key === 'Escape') { if (st.selected !== null) host.select(null); else if (st.studio) host.leaveStudio(); else host.close(); }
    else if ((k.key === 'ArrowRight' || k.key === 'ArrowLeft') && st.selected !== null) host.step(k.key === 'ArrowRight' ? 1 : -1);
    k.preventDefault();
    k.stopImmediatePropagation();
  }, true);
}
