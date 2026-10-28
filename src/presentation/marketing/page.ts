import type { MarketingCopy } from './copy';
import { guides, type Guide } from './guides';
import { homePath, languages } from './translations';
import { escapeHtml as e } from './seo';
import { studySvg } from './study';

const arrow = '<span aria-hidden="true">↗</span>';
const brand = `<svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M5 23V5h18v18M5 14h18M14 5v18" stroke="currentColor" stroke-width="1.7"/>
  <path d="M3 25h22" stroke="currentColor" stroke-width="1.7"/></svg><span>FurniDraw<span class="brand-period">.</span></span>`;
export function header(c: MarketingCopy): string {
  const home = homePath(c.lang);
  return `<a class="skip-link" href="#main">${e(c.skip)}</a>
    <header class="site-header"><a class="brand" href="${home}" aria-label="FurniDraw">${brand}</a>
      <nav class="main-nav" aria-label="${e(c.nav[0])}">
        <a href="${home}#experience">${e(c.nav[0])}</a><a href="${home}#details">${e(c.nav[1])}</a>
        <a href="${home}#notes">${e(c.nav[2])}</a>
      </nav><div class="header-actions"><details class="language-picker"><summary aria-label="${e(c.language)}">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>
        ${c.lang.toUpperCase()}</summary><nav aria-label="${e(c.language)}">${languages.map(l =>
          `<a href="${homePath(l.lang)}" lang="${l.lang}" hreflang="${l.lang}" ${l.lang === c.lang ? 'aria-current="page"' : ''}>${l.name}</a>`).join('')}</nav>
      </details><a class="button button-small" href="/editor/">${e(c.start)} ${arrow}</a></div>
    </header>`;
}

function fittingRoom(c: MarketingCopy, shape: 'regular' | 'alcove' | 'under-stairs' = 'regular'): string {
  const shapes = ['regular', 'alcove', 'under-stairs'];
  return `<div class="fitting-room" data-shape="${shape}" data-view="material">
    <div class="study-topline"><span class="eyebrow">${e(c.study)}</span>
      <div class="segmented" role="group" aria-label="${e(c.study)}">
        ${c.views.map((v, i) => `<button type="button" data-view="${i ? 'drawing' : 'material'}" aria-pressed="${!i}">${e(v)}</button>`).join('')}
      </div>
    </div>
    <div class="study-canvas" id="study-canvas">${studySvg({ width: 240, shape, finish: 'oak', inches: false }, c.lang)}</div>
    <div class="study-bottomline"><span class="study-coordinate" aria-hidden="true">X 2400 · Y 2400 · Z 600</span>
      <div class="study-shapes" role="group" aria-label="${e(c.shapes[0])}">
        ${c.shapes.map((s, i) => `<button type="button" data-shape="${shapes[i]}" aria-pressed="${shapes[i] === shape}">${e(s)}</button>`).join('')}
      </div>
    </div>
    <div class="study-controls">
      <fieldset class="finish-control"><legend>${e(c.finish)}</legend><div class="swatches">
        ${['oak', 'smoked', 'chalk'].map((v, i) => `<button class="swatch swatch-${v}" type="button" data-finish="${v}"
          aria-label="${e(c.finishes[i]!)}" aria-pressed="${!i}" title="${e(c.finishes[i]!)}"></button>`).join('')}
        <span id="finish-name">${e(c.finishes[0])}</span>
      </div></fieldset>
      <div class="width-control"><div class="width-top"><label for="study-width">${e(c.width)}</label>
        <output for="study-width" id="width-output">240 cm</output></div>
        <input id="study-width" type="range" min="140" max="320" step="5" value="240" aria-valuetext="240 cm">
      </div>
      <label class="unit-control"><span class="sr-only">${e(c.units)}</span><select id="study-units" aria-label="${e(c.units)}"><option value="cm">cm</option><option value="in">in</option></select></label>
    </div>
    <div class="study-handoff"><a id="study-start" class="text-link" href="/editor/">${e(c.dimensionCta)} ${arrow}</a>
      <p>${e(c.illustration)}</p></div>
  </div>`;
}

export function footer(c: MarketingCopy): string {
  return `<footer class="site-footer"><div class="footer-top"><a class="brand" href="${homePath(c.lang)}">${brand}</a>
    <p>${e(c.editorLanguage)}</p><a class="text-link" href="/editor/">${e(c.start)} ${arrow}</a></div>
    <div class="footer-bottom"><span>© ${new Date().getUTCFullYear()} FurniDraw</span>
      <nav class="language-links" aria-label="${e(c.language)}">${languages.map(l =>
        `<a lang="${l.lang}" hreflang="${l.lang}" href="${homePath(l.lang)}" ${l.lang === c.lang ? 'aria-current="page"' : ''}>${l.name}</a>`).join('')}</nav>
    </div></footer>`;
}

