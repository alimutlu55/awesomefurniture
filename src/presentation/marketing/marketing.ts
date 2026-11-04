import './marketing.css';
import { editorEntry } from './entry-route';
import { mountThemeToggle } from './theme-toggle';
import { mountLanguagePicker } from './language-picker';

mountThemeToggle();
mountLanguagePicker();

// Shared links and checkout returns must reach the editor with their payload intact.
const destination = editorEntry(location.href);
if (destination) {
  location.replace(destination);
}

// Keep decoding work to visible films and respect the visitor's motion preference.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const films = Array.from(document.querySelectorAll<HTMLVideoElement>('.stage video'));
const visibility = new Map<HTMLVideoElement, number>();

const reconcileFilms = () => {
  if (document.hidden || reduceMotion.matches) {
    films.forEach(video => video.pause());
    return;
  }
  films.forEach(video => {
    const isVisible = (visibility.get(video) || 0) >= 0.15;
    if (isVisible && video.paused) {
      void video.play().catch(() => {});
    } else if (!isVisible && !video.paused) {
      video.pause();
    }
  });
};

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => visibility.set(entry.target as HTMLVideoElement, entry.isIntersecting ? entry.intersectionRatio : 0));
  reconcileFilms();
}, { threshold: [0, 0.15, 0.35, 0.6, 1] });

films.forEach(video => {
  observer.observe(video);
  if (!video.src && video.dataset.src) video.src = video.dataset.src;
});

reduceMotion.addEventListener('change', event => {
  if (event.matches) films.forEach(video => video.pause());
  else reconcileFilms();
});
document.addEventListener('visibilitychange', reconcileFilms);

const preview = document.querySelector<HTMLElement>('.wardrobe-preview');
if (preview) void import('./clothes-preview').then(({ mountPreview }) => mountPreview(preview));

document.querySelectorAll<HTMLInputElement>('.kitchen-comparison input').forEach(input => {
  input.addEventListener('input', () => input.parentElement!.style.setProperty('--reveal', input.value + '%'));
});
