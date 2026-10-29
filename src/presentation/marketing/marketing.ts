import './marketing.css';
import './assembly.css';
import { studyMeasure, studySvg, type StudyState, type StudyShape } from './study';
import { editorEntry } from './entry-route';
import { assemblyCopy } from './assembly-copy';
import type { AssemblyScene } from './assembly-scene';

// Old shared links and checkout returns must still reach the editor, with their payload intact.
const destination = editorEntry(location.href);
if (destination) location.replace(destination);

const room = document.querySelector<HTMLElement>('.fitting-room');
if (room) {
  const lang = document.documentElement.lang || 'en';
  const state: StudyState = { width: 240, shape: room.dataset.shape as StudyShape, finish: 'chalk', inches: false };
  const canvas = room.querySelector<HTMLElement>('#study-canvas')!;
  const width = room.querySelector<HTMLInputElement>('#study-width')!;
  const output = room.querySelector<HTMLOutputElement>('#width-output')!;
  const start = room.querySelector<HTMLAnchorElement>('#study-start')!;
  const assembly = room.querySelector<HTMLInputElement>('#study-assembly')!;
  const play = room.querySelector<HTMLButtonElement>('.assembly-play')!;
  const labels = assemblyCopy(lang);
  let scene: AssemblyScene | null = null, progress = 0, animation = 0;
  const stop = () => {
    cancelAnimationFrame(animation); animation = 0;
    play.dataset.playing = 'false'; play.setAttribute('aria-label', labels.play); play.title = labels.play;
  };
  const setAssembly = (value: number) => {
    progress = value; assembly.value = String(Math.round(value * 100));
    assembly.setAttribute('aria-valuetext', `${Math.round(value * 100)}%`);
    assembly.style.setProperty('--assembly-progress', `${value * 100}%`);
    room.querySelector('.assembly-percent')!.textContent = `${Math.round(value * 100)}%`;
    scene?.update(state, progress);
  };
  const update = () => {
    if (scene) scene.update(state, progress);
    else canvas.querySelector('.study-fallback')!.innerHTML = studySvg(state, lang);
    const measure = studyMeasure(state.width, state.inches, lang);
    output.value = measure.replace(/\s(?:cm|in)$/, ''); output.setAttribute('aria-label', measure);
    width.setAttribute('aria-valuetext', measure);
    width.style.setProperty('--width-progress', `${(state.width - 140) / 180 * 100}%`);
    const spec = { specVersion: 1, name: 'My furniture idea', wardrobes: [{ width: state.width, height: 240,
      depth: 60, shape: state.shape, autoDesign: false }] };
    start.href = '/editor/#spec=' + encodeURIComponent(JSON.stringify(spec));
  };
  width.addEventListener('input', () => { state.width = Number(width.value); update(); });
  room.querySelector<HTMLSelectElement>('#study-units')!.addEventListener('change', event => {
    state.inches = (event.target as HTMLSelectElement).value === 'in'; update();
  });
  room.querySelectorAll<HTMLButtonElement>('button[data-shape]').forEach(button => button.addEventListener('click', () => {
    state.shape = button.dataset.shape as StudyShape;
    room.dataset.shape = state.shape;
    room.querySelectorAll('button[data-shape]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    update();
  }));
  assembly.addEventListener('input', () => { stop(); setAssembly(Number(assembly.value) / 100); });
  play.addEventListener('click', () => {
    if (animation) { stop(); return; }
    const from = progress < .98 ? progress : 0;
    setAssembly(from);
    const began = performance.now(), duration = (1 - from) * 4400;
    play.dataset.playing = 'true'; play.setAttribute('aria-label', labels.pause); play.title = labels.pause;
    const frame = (now: number) => {
      const t = Math.min(1, (now - began) / duration); setAssembly(from + (1 - from) * t);
      if (t < 1) animation = requestAnimationFrame(frame); else stop();
    };
    animation = requestAnimationFrame(frame);
  });
  room.querySelector('.assembly-reset')!.addEventListener('click', () => { stop(); setAssembly(0); scene?.reset(); });
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
    scene.update(state, progress);
    canvas.setAttribute('aria-busy', 'false');
    assembly.disabled = false; play.disabled = false;
    setAssembly(progress);
  }).catch(() => {
    scene?.dispose(); scene = null;
    canvas.setAttribute('aria-busy', 'false'); room.dataset.renderer = 'unavailable';
    canvas.querySelector('.assembly-status')!.textContent = labels.unavailable;
  });
}
