import type { MarketingCopy } from './copy';
import { guides, type Guide } from './guides';
import { homePath, languages } from './translations';
import { escapeHtml as e } from './seo';
import { studySvg } from './study';
import { assemblyCopy } from './assembly-copy';
import { stageSvg } from './stage-art';
import { homeCopy, type HomeCopy } from './home-copy';
import { languageMenu } from './language-menu';

const arrow = '<span aria-hidden="true">↗</span>';

const stageLabels: Record<string, string> = {
  hero: 'A furnished room in the FurniDraw studio',
  studio: 'Switching between the room plan and 3D studio',
  parametric: 'Exploring the furniture sizing controls',
  autolayout: 'Creating a layout from a storage list',
  make: 'Exploring furniture parts, hardware and cutting information',
  drawings: 'Reviewing dimensional technical drawings',
  render: 'Choosing an AI image style',
};

export function stageHtml(slug: string, lang = 'en'): string {
  const h = homeCopy(lang);
  const fallback = `<div class="fb">${stageSvg(slug)}</div>`;
  if (slug === 'render') return `<div class="kitchen-comparison">
    <img src="/assets/kitchen/render.jpg" alt="${e(h.features[5]!.t)} — ${e(h.render)}" width="1600" height="1000" loading="lazy">
    <img class="model-layer" src="/assets/kitchen/model.jpg" alt="${e(h.features[5]!.t)} — ${e(h.model)}" width="1600" height="1000" loading="lazy">
    <span class="compare-line" aria-hidden="true"><b>‹ ›</b></span>
    <span class="compare-tag model-tag">${e(h.model)}</span><span class="compare-tag render-tag">${e(h.render)}</span>
    <input type="range" min="0" max="100" value="50" aria-label="${e(h.compare)}">
  </div>`;
  const index = FEATURES.findIndex(feature => feature.s === slug);
  const label = h.features[index]?.t || stageLabels[slug] || stageLabels.hero!;
  return fallback
    + `<video muted loop playsinline autoplay preload="auto" poster="/assets/video/${slug}.jpg" src="/assets/video/${slug}.mp4" data-src="/assets/video/${slug}.mp4" aria-label="${e(label)}"></video>`;
}

interface FeaturePillar {
  s: string;
  t: string;
  p: string;
  b: readonly string[];
}

export const FEATURES: readonly FeaturePillar[] = [
  {
    s: 'studio',
    t: 'Set the room once. Switch 2D to 3D in a click.',
    p: 'Draw walls, set dimensions and mark constraints. Your floor plan and 3D space stay perfectly in sync.',
    b: ['2D/3D Sync', 'Exact dimensions', 'Room constraints'],
  },
  {
    s: 'parametric',
    t: 'Furniture that resizes to the millimetre.',
    p: 'Design wardrobes, cabinetry and modular pieces with real material swatches. Change a width and every panel follows.',
    b: ['Parametric', 'mm precision', 'Real materials'],
  },
  {
    s: 'autolayout',
    t: 'Tell us what you store. Get the furniture.',
    p: 'List shoes, shirts, coats and boxes. The engine proposes an optimised layout and interior to hold them all.',
    b: ['Auto-Layout', 'Storage lists', 'Optimised interior'],
  },
  {
    s: 'make',
    t: 'Open it up. Configure every part.',
    p: 'Choose shelves, drawers, doors and hardware, then review how the parts fit before anything is cut.',
    b: ['Assembly', 'Hardware', 'Cut lists'],
  },
  {
    s: 'drawings',
    t: 'Technical drawings in one click.',
    p: 'Clean plans, elevations and dimension annotations your carpenter or contractor can build from.',
    b: ['CAD-Ready Schematics', 'Elevations', 'Annotated'],
  },
  {
    s: 'render',
    t: 'See your kitchen as a finished room.',
    p: 'Drag the handle to compare the studio model with the render. Follow the wood grain, white cabinets and countertop from one view to the other.',
    b: ['AI Render', 'Finish-aware', 'Share-ready'],
  },
];

