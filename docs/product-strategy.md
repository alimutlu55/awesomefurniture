# FurniDraw product strategy: from "design a wardrobe" to "make it real"

Product owner's analysis, November 2026. Covers what the product is, where the market is,
why people would come back, and what to build next, with bold bets ranked by how much they move
engagement. Nothing here is built yet; each feature names the code it would build on.

---

## 1. The short version

**What we have that nobody else has.** FurniDraw already goes further than any consumer tool on the
market. It goes from *what someone owns* (Auto design plans storage around their clothes, their reach
and their growth) to *what a workshop needs* (technical drawings, a manufacturing check, a cutting list
and Make, which shows every board, joint, hole and assembly step), for awkward rooms (slopes,
stairs, alcoves, stepped ceilings), in a browser, on a phone.

**What holds it back.** The value sits at both ends of a long path, and nothing pulls a person along
it or brings them back:

1. **We can't see engagement.** There are no product analytics in `src/` (no events, no funnel). We
   cannot tell where people drop off, so the first step is to measure.
2. **The real world comes in and goes out by hand.** The room is typed in by hand. The output is a PDF.
   Between "I like this design" and "this is in my bedroom" sits a gap that the person has to
   cross alone: measuring, pricing, buying boards, cutting, drilling and assembling.
3. **No money figure.** The planner works in relative price units (`budget: 900`). People never
   see what the wardrobe would cost in zloty or euro, and unexpected cost is the most common reason
   people abandon a configurator.
4. **One visit per project.** People design, maybe buy an AI image, and leave. Nothing gives them
   a reason to come back (a partner who has to approve, a build in progress, a wardrobe they live with).

**The direction: own the whole journey from "what I own" to "it's built and I live with it".**
Every competitor stops at the picture (IKEA Kreativ, Planner 5D, Coohom) or at the order of its
own product (IKEA PAX planner, Tylko, Online Bedrooms). Professional CAD (Cabinet Vision, Mozaik,
Polyboard) reaches the workshop but expects a cabinetmaker. **FurniDraw is the only one that can
connect a person's things, their real room and a real workshop.** The bets below each build one
link in that chain.

**North-star metric: *make-ready designs per week*.** A make-ready design passes the manufacturing
check, fits a measured room and has a priced bill of materials. It captures what people
value (a design they can build), it's what we earn from (drawings, Make, orders), and it measures
engagement better than raw sessions do.

---

## 2. What the product is today

An honest inventory, read from the code and docs.

| Area | What it does today | Strength | Where it stops |
|---|---|---|---|
| **Wardrobe editor** | 3D editor; regular, sloped, stepped, under-stairs, recessed and custom shapes; fittings with traits; doors, fronts, handles, 44 hardware entries | Shaped tops cut fittings to the slope automatically; same tools on phone and desktop | Discoverable only by trying |
| **Auto design** | Inventory-led planner (short, long, trousers, folded, shoes, small, handbags) with reach and growth; a gallery of up to 8 ranked, structurally different designs | **Unique.** No competitor plans around what a person owns | Seven possession types; counts are typed in; it doesn't say *why* a design won in plain words |
| **Kitchen cabinets** | Base, wall and tall units, runs with shared worktop and plinth, appliances, pull-to-array | Same engine and same tools as wardrobes | No corners, no worktop cut-outs, not in design specs or the agent API |
| **Studio (room)** | Walls, openings, sloped and stepped ceilings, toilets and basins, room templates (alcove, L-shape, under-stairs, walk-in) | Wardrobes follow the ceiling automatically | Rooms are typed in by hand |
| **Technical drawings** | Plan, elevations, shop sheets, cutting and hardware lists, PDF, manufacturing check that fails closed | Professional grade | No drilling plans; cut sizes ignore edge banding |
| **Make** | One piece down to its boards, joints, holes, drawer boxes, assembly steps and cut layout | **Unique** in a consumer tool | Strips-only cut layout; output stays on screen or in a PDF/CSV |
| **AI image** | Photographic render from three views with real decor SKUs (Gemini) | Sells the dream; it's paid | A one-off; it doesn't show the person's own room |
| **Experience** | Welcome, assembly animation, moods, time of day, fit reveal | Delightful, phone-first | Welcome builds wardrobes only |
| **Accounts and credits** | Guest-first, sign in to buy; PLN, EUR, USD; packs of 40–1,300 credits | Margins are guarded by a test | Credits buy only two features |
| **Agents** | Design spec, `window.furnidraw`, WebMCP, `#spec=` links | Ahead of the market | Wardrobes only; not exposed to people as a chat |
| **Reach** | 7 languages, SEO niche pages (sloped ceiling, alcove, walk-in, under stairs, cut list) | Good long-tail SEO focus | No analytics to see what converts |

