import type { createEditorDom } from '../editor/editor-dom';
import type { createEditorLifetime } from '../viewport/editor-lifetime.js';
import type { DesignImageRequest, GeneratedDesignImage } from '../../application/projects/design-image';
import { requestDesignImage } from './design-image-client';

interface Ports {
  dom: ReturnType<typeof createEditorDom>; lifetime: ReturnType<typeof createEditorLifetime>;
  capture(): DesignImageRequest;
}
const dataUrl = (image: GeneratedDesignImage) => `data:${image.mimeType};base64,${image.data}`;
const sparkle = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/></svg>';

export function bindDesignImageViewer({ dom, lifetime, capture }: Ports) {
  const page = dom.host.ownerDocument, button = page.createElement('button');
  button.type = 'button'; button.className = 'tb ai-image-button'; button.ariaLabel = 'Generate image with AI';
  button.title = 'Generate image with AI'; button.innerHTML = sparkle + '<span>AI image</span>';
  dom.$('#topright').prepend(button);
  const dialog = page.createElement('dialog'); dialog.className = 'ai-image-dialog';
  dialog.ariaLabel = 'Generate image with AI';
  dialog.innerHTML = `<header><div><h2>See your design come to life</h2><p>Professional photography, made from your design.</p></div>
    <button type="button" class="ai-close" aria-label="Close AI image">×</button></header>
    <div class="ai-content"><p class="ai-status" role="status" aria-live="polite"></p>
      <div class="ai-result" hidden><img alt="AI-generated professional photograph of your design"><p>AI visualization · Check details against your design.</p>
      <a class="ai-download" download="design-ai.png">Download image</a></div>
      <div class="ai-references" hidden><h3>Your design references</h3><div class="ai-reference-grid"></div>
      <button type="button" class="ai-json">Download design JSON</button></div></div>
    <footer><p>Your design and three views are sent to Google Gemini to create the image.</p>
      <button type="button" class="ai-generate">Generate image</button></footer>`;
  dom.$('#app').append(dialog);
  const status = dialog.querySelector<HTMLElement>('.ai-status')!;
  const generate = dialog.querySelector<HTMLButtonElement>('.ai-generate')!;
  const references = dialog.querySelector<HTMLElement>('.ai-references')!;
  const grid = dialog.querySelector<HTMLElement>('.ai-reference-grid')!;
  const result = dialog.querySelector<HTMLElement>('.ai-result')!;
  const download = dialog.querySelector<HTMLAnchorElement>('.ai-download')!;
  let current: DesignImageRequest | null = null, controller: AbortController | null = null;
  let imageUrl: string | null = null, disposed = false;
  const downloadUrls = new Set<string>();
  const releaseImage = () => { if (imageUrl) URL.revokeObjectURL(imageUrl); imageUrl = null; };
  function close() { controller?.abort(); dialog.close(); button.focus(); }
  async function run() {
    if (controller) return;
    const request = new AbortController(); controller = request;
    generate.disabled = true; generate.textContent = 'Generating…';
    status.textContent = 'Preparing three views of your design…'; status.classList.remove('is-error');
    dialog.setAttribute('aria-busy', 'true');
    try {
      // Let the progress message paint before synchronous WebGL capture. The snapshot and views are then captured together.
      await new Promise<void>(resolve => lifetime.frame(() => lifetime.frame(() => resolve())));
      if (request.signal.aborted || disposed) return;
      current = capture();
      references.hidden = false; grid.replaceChildren();
      for (const image of current.references) {
        const link = page.createElement('a'), preview = page.createElement('img'), label = page.createElement('span');
        link.href = dataUrl(image); link.download = `design-${image.view}.jpg`;
        preview.src = link.href; preview.alt = `${image.view} reference view`;
        label.textContent = image.view === 'front' ? 'Front' : image.view === 'left' ? 'Left perspective' : 'Right perspective';
        link.append(preview, label); grid.append(link);
      }
      status.textContent = 'Creating your professional image with Gemini. This can take a couple of minutes…';
      const output = await requestDesignImage(current, AbortSignal.any([request.signal, AbortSignal.timeout(160_000)]));
      if (disposed || request.signal.aborted) return;
      const bytes = Uint8Array.from(atob(output.image.data), char => char.charCodeAt(0));
      releaseImage(); imageUrl = URL.createObjectURL(new Blob([bytes], { type: output.image.mimeType }));
      result.querySelector('img')!.src = imageUrl; download.href = imageUrl;
      download.download = `design-ai.${output.image.mimeType === 'image/jpeg' ? 'jpg' : output.image.mimeType.split('/')[1]}`;
      result.hidden = false; status.textContent = 'Your image is ready.';
    } catch (error) {
      if (disposed || request.signal.aborted) return;
      status.textContent = (error as Error).name === 'TimeoutError' ? 'Image generation took too long. Please try again.' : (error as Error).message;
      status.classList.add('is-error');
    } finally {
      controller = null;
      if (!disposed) {
        if (request.signal.aborted) status.textContent = 'Generation cancelled. You can try again.';
        generate.disabled = false; generate.textContent = 'Generate again'; dialog.removeAttribute('aria-busy');
      }
    }
  }
  lifetime.listen(button, 'click', () => {
    if (dialog.open) return;
    dialog.showModal();
    if (!current && !controller) void run();
  });
  lifetime.listen(generate, 'click', () => { void run(); });
  lifetime.listen(dialog.querySelector('.ai-close')!, 'click', close);
  lifetime.listen(dialog, 'cancel', (event: Event) => { event.preventDefault(); close(); });
  lifetime.listen(dialog, 'keydown', (event: Event) => { event.stopPropagation(); });
  lifetime.listen(dialog.querySelector('.ai-json')!, 'click', () => {
    if (!current) return;
    const json = { ...current.specification, referenceViews: current.references.map(({ data: _data, ...view }) => view) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }));
    downloadUrls.add(url);
    const link = page.createElement('a'); link.href = url; link.download = 'design-specification.json';
    dialog.append(link); link.click(); link.remove();
    lifetime.timeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 10_000);
  });
  lifetime.cleanup(() => {
    disposed = true; controller?.abort(); releaseImage(); downloadUrls.forEach(url => URL.revokeObjectURL(url));
    dialog.remove(); button.remove(); current = null;
  });
  return { close };
}
