# FurniDraw product plan: professional depth people can see

Product owner's plan, November 2026. Revised to focus on **features inside the editor** that can each
ship in days or weeks on the code we already have. Big platform projects (ordering from panel shops,
a native scanning app, a marketplace, a carpenter subscription) are parked at the end until these
land.

---

## 1. The problem in one paragraph

FurniDraw's engine is deeper than any consumer tool: a storage planner built around what people own,
millimetre carcass rules, 44 hardware entries with real load ratings, a manufacturing check, Make with
every board and hole. **But people only see a box with shelves.** The depth sits in drawings and data
that most people never open, and several things a professional expects are missing entirely. The
plan has two halves:

1. **Close the professional gaps** a carpenter or a kitchen studio would notice in five minutes.
2. **Make the depth visible and enjoyable**: show the engineering, the storage, the cost and the
   construction live on the model, so people feel they're using a professional's tool that is easy.

---

## 2. Professional gaps found in the code

Each was checked in `src/`, not assumed.

| Gap | Evidence | Why a professional notices |
|---|---|---|
| **No sliding doors** | `slidingTrack` hardware (2- and 3-track, 50 kg/leaf) exists in `hinges-hardware.ts`, but a wardrobe's doors are only `none`, `hinged` or `glass` (`editor-design.ts`) | Sliding-door built-ins are the standard wardrobe in Poland and much of Europe (the whole business of firms like Komandor) |
| **No shelf sag or load check** | Marketing pages promise "adjustable shelves verify span limits to prevent long-term deflection" (`product-pages.ts:327`); no deflection code exists in `src/domain` | A 100 cm shelf of books in 18 mm chipboard sags; every carpenter checks this |
| **Doors and drawers never open** | Nothing in `src/presentation` animates a door or a drawer | You can't check that a drawer clears a hinge, or show a client how it works |
| **No lighting in wardrobes** | `cabinet-lighting.ts` exists for kitchens only | LED rails and strips are in almost every premium built-in |
| **No corner wardrobes** | No L- or U-shaped wardrobe; each piece is a straight box | Walk-ins and bedroom corners are the most valuable spaces |
| **Thin interior range** | Wardrobe fittings: drawer, small drawer, shelf, short and long hang, shoe rack, trouser pull-out, folded shelf, upper boxes, basket, pull-down rail | No tie/belt rack, jewellery insert, drawer dividers, pull-out mirror, ironing board, laundry basket, hidden inner drawer, valet rod |
| **One board build** | 18 mm everywhere; edge banding and grain are fixed text in `decor-base.ts` | Professionals choose 16/18/25 mm, back panel type, edge thickness per edge, grain direction per part |
| **Built-in finishing missing** | No cornice, ceiling filler, skirting cut-out, or legs vs plinth choice for wardrobes | It's what makes a box look "fitted" |
| **No section view** | No clipping of furniture | The standard way to read an interior |
| **No copy/mirror of an interior** | No copy bay, paste bay or mirror layout command | Basic productivity for anyone designing more than one bay |

---

## 3. Part A: professional depth (close the gaps)

Sizes: **S** ≈ under 1 week, **M** ≈ 1–3 weeks. Every feature goes through the existing registries and
layers in `CLAUDE.md`.

### A1. Sliding doors · M · highest priority

**What the person sees.** Fronts › Doors › **Sliding**. The wardrobe gets 2 or 3 leaves on a top
track, overlapping correctly, with the track depth added at the front automatically. Each leaf can be
**split into panels** (wood / mirror / glass / lacquer in 2–5 horizontal or vertical panels) with thin
aluminium frame profiles. Drag a leaf on the model to slide it and see what's behind.

**Professional details.** Leaf count from width; overlap of one frame profile; leaf weight against the
50 kg rating (warns when a mirror leaf is too heavy); the track length from the hardware's own sizes
(1200–3000 mm); the sliding gear on the hardware list; a planner rule that keeps drawers from being
blocked behind the overlap of two leaves.

**Builds on.** `slidingTrack` in `hinges-hardware.ts`, `front-styles.ts`, `door-layout.ts`, mirror
decor (`glass_mirror` in `material-surface-rules.ts`), drawings fronts sheet.

### A2. Engineering check: sag, load and weight, live · S–M