**The moat is the depth of the domain model** (millimetre-exact carcass rules, a manufacturing
check, a storage planner, hardware with real behaviour). Competitors can copy a 3D configurator in
a quarter. They can't copy this in a year. Every bet below should **spend** that depth on something
a person can feel, rather than add more depth nobody sees.

---

## 3. Who it's for

| Persona | Job to be done | What they need from us | Today |
|---|---|---|---|
| **Anna, the renovator** (30–45, flat or house, awkward room) | "Make the most of this odd space and get it built without being ripped off" | Fit the real room, a believable picture, a fair price, someone to build it | Strong on design; weak on room capture, price and finding a builder |
| **Tomasz, the DIY maker** (owns a drill and maybe a track saw) | "Build it myself from boards I order cut to size" | Cut list, drilling, assembly steps, ordering the boards | Strong (Make, drawings); missing ordering and drilling plans |
| **Piotr, the small carpenter or kitchen studio** (1–10 people) | "Win the client fast, quote correctly, cut without mistakes" | Client-facing designs, quotes in their own prices, CNC/saw output | Not served; potentially our best-paying users |
| **The couple** | "Agree on one design, split the wardrobe fairly" | Share, compare, vote, a side for each | Sharing copies the design; no voting |
| **The organiser** (lives with the wardrobe) | "Know where everything goes and keep it tidy" | A map of their storage | Not served |

Anna is the volume, Tomasz is the most engaged, **Piotr is the revenue**, and the couple and the
organiser are how people come back.

---

## 4. The market

| Product | What it does well | What it lacks (our opening) |
|---|---|---|
| **IKEA PAX planner** | Free, trusted, linked to stock and delivery | Fixed widths and depths; reviewers call it slow and clunky and say it struggles with complicated rooms; corner units lose space; IKEA products only; no slopes, no plan for what you own |
| **IKEA Kreativ** | Scans a room from phone photos (LiDAR where present), erases existing furniture, places IKEA products | Decoration, not built-in furniture; scanning takes effort; full features only in the app |
| **Tylko, Pickawood, Online Bedrooms, Komandor, Superszafy** | Made-to-measure ordering, delivery and sometimes assembly | Locked to their own products; simple box configurators; no slopes or planner; lead times of 4–14 weeks; you can't take the design to a local carpenter |
| **Planner 5D, Coohom, Homestyler** | Whole-room decoration, AI styling, floor plan upload | Furniture is decoration, not manufacturable; no cut lists |
| **Cabinet Vision, Mozaik, Polyboard** | Professional design-to-CNC | Desktop, expensive (Mozaik from $125/month, Polyboard into the thousands), made for cabinetmakers, not their clients |
| **SketchUp + OpenCutList, Flatma, CabinetPlans** | Free or cheap cut lists for makers | You model every board yourself; no planner, no client-ready picture |
| **Whering, Acloset** (digital wardrobe apps) | Millions of people already catalogue their clothes | Know *what* you own, not *where* it lives |

### Where the market is going

- **Room capture is becoming normal.** Apple RoomPlan (LiDAR) exports walls, doors and windows to
  USDZ, and IKEA trained people to scan rooms. People will expect to scan rather than type.
- **AI images are a commodity.** Every planner offers "AI design". A pretty picture is no longer
  an advantage. **A buildable** picture is.
- **Configurators lose people at the price and at "will I really get this?"**. Vendor research
  repeatedly names unexpected cost, dead-end options and doubt about fulfilment. FurniDraw's
  manufacturing check and exact drawings answer the trust question better than anyone; we just don't
  turn them into a promise yet.
- **Agents are starting to shop.** We already have WebMCP and a design spec. We could become the
  standard way an AI assistant designs a built-in.

### Our position in one sentence

