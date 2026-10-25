import type { createEditorLifetime } from '../viewport/editor-lifetime.js';
import { createLoadingPlaceholder, createLoadingState } from '../components/loading-state';

export type OrbitPhase = 'generating' | 'cancelled' | 'complete';
export interface DesignImageLoadingOptions {
  isDebug?: boolean;
  onCancel?: () => void;
  onRestart?: () => void;
}

/** The pending image keeps the shape of the result, with the shared component-wide gleam. */
export function createDesignImageLoading(
  page: Document,
  lifetime: ReturnType<typeof createEditorLifetime>,
  options: DesignImageLoadingOptions = {},
) {
  const element = page.createElement('div');
  element.className = 'ai-image-wait ai-magic'; element.hidden = true;
  element.innerHTML = `<section class="ai-image-wait-content">
    <div class="ai-image-wait-preview"></div>
    <div class="ai-image-wait-copy" role="status" aria-live="polite" aria-atomic="true">
      <h2>Creating your image</h2><p class="ai-magic-caption">Preparing your design…</p>
      <p class="ai-magic-wait">This can take about a minute.</p>
    </div>
    <button type="button" class="ai-image-wait-cancel ai-cancel">Cancel</button>
  </section>
  <div class="demo-preview-actions"${options.isDebug ? '' : ' hidden'}>
    <button type="button" class="demo-replay">Replay</button>
    <button type="button" class="demo-preview-complete">Preview completion</button>
  </div>`;
  const preview = createLoadingPlaceholder(page, 'Creating your image…', 'canvas');
  // The visible copy owns the live announcement; the illustration is decorative.
  preview.removeAttribute('role'); preview.removeAttribute('aria-live'); preview.setAttribute('aria-hidden', 'true');
  element.querySelector('.ai-image-wait-preview')!.append(preview);
  const gleam = createLoadingState(preview);
  preview.classList.remove('ui-loading-surface');
  const heading = element.querySelector('h2')!;
  const status = element.querySelector<HTMLElement>('.ai-magic-caption')!;
  const caption = element.querySelector<HTMLElement>('.ai-magic-wait')!;
  const cancel = element.querySelector<HTMLButtonElement>('.ai-cancel')!;
  let phase: OrbitPhase = 'generating';
  function setPhase(next: OrbitPhase) {
    phase = next; element.dataset.phase = next;
    heading.textContent = next === 'complete' ? 'Your image is ready' : next === 'cancelled' ? 'Creation paused' : 'Creating your image';
    status.textContent = next === 'complete' ? 'A new perspective on your space.' : next === 'cancelled' ? 'Your design is ready when you are.' : 'Preparing your design…';
    caption.hidden = next !== 'generating';
    cancel.textContent = next === 'generating' ? 'Cancel' : 'Create another';
    if (next === 'generating') gleam.start(); else gleam.stop();
  }
  function stop() { gleam.stop(); element.hidden = true; element.classList.remove('is-rendering'); }
  lifetime.listen(cancel, 'click', () => { if (phase === 'generating') options.onCancel?.(); else options.onRestart?.(); });
  lifetime.listen(element.querySelector('.demo-replay')!, 'click', () => { setPhase('generating'); options.onRestart?.(); });
  lifetime.listen(element.querySelector('.demo-preview-complete')!, 'click', () => setPhase('complete'));
  lifetime.cleanup(stop);
  return {
    element, cancel, stop, setPhase,
    start() { stop(); element.hidden = false; setPhase('generating'); },
    rendering() { element.classList.add('is-rendering'); status.textContent = 'Rendering your image…'; },
    setStatus(text: string) { status.textContent = text; },
    getPhase: () => phase,
  };
}