**What the person sees.** A new **Engineering** toggle in View. Shelves turn amber or red when they
would sag under what the planner put on them; hanging rails over ~100 cm show "needs a centre support";
drawers show their load against the runner rating; doors show their weight and hinge count. One tap
fixes it: *add a centre divider*, *use 25 mm*, *add a rear rail*, *add a hinge*.

**Professional details.** Deflection by span, board thickness, material stiffness and load per
possession (books vs folded clothes vs shoes); an allowed sag of ~2 mm per metre; hinge count already
exists (`hingesFor` in `hinges.ts`); runner and track ratings from the hardware registry. Critical
results feed the **manufacturing check**, so drawings warn too.

**Why it amazes.** It's the first time a consumer tool shows *why* a carpenter would say no. It also
makes the marketing promise true.

**Builds on.** `possessions.ts` (add a weight per item), `hardware-registry.ts` (loads), the planner's
assignment of possessions to fittings, `manufacturing-validation.ts`.

### A3. Doors and drawers that open · S

**What the person sees.** Tap a door: it swings open. Tap a drawer: it slides out with its contents.
**Open all** in View shows the whole interior working at once. While open, clearances light up when a
drawer hits a hinge, a door hits the wall or a bed, or a pull-out can't clear an inset door.

**Builds on.** Clearances in `wardrobe-rules/clearances.js`, hinge kinds, runner lengths, studio walls
and fixtures as obstacles; the renderer already draws fronts and garments.

### A4. Interior accessories pack · S per item

New entries in `fittings.ts` (and `possessions.ts` where they hold something), each with its own
hardware line and 3D model:

| Fitting | Holds | Notes |
|---|---|---|
| Tie and belt rack (pull-out) | ties, belts (new possessions) | side-mounted, 10 cm wide |
| Jewellery and watch insert | jewellery (new) | velvet trays in a small drawer, glass front option |
| Drawer dividers | socks, underwear | insert grid inside any drawer |
| Pull-out mirror | — | full-height, side-mounted |
| Ironing board pull-out | ironing board | in a drawer frame |
| Laundry basket pull-out | laundry | ventilated, 2 compartments |
| Hidden inner drawer | as drawer | behind a door, with the "inner drawer" clearance |
| Valet rod | an outfit for tomorrow | pull-out, 30 cm |
| Suitcase / bedding space | suitcases, duvets (new) | upper boxes sized for real luggage |

New possession types make Auto design plan for them, so the depth shows up in the planner too.

### A5. Lighting · S–M

**What the person sees.** Fronts › Lighting: LED in the hanging rail, strips on shelf fronts, a
motion sensor that switches on when a door opens. Switch the scene mood to **evening** and the wardrobe
glows from inside, the most beautiful moment in the app.

**Professional details.** Strip lengths, driver wattage, cable routes through the carcass (a hole on
the drawings), switch type; on the hardware list.

**Builds on.** `cabinet-lighting.ts` (kitchens), `cabinet-accents.ts`, time of day in the experience
layer.

### A6. Built-in finishing · S

Cornice or **ceiling filler** (fill to an uneven ceiling with scribe allowance), **skirting cut-out**
on the side panels, **scribe strips** against walls, **plinth or legs** for wardrobes, **end panels**
for wardrobes (kitchens already have them), visible side in a matching decor. Each shows on the
drawings and in Make.

**Builds on.** `end-panels.ts`, `explicit-panel-fit.ts`, filler fittings (`filler` trait),
`carcass.ts` (plinth).

### A7. Board and edge build options · M

**Construction** sheet per piece: carcass thickness 16 / 18 / 25 mm, back panel (3 mm HDF in a groove,
8 mm grooved, 18 mm structural), shelf thickness, edge banding per edge (none / 0.8 / 2 mm) with
defaults by visibility, and **grain direction per part** (visible on the model and the cutting list).
Cutting sizes deduct the edge banding (a known gap in the drawings).

**Builds on.** `carcass.ts` (the only place board thickness lives), `decor-base.ts`
(`grainDirection`, `edgeBandingSpec`), `cutting-list.ts`, Make's `back-construction.ts`.

### A8. Corner wardrobes · M

L-shaped and U-shaped wardrobes along two or three walls, with a proper **corner unit** (a corner
hanging rail, an L-shaped shelf, or a corner carousel) and the blind corner handled the way the
kitchen corner already is.

**Builds on.** `corner-sweep.ts`, `corner-widths.ts`, `corner-details.ts` (kitchens and drawings
already model corners), quarter-turn runs in alignment.

