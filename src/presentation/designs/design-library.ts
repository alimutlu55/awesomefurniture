import { currentLanguage, onLanguageChange, translate } from '../i18n/language';
import { bindLocalizedUi } from '../i18n/localized-ui';
import { createLanguageControl } from '../i18n/language-control';
import languageStyles from '../i18n/language-control.css?raw';
import type { ProjectSummary } from '../../application/ports/project-repository';
import { createDesignDialog } from './name-dialog';
import styles from './design-library.css?raw';
import loadingStyles from '../components/loading-state.css?raw';
import { createLoadingPlaceholder, createLoadingState } from '../components/loading-state';

interface LibraryState {
  items: readonly ProjectSummary[];
  currentId: string | null;
  warning: string | null;
  localOnly: boolean;
}
interface LibraryActions {
  open(id: string): Promise<void>;
  create(name: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  duplicate(id: string): Promise<void>;
  remove(id: string, revision: number): Promise<void>;
  refresh(): Promise<void>;
  preview(id: string): Promise<string | null>;
}

/** Parent destination only. It never mutates the live editor or owns persistence. */
export function mountDesignLibrary(document: Document, actions: LibraryActions) {
  const host = document.createElement('div'); host.id = 'design-library'; host.hidden = true;
  host.dataset.theme = document.documentElement.dataset.theme ?? 'light';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style'); style.textContent = styles + loadingStyles + languageStyles; shadow.append(style);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  const page = el('section', 'page'); page.setAttribute('aria-label', 'Your designs');
  const content = el('div', 'content'), header = el('header');
  const heading = el('h1', '', 'Your designs'); heading.tabIndex = -1;
  const select = el('button', 'select', 'Select'); select.setAttribute('aria-pressed', 'false');
  const add = el('button', 'new', '＋'); add.setAttribute('aria-label', 'New design');
  const language = createLanguageControl(document);
  header.append(heading, language.element, select, add);
  const sort = el('p', 'sort', 'Recently edited');
  const search = el('input', 'search'); search.type = 'search'; search.placeholder = 'Find a design'; search.setAttribute('aria-label', 'Find a design');
  const message = el('p', 'message'); message.setAttribute('role', 'status');
  const retry = el('button', 'retry', 'Retry'); retry.hidden = true;
  const status = el('div', 'status'); status.setAttribute('role', 'status');
  const list = el('div', 'list');
  const placeholder = createLoadingPlaceholder(document, 'Loading your designs…', 'design-list');
  const listLoading = createLoadingState(list);
  const empty = el('div', 'empty');
  empty.append(el('h2', '', 'A place for your ideas.'), el('p', '', 'Start a design for your room.'));
  const emptyNew = el('button', 'primary', 'New design'); empty.append(emptyNew);
  const note = el('p', 'note');
  const bar = el('div', 'managebar'); bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Selected design actions');
  const rename = el('button', '', 'Rename'), duplicate = el('button', '', 'Duplicate'), remove = el('button', 'danger', 'Delete');
  bar.append(rename, duplicate, remove);
  content.append(header, sort, search, message, retry, status, placeholder, list, empty, note); page.append(content); shadow.append(page, bar);
  const dialog = createDesignDialog(document, shadow);
  document.body.append(host);
  const stopTranslation = bindLocalizedUi(shadow);
  let state: LibraryState = { items: [], currentId: null, warning: null, localOnly: true };
  let selecting = false, selected: string | null = null, busy = false, generation = 0;
  let fetching = false, loaded = false, activeId: string | null = null;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      observer.unobserve(entry.target);
      const row = entry.target as HTMLButtonElement, img = row.querySelector('img');
      const frame = row.querySelector<HTMLElement>('.preview-frame')!;
      const finish = () => {
        if (img) img.hidden = !img.naturalWidth;
        frame.classList.remove('ui-loading-surface'); frame.removeAttribute('aria-busy');
      };
      if (img) void actions.preview(row.dataset.id!).then(source => {
        if (!img.isConnected) return;
        if (source) { img.onload = img.onerror = finish; img.src = source; }
        else finish();
      }).catch(finish);
    }
  }, { root: page, rootMargin: '200px' });
  function selectedRow() { return state.items.find(item => item.id === selected); }
  function controls() {
    select.textContent = selecting ? 'Done' : 'Select'; select.setAttribute('aria-pressed', String(selecting));
    const waiting = busy || fetching || !loaded;
    select.disabled = waiting; add.disabled = waiting; emptyNew.disabled = waiting;
    retry.disabled = waiting; search.disabled = waiting;
    bar.hidden = !selecting;
    for (const button of [rename, duplicate, remove]) button.disabled = waiting || !selectedRow();
    for (const row of list.querySelectorAll<HTMLButtonElement>('button')) {
      row.disabled = waiting;
      row.classList.toggle('ui-loading-surface', busy && row.dataset.id === activeId);
    }
    placeholder.hidden = (loaded && !fetching && !busy) || !!state.items.length;
    empty.hidden = waiting || !!state.items.length || !!state.warning || message.classList.contains('error');
    host.setAttribute('aria-busy', String(waiting));
    if (fetching && state.items.length) listLoading.start(); else listLoading.stop();
  }
  function render() {
    generation++; observer.disconnect();
    if (!selectedRow()) selected = null;
    const query = search.value.toLocaleLowerCase();
    const items = state.items.filter(row => row.name.toLocaleLowerCase().includes(query));
    list.replaceChildren();
    for (const item of items) {
      const row = el('button', 'design' + (selecting ? ' selecting' : '')); row.dataset.id = item.id;
      row.setAttribute('data-i18n-preserve-attributes', 'aria-label');
      row.setAttribute('aria-label', translate(selecting ? 'Select' : 'Open') + ' ' + item.name);
      if (selecting) {
        row.setAttribute('aria-pressed', String(selected === item.id));
        const check = el('span', 'selection', selected === item.id ? '✓' : ''); check.setAttribute('aria-hidden', 'true'); row.append(check);
      } else if (state.currentId === item.id) row.setAttribute('aria-current', 'true');
      const image = el('img', 'preview'); image.alt = ''; image.hidden = true;
      const frame = el('span', 'preview-frame ui-loading-surface');
      frame.setAttribute('aria-busy', 'true'); frame.append(image);
      const copy = el('span', 'copy'), name = el('strong', '', item.name); name.title = item.name; name.setAttribute('translate', 'no');
      const date = new Date(item.updatedAt);
      const edited = Number.isNaN(date.valueOf()) ? 'Saved in this browser' : 'Edited ' + new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium' }).format(date);
      copy.append(name, el('small', '', edited));
      if (item.id === state.currentId) copy.append(el('span', 'badge', 'Current design'));
      row.append(frame, copy); list.append(row); observer.observe(row);
    }
    select.hidden = !state.items.length; search.hidden = state.items.length <= 8;
    sort.hidden = !state.items.length; empty.hidden = !!state.items.length;
    if (!items.length && state.items.length) list.append(el('p', 'message', 'No designs match your search.'));
    note.textContent = state.localOnly ? 'Saved for your next visit in this browser.' : 'Your designs are saved. This browser holds your access.';
    note.hidden = !state.items.length;
    message.textContent = state.warning ?? ''; retry.hidden = !state.warning;
    controls();
  }
  async function run(work: () => Promise<void>, label: string, id: string | null = selected) {
    if (busy || fetching) return false;
    activeId = id;
    busy = true; status.textContent = label; message.classList.remove('error'); controls();
    const action = createLoadingState(id ? bar : add); action.start();
    const token = generation;
    try { await work(); return true; }
    catch (error) {
      message.textContent = error instanceof Error ? error.message : 'This action could not be completed. Try again.';
      message.classList.add('error'); retry.hidden = false;
      return false;
    } finally {
      action.stop(); busy = false; activeId = null; status.textContent = ''; controls();
      if (!host.hidden && token !== generation) (selecting ? select : heading).focus({ preventScroll: true });
    }
  }
  async function create() {
    let name = 'Untitled design', index = 2;
    while (state.items.some(item => item.name === name)) name = 'Untitled design ' + index++;
    const value = await dialog.open('create', name);
    if (value !== null) await run(() => actions.create(value), 'Creating design…');
  }
  add.addEventListener('click', () => { void create(); }); emptyNew.addEventListener('click', () => { void create(); });
  select.addEventListener('click', () => { selecting = !selecting; selected = null; render(); select.focus(); });
  search.addEventListener('input', render);
  retry.addEventListener('click', () => { void run(actions.refresh, 'Loading designs…'); });
  list.addEventListener('click', event => {
    const row = (event.target as Element).closest<HTMLButtonElement>('button[data-id]');
    if (!row || busy) return;
    if (selecting) { selected = selected === row.dataset.id ? null : row.dataset.id!; render(); list.querySelector<HTMLButtonElement>(`[data-id="${CSS.escape(row.dataset.id!)}"]`)?.focus(); }
    else void run(() => actions.open(row.dataset.id!), 'Opening design…', row.dataset.id!);
  });
  rename.addEventListener('click', async () => {
    const row = selectedRow(); if (!row) return;
    const name = await dialog.open('rename', row.name);
    if (name !== null) await run(() => actions.rename(row.id, name), 'Renaming design…');
  });
  duplicate.addEventListener('click', () => { const row = selectedRow(); if (row) void run(() => actions.duplicate(row.id), 'Duplicating design…'); });
  remove.addEventListener('click', async () => {
    const row = selectedRow(); if (!row) return;
    if (await dialog.open('delete', row.name) === null) return;
    if (await run(() => actions.remove(row.id, row.revision), 'Deleting design…')) {
      selecting = false; selected = null; render(); heading.focus();
    }
  });
  shadow.addEventListener('keydown', event => {
    if ((event as KeyboardEvent).key === 'Escape' && selecting && !shadow.querySelector('dialog[open]')) {
      selecting = false; selected = null; render(); select.focus();
    }
  });
  render();
  const stopDates = onLanguageChange(render);
  return {
    get visible() { return !host.hidden; },
    update(next: LibraryState) { state = next; loaded = true; message.classList.remove('error'); render(); },
    loading(on: boolean) {
      fetching = on;
      if (on) { status.textContent = 'Loading your designs…'; message.textContent = ''; message.classList.remove('error'); retry.hidden = true; }
      else if (!busy) status.textContent = '';
      controls();
    },
    show() { host.dataset.theme = document.documentElement.dataset.theme ?? 'light'; host.hidden = false; heading.focus({ preventScroll: true }); },
    hide() { host.hidden = true; selecting = false; selected = null; search.value = ''; },
    error(text: string) { loaded = true; message.textContent = text; message.classList.add('error'); retry.hidden = false; controls(); },
    dispose() { stopDates(); stopTranslation(); language.dispose(); observer.disconnect(); dialog.dispose(); host.remove(); },
  };
}
