import type { DesignImageRequest } from '../../application/projects/design-image';
import { modelSpecification } from '../../application/projects/design-image-model-specification';
import { decorCode, getDecor } from '../../domain/materials/decor-catalog';

/** Displays captured model inputs for debugging; hidden unless the frontend log level is debug. */
export function createDesignImageReferences(page: Document, enabled: boolean) {
  const element = page.createElement('section');
  element.className = 'ai-reference-preview'; element.ariaLabel = 'References sent to Gemini'; element.hidden = true;
  element.innerHTML = `<h3>What we’ll send to Gemini</h3>
    <p>These exact views, available manufacturer swatches, and your selected board SKUs and modules will be sent to Gemini.
    The full design JSON below is for your reference and is not sent to Gemini.</p>
    <div class="ai-reference-grid"></div>
    <details><summary>View design JSON (not sent to Gemini)</summary><pre tabindex="0"></pre></details>
    <a class="ai-reference-json" download="design.json">Download JSON</a>`;
  const grid = element.querySelector('.ai-reference-grid')!;
  const json = element.querySelector('pre')!;
  const download = element.querySelector<HTMLAnchorElement>('.ai-reference-json')!;
  let urls: string[] = [];
  function clear() {
    for (const url of urls) URL.revokeObjectURL(url);
    urls = []; grid.replaceChildren(); json.textContent = ''; download.removeAttribute('href'); element.hidden = true;
  }
  function update(input: DesignImageRequest) {
    clear();
    if (!enabled) return;
    const swatches = (input.decorSwatches ?? []).map(swatch => ({ ...swatch, view: decorCode(getDecor(swatch.decorId)) + ' swatch', width: 1024, height: 576 }));
    for (const reference of [...input.references, ...swatches]) {
      const bytes = Uint8Array.from(atob(reference.data), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: reference.mimeType })); urls.push(url);
      const figure = page.createElement('figure'), link = page.createElement('a'), image = page.createElement('img');
      link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.ariaLabel = `Open ${reference.view} reference image`;
      image.src = url; image.alt = `${reference.view} reference sent to Gemini`; image.width = reference.width; image.height = reference.height;
      link.append(image);
      const caption = page.createElement('figcaption'); caption.textContent = `${reference.view} · ${reference.width} × ${reference.height}`;
      figure.append(link, caption); grid.append(figure);
    }
    const text = JSON.stringify(modelSpecification(input.specification), null, 2);
    json.textContent = text;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); urls.push(url); download.href = url;
    element.hidden = false;
  }
  return { element, update, clear };
}
