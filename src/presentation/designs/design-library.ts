import type { ProjectSummary } from '../../application/ports/project-repository';
import { createDesignDialog } from './name-dialog';
import styles from './design-library.css?raw';

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
  const style = document.createElement('style'); style.textContent = styles; shadow.append(style);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  const page = el('section', 'page'); page.setAttribute('aria-label', 'Your designs');
  const content = el('div', 'content'), header = el('header');
  const heading = el('h1', '', 'Your designs'); heading.tabIndex = -1;
  const select = el('button', 'select', 'Select'); select.setAttribute('aria-pressed', 'false');
  const add = el('button', 'new', '＋'); add.setAttribute('aria-label', 'New design');
  header.append(heading, select, add);
  const sort = el('p', 'sort', 'Recently edited');
  const search = el('input', 'search'); search.type = 'search'; search.placeholder = 'Find a design'; search.setAttribute('aria-label', 'Find a design');
  const message = el('p', 'message'); message.setAttribute('role', 'status');
  const retry = el('button', 'retry', 'Retry'); retry.hidden = true;
  const status = el('div', 'status'); status.setAttribute('role', 'status');
  const list = el('div', 'list');
  const empty = el('div', 'empty');
  empty.append(el('h2', '', 'A place for your ideas.'), el('p', '', 'Start a design for your room.'));
  const emptyNew = el('button', 'primary', 'New design'); empty.append(emptyNew);
  const note = el('p', 'note');
  const bar = el('div', 'managebar'); bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Selected design actions');
  const rename = el('button', '', 'Rename'), duplicate = el('button', '', 'Duplicate'), remove = el('button', 'danger', 'Delete');
  bar.append(rename, duplicate, remove);
  content.append(header, sort, search, message, retry, status, list, empty, note); page.append(content); shadow.append(page, bar);
  const dialog = createDesignDialog(document, shadow);
  document.body.append(host);
  let state: LibraryState = { items: [], currentId: null, warning: null, localOnly: true };
  let selecting = false, selected: string | null = null, busy = false, generation = 0;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      observer.unobserve(entry.target);
      const row = entry.target as HTMLButtonElement, img = row.querySelector('img');
      if (img) void actions.preview(row.dataset.id!).then(source => {
        if (source && img.isConnected) { img.src = source; img.hidden = false; }
      }).catch(() => undefined);
    }
  }, { root: page, rootMargin: '200px' });
  function selectedRow() { return state.items.find(item => item.id === selected); }
  function controls() {
    select.textContent = selecting ? 'Done' : 'Select'; select.setAttribute('aria-pressed', String(selecting));
    select.disabled = busy; add.disabled = busy; emptyNew.disabled = busy;
    bar.hidden = !selecting;
    for (const button of [rename, duplicate, remove]) button.disabled = busy || !selectedRow();
    for (const row of list.querySelectorAll('button')) row.disabled = busy;
    host.setAttribute('aria-busy', String(busy));
  }
  function render() {
    generation++; observer.disconnect();
    if (!selectedRow()) selected = null;
    const query = search.value.toLocaleLowerCase();
    const items = state.items.filter(row => row.name.toLocaleLowerCase().includes(query));
    list.replaceChildren();
    for (const item of items) {
      const row = el('button', 'design' + (selecting ? ' selecting' : '')); row.dataset.id = item.id;
      row.setAttribute('aria-label', (selecting ? 'Select ' : 'Open ') + item.name);
      if (selecting) {
        row.setAttribute('aria-pressed', String(selected === item.id));
        const check = el('span', 'selection', selected === item.id ? '✓' : ''); check.setAttribute('aria-hidden', 'true'); row.append(check);
      } else if (state.currentId === item.id) row.setAttribute('aria-current', 'true');
      const image = el('img', 'preview'); image.alt = ''; image.hidden = true;
      const copy = el('span', 'copy'), name = el('strong', '', item.name); name.title = item.name;
      const date = new Date(item.updatedAt);
      const edited = Number.isNaN(date.valueOf()) ? 'Saved in this browser' : 'Edited ' + new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
      copy.append(name, el('small', '', edited));
      if (item.id === state.currentId) copy.append(el('span', 'badge', 'Current design'));
      row.append(image, copy); list.append(row); observer.observe(row);
    }
    select.hidden = !state.items.length; search.hidden = state.items.length <= 8;
    sort.hidden = !state.items.length; empty.hidden = !!state.items.length;
    if (!items.length && state.items.length) list.append(el('p', 'message', 'No designs match your search.'));
    note.textContent = state.localOnly ? 'Saved for your next visit in this browser.' : 'Your designs are saved. This browser holds your access.';
    note.hidden = !state.items.length;
    message.textContent = state.warning ?? ''; retry.hidden = !state.warning;
    controls();
  }
  async function run(work: () => Promise<void>, label: string) {
    if (busy) return false;
    busy = true; status.textContent = label; message.classList.remove('error'); controls();
    const token = generation;
    try { await work(); return true; }
    catch (error) {
      message.textContent = error instanceof Error ? error.message : 'This action could not be completed. Try again.';
      message.classList.add('error'); retry.hidden = false;
      return false;
    } finally {
      busy = false; status.textContent = ''; controls();
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
    else void run(() => actions.open(row.dataset.id!), 'Opening design…');
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
  return {
    get visible() { return !host.hidden; },
    update(next: LibraryState) { state = next; render(); },
    show() { host.dataset.theme = document.documentElement.dataset.theme ?? 'light'; host.hidden = false; heading.focus({ preventScroll: true }); },
    hide() { host.hidden = true; selecting = false; selected = null; search.value = ''; },
    error(text: string) { message.textContent = text; message.classList.add('error'); retry.hidden = false; },
    dispose() { observer.disconnect(); dialog.dispose(); host.remove(); },
  };
}
