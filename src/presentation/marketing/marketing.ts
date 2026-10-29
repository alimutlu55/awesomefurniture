import './marketing.css';
import './assembly.css';
import { studyMeasure, studySvg, type StudyState, type StudyShape, type StudyFinish } from './study';
import { editorEntry } from './entry-route';
import { assemblyCopy } from './assembly-copy';
import type { AssemblyScene } from './assembly-scene';

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
  const assembly = room.querySelector<HTMLInputElement>('#study-assembly')!;
  const play = room.querySelector<HTMLButtonElement>('.assembly-play')!;
  const stages = [...room.querySelectorAll<HTMLButtonElement>('[data-assembly]')];
  const labels = assemblyCopy(lang);
  let scene: AssemblyScene | null = null, drawing = false, progress = .72, animation = 0, resume = false;
  const stop = () => {
    cancelAnimationFrame(animation); animation = 0; resume = false;
    play.dataset.playing = 'false'; play.setAttribute('aria-label', labels.play); play.title = labels.play;
  };
  const setAssembly = (value: number) => {
    progress = value; assembly.value = String(Math.round(value * 100));
    assembly.setAttribute('aria-valuetext', `${Math.round(value * 100)}%`);
    assembly.style.setProperty('--assembly-progress', `${value * 100}%`);
    room.querySelector('.assembly-percent')!.textContent = `${Math.round(value * 100)}%`;
    stages.forEach((button, i) => button.setAttribute('aria-pressed', String(i === (value < .24 ? 0 : value < .88 ? 1 : 2))));
    scene?.update(state, progress, drawing);
  };
  const update = () => {
    if (scene) scene.update(state, progress, drawing);
    else canvas.querySelector('.study-fallback')!.innerHTML = studySvg(state, lang);
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
    drawing = button.dataset.view === 'drawing';
    room.querySelectorAll('button[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    scene?.update(state, progress, drawing);
  }));
  assembly.addEventListener('input', () => { stop(); setAssembly(Number(assembly.value) / 100); });
  stages.forEach(button => button.addEventListener('click', () => { stop(); setAssembly(Number(button.dataset.assembly) / 100); }));
  play.addEventListener('click', () => {
    if (animation) { stop(); resume = true; return; }
    const from = resume && progress < .98 ? progress : 0;
    setAssembly(from);
    const began = performance.now(), duration = (1 - from) * 6500;
    play.dataset.playing = 'true'; play.setAttribute('aria-label', labels.pause); play.title = labels.pause;
    const frame = (now: number) => {
      const t = Math.min(1, (now - began) / duration); setAssembly(from + (1 - from) * t);
      if (t < 1) animation = requestAnimationFrame(frame); else stop();
    };
    animation = requestAnimationFrame(frame);
  });
  room.querySelector('.assembly-reset')!.addEventListener('click', () => scene?.reset());
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  const visibility = new IntersectionObserver(entries => { if (!entries[0]!.isIntersecting) stop(); });
  visibility.observe(room);
  let ended = false;
  window.addEventListener('pagehide', event => {
    stop();
    if (!event.persisted) { ended = true; visibility.disconnect(); scene?.dispose(); }
  });
  update();
  // Keep the static page immediate; fetch the 3D runtime independently of the editor and account code.
  void import('./assembly-scene').then(({ createAssemblyScene }) => {
    if (ended) return;
    scene = createAssemblyScene(canvas, `${labels.slider}. ${labels.rotate}.`, labels.unavailable);
    scene.update(state, progress, drawing);
    canvas.setAttribute('aria-busy', 'false');
    assembly.disabled = false; play.disabled = false; stages.forEach(button => { button.disabled = false; });
    setAssembly(progress);
  }).catch(() => {
    scene?.dispose(); scene = null;
    canvas.setAttribute('aria-busy', 'false'); room.dataset.renderer = 'unavailable';
    canvas.querySelector('.assembly-status')!.textContent = labels.unavailable;
  });
}
