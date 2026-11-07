import type { MarketingCopy } from './copy';
import { guides, type Guide } from './guides';
import { informationPages } from './information-pages';
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
    <picture>
      <source srcset="/assets/kitchen/render.webp" type="image/webp">
      <img src="/assets/kitchen/render.jpg" alt="${e(h.kitchenRenderAlt)}" width="1600" height="1000" loading="lazy">
    </picture>
    <picture class="model-layer">
      <source srcset="/assets/kitchen/model.webp" type="image/webp">
      <img class="model-layer" src="/assets/kitchen/model.jpg" alt="${e(h.kitchenModelAlt)}" width="1600" height="1000" loading="lazy">
    </picture>
    <span class="compare-line" aria-hidden="true"><b>‹ ›</b></span>
    <span class="compare-tag model-tag">${e(h.model)}</span><span class="compare-tag render-tag">${e(h.render)}</span>
    <input type="range" min="0" max="100" value="50" aria-label="${e(h.compare)}">
  </div>`;
  const index = FEATURES.findIndex(feature => feature.s === slug);
  const label = h.features[index]?.t || stageLabels[slug] || stageLabels.hero!;
  return fallback
    + `<video muted loop playsinline preload="none" poster="/assets/video/${slug}.jpg" data-src="/assets/video/${slug}.mp4" aria-label="${e(label)}"></video>`;
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

function kitchenStudy(c: MarketingCopy): string {
  return `<div class="fitting-room" data-nosnippet data-shape="regular" data-view="model">`
    + `<div class="assembly-stage kitchen-stage" style="position:relative;width:100%;aspect-ratio:16/10;overflow:hidden;border-radius:12px;background:var(--soft,#eaece5);"><div class="kitchen-comparison" style="margin:0;width:100%;">`
    + `<picture><source srcset="/assets/kitchen/render.webp" type="image/webp">`
    + `<img src="/assets/kitchen/render.jpg" alt="Realistic kitchen cabinet design render" width="1600" height="1000" loading="lazy"></picture>`
    + `<picture class="model-layer"><source srcset="/assets/kitchen/model.webp" type="image/webp">`
    + `<img class="model-layer" src="/assets/kitchen/model.jpg" alt="Modular kitchen cabinet 3D model" width="1600" height="1000" loading="lazy"></picture>`
    + `<span class="compare-line" aria-hidden="true"><b>‹ ›</b></span>`
    + `<span class="compare-tag model-tag">3D CAD Model</span><span class="compare-tag render-tag">AI Visualisation</span>`
    + `<input type="range" min="0" max="100" value="50" aria-label="Percentage of 3D kitchen view revealed">`
    + `</div></div>`
    + `<div class="study-bottomline" style="margin-top:14px;">`
    + `<div class="kitchen-badges" style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px;">`
    + `<span style="background:var(--soft);padding:4px 8px;border-radius:3px;">Base Units (60/80/100 cm)</span>`
    + `<span style="background:var(--soft);padding:4px 8px;border-radius:3px;">Wall Units (72/90 cm)</span>`
    + `<span style="background:var(--soft);padding:4px 8px;border-radius:3px;">Tall Pantry Housing</span>`
    + `<span style="background:var(--soft);padding:4px 8px;border-radius:3px;">Continuous Worktop &amp; Plinth</span>`
    + `</div></div>`
    + `<div class="study-handoff" style="margin-top:14px;"><a id="study-start" class="text-link" href="/editor/?lang=${c.lang}">Open kitchen planner in 3D ${arrow}</a>`
    + `<p>Plan modular base, wall, and tall kitchen units directly in your browser with real-time 3D dimensions.</p></div>`
    + `</div>`;
}