> **FurniDraw designs storage around your life and your real room, then hands you everything you
> need to have it made: by a workshop near you, or by yourself.**

Not a retailer (we don't sell one brand's boxes), not CAD (no training needed), not a decoration app
(everything is buildable to the millimetre).

---

## 5. Engagement diagnosis

The current journey, with where people likely drop off (to be confirmed with data):

```
Land (SEO page) → Welcome → Empty project → Add wardrobe → Size it → Auto design → Fronts/finish
   → AI image (paid) → Drawings (first free) → Make → … leaves to build elsewhere
```

| Moment | Likely friction | Fix (see bets) |
|---|---|---|
| Empty project | "Where do I start?" A new project starts without furniture | B1 Room-first start, B9 Inventory onboarding |
| Measuring the room | Tape measure, typing walls, wrong numbers | B1 Scan, B6 Measurement check |
| Auto design | Typing counts of clothes; not knowing why a design won | B9 Wardrobe twin, E2 Explain |
| Price | No money figure | B2 Live price |
| AI image | Paid before trust is built; shows a studio, not *my* room | E5 First image free, B3 "In my room" |
| Drawings and Make | Strong, but then the person is on their own | B4 Order it cut, B5 Build companion |
| After the build | No reason to return | B7 Living wardrobe, B8 Gallery |

### Instrument first (week 1)

There are no product analytics in the code. Before building any feature:

- Add a small `track(event, props)` port in `application/` with a Supabase or privacy-friendly
  adapter in `infrastructure/` (cookieless, EU-hosted: we sell in PLN and EUR under GDPR).
- About 20 events: `welcome_seen`, `room_created(source)`, `furniture_added(kind)`,
  `auto_design_run`, `auto_design_applied(rank)`, `finish_changed`, `ai_image_generated`,
  `drawings_opened`, `make_opened`, `manufacturing_check(result)`, `design_shared`, `credits_purchased(pack)`,
  `returned(day)`.
- Funnel: **activated** = a furniture piece sized to a room + Auto design applied, within the first session.
- Retention: D1/D7/D30 return by persona signal (kitchen vs wardrobe, Make opened or not).

---

## 6. Strategy: four pillars

1. **Real world in.** Scan or photograph the room and the clothes; never start empty.
2. **Real world out.** Price in money, order boards cut and drilled, connect to a carpenter.
3. **Confidence.** Prove it fits, prove it's buildable, prove the price before anyone pays.
4. **Life after the build.** The design becomes the map of a person's storage, and a story they share.

---

## 7. Bold bets

Each bet: what, why it matters, what it builds on, the metric it moves, and a rough size
(S ≈ 2 weeks, M ≈ 1–2 months, L ≈ a quarter, XL ≈ more).

### B1. Scan your room, get a wardrobe in 60 seconds (Real world in) · L

**What.** "Scan my room" on the welcome screen. iPhone/iPad with LiDAR: a light native companion
(App Clip) uses RoomPlan and sends walls, openings, ceiling height and slopes as a **design
spec** (`room`, `ceilings`, openings) to the web editor. Every other phone: **guided measuring**
(the app asks for 4–9 numbers, one at a time, with a picture of where to put the tape) plus a
photo of the wall that Gemini reads for doors, windows, sockets and the slope line. Then
**Auto design fills the wall straight away**, with the assembly animation.

**Why.** It removes the biggest chore (measuring and typing walls) and the empty-project problem
at once. It turns "a wardrobe editor" into "the app that designs *my* bedroom".

**Builds on.** The design spec already describes rooms, ceilings and wardrobes that `fill` a wall;
`buildFromSpec` builds them in one step; the welcome already plays assembly.
`docs/studio-investigation.md` holds the photo-to-room research.

**Measures.** Activation rate; time to first sized wardrobe; share of projects with a room.

### B2. Live price in real money, with three ways to buy it (Real world out) · M

**What.** A price pill always visible on the model: **"≈ 2,340 zł"**, tapped for a breakdown.
Three columns:

| Build it yourself | Boards cut and drilled for you | Built and fitted |
|---|---|---|
| Boards, edge banding, hardware at shop prices | + cutting, drilling, edging (B4) | + workshop fitting (B10) |

