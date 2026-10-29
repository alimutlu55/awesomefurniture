# FurniDraw search discovery

The public site introduces the product without booting WebGL or creating an anonymous account.
The studio stays at `/editor/`; `/editor.html` remains compatible. Existing root links carrying
`#spec=`, `#design=`, saved session IDs, library navigation or checkout results are forwarded to
the studio with their original query and fragment intact.

## Public pages

The English homepage is `/`. Translated introductions are `/de/`, `/fr/`, `/es/`, `/pl/`, `/pt/`
and `/tr/`. Each has complete primary content in its own HTML, its own canonical address, and
reciprocal language alternates, including `x-default`. Language selection is explicit; there is
no country or browser-language redirect. The editor and detailed guides currently use English.

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
The branded social image is `public/assets/furnidraw-social.png` (1200 × 630).

The material study is an illustration, not the editor's manufacturing model. Its width and
shape carry into a validated design specification; the user chooses fittings and finishes in
the editor. The public preview can show inches; the editor receives centimetres. Controls work
with keyboard and touch. Motion preferences are respected. No new analytics trackers are added.

## Verify

Run `npm run check`, then inspect the homepage, at least one guide and language version on
desktop and at 375px. Test material and drawing views, dimensions, inches, language navigation
and the editor handoff. Inspect the emitted HTML and sitemap, not only the client DOM.

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
