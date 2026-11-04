import { productPages } from './product-pages';
import { nichePages } from './niche-pages';
import type { Guide, GuideSection } from './guide-types';
export type { Guide, GuideSection };

/** Practical informational woodworking, measurement and planning guides. */
export const guideArticles: readonly Guide[] = [
  {
    slug: 'guides/measure-for-a-fitted-wardrobe',
    label: 'How to measure for a fitted wardrobe',
    title: 'How to Measure for a Fitted Wardrobe — Practical Checklist | FurniDraw',
    description: 'Measure width, height, depth and obstructions for a fitted wardrobe. '
      + 'A practical step-by-step checklist to prepare accurate site measurements before building.',
    eyebrow: 'MEASURING CHECKLIST & SITE SURVEY GUIDE',
    heading: 'How to measure for a fitted wardrobe.\nA practical step-by-step checklist.',
    intro: 'Record clear widths, heights, depths and obstructions before planning a fitted wardrobe. '
      + 'Use this checklist to prepare site measurements for design and carpentry review.',
    shape: 'alcove',
    sections: [
      {
        title: '01. Find the smallest clear dimensions.',
        body: 'Measure the width across floor level, at the midpoint (120 cm), and near the ceiling. '
          + 'Measure the height on the left, in the center, and on the right side. Check depth at multiple positions. '
          + 'Plastered walls, timber floors, and ceilings are never perfectly plumb or level. Record the smallest '
          + 'dimension as your maximum cabinet envelope, and note whether new carpets or floorboards will be installed.',
      },
      {
        title: '02. Draw and measure what the tape cannot explain.',
        body: 'Sketch all obstructions: baseboards (skirting), coving, radiators, electrical sockets, light switches, '
          + 'access hatches, and pipes. Note the swing direction and handle clearance of bedroom doors and windows. '
          + 'For sloping ceilings, measure knee-wall heights and rake angles at 50 cm intervals along the wall.',
        list: [
          'Width at 3 heights; height at 3 positions; depth at left, middle, and right.',
          'Position and dimensions of electrical outlets, switches, radiators, and pipes.',
          'Door swing radius and clearance to existing furniture and light fixtures.',
        ],
      },
      {
        title: '03. Enter dimensions into the 3D studio and verify tolerances.',
        body: 'Enter your room measurements into FurniDraw in your preferred units: the studio supports centimetres, '
          + 'millimetres, and inches (1 inch = 2.54 cm). Use the 3D model to test clearances and bay widths. '
          + 'Always allow a 25–40 mm scribing fillet along the sides and top to allow your joiner to fit the wardrobe '
          + 'flush against irregular walls.',
      },
      {
        title: '04. Professional cabinetmaker review.',
        body: 'Reviewed by FurniDraw Cabinet Engineering Team. Before ordering sheet goods or cutting boards, have your '
          + 'joiner or carpenter verify critical site measurements against the exported dimensioned drawings.',
      },
    ],
  },
  {
    slug: 'guides/standard-wardrobe-dimensions',
    label: 'Standard wardrobe dimensions guide',
    title: 'Standard Wardrobe Dimensions Guide — Depths, Rails & Shelves | FurniDraw',
    description: 'Complete guide to standard wardrobe dimensions: depth requirements, '
      + 'hanging rail heights for shirts vs coats, drawer clearances, and shoe shelf spacing.',
    eyebrow: 'STORAGE ERGONOMICS & DIMENSIONS GUIDE',
    heading: 'Standard wardrobe dimensions guide.\nDepths, hanging rails & shelves.',
    intro: 'Plan your wardrobe layout around standard ergonomic dimensions. '
      + 'Learn required carcass depths, hanging rail drops, and shelf spacing for every clothing category.',
    shape: 'regular',
    sections: [
      {
        title: 'Carcass depth requirements: reach-in vs walk-in.',
        body: 'Standard adult hangers are 420–450 mm wide. Adding coat sleeve bulk requires a minimum internal carcass depth '
          + 'of 550 mm for hinged door wardrobes and 580–600 mm for sliding door wardrobes to prevent sleeves from catching. '
          + 'Open walk-in closet shelving requires only 350–400 mm depth for folded clothing.',
      },
      {
        title: 'Hanging rail vertical drops: short vs long hanging.',
        body: 'Do not allocate excessive height to short hanging: shirts, jackets, suits, and folded trousers require '
          + '1000–1050 mm clear height below the rail. Full-length evening dresses, long overcoats, and jumpsuits require '
          + '1500–1650 mm. In high-ceiling rooms (240 cm+), stacking two short hanging rails doubles your storage capacity.',
        list: [
          'Short hanging (shirts, jackets, blazers): 1000–1050 mm clear vertical space.',
          'Long hanging (overcoats, maxi dresses): 1500–1650 mm clear vertical space.',
          'Mid-length hanging (trousers on hangers, skirts): 1100–1200 mm clear vertical space.',
        ],
      },
      {
        title: 'Shelf spacing & drawer ergonomics.',
        body: 'Shelves for folded knitwear and t-shirts should be spaced 280–320 mm apart. Wider gaps cause tall clothing stacks '
          + 'to topple over. Internal drawers should be positioned between 300 mm and 1200 mm from the floor for comfortable '
          + 'reach without stooping. Shoe shelves require 180–220 mm height per pair.',
      },
      {
        title: 'Bay widths and shelf deflection limits.',
        body: 'For standard 18 mm MFC or veneered MDF, keep shelf spans under 800–900 mm to prevent sagging under heavy loads. '
          + 'Wider wardrobes should be divided into multiple narrower bays using vertical partitions (gables).',
      },
    ],
  },
  {
    slug: 'guides/cabinet-hinge-types-guide',
    label: 'Concealed cabinet hinges guide',
    title: 'Concealed Cabinet Hinges Guide — 110° vs 155° Zero Protrusion | FurniDraw',
    description: 'Comprehensive guide to concealed cabinet hinges: full overlay, '
      + 'half overlay, inset, 110° standard, 155° zero-protrusion for internal drawers, and clearances.',
    eyebrow: 'CABINET HARDWARE & HINGE ENGINEERING',
    heading: 'Concealed cabinet hinges guide.\n110° vs 155° zero-protrusion & inset.',
    intro: 'Understand European concealed cup hinges for custom cabinetry. '
      + 'Compare overlay types, opening angles, and zero-protrusion hinges for pull-out drawers.',
    shape: 'regular',
    sections: [
      {
        title: 'Overlay configurations: full overlay, half overlay and inset.',
        body: 'Full overlay hinges mount the door completely over the cabinet carcass edge (typically leaving a 1–2 mm reveal). '
          + 'Half overlay hinges allow two adjacent doors to share a single central 18 mm partition. Inset hinges position '
          + 'the door flush inside the cabinet face frame, requiring precise 2–3 mm perimeter reveal gaps.',
      },
      {
        title: 'Opening angles: 110° standard vs 155° zero-protrusion.',
        body: 'Standard 110° hinges swing the door open wide enough for everyday access, but the door leaf still protrudes '
          + 'into the bay opening by 25–35 mm. If the cabinet contains internal pull-out drawers or wire baskets, the drawer fronts '
          + 'will crash into the open door. A 155° zero-protrusion hinge swings the door completely clear of the carcass edge.',
        list: [
          '110° Standard hinges: suitable for standard shelves and hanging rail sections.',
          '155° Zero-protrusion hinges: mandatory for bays with internal pull-out drawers or trays.',
          '170° Wide-angle hinges: ideal for corner units and deep accessibility.',
          'Blind corner hinges: designed for 90-degree corner cabinet intersections.',
        ],
      },
      {
        title: 'Hinge drilling patterns: 35 mm cup & System 32 spacing.',
        body: 'Concealed hinges require a standard 35 mm diameter cup hole drilled 11.5–12.5 mm deep into the rear of the door leaf. '
          + 'The edge distance (boring distance) is typically 3–5 mm from the door edge. Mounting plates fasten to the carcass '
          + 'at the standard 37 mm setback line using System 32 hole spacing.',
      },
      {
        title: 'Hinge quantity per door height and weight.',
        body: 'For doors under 100 cm height (under 5 kg), 2 hinges are sufficient. Doors between 100–160 cm require 3 hinges. '
          + 'Tall wardrobe doors between 160–210 cm require 4 hinges, and doors from 210–250 cm require 5 hinges to prevent warping.',
      },
    ],
  },
  {
    slug: 'guides/closet-vs-wardrobe',
    label: 'Closet vs. wardrobe: planning your storage',
    title: 'Closet vs. Wardrobe Planning — Custom Storage Layout Guide | FurniDraw',
    description: 'Compare closet and wardrobe layouts, measure the available space and '
      + 'plan hanging rails, shelves and drawers around the clothes you need to store.',
    eyebrow: 'STORAGE PLANNING & TERMINOLOGY GUIDE',
    heading: 'Closet or wardrobe?\nPlan around what you store.',
    intro: 'Whether you call it a closet or a wardrobe, start with your available space and '
      + 'garment collection. Key decisions are dimensions, accessibility, and interior zoning.',
    shape: 'regular',
    sections: [
      {
        title: 'Describe the space before choosing a layout.',
        body: 'Terminology varies: British English refers to "fitted wardrobes" and "alcove cupboards", '
          + 'while North American terminology uses "reach-in closets" and "walk-in closets". '
          + 'Describe your actual physical space to your maker: alcove recess, wall-to-wall run, or dedicated room.',
      },
      {
        title: 'Build an inventory of your clothing.',
        body: 'Separate short hanging items from long coats, folded clothes, and shoes. Account for everyday items '
          + 'versus seasonal luggage. In FurniDraw, enter your exact counts into the automatic storage layout tool '
          + 'to receive an instant parametric proposal tailored to your storage volume.',
        list: [
          'Group shirts, jackets, and blouses separately from long overcoats and dresses.',
          'Designate accessible drawer storage for undergarments and accessories.',
          'Reserve top high-level shelves for seasonal bedding, duvets, and luggage.',
        ],
      },
      {
        title: 'Compare interiors and door access in 3D.',
        body: 'Test hanging rails, shelves, and drawers in the 3D studio. Inspect door swing arcs beside bedroom beds '
          + 'and ensure drawers pull out smoothly without obstructing doors or walkways.',
      },
      {
        title: 'Prepare workshop documentation for your maker.',
        body: 'Generate dimensioned elevations, cutting lists, and hardware schedules. Share the plans with your joiner '
          + 'to confirm site fitting tolerances, materials, and edge banding before fabrication starts.',
      },
    ],
  },
  {
    slug: 'guides/kitchen-layout-planning',
    label: 'How to plan a kitchen cabinet layout',
    title: 'Kitchen Layout Planning Guide — Base, Wall & Tall Units | FurniDraw',
    description: 'Plan a kitchen cabinet layout around room measurements, appliances and access. '
      + 'Review base, wall and tall units in 3D before discussing installation.',
    eyebrow: 'KITCHEN ERGONOMICS & LAYOUT GUIDE',
    heading: 'Plan your kitchen layout.\nStart with the room.',
    intro: 'Prepare a room sketch, appliance information and storage requirements before arranging kitchen units. '
      + 'Use 3D layouts to verify workflow ergonomics and service clearances.',
    shape: 'regular',
    sections: [
      {
        title: 'Record the room perimeter and existing utility services.',
        body: 'Measure each wall and note the exact locations of water supply lines, waste drainage, gas inlets, '
          + 'electrical circuits, and cooker hood ventilation extraction ducts. Confirm service relocation feasibility '
          + 'with your plumber and electrician before finalizing unit positions.',
      },
      {
        title: 'Gather appliance specifications before sizing cabinetry.',
        body: 'Obtain installation specification sheets for your oven, hob, dishwasher, sink, and refrigerator. '
          + 'Verify appliance cut-out dimensions, required ventilation air gaps, and door opening clearances. '
          + 'Ensure dishwasher placement allows adjacent plumbing connections.',
        list: [
          'Record appliance model numbers, electrical loads, and installation cut-outs.',
          'Verify worktop depth (typically 600–650 mm) and carcass depth (560–580 mm).',
          'Maintain minimum 50 mm clearance behind appliances for service runs and plumbing.',
        ],
      },
      {
        title: 'Arrange base, wall and tall cabinets logically.',
        body: 'Organize the kitchen around the classic work triangle: food storage (fridge), prep/cleaning (sink), '
          + 'and cooking (hob/oven). Place base drawers near prep areas, heavy pan pull-outs under the hob, and '
          + 'tall pantry units on the outer ends of runs to avoid breaking continuous worktop spans.',
      },
      {
        title: 'Review the layout with your installer before ordering.',
        body: 'Export technical drawings to review unit positions, continuous worktop lengths, plinth levelling, '
          + 'and corner clearances with your kitchen fitter. Confirm wall fixings, service voids, and worktop joints.',
      },
    ],
  },
  {
    slug: 'guides/read-a-cabinet-cutting-list',
    label: 'How to read a cabinet cutting list',
    title: 'How to Read a Cabinet Cutting List — Workshop Guide | FurniDraw',
    description: 'Understand cabinet cutting list dimensions, quantities and materials. '
      + 'Check finished part sizes, edge-banding deductions and workshop details before cutting.',
    eyebrow: 'WORKSHOP DOCUMENTATION & CUT LISTS',
    heading: 'Read a cabinet cutting list.\nCheck every part before cutting.',
    intro: 'A cutting list translates a 3D furniture design into panel parts for cutting. '
      + 'Read it alongside dimensioned drawings and understand workshop machining allowances.',
    shape: 'regular',
    sections: [
      {
        title: 'Match each line item to a component in the drawing.',
        body: 'Begin by referencing the cabinet elevation and cross-section drawings to identify each part: side gables, '
          + 'bottom decks, top stretchers, adjustable shelves, partitions, back panels, and door leaves. Check both part '
          + 'quantities and dimensions carefully.',
      },
      {
        title: 'Check units, material specification and board thickness.',
        body: 'Confirm measurement units (millimetres are standard in cabinetmaking workshops). Group parts by board material '
          + 'and thickness (e.g. 18 mm melamine-faced chipboard for carcasses, 8 mm MDF for backs). Check grain orientation flags '
          + 'for veneered or woodgrain decors.',
        list: [
          'Verify current drawing revision number matches the cutting list revision.',
          'Check part counts, board thicknesses, and material specifications.',
          'Note grain direction: vertical for gables and doors, horizontal for shelves.',
        ],
      },
      {
        title: 'Distinguish finished dimensions from saw cutting sizes.',
        body: 'FurniDraw cutting lists report finished component sizes. If applying 1 mm or 2 mm thick edge banding, '
          + 'confirm whether your panel saw operator or CNC software requires pre-banding dimensional deductions '
          + 'to achieve the exact finished size after banding is applied.',
      },
      {
        title: 'Review the complete build before releasing to the workshop.',
        body: 'Re-verify site measurements before cutting panels. Ensure assembly joinery (System 32 confirmat screws, '
          + 'cam-and-dowel fasteners, or pocket screws) and hinge plate positions align with the parts schedule.',
      },
    ],
  },
];

export const guides: readonly Guide[] = [...productPages, ...nichePages, ...guideArticles];