function fittingRoom(c: MarketingCopy, shape: 'regular' | 'alcove' | 'under-stairs' = 'regular'): string {
  const shapes = ['regular', 'alcove', 'under-stairs'];
  const a = assemblyCopy(c.lang);
  return `<div class="fitting-room" data-nosnippet data-shape="${shape}" data-view="drawing">
    <div class="assembly-stage">
      <div class="study-canvas" id="study-canvas" aria-busy="true">
        <div class="study-fallback">${studySvg({ width: 240, shape, finish: 'chalk', inches: false }, c.lang)}</div>
        <p class="assembly-status" role="status">${e(a.loading)}</p>
      </div>
    </div>
    <div class="study-bottomline">
      <div class="study-shapes" role="group" aria-label="${e(c.shapes[0])}">
        ${c.shapes.map((s, i) => `<button type="button" data-shape="${shapes[i]}" aria-pressed="${shapes[i] === shape}">${e(s)}</button>`).join('')}
      </div>
    </div>
    <div class="study-controls">
      <div class="width-control"><div class="width-top"><label for="study-width">${e(c.width)}</label>
        <div class="width-value"><output for="study-width" id="width-output" aria-label="240 cm">240</output></div></div>
        <input id="study-width" type="range" min="140" max="320" step="5" value="240" aria-valuetext="240 cm">
      </div>
    </div>
    <div class="study-handoff"><a id="study-start" class="text-link" href="/editor/?lang=${c.lang}">${e(c.dimensionCta)} ${arrow}</a>
      <p>${e(c.illustration)}</p></div>
  </div>`;
}

function footerHtml(c: MarketingCopy): string {
  const guideLinks = guides.map(g => `<a href="/${g.slug}/">${e(g.label)}</a>`).join(' ');
  const langLinks = languages.map(l =>
    `<a href="${homePath(l.lang)}" lang="${l.lang}" hreflang="${l.lang}">${e(l.name)}</a>`).join(' ');
  return `<footer><div class="wrap"><span>© 2026 FurniDraw.</span>`
    + `<span>${guideLinks}<a href="/llms.txt">For AI assistants</a></span></div>`
    + `<div class="wrap" style="margin-top:12px;font-size:13px;opacity:0.8">`
    + `<span>${e(c.language)}</span><span>${langLinks}</span></div></footer>`;
}

function wardrobeCount(key: string, label: string, value: number, max: number, number: string, h: HomeCopy) {
  return `<div class="wardrobe-count"><label for="count-${key}"><span class="count-index" aria-hidden="true">${number}</span>${e(label)}</label><div class="count-stepper">
    <button type="button" data-delta="-1" aria-label="${e(h.decrease)} ${e(label)}">−</button>
    <input id="count-${key}" type="number" inputmode="numeric" name="${key}" min="0" max="${max}" value="${value}" required>
    <button type="button" data-delta="1" aria-label="${e(h.increase)} ${e(label)}">+</button></div></div>`;
}

