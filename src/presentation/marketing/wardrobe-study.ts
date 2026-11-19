import { STARTER_WARDROBE_SHAPES, starterDesignHref } from '../../domain/project/starter-design';
import { studyMeasure, studySvg } from './study';

export function mountWardrobeStudy(doc: Document) {
  const width = doc.querySelector<HTMLInputElement>('#study-width');
  if (!width) return;
  const room = width.closest<HTMLElement>('.fitting-room')!;
  const preview = room.querySelector<HTMLElement>('.study-fallback')!;
  const output = room.querySelector<HTMLOutputElement>('#width-output')!;
  const link = room.querySelector<HTMLAnchorElement>('#study-start')!;
  const choices = room.querySelectorAll<HTMLButtonElement>('.study-shapes button');
  const lang = doc.documentElement.lang || 'en';

  const render = () => {
    const shape = STARTER_WARDROBE_SHAPES.find(id => id === room.dataset.shape) ?? 'regular';
    const cm = width.valueAsNumber;
    const measure = studyMeasure(cm, false, lang);
    output.value = new Intl.NumberFormat(lang).format(cm);
    output.setAttribute('aria-label', measure);
    width.setAttribute('aria-valuetext', measure);
    preview.innerHTML = studySvg({ width: cm, shape, finish: 'chalk', inches: false }, lang);
    link.setAttribute('href', starterDesignHref(lang, { kind: 'wardrobe', width: cm, shape }));
    for (const choice of choices) choice.setAttribute('aria-pressed', String(choice.dataset.shape === shape));
  };

  width.addEventListener('input', render);
  for (const choice of choices) choice.addEventListener('click', () => {
    room.dataset.shape = choice.dataset.shape!;
    render();
  });
  doc.defaultView?.addEventListener('pageshow', render);
  render();
}