Plus **cost-aware nudges** that only FurniDraw can make because it knows the cut layout:
*"Make it 2 cm narrower and it fits on 3 sheets instead of 4: save 180 zł."* *"Soft-close runners
on these 4 drawers: +160 zł."*

**Why.** Unexpected cost is the main reason people abandon configurators. A live, honest price is
the most trusted thing we can add, and the sheet-saving nudge is a "wow" moment.

**Builds on.** `cutting-list.ts`, `make-cut-layout.ts`, `stock-sheet.ts`, `hardware-list.ts`,
`material-schedule.ts` and the decor catalogue with manufacturer SKUs. Prices become a registry
(per country) like `credit-catalog.ts`.

**Measures.** Time spent per design; rate of drawings and orders; fewer exits at the finish step.

### B3. "See it in my room": AR at full size and AI images of the real room · M

**What.**
- **AR at 1:1**: Quick Look (USDZ) on iPhone, WebXR/Scene Viewer on Android. Place the wardrobe on
  the real wall, **open its doors in AR**, check it clears the bed and the radiator.
- **Reach check with your own body**: stand in front of it in AR and see the top shelf glow red if
  it's above *your* reach (Max reach is already a setting).
- **AI image of my room**: the person uploads a photo of their real room; the AI image puts the
  designed wardrobe in it, using the same finishes and locked instructions.

**Why.** It answers "will it look right and will it fit?" in the person's own space. It's the most
shareable moment ("look what's going in our bedroom") and makes the paid AI image worth much more.

**Builds on.** The Three.js scene can be exported to glTF/USDZ; the AI image pipeline already takes
reference views and decor swatches (`design-image-references.ts`).

**Measures.** AI image conversion; shares; time to decision.

### B4. "Make it real": order the boards cut, edged and drilled · XL (the big one)

**What.** One button after the manufacturing check passes: **Order cut and drilled**. FurniDraw sends
the job to a partner panel shop (Poland has a dense network of board suppliers who cut and edge to
order) in their format: a cutting list with edging codes, drilling programmes (CSV/DXF, later
machine formats) and labels. The person gets a delivery date and a box of numbered boards. We earn a
commission per order.

Phase it:
1. **Export pack (S)**: a ZIP the person emails to *any* shop: optimised cutting list in the common
   panel-saw CSV layout, edging per edge, a drilling sheet per board, a QR label per part.
2. **Partner network (L)**: 3–5 shops in Poland with real prices feeding B2; orders, status and
   reorders in the app.
3. **Marketplace (XL)**: shops compete on price and lead time; ratings.

**Why.** It closes the gap where we lose every user today. It turns the drawings from a PDF into a
transaction, and it's a revenue line far bigger than AI images. Competitors with ordering (Tylko,
Online Bedrooms) only sell their own boxes; nobody lets you take **your own** design to a local
shop with one click.

**Builds on.** Make (parts, joints, holes, `part-operations.ts`), the cutting list, the manufacturing
check (it fails closed, which is exactly what an order needs), the hardware list.

**Prerequisites.** Close the known gaps: drilling plans in drawings; cut sizes that deduct edge banding.

**Measures.** Orders per week (the revenue version of the north star); average order value.

### B5. Build companion: the assembly manual that knows your wardrobe · M

**What.** Make's assembly steps become a **phone mode for build day**: one step per screen, big
pictures, "next" by voice or tap, a parts checklist, the hardware for this step, and a timer. Every
board has a **QR label** (printed with the order or the export pack). Scan a board and the app
shows where it goes and which step it's in. Optional AR: point the phone at the carcass and the next
board's position is highlighted.

**Why.** Assembly is where DIY builds go wrong. It brings the person back into the app for a whole
day (or a weekend). It's what makes "I built this" stories, which feed B8.

**Builds on.** `make-assembly.ts`, `make-timeline.ts`, `make-staging.ts`, the Make view and its
marks; the experience layer's assembly animation.

**Measures.** Returning sessions per project; finished builds reported.

### B6. Measurement check: "measure these 9 points before you order" · S

**What.** Before drawings or an order, a short guided check: three widths (top, middle, bottom),
three heights, both diagonals, a skirting board, a socket. FurniDraw spots walls that aren't square
or level and **adds scribe allowances and filler strips automatically**, explaining why.