### A9. Kitchen professional details · S each

Worktop material and thickness (28/38 mm laminate, compact, stone), overhang, **upstand and
splashback**, **sink and hob cut-outs** (a known gap), tall-unit fillers to the ceiling, appliance
niche sizes from a short list of real standard niches (60 × 60, 45 × 60, 88 cm built-in fridge).

---

## 4. Part B: make the depth visible and enjoyable

### B1. "Pack it": watch your things move in · S–M

After Auto design, press **Pack it**: the clothes, shoes and bags the planner assigned fly into their
places, one category at a time, with a running count: *"24 of 24 shirts · 10 of 10 trousers ·
12 pairs of shoes · 3 spare slots"*. Tap a shelf to see what lives there.

**Builds on.** Garments are already drawn (`garment-shape.ts`, `fabric.ts`); `possession-report.ts`
knows what goes where; the assembly animation's timing in `assembly-motion.ts`.

### B2. Design passport: the numbers a professional quotes · S

A pill on the model opens a one-page passport of the piece, live as it changes (figures below are an illustration, not a real design):

| | |
|---|---|
| Storage fit | 100% of what you own, 18% room to grow |
| Boards | 23 parts, 3.4 sheets of 2800 × 2070, **91% yield** |
| Edge banding | 48.6 m |
| Hardware | 12 hinges, 6 pairs of runners, 2 rails, 186 screws |
| Weight | 142 kg empty |
| Build time | ≈ 6 h for two people |
| Engineering | all shelves within sag limits |
| Price | ≈ 2,340 zł in boards and hardware (when B3 is in) |

**Builds on.** Make (parts, holes, hardware, timeline), the cut layout, the hardware list, the planner
report. Nearly all the numbers already exist; they're just not shown together.

### B3. Live price in money · M

A price figure on the model (boards by m² and decor, edge banding by metre, hardware by piece, from a
price registry per country like `credit-catalog.ts`). Every change shows its cost: *soft-close runners
+160 zł*. **Sheet-saving hints** from the cut layout: *"2 cm narrower fits on 3 sheets instead of 4:
save 180 zł."* Only FurniDraw can do this, because only FurniDraw knows the cut layout.

### B4. Reach and body view · S

Set one or two people's heights. A silhouette stands in front of the wardrobe; zones colour **easy**,
**stretch** and **step needed**. Auto design and Pack it use them ("her side", "his side").

**Builds on.** Max reach (`max-reach.ts`) and the drawn reach line in `cabinet-layout-renderer.js`.

### B5. Section and exploded views · S

- **Section**: drag a cut plane through the piece (front to back or side to side) to read the interior
  as a drawing does, with dimensions.
- **Exploded**: a slider in Make that pulls the boards apart along their joints, then puts them back.

**Builds on.** Make's parts and joints; Three.js clipping planes.

### B6. Compare two designs side by side · S–M

From the Auto design gallery, pick two: a split screen with the same camera, and a table of the
differences (storage fit, sheets, price, drawers, reach). Swap and apply.

### B7. Productivity a professional expects · S each

- **Copy bay / paste bay** and **mirror the interior**.
- **Lock a bay** and re-run Auto design on the rest.
- **System 32 snapping**: shelves and runners move in 32 mm steps, the holes a real carcass has
  (`make-hardware.ts` already uses the 32 mm line).