export function homeBody(c: MarketingCopy): string {
  const h = homeCopy(c.lang);
  const features = FEATURES.map((feature, i) => ({ ...feature, ...h.features[i] }));
  const workflowHtml = features.map((f, i) => {
    const num = '0' + (i + 1);
    const shortTitle = f.t.split(/[.]|,/)[0]!;
    return `<a href="#f${i + 1}"><span>${num}</span>${e(shortTitle)}</a>`;
  }).join('');

  const featuresHtml = features.map((f, i) => {
    const num = '0' + (i + 1);
    return `<section class="feat" id="f${i + 1}"><div class="wrap row">`
      + `<div class="copy"><div class="num">${num} / 06</div>`
      + `<h2>${e(f.t)}</h2><p>${e(f.p)}</p>`
      + `<div class="badges">${f.b.map(badge => `<span>${e(badge)}</span>`).join('')}</div></div>`
      + `<div class="feature-media"><div class="stage" data-slug="${f.s}">${stageHtml(f.s, c.lang)}</div></div>`
      + `</div></section>`;
  }).join('');

  return `<header><div class="wrap nav"><a class="logo" href="#top">FurniDraw<i>.</i></a>`
    + `<nav><a class="l" href="#workflow">${e(h.workflow)}</a><a class="l" href="#f1">${e(h.featuresLabel)}</a><a class="l" href="#start">${e(h.start)}</a>`
    + `${languageMenu(c)}<a class="btn sm" href="/editor/?lang=${c.lang}">${e(c.start)} ↗</a></nav></div></header>`
    + `<main id="top">`
    + `<section class="hero"><div class="wrap">`
    + `<div class="eyebrow">${e(c.eyebrow)}</div>`
    + `<h1>${e(h.headline)}</h1>`
    + `<p class="sub">${e(h.intro)}</p>`
    + `<div class="cta"><a class="btn" href="/editor/?lang=${c.lang}">${e(h.launch)} ↗</a>`
    + `<a class="btn ghost" href="#workflow">${e(h.seeWorkflow)}</a></div>`
    + `<p class="note">${e(c.note)}</p>`
    + `<section class="wardrobe-preview" data-invalid="${e(h.invalid)}" aria-labelledby="preview-title">
      <div class="preview-heading"><span>${e(h.study)}</span><span>01 / ${e(h.wardrobe)}</span></div>
      <div class="preview-stage"><div class="preview-host" inert></div>
        <div class="preview-stage-label"><span class="preview-live-dot" aria-hidden="true"></span>${e(h.live)}</div>
        <div class="preview-caption"><span>${e(h.caption)}</span><span>${e(h.plate)}</span></div>
      </div>
      <div class="preview-controls"><div class="preview-kicker">${e(h.kicker)}</div>
        <h2 id="preview-title">${e(h.title)}<br><em>${e(h.emphasis)}</em></h2>
        <p class="preview-intro">${e(h.previewIntro)}</p>
        <div class="preview-inventory"><span>${e(h.inventory)}</span><span>${e(h.quantity)}</span></div>
        ${wardrobeCount('short',h.counts[0]!,24,150,'01',h)}${wardrobeCount('long',h.counts[1]!,4,80,'02',h)}
        ${wardrobeCount('folded',h.counts[2]!,30,200,'03',h)}${wardrobeCount('shoes',h.counts[3]!,8,80,'04',h)}
        <div class="preview-summary"><span>${e(h.summary)}</span><span><output class="preview-total">66</output> ${e(h.pieces)}</span></div>
        <button type="button" class="btn" id="preview-open" disabled><span>${e(h.continue)}</span><span aria-hidden="true">↗</span></button>
        <p class="preview-status" role="status">${e(h.loading)}</p>
      </div>
      <div class="preview-footer"><span>${e(h.footer)}</span><span>${e(h.footerHint)}</span></div>
      </section>`
    + `<div class="strip" id="workflow">${workflowHtml}</div>`
    + `</div></section>`
    + `<div id="features">${featuresHtml}</div>`
    + `<section class="final" id="start"><div class="wrap">`
    + `<div class="eyebrow">${e(h.ready)}</div>`
    + `<h2>${e(h.closing)}</h2>`
    + `<div class="cta"><a class="btn" href="/editor/?lang=${c.lang}">${e(h.launch)} ↗</a></div>`
    + `<p class="note">${e(c.editorLanguage)}</p>`
    + `</div></section>`
    + `<div class="fitting-room" data-nosnippet style="display:none"><span class="sr-only">${c.headline.join(' ')}</span></div>`
    + `</main><footer><div class="wrap"><span>© 2026 FurniDraw.</span>`
    + `<span><a href="/wardrobe-designer/">Wardrobe designer</a> <a href="/cabinet-design-software/">Cabinet software</a> <a href="/llms.txt">For AI assistants</a></span></div></footer>`;
}

export function guideBody(c: MarketingCopy, guide: Guide): string {
  return `<header><div class="wrap nav"><a class="logo" href="/">FurniDraw<i>.</i></a>`
    + `<nav><a class="l" href="/">Home</a><a class="l" href="#fitting-room">Studio</a>${languageMenu(c)}`
    + `<a class="btn sm" href="/editor/?lang=${c.lang}">Open the studio ↗</a></nav></div></header>`
    + `<main id="main" class="guide-page wrap">`
    + `<section class="guide-hero"><nav class="breadcrumb" aria-label="Breadcrumb">`
    + `<a href="/">FurniDraw</a><span aria-hidden="true"> / </span><span aria-current="page">${e(guide.label)}</span></nav>`
    + `<div class="eyebrow">${e(guide.eyebrow)}</div><h1>${e(guide.heading).replace('\n', '<br>')}</h1><p class="sub">${e(guide.intro)}</p>`
    + `<a class="btn" href="${guide.slug === 'cabinet-design-software' ? `/editor/?lang=${c.lang}` : '#fitting-room'}">${e(c.explore)} ${arrow}</a></section>`
    + `<div class="guide-content"><article class="guide-article">${guide.sections.map(s =>
      `<section><h2>${e(s.title)}</h2><p>${e(s.body)}</p>${s.list ? `<ul>${s.list.map(t => `<li>${e(t)}</li>`).join('')}</ul>` : ''}</section>`).join('')}`
    + `<a class="text-link" href="/editor/?lang=${c.lang}">${e(c.start)} ${arrow}</a></article>`
    + `<aside id="fitting-room" aria-label="${e(c.study)}">${fittingRoom(c, guide.shape)}</aside></div>`
    + `<section class="related"><div class="eyebrow">KEEP EXPLORING</div><div class="related-links">${guides.filter(g => g.slug !== guide.slug).map(g =>
      `<a href="/${g.slug}/">${e(g.label)} ${arrow}</a>`).join('')}</div></section>`
    + `</main>${footerHtml(c)}`;
}