**Why.** Every carpenter's first question, and the reason people fear ordering online. It turns
our millimetre precision into a promise: *"If you measured these 9 points, it will fit."*

**Builds on.** Studio walls and ceilings, filler fittings (`filler` trait), end panels, the
manufacturing check (as a new blocking finding when unmeasured).

**Measures.** Order rate; fewer support requests and remakes.

### B7. Living wardrobe: the design becomes the map of your storage · M

**What.** After the build, switch the project to **Living** mode:
- **Where is it?** Search "winter scarves" and the shelf lights up.
- **Labels**: print shelf and box labels from the planner's own assignment of possessions to fittings.
- **Seasons**: the planner already reserves storage above reach; plan a summer/winter swap and
  remind the person twice a year.
- **Life changes**: "a baby is coming", "my partner is moving in", "I'm working from home". Re-plan
  the interior *within the existing carcass* (move shelves and rails, add drawers) and order only
  the new parts.

**Why.** It gives a reason to come back for years, not one evening. Re-planning a built wardrobe
is a repeat purchase (new fittings, new boards) with zero acquisition cost.

**Builds on.** `possession-report.ts` (what goes where), `upper-shelf.ts` (reserve storage),
Auto design with fixed fittings (it already respects existing fittings and divider cuts).

**Measures.** D30/D90 retention; repeat orders.

### B8. Gallery and Remix: real builds that fit into your room · M

**What.** A public gallery of designs and **finished builds** (before/after photos, cost, time to
build). Every entry has **Remix into my room**: the design spec is re-fitted to the viewer's own
walls, ceiling and possessions in one tap. Creators get credits when someone remixes or orders
their design.

**Why.** Inspiration is the top of every furniture funnel (Pinterest, Instagram). A remixable,
buildable gallery is content that only we can make, it's great for SEO (every build is a page), and
it rewards the people who build with us.

**Builds on.** The design spec and `describeScene` (a design described in words); share links;
SEO niche pages; credits.

**Measures.** New users from shared or gallery pages; remixes per build.

### B9. Wardrobe twin: count your clothes with the camera · M

**What.** Instead of typing "20 short hanging, 10 trousers", the person **photographs their open
wardrobe or rail** (or pastes from a digital-wardrobe app) and the AI counts and sorts the items
into our possession types, with lengths (dresses vs shirts) estimated. They confirm the numbers.
Add more possession types people ask for: suitcases, bedding, ironing board, vacuum cleaner, hats,
ties and belts, jewellery, sports kit.

**Why.** It makes Auto design (our most unique feature) effortless and a bit magical, and it's the
best onboarding hook: *"Show us your clothes, we'll design the wardrobe."* Digital-wardrobe apps
report millions of users who already think about their clothes as an inventory.

**Builds on.** `possessions.ts` (one entry per new type), the planner, the Gemini integration.

**Measures.** Auto design runs; Auto design applied; activation.

### B10. FurniDraw Pro: the carpenter's front of house · L (revenue)

**What.** A subscription for small workshops and kitchen studios:
- **Their own prices** (boards, hardware, labour) feed the live price (B2) and a branded quote PDF.
- **Client link**: the carpenter sends a link; the client sees the AI image, AR and price, comments
  and approves; changes come back to the carpenter.
- **Workshop output**: their own panel-saw and CNC export settings.
- **Leads**: people who press "Built and fitted" (B2) near them become paid leads.

**Why.** Small workshops quote in spreadsheets and sketches, and the professional tools are
expensive and desktop-only. They would pay monthly for something that wins clients faster. Each Pro
also brings their clients into FurniDraw, a distribution channel we don't pay for.

**Builds on.** The drawings and Make (already pro grade), accounts, credits (a subscription is one
more credit catalogue entry), sharing.

**Measures.** Pro subscribers; MRR; client links opened.

### B11. Talk to your designer: a chat that builds · M

**What.** A chat panel in the editor: *"Make the left side for my husband's suits and add a shoe
drawer at the bottom."* *"Make it cheaper."* *"Why is this shelf so high?"* The assistant changes
the design with the editor's own commands, and explains the result in carpentry terms.

**Why.** It's the easiest interface for people who don't think in bays and sections. We already
built it for external agents; people deserve it too.