- **Measure anything**: a tape between any two points on the model.
- **Design templates**: ready designs to start from ("couple's walk-in", "sloped attic", "kid's
  wardrobe that grows", "hallway with bench"), built with the design spec.

### B8. "Grows with your child" · S–M

A timeline slider on a kid's wardrobe (age 3 → 8 → 14): the same carcass, re-planned at each age with
rails moving up and drawers replacing toy boxes. It shows why adjustable construction matters, and
it's a story people share.

**Builds on.** Auto design with fixed carcass and dividers; possessions per age as presets.

### B9. Explain the design · S

Every Auto design card and the selected piece get one plain sentence and three reasons: *"All your
shirts at eye level; shoes on pull-outs you reach without bending; 2 bays kept for growth."* Any
fitting can answer "why is this here?"

**Builds on.** `layout-score.ts`, `design-hero-metrics.ts`, `possession-report.ts`.

---

## 5. Release plan

Three releases, each 4–6 weeks, each with a story people can feel.

| Release | Theme | Features | The demo |
|---|---|---|---|
| **1. Real wardrobe** | What a carpenter expects | A1 Sliding doors · A2 Engineering check · A3 Doors that open · B7 Copy, mirror, lock, System 32 | Slide a mirror door, open the drawers, watch a shelf turn red and fix it in one tap |
| **2. See the depth** | The numbers and the story | B1 Pack it · B2 Design passport · B9 Explain · B4 Reach view · B5 Section and exploded | Watch 24 shirts move in; open the passport: 91% yield, 142 kg, 6 h |
| **3. Premium finish** | What makes it look fitted and expensive | A4 Accessories · A5 Lighting · A6 Built-in finishing · A7 Board build · B3 Price | Evening mood with LED rails; the price changes as soft-close is added |
| Then | Bigger pieces | A8 Corner wardrobes · A9 Kitchen details · B6 Compare · B8 Grows with your child | |

Before release 1: add a small `track(event)` port so we can see which features people use (no product
analytics exist today).

### Prioritisation

| Feature | Wow | Pro credibility | Effort | Order |
|---|---|---|---|---|
| A1 Sliding doors | ●●● | ●●● | M | 1 |
| A2 Engineering check | ●●● | ●●● | S–M | 2 |
| A3 Doors that open | ●●● | ●● | S | 3 |
| B1 Pack it | ●●● | ● | S–M | 4 |
| B2 Design passport | ●● | ●●● | S | 5 |
| B7 Productivity set | ● | ●●● | S | 6 |
| A5 Lighting | ●●● | ●● | S–M | 7 |
| A4 Accessories pack | ●● | ●●● | S each | 8 |
| B3 Live price | ●●● | ●●● | M | 9 |
| A6 Built-in finishing | ● | ●●● | S | 10 |
| B9 Explain | ●● | ●● | S | 11 |
| B4 Reach view | ●● | ●● | S | 12 |
| B5 Section and exploded | ●● | ●●● | S | 13 |
| A7 Board build | ● | ●●● | M | 14 |
| A8 Corner wardrobes | ●● | ●●● | M | 15 |

---

## 6. Parked until these land

These stay valuable but are large: ordering boards from partner panel shops, a RoomPlan scanning
companion app, a public gallery with remix, a carpenter subscription with client links, a chat
designer, a "living wardrobe" after the build. The features above are also their foundations (the
price, the passport, the engineering check and the board build are what an order or a quote needs).

---

## 7. Market context (short)

| Product | Has | Lacks |
|---|---|---|
| IKEA PAX planner | Free, trusted, linked to stock | Fixed sizes, IKEA parts only, no slopes, reviewers call it slow and clunky |
| Tylko, Pickawood, Online Bedrooms, Komandor | Made-to-measure ordering | Simple box configurators, their own products only |
| Planner 5D, Coohom, IKEA Kreativ | Rooms, AI images, scanning | Furniture is decoration, not buildable |
| Cabinet Vision, Mozaik, Polyboard | Professional design to CNC | Expensive desktop tools for cabinetmakers |

Our position: **a professional's depth with a consumer's ease.** Part A earns the first half, Part B
makes people feel it.

Sources: [House Digest on the PAX planner](https://www.housedigest.com/1908134/ikea-online-closet-design-tool),
[PAX downsides](https://housedigest.com/1648850/ikea-pax-wardrobe-cons-downsides-criticism-tiktok),
[Tylko configurator](https://tylko.com/faq/articles/popular/what-is-the-configurator),
[Online Bedrooms](https://www.online-bedrooms.co.uk/alcove-wardrobes),
[Coohom](https://www.coohom.com/article/ai-room-design-from-floor-plan),
[Planner 5D](https://planner5d.com/use/ai-decorating-app),
[IKEA Kreativ](https://ikea.com/us/en/newsroom/corporate-news/ikea-launches-new-ai-powered-digital-experience-empowering-customers-to-create-lifelike-room-designs-pub58c94890),
[Cabinet software 2026](https://www.myarchitectai.com/blog/cabinet-design-software),
[Oferteo: projekt szafy na wymiar](https://www.oferteo.pl/artykuly/projekt-szafy-na-wymiar),
[Magebit on configurator abandonment](https://magebit.com/blog/why-customers-abandon-your-product-builder-and-how-to-fix-the-ux).
