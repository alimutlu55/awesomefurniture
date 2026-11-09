import type { Guide } from './guide-types';

/** Core commercial landing pages targeting primary furniture design keywords. */
export const productPages: readonly Guide[] = [
  {
    slug: 'wardrobe-designer',
    label: 'Online wardrobe designer',
    title: 'Design a Fitted Wardrobe Online — Free 3D Wardrobe Planner',
    description: 'Design a fitted or built-in wardrobe online, free to start. '
      + 'Plan the layout in 3D to your room, then get dimensioned drawings and a cut list for your joiner.',
    eyebrow: 'FITTED & BUILT-IN WARDROBE PLANNER',
    heading: 'Design a fitted wardrobe online.\nFree 3D wardrobe planner.',
    intro: 'FurniDraw is a free online wardrobe designer for fitted and built-in wardrobes. '
      + 'Plan the layout to your exact room, choose rails, drawers and doors, then get dimensioned drawings and a cutting list.',
    shape: 'regular',
    sections: [
      {
        title: 'How to design your own wardrobe online.',
        body: 'You do not need CAD experience or a download. Begin with the space, using our '
          + '[guide on measuring for a fitted wardrobe](/guides/measure-for-a-fitted-wardrobe/), then shape the wardrobe around it.',
        list: [
          'Enter the width, height and depth of the space.',
          'Count your clothes and let Auto design propose a layout, or add rails, shelves and drawers yourself.',
          'Choose door style, finish and handles, then check the result in 3D.',
          'Export dimensioned drawings and a cutting list for your joiner.',
        ],
      },
      {
        title: 'A wardrobe layout planner built around your exact room.',
        body: 'FurniDraw lets you design wall-to-wall and floor-to-ceiling fitted wardrobes that adapt '
          + 'to your exact room dimensions. Unlike generic room planners that place rigid pre-made blocks, '
          + 'our engine builds parametric joinery using standard 18 mm carcass boards, 6 mm recessed backs, '
          + 'and customizable plinths. Review our [standard wardrobe dimensions](/guides/standard-wardrobe-dimensions/) '
          + 'for depths, hanging heights, and shelf spacing guidelines.',
      },
      {
        title: 'Design a built-in wardrobe from what you actually own.',
        body: 'Tell the planner what you need to store: count your shirts, jackets, long coats, folded sweaters, '
          + 'and shoe pairs. FurniDraw’s automatic layout algorithm proposes an optimized interior configuration '
          + 'with appropriate hanging drops (1050 mm for short hanging, 1600 mm for long coats).',
        list: [
          'Automatic bay splitting based on clothing inventory and user reach.',
          'Dedicated vertical zones for shirts, dresses, folded knitwear, and shoes.',
          'Real-time clearance checking for drawer travel and door swings.',
        ],
      },
      {
        title: 'Fitted or built-in: design for the space you have.',
        body: '“Fitted” and “built-in” usually describe the same thing: a wardrobe made to fill the space between walls, '
          + 'floor and ceiling instead of standing in front of them. Awkward rooms have their own starting points: '
          + 'the [alcove wardrobe designer](/alcove-wardrobe-designer/), the [sloped ceiling wardrobe designer](/sloped-ceiling-wardrobe-designer/) '
          + 'and [under stairs wardrobe design](/under-stairs-wardrobe/). For a whole dressing room, use the [walk-in closet planner](/walk-in-closet-planner/).',
      },
      {
        title: 'Door front styles, carcass finishes & hardware clearances.',
        body: 'Explore Slab, Shaker, Profiled, and Rail door fronts with realistic wood decors and matt laminates. '
          + 'The software enforces hardware clearance rules: 110° standard hinges for regular bays and '
          + '[155° zero-protrusion hinges](/guides/cabinet-hinge-types-guide/) where internal pull-out drawers '
          + 'require unobstructed clearance to slide past open doors.',
      },
      {
        title: 'From wardrobe design tool to drawings your joiner can build.',
        body: 'Export comprehensive CAD-ready technical drawings including front elevations, sectional views, '
          + 'panel cutting schedules, and hardware lists. Hand these clear documentation sets directly to your '
          + 'carpenter or local joiner. Design 100% free in your browser; our transparent [pricing](/pricing/) '
          + 'applies only when exporting drawings or AI renders.',
      },
      {
        title: 'Worked example: a 2.4 m fitted wardrobe planned from a clothes count.',
        body: 'We gave Auto design a space 240 cm wide, 240 cm high and 60 cm deep, and a typical count: 24 shirts and jackets, '
          + '6 long coats and dresses, 12 trousers, 30 folded items, 8 pairs of shoes and 30 small items. Its top proposal has four bays '
          + 'with a shelf zone across the top for seasonal things. It holds all the trousers, folded items, shoes and small items, '
          + 'and about 86% of the hanging clothes, so a wider wardrobe or a shorter list would be needed to fit everything.',
        list: [
          'Bay 1 (51 cm): full-length hanging for coats and dresses.',
          'Bay 2 (60 cm): two drawers with shirt hanging above.',
          'Bay 3 (60 cm): two drawers, a small-items drawer and five shoe shelves.',
          'Bay 4 (60 cm): a drawer and two shelves with shirt hanging above.',
        ],
      },
    ],
    faqs: [
      [
        'Can I design my own wardrobe online for free?',
        'Yes. You can plan rooms, configure custom wardrobes, adjust internal fittings, and save drafts in '
          + 'your browser completely free without entering payment details or creating an account.',
      ],
      [
        'What door styles and hinge types are supported?',
        'The studio includes Slab, Shaker, Profiled, and Rail doors, alongside standard 110°, wide-angle 155° '
          + 'zero-protrusion hinges for internal drawers, 170° hinges, and inset door configurations.',
      ],
      [
        'Can a local joiner or carpenter build from these drawings?',
        'Yes. The exported documentation provides dimensioned elevations, cabinet sections, hardware schedules, '
          + 'and finished component cutting lists formatted specifically for professional cabinetmakers.',
      ],
      [
        'How does FurniDraw handle uneven walls and ceilings?',
        'You can configure perimeter scribing fillets (typically 25–40 mm wide) on the left, right, and top edges. '
          + 'Your joiner cuts these fillers on-site to match wall irregularities and skirting boards.',
      ],
      [
        'Do I need to download or install any software?',
        'No. FurniDraw operates entirely inside your web browser on desktop, laptop, tablet, or phone with WebGL support.',
      ],
    ],
  },
  {
    slug: 'kitchen-cabinet-design-software',
    label: 'Kitchen cabinet design software',
    title: 'Kitchen Cabinet Design Software: Free 3D Planner | FurniDraw',
    description: 'Plan modular kitchen cabinets in 3D in your browser. '
      + 'Configure base, wall, and tall units with worktops, plinths, and workshop cut lists.',
    eyebrow: 'MODULAR KITCHEN CABINET PLANNING & 3D CAD',
    heading: 'Kitchen cabinet design software.\nPlan base, wall & tall units in 3D.',
    intro: 'Plan modular base, wall and tall kitchen cabinets in your browser. '
      + 'Design continuous worktops and plinths, review appliance openings, and export workshop-ready drawings.',
    shape: 'regular',
    sections: [
      {
        title: '2D and 3D kitchen room layout planner.',
        body: 'Start by drawing your kitchen perimeter, placing doors and windows, and marking plumbing and electrical connections. '
          + 'Use our [free 2D/3D room planner](/2d-3d-room-planner/) to keep floor plans and 3D views synchronized so you can verify '
          + 'walkway clearances and appliance access.',
      },
      {
        title: 'Configure modular base, wall & tall cabinets.',
        body: 'Build kitchen runs using standard modular cabinet carcasses: 600 mm, 800 mm, and 1000 mm base units; '
          + 'tall pantry and appliance housings; and 720 mm or 900 mm overhead wall units. Carcasses share continuous '
          + 'worktops and recessed plinths. Read our [kitchen layout planning guide](/guides/kitchen-layout-planning/) for ergonomics.',
        list: [
          'Modular base units with adjustable drawers, shelving, and pull-out organizers.',
          'Tall pantry units with pull-out storage, and housings for fridges and ovens.',
          'Continuous worktop spans and recessed plinth runs with accurate levelling heights.',
        ],
      },
      {
        title: 'Door fronts, drawer systems & hardware clearances.',
        body: 'Choose from modern slab doors or classic shaker profiles. Configure drawers on bottom-mounted '
          + 'runners and concealed European hinges. FurniDraw calculates door swing clearances and drawer '
          + 'travel to prevent clashes with adjacent walls, handles, or appliances.',
      },
      {
        title: 'Export dimensioned cabinet drawings & workshop cut lists.',
        body: 'Generate full kitchen elevations, top-down installation plans, and parts schedules detailing finished '
          + 'panel sizes for carcasses, shelves, and doors. Design free in your browser; check our [pricing](/pricing/) '
          + 'for export credits when handing plans to your cabinetmaker or kitchen fitter.',
      },
    ],
    faqs: [
      [
        'Can I plan kitchen cabinet runs in both 2D and 3D?',
        'Yes. You can switch between a precise 2D floor plan for dimension checks and an interactive 3D model '
          + 'to inspect finishes, door swings, and overall room proportions.',
      ],
      [
        'How do worktops and plinths work across multiple units?',
        'Adjoining base units automatically share a continuous worktop and unbroken plinth line, which update '
          + 'automatically whenever you add, remove, or resize a cabinet in the run.',
      ],
      [
        'Are cut lists and panel dimensions included for kitchen units?',
        'Yes. The workshop documentation provides a comprehensive cutting list of finished component dimensions '
          + 'for every carcass side, base, top rail, shelf, and front panel.',
      ],
      [
        'Can I customize cabinet depths and widths?',
        'Yes. You can adjust cabinet widths, depths, and heights parametrically to suit custom alcoves, narrow runs, '
          + 'or non-standard appliance specifications.',
      ],
      [
        'Does the software verify corner cabinet clearances?',
        'Yes. FurniDraw enforces corner setback rules to ensure base drawers and hinged doors clear adjacent handles.',
      ],
      [
        'Are drilling plans for CNC machines included?',
        'Exported drawings provide standard System 32 hole references and 37 mm setbacks for workshop line-boring machines. '
          + 'Raw CNC G-code and CAM machine files are not included.',
      ],
    ],
  },
  {
    slug: 'furniture-making-software',
    label: 'Furniture design & making software',
    title: 'Furniture Making Software: 3D CAD and Cut Lists | FurniDraw',
    description: 'Online furniture making software for custom wardrobes and cabinets. '
      + 'Parametric 3D CAD, dimensioned shop drawings, and parts cut lists.',
    eyebrow: 'FURNITURE MAKING & WORKSHOP DOCUMENTATION',
    heading: 'Furniture making software.\nFrom 3D CAD to workshop cut lists.',
    intro: 'Design custom built-in furniture to the exact millimetre. '
      + 'Generate dimensioned shop elevations, section views, parts schedules, and cutting lists directly in your browser.',
    shape: 'regular',
    sections: [
      {
        title: 'Parametric 3D furniture design to exact millimetres.',
        body: 'FurniDraw gives woodworkers, cabinetmakers, and serious DIYers the power of parametric CAD without '
          + 'the steep learning curve of complex engineering software. Set exact cabinet heights, bay widths, and depths. '
          + 'All joinery relationships, panel setbacks, and shelf spacing adjust automatically in real time.',
      },
      {
        title: 'Separate 3D visualisation from workshop engineering.',
        body: 'While realistic AI renders help clients and homeowners visualize materials and lighting in a finished room, '
          + 'workshop fabrication demands precise engineering data. FurniDraw strictly separates visual styling from '
          + 'dimensional geometry, delivering crisp vector elevations and unambiguous millimetre measurements.',
        list: [
          'True 1:1 parametric cabinet geometry built around standard sheet goods.',
          'Dimensioned elevations showing bay widths, clear openings, and shelf heights.',
          'Cross-sectional views detailing plinth setbacks, back panel grooves, and rail drops.',
        ],
      },
      {
        title: 'Workshop-ready drawings, cutting lists & hardware schedules.',
        body: 'Generate full documentation packets with one click using our [cabinet cut list generator](/cabinet-cut-list-generator/). '
          + 'Cutting lists categorize components by board material and thickness (e.g. 18 mm MFC carcass, 6 mm backing board). '
          + 'Consult our guide on [how to read a cabinet cutting list](/guides/read-a-cabinet-cutting-list/) before cutting.',
      },
      {
        title: 'Joinery rules, scribing allowances & panel assembly.',
        body: 'Incorporate realistic scribing allowances and infill fillets for out-of-plumb walls and uneven floors. '
          + 'Carcass panels adhere to professional assembly standards (System 32 hole spacing and 37 mm hinge lines), '
          + 'providing an accurate foundation for manual line boring and workshop fabrication.',
      },
    ],
    faqs: [
      [
        'How accurate are the dimensions generated by FurniDraw?',
        'All geometry is calculated to the millimetre. Component dimensions in the cutting list reflect exact finished '
          + 'panel sizes according to your defined carcass thickness and setback rules.',
      ],
      [
        'What panel materials and board thicknesses are supported?',
        'Carcasses use 18 mm boards with 6 mm backs, across natural and smoked oak decors, '
          + 'white finishes, and other surface decors.',
      ],
      [
        'Does FurniDraw support hardware specifications like hinges and drawer runners?',
        'Yes. The engine automatically calculates quantities and specifications for concealed European hinges, '
          + 'bottom-mounted drawer runners, hanging rails, and assembly fasteners.',
      ],
      [
        'Is any software installation required?',
        'No. FurniDraw operates entirely inside any modern web browser on desktop, laptop, or tablet with WebGL support.',
      ],
    ],
  },
  {
    slug: 'under-stairs-wardrobe',
    label: 'Under stairs wardrobe designer',
    title: 'Under Stairs Wardrobe Design — Free 3D Planner | FurniDraw',
    description: 'Design an under stairs wardrobe in 3D, free to start. '
      + 'Fit coats, shoes and drawers beneath the slope, then get dimensioned drawings and a cut list.',
    eyebrow: 'UNDER STAIRS STORAGE PLANNER',
    heading: 'Under stairs wardrobe design.\nPlan shaped storage in 3D.',
    intro: 'Turn the awkward space beneath your staircase into a wardrobe. '
      + 'Set the slope, plan bays for coats, shoes and drawers, and get drawings made for that exact shape.',
    shape: 'under-stairs',
    sections: [
      {
        title: 'Design a wardrobe under the stairs that follows the real slope.',
        body: 'The triangular space beneath a staircase is valuable but hard to furnish. '
          + 'Start from the under-stairs shape in FurniDraw and adjust its outline to match your staircase, including a level landing at the tall end. '
          + 'Pair with our [sloped ceiling wardrobe designer](/sloped-ceiling-wardrobe-designer/) for attic and roof eaves.',
      },
      {
        title: 'Under stairs wardrobe ideas for each height.',
        body: 'Each part of the slope suits different storage, so plan it by height. Auto design follows this pattern. '
          + 'It fills each bay up to the lowest point of the slope above it, so the wedge above that point stays empty in its proposals.',
        list: [
          'Low end: shoe shelves, which need little height.',
          'Middle: shirts and jackets on short hanging, or drawers.',
          'Tall end: full-length coats and dresses, with space above for seasonal things.',
        ],
      },
      {
        title: 'Worked example: a 2 m wardrobe under the stairs.',
        body: 'We gave Auto design a space 200 cm wide and 60 cm deep, rising from 69 cm at the low end to 230 cm and then level, '
          + 'with 8 shirts and jackets, 6 long coats, 10 folded items and 10 pairs of shoes. Its top proposal holds all the folded items, '
          + 'about 86% of the long clothes, 75% of the shoes and 70% of the shirts and jackets. A staircase holds less than a straight wardrobe, '
          + 'so count what you own before you commit.',
        list: [
          'Bay 1 (41 cm), the lowest: three shoe shelves.',
          'Bay 2 (50 cm): short hanging.',
          'Bay 3 (50 cm): two drawers and six shoe shelves.',
          'Bay 4 (50 cm), the tallest: full-length hanging with a shelf space above.',
        ],
      },
      {
        title: 'Generate dimensioned shop drawings for sloped ceilings.',
        body: 'Under-stairs cabinetry requires precise angled cuts and non-standard door geometries. FurniDraw generates '
          + 'dimensioned front elevations showing rake angles, cut heights on left and right stiles, and internal '
          + 'shelf levels. Hand these drawings to your carpenter to ensure every panel fits flush.',
      },
      {
        title: 'Scribing to rake angles & handling stringer obstructions.',
        body: 'Stair undersides often feature protruding carriage timbers, drywall plaster beads, and electrical wiring. '
          + 'The planner incorporates scribing fillets and top infill panels, giving installers the necessary tolerance '
          + 'to scribe panels neatly to the stair profile on-site.',
      },
    ],
    faqs: [
      [
        'How do I measure the staircase angle for an under-stairs wardrobe?',
        'Measure the floor width, the maximum vertical height at the tall end, and the height at several points along '
          + 'the slope. Enter these measurements into FurniDraw to establish the exact ceiling rake.',
      ],
      [
        'Can I combine pull-out drawers with hanging rails under stairs?',
        'Yes. You can configure tall bays with hanging rails and shorter bays with drawers or shoe shelves.',
      ],
      [
        'Can I build an under stairs wardrobe myself?',
        'If you are comfortable cutting angled panels, yes. The drawings give the height on each side of every sloped door and panel, '
          + 'and the cutting list gives finished sizes. Ask a joiner to check the site measurements before you cut.',
      ],
      [
        'Does FurniDraw calculate raked ceiling panels and angled doors?',
        'Yes. The engine computes raked top panels and angled door fronts with corresponding hinge placements and edge angles.',
      ],
      [
        'What tolerances should be allowed for uneven stairs?',
        'We recommend allowing a 25–40 mm scribing fillet along the sloped ceiling and side walls to accommodate plaster variations.',
      ],
    ],
  },
  {
    slug: '3d-furniture-configurator',
    label: '3D furniture configurator',
    title: 'Online Wardrobe & Cabinet Configurator in 3D | FurniDraw',
    description: 'Free online 3D furniture configurator. '
      + 'Customise wardrobes and cabinets to the millimetre with real-time parametric CAD and cut lists.',
    eyebrow: '3D FURNITURE CONFIGURATOR & PARAMETRIC DESIGN',
    heading: '3D furniture configurator online.\nCustom wardrobes & cabinetry.',
    intro: 'Configure custom wardrobes, closets, and modular cabinetry with real-time 3D parametric controls. '
      + 'Tailor dimensions, materials, door styles, and hardware in your browser.',
    shape: 'regular',
    sections: [
      {
        title: 'Parametric 3D furniture configuration in real time.',
        body: 'FurniDraw delivers an interactive 3D configurator designed specifically for bespoke cabinetry. '
          + 'Unlike static 3D visualizers, every slider and input field connects to real engineering rules. '
          + 'Adjust overall width, height, or carcass depth, and watch bays, internal partitions, shelves, and doors '
          + 'recalculate proportionally. Try our [free online wardrobe designer](/wardrobe-designer/) to explore built-in layouts.',
      },
      {
        title: 'Customise dimensions, front styles & finishes to the millimetre.',
        body: 'Choose from multiple door front styles including flat Slab, classic Shaker, Profiled shaker, and Rail designs. '
          + 'Apply realistic woodgrain decors with grain orientation awareness. Configure plinth heights, top scribe infills, '
          + 'and end panels to match your room interior perfectly.',
        list: [
          'Instant 3D rendering with realistic lighting, shadows, and material textures.',
          'Full control over internal bay divisions, shelf spacing, and drawer stack counts.',
          'Support for inset and overlay door leaf configurations with uniform reveal gaps.',
        ],
      },
      {
        title: 'Intelligent hardware & internal fitting clearance rules.',
        body: 'Our configurator embeds real woodworking logic: internal drawers automatically calculate runner setbacks '
          + 'and hinge clearances so drawer fronts never strike open doors. Hanging rails enforce minimum garment drops, '
          + 'and adjustable shelves verify span limits to prevent long-term deflection.',
      },
      {
        title: 'Export workshop-ready drawings, cutting lists & assembly steps.',
        body: 'Turn your 3D configuration into actionable workshop data. Export 2D dimensional elevations, cross-sections, '
          + 'part-by-part cutting lists, and step-by-step 3D assembly guides that make building or ordering custom furniture '
          + 'straightforward. Also check out our [kitchen cabinet design software](/kitchen-cabinet-design-software/).',
      },
    ],
    faqs: [
      [
        'What is a parametric 3D furniture configurator?',
        'A parametric configurator recalculates all internal parts, joint positions, and hardware rules automatically '
          + 'whenever you modify external dimensions, rather than simply stretching a 3D mesh.',
      ],
      [
        'Which door front styles can I configure?',
        'FurniDraw supports modern Slab doors, timeless Shaker stiles and rails, Profiled shaker panels, and Rail door designs.',
      ],
      [
        'Does the configurator automatically calculate internal clearances?',
        'Yes. It verifies that internal drawers have adequate clearance past door hinges and that shelf heights provide '
          + 'sufficient vertical space for clothing and storage boxes.',
      ],
      [
        'Can I view the furniture model in realistic materials?',
        'Yes. You can switch between technical CAD drawing view and material study view to inspect wood grains and finishes.',
      ],
      [
        'Can I configure modular kitchen units as well as wardrobes?',
        'Yes. FurniDraw supports modular base cabinets, wall cupboards, tall pantry towers, and fitted wardrobes.',
      ],
      [
        'Is any software download or account required?',
        'No. FurniDraw operates completely in your web browser with local draft saving and instant 3D rendering.',
      ],
    ],
  },
];
