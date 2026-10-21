import type { DesignImageRequest } from '../../application/projects/design-image';
import type { createEditorLifetime } from '../viewport/editor-lifetime.js';

const star = '<path d="M32 2C35 23 41 29 62 32C41 35 35 41 32 62C29 41 23 35 2 32C23 29 29 23 32 2Z"/>';
const captions = [
  'Your design. A whole new light.',
  'A little patience. A lot of possibility.',
  'Inspired by every angle and detail of your design.',
];

/** Decorative animation; the viewer owns the live status and the actual request. */
export function createDesignImageLoading(page: Document, lifetime: ReturnType<typeof createEditorLifetime>) {
  const element = page.createElement('section');
  element.className = 'ai-magic'; element.hidden = true; element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `<div class="ai-magic-top"><span>✧ A LITTLE DESIGN MAGIC</span><span class="ai-magic-quality">1K IMAGE</span></div>
    <div class="ai-magic-art">
      <div class="ai-magic-halo"></div><div class="ai-magic-orbit"></div><div class="ai-magic-orbit ai-magic-orbit-inner"></div>
      <div class="ai-magic-cards">${['left', 'front', 'right'].map(view => `<div class="ai-magic-card" data-view="${view}">
        <div class="ai-magic-card-image"><img alt=""><span></span></div><div class="ai-magic-card-label">${view === 'front' ? 'FRONT VIEW' : `${view.toUpperCase()} VIEW`}</div></div>`).join('')}</div>
      <div class="ai-magic-spark"><svg viewBox="0 0 64 64">${star}</svg></div>
      ${[1, 2, 3, 4, 5, 6].map(index => `<svg class="ai-magic-dust ai-magic-dust-${index}" viewBox="0 0 64 64">${star}</svg>`).join('')}
    </div>
    <div class="ai-magic-copy"><h3>A little magic.<br>A new perspective.</h3>
      <p class="ai-magic-caption">Preparing your design for its close-up.</p></div>
    <div class="ai-magic-progress"><span></span></div>
    <div class="ai-magic-steps"><span class="ai-magic-prepare">Three design views</span><span class="ai-magic-render">Creating your image</span></div>
    <p class="ai-magic-wait">Great details take a little time. Usually a minute or two.</p>`;
  const caption = element.querySelector<HTMLElement>('.ai-magic-caption')!;
  const wait = element.querySelector<HTMLElement>('.ai-magic-wait')!;
  let timer: ReturnType<typeof lifetime.timeout> | undefined;
  let longWaitTimer: ReturnType<typeof lifetime.timeout> | undefined;
  function stop() {
    if (timer !== undefined) lifetime.cancelTimeout(timer);
    if (longWaitTimer !== undefined) lifetime.cancelTimeout(longWaitTimer);
    timer = undefined; longWaitTimer = undefined; element.hidden = true;
    element.querySelectorAll('img').forEach(image => image.removeAttribute('src'));
  }
  function start() {
    stop(); element.hidden = false; element.classList.remove('is-rendering');
    caption.textContent = 'Preparing your design for its close-up.';
    wait.textContent = 'Great details take a little time. Usually a minute or two.';
  }
  function prepared(request: DesignImageRequest) {
    element.classList.add('is-rendering');
    for (const reference of request.references) {
      const image = element.querySelector<HTMLImageElement>(`[data-view="${reference.view}"] img`)!;
      image.src = `data:${reference.mimeType};base64,${reference.data}`;
    }
    let index = 0;
    caption.textContent = captions[index]!;
    const rotateCaption = () => {
      index = (index + 1) % captions.length; caption.textContent = captions[index]!;
      timer = lifetime.timeout(rotateCaption, 9_000);
    };
    timer = lifetime.timeout(rotateCaption, 9_000);
    longWaitTimer = lifetime.timeout(() => {
      wait.textContent = 'Your image is still being created. Thanks for giving it a little more time.';
    }, 60_000);
  }
  lifetime.cleanup(stop);
  return { element, start, prepared, stop };
}
