import type { Guide } from './guide-types';

/** Niche commercial landing pages targeting high-intent long-tail search terms. */
export const nichePages: readonly Guide[] = [
  {
    slug: '2d-3d-room-planner',
    label: '2D & 3D room planner',
    title: '2D & 3D Room Planner — Plan Fitted Furniture & Layouts | FurniDraw',
    description: 'Free online 2D and 3D room planner. '
      + 'Draw floor plans, add doors, windows, and sloped ceilings, and fit custom wardrobes and cabinetry seamlessly.',
    eyebrow: '2D/3D ROOM PLANNER & ARCHITECTURAL LAYOUT',
    heading: '2D & 3D room planner.\nPlan fitted furniture in your space.',
    intro: 'Draw walls, define room dimensions, place doors and windows, and design custom-fitted furniture in one synchronized 2D/3D workspace.',
    shape: 'regular',
    sections: [
      {
        title: 'Interactive 2D floor plan with real-time 3D synchronisation.',
        body: 'Start with the room perimeter. FurniDraw lets you input wall lengths, wall angles, and partition offsets. '
          + 'Switch instantly between top-down 2D floor plans for exact dimensioning and interactive 3D navigation to inspect '
          + 'room proportions, sightlines, and ceiling clearance around every cabinet.',
      },
      {
        title: 'Model walls, obstructions, chimney breasts & sloped ceilings.',
        body: 'Real rooms are rarely simple boxes. Our room engine supports 7 architectural room templates including '
          + 'straight walls, corner rooms, chimney breast alcoves, L-shaped spaces, and walk-in dressing areas. '
          + 'Incorporate sloped attic roofs, ceiling boxing, structural pillars, and staircase bulkheads directly into the model.',
        list: [
          'Support for alcoves, pillars, staircase bulkheads, and sloped ceiling planes.',
          'Precise positioning of door openings, window reveals, and heating radiators.',
          'Automatic detection of wall references and clearance lines.',
        ],
      },
      {
        title: 'Fit parametric cabinets directly into awkward room layouts.',
        body: 'Place wardrobes or kitchen runs against walls and watch them snap to structural boundaries. '
          + 'Resize cabinets to fill alcoves wall-to-wall with automated scribing allowances. Test how wardrobes look '
          + 'under dormer windows or adjacent to bedroom doors before committing to carpentry work.',
      },
      {
        title: 'Test door swings, clearances & walkway tolerances in 3D.',
        body: 'Avoid costly installation surprises. Verify that hinged wardrobe doors clear bedside tables, that drawers extend '
          + 'fully without hitting door frames, and that minimum walkway clearances (typically 800–900 mm) are preserved throughout the space.',
      },
    ],
    faqs: [
      [
        'Can I draw non-square rooms or angled walls?',
        'Yes. FurniDraw supports custom corner angles, alcoves, pillar protrusions, and sloped ceiling sections.',
      ],
      [
        'Do furniture pieces snap to the walls in 2D?',
        'Yes. Cabinets automatically align and snap flush against selected walls, maintaining proper rear ventilation setbacks.',
      ],
      [
        'Can I plan both bedrooms and kitchens in the same planner?',
        'Yes. The 2D/3D studio allows you to configure fitted wardrobes, closets, and modular kitchen cabinet runs.',
      ],
      [
        'Is the room planner free to use?',
        'Yes. Room modeling and 3D furniture layout are 100% free with no account required.',
      ],
    ],
  },
  {
    slug: 'sloped-ceiling-wardrobe-designer',
    label: 'Sloped ceiling wardrobe designer',
    title: 'Sloped Ceiling Wardrobe Designer — 3D Attic Storage | FurniDraw',
    description: 'Design custom wardrobes for sloped ceilings, attic rooms, and loft conversions in 3D. '
      + 'Configure angled doors, hanging rails, and precise cut lists.',
    eyebrow: 'SLOPED CEILING & ATTIC WARDROBE DESIGNER',
    heading: 'Sloped ceiling wardrobe designer.\nCustom loft & attic storage.',
    intro: 'Turn awkward loft angles into beautiful storage. '
      + 'Design fitted wardrobes for sloped ceilings with parametric raked doors, custom shelving, and workshop cut lists.',
    shape: 'under-stairs',
    sections: [
      {
        title: 'Design fitted wardrobes for angled walls and roof slopes.',
        body: 'Attic conversions and mansard roofs present unique challenges for off-the-shelf wardrobes like IKEA PAX. '
          + 'FurniDraw’s sloped ceiling designer lets you set knee-wall (purline) heights, total ceiling height, and the exact roof pitch angle. '
          + 'The carcass tops and side gables rake automatically to follow your ceiling contour.',
      },
      {
        title: 'Parametric geometry: following rake angles to the exact degree.',
        body: 'Specify the slope start position and degree of pitch. The software calculates the cut angles on vertical partitions, '
          + 'raked top panels, and door stiles. Whether your slope runs front-to-back or side-to-side, internal shelves align to '
          + 'maximize every centimetre of vertical space.',
        list: [
          'Parametric ceiling rake matching single slopes, gambrel roofs, and dormer recesses.',
          'Automatic calculation of bevel cuts and rake angles on side gables and doors.',
          'Full-height storage in tall sections transitioning to deep drawer bays under the eaves.',
        ],
      },
      {
        title: 'Zone storage for short hanging, shelves & drawers under slopes.',
        body: 'Position full-length hanging where the ceiling is highest, transition to double short-hanging rails in mid-height bays, '
          + 'and place heavy-duty drawers, shoe racks, or pull-out baskets under the lowest eaves where hanging garments cannot fit.',
      },
      {
        title: 'Workshop-ready angled elevations & raked cutting lists.',
        body: 'Fabricating angled furniture requires accurate workshop data. Export dimensioned elevations displaying top panel angles, '
          + 'finished panel heights at high and low points, and hardware locations for raked door hinges.',
      },
    ],
    faqs: [
      [
        'How do I calculate the roof pitch for my attic wardrobe?',
        'Measure the height of the vertical knee wall, the ceiling height where the slope ends, and the horizontal distance between them. '
          + 'Enter these into FurniDraw to generate the exact slope angle.',
      ],
      [
        'Can doors be cut at an angle to fit the sloped ceiling?',
        'Yes. FurniDraw models angled door leaves and calculates specialized hinge positioning along the non-sloped vertical stile.',
      ],
      [
        'What is the minimum recommended height for hanging clothes under a slope?',
        'We recommend a minimum clear height of 1050 mm for shirts and jackets, and 1600 mm for full-length dresses or coats.',
      ],
      [
        'Can I include drawers under low eaves?',
        'Yes. Low knee-wall sections are ideal for deep pull-out drawers that take advantage of the floor depth beneath the eaves.',
      ],
    ],
  },
  {
    slug: 'walk-in-closet-planner',
    label: 'Walk-in closet planner',
    title: 'Walk-In Closet Planner — 3D Custom Dressing Room Design | FurniDraw',
    description: 'Plan custom walk-in closets and luxury dressing rooms in 3D. '
      + 'Organise hanging sections, shoe walls, drawers, and islands with dimensioned drawings.',
    eyebrow: 'WALK-IN CLOSET PLANNER & DRESSING ROOM CAD',
    heading: 'Walk-in closet planner.\nDesign custom dressing rooms in 3D.',
    intro: 'Transform spare rooms and dressing areas into luxury walk-in closets. '
      + 'Configure U-shaped, L-shaped, and galley storage layouts with custom shelving, shoe displays, and drawer islands.',
    shape: 'regular',
    sections: [
      {
        title: 'Design U-shaped, L-shaped and galley walk-in closets in 3D.',
        body: 'Whether transforming a walk-through dressing area or dedicated closet room, FurniDraw helps you plan every wall. '
          + 'Configure continuous cabinetry around corners with corner posts and specialized blind-corner storage, ensuring '
          + 'seamless transitions between hanging rails, shelving bays, and drawer stacks.',
      },
      {
        title: 'Calculate storage capacity from your actual garment inventory.',
        body: 'Input your complete wardrobe inventory: shirts, suits, long evening gowns, folded jeans, handbags, and shoes. '
          + 'The planner optimizes vertical space by stacking double hanging rails (requiring ~2100 mm total height) and allocating '
          + 'dedicated illuminated shoe displays with angled or flat shelves.',
        list: [
          'Efficient corner integration with corner hanging rails or continuous shelving.',
          'Integrated drawer towers with velvet-lined accessory organizers and jewelry trays.',
          'Custom shoe walls with adjustable shelf pitches and high-heel heel stops.',
        ],
      },
      {
        title: 'Configure corner transitions, corner posts & interior shelving.',
        body: 'Corner intersections are often wasted space. FurniDraw models corner carcass joinery, ensuring that adjacent doors '
          + 'and pull-out drawers never collide. Configure open-concept boutique closets or enclose bays with elegant glass doors.',
      },
      {
        title: 'Generate accurate material schedules & dimensioned elevations.',
        body: 'Export comprehensive room elevations for every wall of your dressing room. Review carcass dimensions, shelf heights, '
          + 'and hardware placements with your interior designer, contractor, or custom closet manufacturer before fabrication.',
      },
    ],
    faqs: [
      [
        'What is the minimum room size needed for a walk-in closet?',
        'A single-sided walk-in requires at least 150 cm width (60 cm closet depth + 90 cm walkway). '
          + 'A double-sided closet requires at least 210–240 cm width.',
      ],
      [
        'How deep should walk-in closet shelves and hanging sections be?',
        'Hanging sections require 55–60 cm depth so clothes hangers do not brush against walls. Folded shirt and shoe shelves require 35–40 cm.',
      ],
      [
        'Can I design open-front closets without doors?',
        'Yes. FurniDraw fully supports open boutique-style cabinetry, as well as framed and glass door fronts.',
      ],
      [
        'Does the software calculate corner clearances?',
        'Yes. The engine enforces corner setback rules to ensure drawers in adjoining bays can pull out freely.',
      ],
    ],
  },
  {
    slug: 'alcove-wardrobe-designer',
    label: 'Alcove wardrobe designer',
    title: 'Alcove Wardrobe Designer — Built-In Chimney Breast Storage | FurniDraw',
    description: 'Design custom alcove wardrobes and chimney breast cabinets in 3D. '
      + 'Calculate scribing fillets, ceiling boxing, and floor out-of-square allowances.',
    eyebrow: 'ALCOVE WARDROBES & CHIMNEY BREAST CUPBOARDS',
    heading: 'Alcove wardrobe designer.\nBuilt-in chimney breast storage.',
    intro: 'Turn bedroom chimney breast alcoves into seamless built-in storage. '
      + 'Design fitted cupboards that fit recesses perfectly, complete with scribing infills, plinths, and cut lists.',
    shape: 'alcove',
    sections: [
      {
        title: 'Measure and design fitted wardrobes for recesses and alcoves.',
        body: 'Period homes frequently feature chimney breasts flanked by recessed alcoves. Because alcove walls are rarely straight '
          + 'or square, standard freestanding wardrobes leave unsightly gaps and accumulate dust. FurniDraw builds bespoke alcove '
          + 'carcasses that maximize the recess width and depth while incorporating perimeter scribing infills.',
      },
      {
        title: 'Scribing allowances, infill strips & plinth (toe kick) integration.',
        body: 'The planner provides dedicated side scribing fillets (typically 30–50 mm wide) that allow carpenters to scribe '
          + 'panels tightly against uneven brickwork and skirting boards on-site. Choose whether the wardrobe sits flush with '
          + 'the chimney breast face or recesses slightly to maintain architectural shadow gaps.',
        list: [
          'Built-in scribing fillets for out-of-plumb walls and uneven plasterwork.',
          'Seamless integration with Victorian, Edwardian, and modern baseboards (skirting).',
          'Full-height ceiling infill panels or decorative cornice crown moulding details.',
        ],
      },
      {
        title: 'Maximize alcove depth for hanging rails, shelves & drawers.',
        body: 'Standard alcove depth is often around 40–50 cm, which is slightly shallower than standard 60 cm hanger depth. '
          + 'FurniDraw allows you to either project the wardrobe forward with custom side end panels or utilize pull-out '
          + 'telescopic hanging rails to preserve shallow alcove aesthetics.',
      },
      {
        title: 'Workshop elevations & cut lists with fitting tolerances.',
        body: 'Export millimetre-accurate cutting lists and front elevations. Share the documentation with your joiner to ensure '
          + 'all panels, internal partitions, and face frames are cut to fit your alcove measurements exactly.',
      },
    ],
    faqs: [
      [
        'What if my alcove walls are not parallel or plumb?',
        'Measure the narrowest width at the bottom, middle, and top of the alcove. FurniDraw designs the carcass to fit '
          + 'the smallest dimension and adds side scribing fillets that your joiner cuts to match wall irregularities.',
      ],
      [
        'What should I do if my alcove is too shallow for coat hangers?',
        'If your alcove is under 55 cm deep, you can either extend the wardrobe carcass forward into the room with finished side gables '
          + 'or install front-facing pull-out hanging rails.',
      ],
      [
        'Can I build an alcove cupboard with drawers in the lower half?',
        'Yes. A common alcove design features a 3-drawer chest in the bottom section and hanging or shelving space behind doors above.',
      ],
      [
        'Does the software account for high Victorian skirting boards?',
        'Yes. You can configure plinth (toe kick) heights up to 150 mm or more to clear tall historic skirting boards cleanly.',
      ],
    ],
  },
  {
    slug: 'cabinet-cut-list-generator',
    label: 'Cabinet cut list generator',
    title: 'Cabinet Cut List Generator — 3D Parts & Panel Schedules | FurniDraw',
    description: 'Generate accurate cabinet cutting lists, panel schedules, and hardware lists from 3D designs. '
      + 'Free online cut list tool for carpenters and DIYers.',
    eyebrow: 'CABINET CUT LIST GENERATOR & WORKSHOP PLANS',
    heading: 'Cabinet cut list generator.\n3D parts & workshop schedules.',
    intro: 'Transform 3D cabinet designs into accurate workshop cutting lists. '
      + 'Generate part-by-part dimensions, panel thicknesses, grain orientation, and hardware counts in one click.',
    shape: 'regular',
    sections: [
      {
        title: 'Convert 3D cabinet designs into accurate workshop cut lists.',
        body: 'Manual cut-list calculations are prone to arithmetic errors, resulting in wasted sheet goods and costly rework. '
          + 'FurniDraw’s cut list generator automatically derives component sizes directly from your 3D parametric model. '
          + 'Every side gable, bottom panel, top rail, shelf, back board, and door leaf is computed to the exact millimetre.',
      },
      {
        title: 'Track carcass panels, shelves, partitions, fronts & backing boards.',
        body: 'The generated parts list categorizes components logically by assembly role and material thickness. '
          + 'Distinguish 18 mm carcass boards (MDF, MFC, or plywood) from 8 mm backing boards and 22 mm worktop slabs. '
          + 'Quantities, finished lengths, and finished widths are displayed clearly for workshop efficiency.',
        list: [
          'Component schedule organized by board material and thickness.',
          'Part identification mapping directly to 2D elevations and 3D views.',
          'Exact finished measurements ready for panel saw cutting or CNC optimization.',
        ],
      },
      {
        title: 'Edge banding allowances, grain direction & board thicknesses.',
        body: 'Our documentation details finished component sizes and indicates which visible edges require edge banding (0.8 mm, '
          + '1 mm, or 2 mm PVC/ABS/wood veneer). Grain direction flags ensure that woodgrain decors run vertically on doors '
          + 'and gables and horizontally on drawer fronts and shelves.',
      },
      {
        title: 'Export dimensioned CAD drawings & hardware schedules.',
        body: 'Alongside the cut list, download dimensioned workshop elevations, cabinet cross-sections, and a comprehensive '
          + 'hardware schedule listing all hinge mechanisms, drawer runners, shelf support studs, and connecting bolts.',
      },
    ],
    faqs: [
      [
        'Are the cutting list dimensions finished sizes or rough cutting sizes?',
        'FurniDraw outputs finished component dimensions. Ask your workshop or board supplier if they require deductions '
          + 'for edge banding thickness before cutting.',
      ],
      [
        'Can I export the cutting list for sheet nesting software?',
        'Yes. The parts list provides clean dimensional data that can be input into panel nesting and cut optimization software.',
      ],
      [
        'Does the cut list include backing board grooves and rebates?',
        'Carcass depths and back board sizes are calculated accounting for an 8 mm back panel set into a rear rebate or groove.',
      ],
      [
        'Is the cut list generator free to use?',
        'You can design cabinets and view parts lists in the browser for free. Exporting formal PDF workshop documentation '
          + 'uses affordable credits.',
      ],
    ],
  },
];
