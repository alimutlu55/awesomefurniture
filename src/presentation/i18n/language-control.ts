import { APP_LANGUAGES, currentLanguage, onLanguageChange, setLanguage } from './language';
/** Uses the editor's existing menu rows, icon sizing, secondary text and checked choices. */
export function createLanguageControl(doc: Document): { element: HTMLDetailsElement; dispose(): void } {
  const element = doc.createElement('details'); element.className = 'language-control';
  element.setAttribute('data-sheet-scroll', '');
  const summary = doc.createElement('summary'); summary.className = 'mi'; summary.setAttribute('aria-label', 'Language');
  summary.setAttribute('role', 'button'); summary.setAttribute('aria-expanded', 'false');
  summary.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>'
    + '<ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>'
    + '<span>Language<small class="language-current" translate="no"></small></span>'
    + '<svg class="ic language-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  const current = summary.querySelector<HTMLElement>('.language-current')!;
  const options = doc.createElement('div'); options.className = 'language-options';
  options.setAttribute('role', 'group'); options.setAttribute('aria-label', 'Language');
  for (const language of APP_LANGUAGES) {
    const button = doc.createElement('button'); button.type = 'button'; button.className = 'mi';
    button.dataset.language = language.code; button.lang = language.code; button.setAttribute('translate', 'no');
    button.setAttribute('role', 'menuitemradio');
    button.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
    const name = doc.createElement('span'); name.textContent = language.name; button.append(name); options.append(button);
  }
  const buttons = [...options.querySelectorAll<HTMLButtonElement>('button')];
  const status = doc.createElement('p'); status.className = 'sub language-status'; status.setAttribute('role', 'status');
  let busy = false, interacting = false, resetTimer: ReturnType<typeof setTimeout> | null = null;
  const startInteraction = () => {
    interacting = true;
    if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
  };
  const endInteraction = () => {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { interacting = false; resetTimer = null; }, 400);
  };
  options.addEventListener('pointerdown', startInteraction);
  options.addEventListener('mousedown', startInteraction);
  doc.addEventListener('pointerup', endInteraction, true);
  doc.addEventListener('pointercancel', endInteraction, true);
  doc.addEventListener('mouseup', endInteraction, true);
  const refresh = () => {
    const language = APP_LANGUAGES.find(item => item.code === currentLanguage())!;
    current.textContent = language.name; current.lang = language.code;
    buttons.forEach(button => button.setAttribute('aria-checked', String(button.dataset.language === language.code)));
  };
  const selectLanguage = async (code: string | undefined) => {
    const language = APP_LANGUAGES.find(item => item.code === code);
    if (!language || busy) return;
    busy = true; status.textContent = ''; summary.setAttribute('aria-busy', 'true');
    buttons.forEach(button => { button.disabled = true; });
    try {
      await setLanguage(language.code);
      element.open = false;
      summary.focus({ preventScroll: true });
    }
    catch { element.open = true; status.textContent = 'Language could not be loaded. Try again.'; }
    finally { busy = false; summary.removeAttribute('aria-busy'); buttons.forEach(button => { button.disabled = false; }); }
  };
  for (const button of buttons) {
    const code = button.dataset.language;
    button.addEventListener('pointerdown', e => { e.stopPropagation(); startInteraction(); });
    button.addEventListener('mousedown', e => { e.stopPropagation(); startInteraction(); });
    button.addEventListener('click', async e => {
      e.preventDefault();
      e.stopPropagation();
      await selectLanguage(code);
    });
  }
  const activate = async (event: Event) => {
    const target = event.target as Element | null;
    const button = target?.closest?.<HTMLButtonElement>('button[data-language]');
    if (button?.dataset?.language) await selectLanguage(button.dataset.language);
  };
  const toggle = () => {
    summary.setAttribute('aria-expanded', String(element.open));
    if (element.open) buttons.find(button => button.getAttribute('aria-checked') === 'true')?.focus({ preventScroll: true });
  };
  const navigate = (event: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || busy) return;
    const active = buttons.indexOf(event.target as HTMLButtonElement); if (active < 0) return;
    event.preventDefault(); event.stopPropagation();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (active + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[index]?.focus();
  };
  const leave = (event: FocusEvent) => {
    if (interacting) return;
    const target = event.relatedTarget as Node | null;
    if (target && target instanceof Node && !element.contains(target)) element.open = false;
  };
  const outside = (event: Event) => {
    if (!element.open) return;
    const path = event.composedPath ? event.composedPath() : [];
    if (path.length > 0 && !path.includes(element)) element.open = false;
  };
  doc.addEventListener('pointerdown', outside, true);
  refresh(); const unsubscribe = onLanguageChange(refresh);
  options.addEventListener('click', activate); options.addEventListener('keydown', navigate);
  element.addEventListener('toggle', toggle); element.addEventListener('focusout', leave);
  element.append(summary, options, status);
  return { element, dispose() {
    if (resetTimer) clearTimeout(resetTimer);
    doc.removeEventListener('pointerup', endInteraction, true);
    doc.removeEventListener('pointercancel', endInteraction, true);
    doc.removeEventListener('mouseup', endInteraction, true);
    doc.removeEventListener('pointerdown', outside, true);
    options.removeEventListener('click', activate); options.removeEventListener('keydown', navigate);
    element.removeEventListener('toggle', toggle); element.removeEventListener('focusout', leave);
    unsubscribe(); element.remove();
  } };
}