export function homeBody(c: MarketingCopy): string {
  return `${header(c)}<main id="main">
    <section class="hero section-wrap" aria-labelledby="hero-title"><div class="hero-copy">
      <p class="eyebrow">${e(c.eyebrow)}</p>
      <h1 id="hero-title">${e(c.headline[0])}<br><span>${e(c.headline[1])}</span></h1>
      <p class="hero-intro">${e(c.intro)}</p>
      <a class="button" href="#fitting-room">${e(c.explore)} <span aria-hidden="true">↓</span></a>
      <p class="quiet hero-note">${e(c.note)}</p>
    </div><div id="fitting-room">${fittingRoom(c)}</div></section>
    <section id="experience" class="experience section-wrap"><div class="section-heading">
      <p class="eyebrow">01 / ${e(c.nav[0])}</p><h2>${e(c.statement[0])}<br><span>${e(c.statement[1])}</span></h2>
      <p>${e(c.statementBody)}</p></div>
      <div class="process">${c.steps.map(([title, body], i) => `<article class="process-step">
        <div class="process-visual process-visual-${i}" aria-hidden="true">${processArt(i)}</div>
        <span class="step-number">0${i + 1}</span><h3>${e(title)}</h3><p>${e(body)}</p></article>`).join('')}</div>
    </section>
    <section id="details" class="details-section"><div class="details-grid section-wrap">
      <figure class="interior-figure"><img src="/assets/wardrobe-scene.jpg" width="750" height="1160" loading="lazy" decoding="async" alt="${e(c.imageAlt)}">
        <figcaption>${e(c.imageCaption)}</figcaption></figure>
      <div class="detail-copy"><p class="eyebrow">02 / ${e(c.detail[0])}</p>
        <h2>${e(c.detail[1])}<br><span>${e(c.detail[2])}</span></h2><p>${e(c.materials)}</p>
        <div class="detail-rule"><span>01—03</span><span>${e(c.steps.map(s => s[0]).join(' / '))}</span></div>
        <a class="text-link" href="/editor/">${e(c.start)} ${arrow}</a>
        <p class="quiet">${e(c.editorLanguage)}</p>
      </div></div></section>
    <section id="notes" class="notes section-wrap"><div class="notes-heading"><p class="eyebrow">03 / ${e(c.nav[2])}</p>
      <h2>${e(c.resourceTitle)}</h2><p>${e(c.resourceIntro)}</p></div>
      <div class="guide-list">${guides.map((g, i) => `<a class="guide-row" href="/${g.slug}/" hreflang="en">
        <span class="guide-number">0${i + 1}</span><span lang="en">${e(g.label)}</span><span class="guide-action">${e(c.resourceLink)} ${arrow}</span></a>`).join('')}</div>
    </section>
    <section class="faq section-wrap"><h2>${e(c.questions)}</h2><div>${c.faqs.map(([q, a]) =>
      `<details><summary>${e(q)}<span aria-hidden="true">+</span></summary><p>${e(a)}</p></details>`).join('')}</div></section>
    <section class="closing section-wrap"><p class="eyebrow">FURNIDRAW</p><h2>${e(c.closing[0])}<br><span>${e(c.closing[1])}</span></h2>
      <a class="button" href="/editor/">${e(c.start)} ${arrow}</a><p class="quiet">${e(c.note)}</p></section>
  </main>${footer(c)}`;
}

export function guideBody(c: MarketingCopy, guide: Guide): string {
  return `${header(c)}<main id="main" class="guide-page">
    <section class="guide-hero section-wrap"><a class="breadcrumb" href="/">FurniDraw <span aria-hidden="true">/</span></a>
      <p class="eyebrow">${e(guide.eyebrow)}</p><h1>${e(guide.heading).replace('\n', '<br>')}</h1><p>${e(guide.intro)}</p>
      <a class="button" href="${guide.slug === 'cabinet-design-software' ? '/editor/' : '#fitting-room'}">${e(c.explore)} ${arrow}</a></section>
    <div class="guide-content section-wrap"><article class="guide-article">${guide.sections.map(s =>
      `<section><h2>${e(s.title)}</h2><p>${e(s.body)}</p>${s.list ? `<ul>${s.list.map(t => `<li>${e(t)}</li>`).join('')}</ul>` : ''}</section>`).join('')}
      <a class="text-link" href="/editor/">${e(c.start)} ${arrow}</a></article>
      <aside id="fitting-room" aria-label="${e(c.study)}">${fittingRoom(c, guide.shape)}</aside></div>
    <section class="related section-wrap"><p class="eyebrow">KEEP EXPLORING</p><div class="related-links">${guides.filter(g => g.slug !== guide.slug).map(g =>
      `<a href="/${g.slug}/">${e(g.label)} ${arrow}</a>`).join('')}</div></section>
  </main>${footer(c)}`;
}

function processArt(i: number): string {
  if (i === 0) return `<svg viewBox="0 0 320 200"><g fill="none" stroke="currentColor" stroke-width="1.2">
    <path d="M65 160V50l160-20v115zM65 50l-22-18 160-20 22 18M225 145l25 18-160 23-25-26M43 32v110l22 18M65 100l160-20M143 40v111"/>
    <path d="M50 177l180-25M50 172v10m180-35v10" opacity=".4"/></g><text x="125" y="185">2400</text></svg>`;
  if (i === 1) return `<div class="material-stack"><i></i><i></i><i></i></div>`;
  return `<svg viewBox="0 0 320 200"><g fill="none" stroke="currentColor" stroke-width="1">
    <path d="M88 25h147v153H88zM97 36h129v116H97zM140 36v116m43-116v116M97 85h43m43-20h43m-43 42h43M97 165h80m-80 5h54"/>
    <path d="M77 36v116m-4-116h8m-8 116h8M97 16h129m-129-4v8m129-8v8" opacity=".5"/>
    </g><text x="142" y="12">2400</text><text x="190" y="170">FD—01</text></svg>`;
}