**Builds on.** The design spec, `check`/`build`/`describe_design` (WebMCP), editor commands and
undo checkpoints; kitchens need adding to the spec first (known gap).

**Measures.** Edits per session; activation for first-time users.

### B12. Decide together: share to vote, side by side · S

**What.** Share a set of Auto design options or finishes as a **vote link**: the partner swipes,
both see where they agree. Couples' wardrobes get **"his / hers / ours"** split, with a reach profile
per person (two heights).

**Why.** Built-in furniture is a household decision. Today a share copies the design; a vote brings
a second person into the product and brings the first one back.

**Builds on.** Share links (`?session=`), the Auto design gallery, Max reach.

**Measures.** Invitees who open the link; return visits within 48 hours.

### More, smaller bets

| Idea | What | Size |
|---|---|---|
| **Inspiration to design** | Upload a Pinterest photo; we read the style (fronts, handles, decor, proportions) and apply it to the person's design | M |
| **Refit an existing wardrobe** | "I already have wardrobe frames": measure the existing carcasses and plan only new interiors and doors for them | M |
| **New furniture kinds** | Hallway (shoes, coats, bench), home office and desks, TV wall, bookcases, bathroom vanity (fixtures exist), attic knee walls, bed with storage | M each, through the furniture module |
| **Kitchen corners and cut-outs** | L- and U-shaped runs, corner units, sink and hob cut-outs in the worktop (known gaps) | L |
| **Share as video** | Export the assembly animation and the reveal as a vertical video for TikTok/Instagram | S |
| **Board yield score** | "92% of the boards are used" with a leaf; the sheet-saving nudge from B2 | S |
| **Lighting** | LED strips and motion lights in wardrobes (cabinet lighting exists for kitchens) with drilling and cable routes | M |
| **Accessibility** | Wheelchair reach and pull-down rail presets; "for an elderly parent" profile | S |

---

## 8. Making the existing features stronger

| Feature | Change | Why |
|---|---|---|
| **Welcome** | Start from the room or from the clothes (B1, B9), never from an empty project; build kitchens too | Activation |
| **Auto design** | Explain each design in one sentence ("fits all 24 shirts; shoes at hand"); **lock a bay and redesign the rest**; show "what you give up" between two designs | Trust and control |
| **Auto design** | Fix the known gaps: plan above the lowest point under a slope; never leave shirts out in a tall narrow bay | Quality |
| **AI image** | First image free once signed in; show it in the person's room (B3); offer 3 moods per generation | Conversion: the first image sells the next |
| **Credits** | Earn credits for sharing a build, for a remix of your design (B8) and for referrals; add a Pro subscription (B10) | Retention and revenue |
| **Technical drawings** | Drilling plans; edge-banding deduction; a "send to workshop" button (B4 phase 1) | Unblocks ordering |
| **Make** | QR labels per board; nested cut layout with offcut reuse; machine export | Build companion and ordering |
| **Studio** | Room templates for the rooms people search for (attic, hallway, bay window); it's the base for B1, B3 and B6 | Foundation |
| **Kitchen** | Into the design spec and the agent API; corners; cut-outs | Parity with wardrobes |
| **Sharing** | A read-only "view" link with the AI image and price, beside the "copy" link | Show without losing the original |
| **Mobile** | Run `check:mobile` in CI; every new bet phone-first | Most visitors come from phones |

---

## 9. The loops that bring people back

```
          ┌──────────── Design loop (one evening) ────────────┐
          │ room → Auto design → finish → price → AI image     │
          └───────────────┬────────────────────────────────────┘
                          │ "make it real"
          ┌───────────────▼──────── Build loop (weeks) ────────┐
          │ measurement check → order → delivery → companion   │
          └───────────────┬────────────────────────────────────┘
                          │ "I built it"
          ┌───────────────▼──────── Social loop ───────────────┐
          │ gallery → remix in another room → new user         │──┐
          └───────────────┬────────────────────────────────────┘  │
                          │ lives with it                          │
          ┌───────────────▼──────── Living loop (years) ───────┐  │
          │ where is it → seasons → life change → reorder parts│  │
          └────────────────────────────────────────────────────┘  │
          ┌──────────── Pro loop: carpenter brings clients ────┐◄─┘
          └────────────────────────────────────────────────────┘
```