function footerHtml(c: MarketingCopy): string {
  const h = homeCopy(c.lang);
  const guideLinks = `<a href="/guides/">${e(h.guidesLabel)}</a>`;
  const langLinks = languages.map(l =>
    `<a href="${homePath(l.lang)}" lang="${l.lang}" hreflang="${l.lang}">${e(l.name)}</a>`).join(' ');
  return `<footer><div class="wrap"><span>© 2026 FurniDraw</span>`
    + `<span class="footer-links">${guideLinks}<a href="/about/" hreflang="en">${e(h.aboutLabel)}</a>`
    + `<a href="/pricing/" hreflang="en">${e(h.pricingLabel)}</a><a href="/contact/" hreflang="en">${e(h.contactLabel)}</a>`
    + `<a href="/privacy/" hreflang="en">${e(h.privacyLabel)}</a><a href="/terms/" hreflang="en">${e(h.termsLabel)}</a>`
    + `<a href="/llms.txt" title="FurniDraw LLM / AI agent documentation">AI Agents (llms.txt)</a></span></div>`
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

  return `<a class="skip-link" href="#top">${e(c.skip)}</a><header><div class="wrap nav"><a class="logo" href="#top">FurniDraw<i>.</i></a>`
    + `<nav aria-label="FurniDraw"><a class="l" href="#workflow">${e(h.workflow)}</a><a class="l" href="#f1">${e(h.featuresLabel)}</a>`
    + `<a class="l" href="/pricing/">${e(h.pricingLabel)}</a><a class="guides-nav" href="/guides/">${e(h.guidesLabel)}</a>`
    + `${languageMenu(c)}<a class="btn sm" href="/editor/?lang=${c.lang}">${e(c.start)} ↗</a></nav></div></header>`
    + `<main id="top">`
    + `<section class="hero"><div class="wrap">`
    + `<div class="eyebrow">${e(c.eyebrow)}</div>`
    + `<h1>${e(h.headline)}</h1>`
    + `<p class="hero-tagline">${e(c.headline.join(' '))}</p>`
    + `<p class="sub">${e(h.intro)}</p>`
    + `<div class="cta"><a class="btn" href="/editor/?lang=${c.lang}">${e(h.launch)} ↗</a>`
    + `<a class="btn ghost" href="#workflow">${e(h.seeWorkflow)}</a></div>`
    + `<p class="note">${e(c.note)}</p>`
    + `<section class="wardrobe-preview" data-nosnippet data-invalid="${e(h.invalid)}" aria-labelledby="preview-title">
      <div class="preview-stage"><div class="preview-host" inert></div></div>
      <div class="preview-controls"><div class="preview-kicker">${e(h.kicker)}</div>
        <h2 id="preview-title">${e(h.title)}<br><em>${e(h.emphasis)}</em></h2>
        <p class="preview-intro">${e(h.previewIntro)}</p>
        <div class="preview-inventory"><span>${e(h.inventory)}</span><span>${e(h.quantity)}</span></div>
        ${wardrobeCount('short',h.counts[0]!,24,150,'01',h)}${wardrobeCount('long',h.counts[1]!,4,80,'02',h)}
        ${wardrobeCount('folded',h.counts[2]!,30,200,'03',h)}${wardrobeCount('shoes',h.counts[3]!,8,80,'04',h)}
        <div class="preview-summary"><span>${e(h.summary)}</span><span><output class="preview-total">66</output> ${e(h.pieces)}</span></div>
        <button type="button" class="btn" id="preview-open" disabled><span>${e(h.continue)}</span><span aria-hidden="true">↗</span></button>
        <p class="preview-status" role="status" data-nosnippet>${e(h.loading)}</p>
      </div>
      <div class="preview-footer"><span>${e(h.footer)}</span><span>${e(h.footerHint)}</span></div>
      </section>`
    + `<div class="strip" id="workflow">${workflowHtml}</div>`
    + `</div></section>`
    + `<div id="features">${featuresHtml}</div>`
    + `<section class="resources wrap" id="guides" aria-labelledby="guides-title">`
    + `<h2 id="guides-title">${e(h.guidesTitle)}</h2><p>${e(c.resourceIntro)}</p>`
    + `<div class="guide-cards">${guides.map(g => `<a href="/${g.slug}/" hreflang="en"><h3 lang="en">${e(g.label)}</h3><p lang="en">${e(g.description)}</p><span>${e(c.resourceLink)} ${arrow}</span></a>`).join('')}</div></section>`
    + `<section class="faq wrap" aria-labelledby="faq-title"><h2 id="faq-title">${e(h.faqTitle)}</h2>`
    + `${c.faqs.map(([question, answer]) => `<details><summary>${e(question)}</summary><p>${e(answer)}</p></details>`).join('')}</section>`
    + `<section class="final" id="start"><div class="wrap">`
    + `<div class="eyebrow">${e(h.ready)}</div>`
    + `<h2>${e(h.closing)}</h2>`
    + `<div class="cta"><a class="btn" href="/editor/?lang=${c.lang}">${e(h.launch)} ↗</a></div>`
    + `<p class="note">${e(c.editorLanguage)}</p>`
    + `</div></section>`
    + `<div class="fitting-room" data-nosnippet style="display:none"><span class="sr-only">${c.headline.join(' ')}</span></div>`
    + `</main>${footerHtml(c)}`;
}

const longDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

function renderBody(text: string): string {
  return e(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export function guideBody(c: MarketingCopy, guide: Guide): string {
  const informational = informationPages.some(page => page.slug === guide.slug);
  const h = homeCopy(c.lang);
  const isGuideArticle = guide.slug.startsWith('guides/');
  const breadcrumb = `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">FurniDraw</a><span aria-hidden="true"> / </span>`
    + (isGuideArticle ? `<a href="/guides/">Guides</a><span aria-hidden="true"> / </span>` : '')
    + `<span aria-current="page">${e(guide.label)}</span></nav>`;
  const dated = guide.updated ?? guide.published;
  const bylineHtml = isGuideArticle
    ? `<p class="guide-byline" style="font-size:13px;opacity:0.8;margin:-4px 0 24px;">`
      + `By the FurniDraw team${dated ? ` · ${guide.updated ? 'Updated' : 'Published'} <time datetime="${dated}">${longDate(dated)}</time>` : ''}</p>`
    : '';
  const hubGrid = guide.slug === 'guides'
    ? `<section class="guide-hub-grid" style="margin-top:28px;"><h2>All Guides &amp; References</h2><div class="guide-cards" style="margin-top:16px;">`
      + guides.filter(g => g.slug.startsWith('guides/')).map(g => `<a href="/${g.slug}/"><h3 lang="en">${e(g.label)}</h3><p lang="en">${e(g.description)}</p><span>Read guide ${arrow}</span></a>`).join('')
      + `</div></section>`
    : '';

  return `<a class="skip-link" href="#main">${e(c.skip)}</a><header><div class="wrap nav"><a class="logo" href="/">FurniDraw<i>.</i></a>`
    + `<nav aria-label="FurniDraw"><a class="l" href="/">Home</a><a class="l" href="/pricing/">${e(h.pricingLabel)}</a>`
    + `<a class="guides-nav" href="/guides/">Guides</a>${languageMenu(c)}`
    + `<a class="btn sm" href="/editor/?lang=${c.lang}">Open the studio ↗</a></nav></div></header>`
    + `<main id="main" class="guide-page wrap">`
    + `<section class="guide-hero">${breadcrumb}`
    + `<div class="eyebrow">${e(guide.eyebrow)}</div><h1>${e(guide.heading).replace('\n', '<br>')}</h1><p class="sub">${e(guide.intro)}</p>`
    + bylineHtml
    + `<a class="btn" href="/editor/?lang=${c.lang}">${e(c.start)} ${arrow}</a></section>`
    + `<div class="guide-content${informational ? ' information-content' : ''}"><article class="guide-article">${guide.sections.map(s =>
      `<section><h2>${e(s.title)}</h2><p>${renderBody(s.body)}</p>${s.list ? `<ul>${s.list.map(t => `<li>${renderBody(t)}</li>`).join('')}</ul>` : ''}</section>`).join('')}`
    + hubGrid
    + (guide.faqs && guide.faqs.length ? `<section class="guide-faq"><h2>Frequently Asked Questions</h2>`
      + `${guide.faqs.map(([q, a]) => `<details><summary>${e(q)}</summary><p>${e(a)}</p></details>`).join('')}</section>` : '')
    + `<a class="text-link" href="mailto:support@furnidraw.com">Contact support@furnidraw.com ${arrow}</a></article>`
    + `${informational ? '<div class="fitting-room" data-nosnippet style="display:none"></div>'
      : `<aside id="fitting-room" aria-label="${e(c.study)}">${guide.slug === 'kitchen-cabinet-design-software' ? kitchenStudy(c) : fittingRoom(c, guide.shape)}</aside>`}</div>`
    + `<section class="related"><div class="eyebrow">KEEP EXPLORING</div><div class="related-links">${guides.filter(g => g.slug !== guide.slug && g.slug !== 'guides').map(g =>
      `<a href="/${g.slug}/">${e(g.label)} ${arrow}</a>`).join('')}</div></section>`
    + `</main>${footerHtml(c)}`;
}
