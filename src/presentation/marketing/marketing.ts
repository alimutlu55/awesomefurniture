import './marketing.css';
import { studyMeasure, studySvg, type StudyState, type StudyShape, type StudyFinish } from './study';
import { editorEntry } from './entry-route';

// Old shared links and checkout returns must still reach the editor, with their payload intact.
const destination = editorEntry(location.href);
if (destination) location.replace(destination);

const room = document.querySelector<HTMLElement>('.fitting-room');
if (room) {
  const lang = document.documentElement.lang || 'en';
  const state: StudyState = { width: 240, shape: room.dataset.shape as StudyShape, finish: 'oak', inches: false };
  const canvas = room.querySelector<HTMLElement>('#study-canvas')!;
  const width = room.querySelector<HTMLInputElement>('#study-width')!;
  const output = room.querySelector<HTMLOutputElement>('#width-output')!;
  const start = room.querySelector<HTMLAnchorElement>('#study-start')!;
  const finishName = room.querySelector<HTMLElement>('#finish-name')!;
  const finishButtons = [...room.querySelectorAll<HTMLButtonElement>('[data-finish]')];
  const update = () => {
    canvas.innerHTML = studySvg(state, lang);
    output.value = studyMeasure(state.width, state.inches, lang);
    width.setAttribute('aria-valuetext', output.value);
    const coordinate = room.querySelector('.study-coordinate');
    if (coordinate) coordinate.textContent = `X ${state.width * 10} · Y 2400 · Z 600`;
    const spec = { specVersion: 1, name: 'My furniture idea', wardrobes: [{ width: state.width, height: 240,
      depth: 60, shape: state.shape, autoDesign: false }] };
    start.href = '/editor/#spec=' + encodeURIComponent(JSON.stringify(spec));
  };
  width.addEventListener('input', () => { state.width = Number(width.value); update(); });
  room.querySelector<HTMLSelectElement>('#study-units')!.addEventListener('change', event => {
    state.inches = (event.target as HTMLSelectElement).value === 'in'; update();
  });
  finishButtons.forEach(button => button.addEventListener('click', () => {
    state.finish = button.dataset.finish as StudyFinish;
    finishButtons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    finishName.textContent = button.getAttribute('aria-label');
    update();
  }));
  room.querySelectorAll<HTMLButtonElement>('button[data-shape]').forEach(button => button.addEventListener('click', () => {
    state.shape = button.dataset.shape as StudyShape;
    room.dataset.shape = state.shape;
    room.querySelectorAll('button[data-shape]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    update();
  }));
  room.querySelectorAll<HTMLButtonElement>('button[data-view]').forEach(button => button.addEventListener('click', () => {
    room.dataset.view = button.dataset.view;
    room.querySelectorAll('button[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  }));
  update();
}