| Loop | Metric | Target at 12 months (to be set once week-1 analytics give a baseline) |
|---|---|---|
| Design | Activation (sized to a room + Auto design applied) | Baseline + 50% |
| Build | Make-ready designs per week; orders per week | North star |
| Social | Share of new users from gallery and shared links | 25% |
| Living | D90 return rate of people who built | 30% |
| Pro | Paying workshops; client links per workshop per month | — |

---

## 10. Roadmap

### Now (0–6 weeks): measure and remove friction
1. Product analytics and the funnel (§5). **Nothing else ships without it.**
2. Add `check:mobile` to CI so every bet stays phone-first.
3. B6 Measurement check.
4. B4 phase 1: the workshop export pack (ZIP: cutting list with edging, drilling sheets, QR labels).
5. Auto design explanations and "lock this bay".
6. Share as video; read-only view links.

### Next (1–2 quarters): real world in and out
7. B2 Live price with Polish board and hardware prices (one market first), with sheet-saving nudges.
8. B1 Room capture: guided measuring for everyone, then the RoomPlan companion.
9. B9 Wardrobe twin (count clothes from a photo) and new possession types.
10. B3 AR at 1:1 and AI images of the real room.
11. B12 Vote links and two-person reach.
12. Drawings: drilling plans and edge banding; kitchens in the spec.

### Later (2–4 quarters): transactions and community
13. B4 phase 2: partner panel shops in Poland; orders in the app.
14. B10 FurniDraw Pro.
15. B5 Build companion with QR scanning.
16. B8 Gallery and Remix.
17. B11 Chat designer.

### Moonshots (12 months+)
- B7 Living wardrobe with life-change re-plans and reorders.
- A marketplace of workshops across the EU competing on price and lead time.
- **FurniDraw as the standard for AI assistants**: any assistant designs a built-in through our spec
  and hands the person a link they can order from.
- Whole-home built-ins: one room scan, every wall planned (wardrobe, desk, TV wall, kitchen).

---

## 11. Prioritisation

Scored 1–5 (impact on engagement, impact on revenue, confidence, effort where 5 = smallest).

| Bet | Engagement | Revenue | Confidence | Effort | Total | When |
|---|---|---|---|---|---|---|
| Analytics | 3 | 3 | 5 | 5 | **16** | Now |
| B6 Measurement check | 3 | 4 | 4 | 5 | **16** | Now |
| B4.1 Export pack | 3 | 3 | 4 | 5 | **15** | Now |
| B2 Live price | 5 | 4 | 4 | 3 | **16** | Next |
| B1 Room capture | 5 | 3 | 3 | 2 | **13** | Next |
| B9 Wardrobe twin | 4 | 2 | 3 | 3 | **12** | Next |
| B3 AR and own-room image | 4 | 4 | 4 | 3 | **15** | Next |
| B12 Vote links | 4 | 1 | 4 | 5 | **14** | Next |
| B4.2 Partner shops | 4 | 5 | 3 | 1 | **13** | Later |
| B10 Pro | 3 | 5 | 3 | 2 | **13** | Later |
| B5 Build companion | 4 | 2 | 4 | 3 | **13** | Later |
| B8 Gallery and Remix | 4 | 3 | 3 | 3 | **13** | Later |
| B11 Chat designer | 4 | 2 | 3 | 3 | **12** | Later |
| B7 Living wardrobe | 5 | 3 | 2 | 3 | **13** | Moonshot |

---

## 12. Risks and what we won't do

| Risk | Mitigation |
|---|---|
| **Liability when an ordered wardrobe doesn't fit** | The measurement check (B6) and the manufacturing check fail closed; orders need both; partner shops confirm before cutting |
| **Prices go stale** | Prices are a dated registry per country, refreshed by partners; every figure says "≈" and the date |
| **AI counts and photo reading are wrong** | The person always confirms the numbers; AI suggests, the domain model decides |
| **Spreading too thin** | One country (Poland) for ordering and prices first; one furniture kind per quarter |
| **Breaking the guards** | Every bet goes through the registries and layers in `CLAUDE.md`; golden tests stay unchanged unless a planner change is intended |
| **Native app cost** | Only an App Clip/companion for RoomPlan; everything else stays in the browser |

