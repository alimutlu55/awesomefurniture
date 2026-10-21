import type { createEditorLifetime } from '../viewport/editor-lifetime.js';

const star = '<path d="M32 2C35 23 41 29 62 32C41 35 35 41 32 62C29 41 23 35 2 32C23 29 29 23 32 2Z"/>';
const preparing = 'Getting your design ready…';
const captions = [
  'Setting the scene…',
  'Composing the perfect shot…',
  'Balancing natural light…',
  'Refining materials and textures…',
  'Adding the finishing touches…',
];

/**
 * Decorative waiting experience. It never shows technical inputs (reference views, JSON):
 * the viewer owns the accessible status, the request and cancellation.
 */
export function createDesignImageLoading(page: Document, lifetime: ReturnType<typeof createEditorLifetime>) {
  const element = page.createElement('section');
  element.className = 'ai-magic'; element.hidden = true;
  element.innerHTML = `<div class="ai-magic-aurora" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    <div class="ai-magic-stage" aria-hidden="true">
      <div class="ai-magic-ring"></div><div class="ai-magic-ring ai-magic-ring-2"></div>
      <div class="ai-magic-orb"><svg viewBox="0 0 64 64">${star}</svg></div>
      ${[1, 2, 3, 4, 5, 6].map(index => `<svg class="ai-magic-dust ai-magic-dust-${index}" viewBox="0 0 64 64">${star}</svg>`).join('')}
    </div>
    <div class="ai-magic-copy">
      <h2>Creating your image</h2>
      <p class="ai-magic-caption" aria-hidden="true">${preparing}</p>
      <div class="ai-magic-progress" aria-hidden="true"><span></span></div>
      <p class="ai-magic-wait">Usually about a minute.</p>
    </div>
    <button type="button" class="ai-button ai-glass ai-cancel">Cancel</button>`;
  const caption = element.querySelector<HTMLElement>('.ai-magic-caption')!;
  const wait = element.querySelector<HTMLElement>('.ai-magic-wait')!;
  const cancel = element.querySelector<HTMLButtonElement>('.ai-cancel')!;
  let timer: ReturnType<typeof lifetime.timeout> | undefined;
  let longWaitTimer: ReturnType<typeof lifetime.timeout> | undefined;
  function show(text: string) {
    caption.classList.remove('is-changing');
    // Restart the caption transition so each message fades in.
    void caption.offsetWidth;
    caption.textContent = text; caption.classList.add('is-changing');
  }
  function stop() {
    if (timer !== undefined) lifetime.cancelTimeout(timer);
    if (longWaitTimer !== undefined) lifetime.cancelTimeout(longWaitTimer);
    timer = undefined; longWaitTimer = undefined; element.hidden = true;
    element.classList.remove('is-rendering');
  }
  function start() {
    stop(); element.hidden = false; show(preparing);
    wait.textContent = 'Usually about a minute.';
  }
  /** Called once the design has been captured and the request is in flight. */
  function rendering() {
    element.classList.add('is-rendering');
    let index = 0;
    show(captions[index]!);
    const rotate = () => {
      index = (index + 1) % captions.length; show(captions[index]!);
      timer = lifetime.timeout(rotate, 5_000);
    };
    timer = lifetime.timeout(rotate, 5_000);
    longWaitTimer = lifetime.timeout(() => {
      wait.textContent = 'Almost there. Beautiful images can take a little longer.';
    }, 60_000);
  }
  lifetime.cleanup(stop);
  return { element, cancel, start, rendering, stop };
}
