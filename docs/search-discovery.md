# FurniDraw search discovery

The public site introduces the product without booting WebGL or creating an anonymous account.
The studio stays at `/editor/`; `/editor.html` remains compatible. Existing root links carrying
`#spec=`, `#design=`, saved session IDs, library navigation or checkout results are forwarded to
the studio with their original query and fragment intact.

## Public pages

The English homepage is `/`. Translated introductions are `/de/`, `/fr/`, `/es/`, `/pl/`, `/pt/`
and `/tr/`. Each has complete primary content in its own HTML, its own canonical address, and
reciprocal language alternates, including `x-default`. Language selection is explicit; there is
no country or browser-language redirect. The studio interface supports the same seven languages; detailed guides and manufacturing documents currently use English.

The English search pages are:

- `/wardrobe-designer/`
- `/cabinet-design-software/`
- `/furniture-making-software/`
- `/under-stairs-wardrobe/`
- `/guides/measure-for-a-fitted-wardrobe/`

These are specific, distinct explanations of supported workflows and limitations. Do not add
near-identical country pages or claim capabilities the editor does not support.

## Implementation

`scripts/marketing-site.ts` renders the same content for people and crawlers. Vite serves the
pages during development and emits individual HTML files during the build. It also emits
`robots.txt`, the XML sitemap with language alternates, and the canonical editor entry.

The content, translations, page rendering, metadata, illustrative SVG study and interaction
code live in `src/presentation/marketing/`. Add a translated homepage to `languages` only when
its primary content has been translated. The language menu, alternates and sitemap then update
together. Detailed guides do not claim translations that do not exist.

Structured data describes the website, organization, application and guide breadcrumbs. It
contains no invented ratings, customer counts, prices or reviews. No rich-result appearance is
guaranteed. Titles, descriptions, social previews and canonical URLs are generated per page.
The active social image is `public/assets/furnidraw-design-social.png` (1200 × 630).
The organization mark is `public/assets/furnidraw-mark.png` (512 × 512).
Both are original code-rendered graphics; `scripts/render-discovery-brand.py` regenerates them.
The application offer describes the free browser design workspace and identifies credit-based
features. Optional ratings remain absent until genuine review data is available.

The drawing-only assembly preview is an illustration, not the editor's manufacturing model. Its width and
shape carry into a validated design specification; the user chooses fittings and finishes in
the editor. The public preview can show inches; the editor receives centimetres. Controls work
with keyboard and touch. Motion preferences are respected. No new analytics trackers are added.

## Verify

Run `npm run check`, then inspect the homepage, at least one guide and language version on
desktop and at 375px. Test drawing assembly, playback, dimensions, inches, language navigation
and the editor handoff. Inspect the emitted HTML and sitemap, not only the client DOM.

`npm run check:seo` audits the emitted pages after a build and is included in `npm run check`.
It checks unique titles and descriptions, canonical/indexing rules, heading structure, all
internal links and section targets, image attributes, asset references, language alternates,
structured data, visible breadcrumbs, sitemap coverage, public-page reachability and deferred
editor loading. It also verifies that the linked `/llms.txt` guide is actually generated.

Illustrative dimensions and assistant instructions are marked `data-nosnippet`; the product
description, guides and FAQs remain available for search snippets. This does not hide content
from visitors or prevent indexing. Technical metadata and visible content describe the same tool.

## Audit coverage and limits

| Area | Implemented checks |
| --- | --- |
| Crawlability | Static HTML, crawlable links, working resources, XML sitemap and robots directives |
| Canonicalization | HTTPS production canonicals, stable trailing-slash public URLs, editor excluded |
| Search intent | Specific furniture, wardrobe, cabinet and measurement headings; distinct guide content |
| International discovery | Full translated introductions, self-canonicals, reciprocal language alternates, x-default |
| Structured data | Brand, site name, application offer and visible guide breadcrumbs; no fabricated reviews |
| Search appearance | Unique metadata, localized social metadata, descriptive images and snippet exclusions |
| User experience | Responsive layout, keyboard/touch controls, reduced motion, reserved image space, small public script |
| Release quality | Build-time link/content audit, regression checks and browser verification |

These checks follow applicable Google Search Essentials and Search Central guidance. They are
not a certification of every ranking factor. Search demand, genuine editorial links, original
examples, translation review, user experience data and continued content maintenance require
ongoing work. Do not use keyword stuffing, fake reviews, paid link schemes or near-duplicate
country pages. Google’s optional software-review warning should not be filled with invented data.

References: [SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide),
[language alternates](https://developers.google.com/search/docs/specialty/international/localized-versions),
[software application metadata](https://developers.google.com/search/docs/appearance/structured-data/software-app),
[site names](https://developers.google.com/search/docs/appearance/site-names).

Only production/main CI builds are indexable. CI builds for other branches emit a restrictive
robots file and public pages with `noindex`. The editor is always `noindex,follow`.

## Publish and register

Publish through the existing Cloudflare/main workflow after reviewing the final change. Do not
deploy the entire working directory indiscriminately: this workspace may contain unrelated work.
Keep the existing backend, secrets, bindings and custom domain configuration.

After publication:

1. Verify `/`, all language URLs, one guide, `/editor/`, `/robots.txt` and `/sitemap.xml` on
   `https://furnidraw.com`. Confirm their HTTP status, content and canonical URLs.
2. In the verified `furnidraw.com` domain property in Google Search Console, submit
   `https://furnidraw.com/sitemap.xml` once. Confirm the returned status.
3. Inspect the homepage, request indexing, and check representative guide and language URLs.
   Submit the same sitemap through Bing Webmaster Tools if that property is available.
4. Monitor indexing, search impressions and queries by country. Prioritize new translations
   and guides using actual search demand. Translation quality benefits from native review.

Indexability is preparation for search discovery, not a guarantee of indexing, rankings or
visibility in every country. Useful examples, relevant editorial links and continued content
work remain part of growing the site.