**We won't:** become a retailer with our own stock; copy another company's products, names or
look; add decoration (sofas, lamps) that isn't built-in; trade the guest-first experience for forced
sign-up before someone can design.

---

## 13. Questions for the founder

1. Ordering (B4) or Pro (B10) first? Ordering suits Anna and Tomasz; Pro suits Piotr and grows
   through carpenters. My recommendation: **the export pack now, then Pro before a marketplace**:
   carpenters are the panel shops' customers too.
2. Is Poland the launch market for prices and partners? (Our pricing, BLIK and tax setup say yes.)
3. Are we willing to ship a small native companion for RoomPlan, or stay browser-only with guided
   measuring?
4. What analytics are acceptable (self-hosted, cookieless)?

---

## Sources (market research, November 2026)

Vendor and blog sources; treat their claims as claims, not verified figures.

- IKEA PAX planner reviews: [House Digest: does the IKEA closet tool work?](https://www.housedigest.com/1908134/ikea-online-closet-design-tool),
  [House Digest: PAX downsides](https://housedigest.com/1648850/ikea-pax-wardrobe-cons-downsides-criticism-tiktok),
  [Chris Loves Julia: using the PAX planner](https://www.chrislovesjulia.com/how-to-use-the-ikea-pax-wardrobe-planner-our-master-closet-mood-board),
  [PAX vs custom built-ins](https://www.alibaba.com/product-insights/ikea-pax-wardrobe-vs-custom-built-in-closets-is-the-ikea-hack-worth-the-assembly-stress.html)
- IKEA Kreativ: [IKEA newsroom](https://ikea.com/us/en/newsroom/corporate-news/ikea-launches-new-ai-powered-digital-experience-empowering-customers-to-create-lifelike-room-designs-pub58c94890),
  [TechCrunch](https://techcrunch.com/?p=2340297), [IKEA help: room dimensions](https://www.ikea.com/ie/en/customer-service/knowledge/articles/28c782c5-0036-4ff1-b1fd-20846237ee09.html)
- Made to measure: [Tylko configurator](https://tylko.com/faq/articles/popular/what-is-the-configurator),
  [Tylko wardrobes](https://tylko.com/furniture-c/wardrobe), [Online Bedrooms alcove wardrobes](https://www.online-bedrooms.co.uk/alcove-wardrobes),
  [Pickawood](https://pickawood.com/en/p/wardrobes-23/35389), [Oferteo: projekt szafy na wymiar](https://www.oferteo.pl/artykuly/projekt-szafy-na-wymiar),
  [kb.pl: szafa wnękowa na wymiar](https://kb.pl/meble/szafy/zabudowana-szafa-wnekowa-na-wymiar-ceny-opinie-porady-na-co-zwrocic-uwage/)
- Professional and maker tools: [MyArchitectAI: 12 cabinet design tools 2026](https://www.myarchitectai.com/blog/cabinet-design-software),
  [Mozaik](https://www.mozaiksoftware.com), [CabinetFile service](https://wooddesigner.org/cabinetfile-service/)
- Room and AI planners: [Coohom: AI room design from floor plan](https://www.coohom.com/article/ai-room-design-from-floor-plan),
  [Coohom: floor plan from a photo](https://www.coohom.com/article/how-to-create-a-floor-plan-from-a-photo),
  [Planner 5D AI decorating](https://planner5d.com/use/ai-decorating-app)
- Room capture: [Road to VR on RoomPlan](https://roadtovr.com/?p=171125), [Apple developer forums: RoomPlan](https://developer.apple.com/forums/thread/829418)
- Digital wardrobes: [Whering raises $7m](https://www.theindustry.fashion/whering-secures-7m-to-expand-ai-powered-wardrobe-app/),
  [Best clothing inventory apps 2026](https://beautyai.app/blog/best-clothing-inventory-apps-2026), [Acloset](https://appgoblin.info/apps/com.looko.acloset)
- Configurator abandonment: [Magebit](https://magebit.com/blog/why-customers-abandon-your-product-builder-and-how-to-fix-the-ux),
  [ar-range: what stops customers converting](https://www.ar-range.app/solutions/knowledge-base/what-stops-customers-from-converting-when-buying-personalized-furniture),
  [Twikit: online furniture pain points](https://twikit.com/?p=34359)
