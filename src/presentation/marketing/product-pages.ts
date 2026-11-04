import type { Guide } from './guide-types';

/** Core commercial landing pages targeting primary furniture design keywords. */
export const productPages: readonly Guide[] = [
  {
    slug: 'wardrobe-designer',
    label: 'Online wardrobe designer',
    title: 'Free Online Wardrobe Designer & 3D Closet Planner | FurniDraw',
    description: 'Free online 3D wardrobe designer and custom closet planner. '
      + 'Design fitted storage, shelving, drawers, and hanging rails with workshop cut lists in your browser.',
    eyebrow: 'FITTED WARDROBE PLANNING & 3D CLOSET CONFIGURATOR',
    heading: 'Free online wardrobe designer.\nCustom fitted storage in 3D.',
    intro: 'Design custom built-in wardrobes and walk-in closets to the exact millimetre. '
      + 'Configure hanging rails, internal drawers, and door fronts, then generate dimensioned drawings and cutting lists.',
    shape: 'regular',
    sections: [
      {
        title: 'Parametric wardrobe and custom closet layout design.',
        body: 'FurniDraw lets you design wall-to-wall and floor-to-ceiling fitted wardrobes that adapt '
          + 'to your exact room dimensions. Unlike generic room planners that place rigid pre-made blocks, '
          + 'our engine builds parametric joinery using standard 18 mm carcass boards, 8 mm recessed backs, '
          + 'and customizable plinths (toe kicks). Whether planning a modern reach-in closet or a luxury '
          + 'dressing room, every internal bay resizes dynamically while maintaining structural integrity.',
      },
      {
        title: 'Auto-design built-in storage by garment & shoe count.',
        body: 'Tell the planner what you need to store: count your shirts, jackets, long coats, folded sweaters, '
          + 'and shoe pairs. FurniDraw’s automatic layout algorithm proposes an optimized interior configuration '
          + 'with appropriate hanging drops (1050 mm for short hanging, 1600 mm for long coats), ergonomic shelf '
          + 'spacing, and drawer stacks placed within easy reach. You can fine-tune every divider, rail, and shelf.',
        list: [
          'Automatic bay splitting based on clothing inventory and user reach.',
          'Dedicated vertical zones for shirts, dresses, folded knitwear, and shoes.',
          'Real-time clearance checking for drawer travel and door swings.',
        ],
      },
      {
        title: 'Door front styles, carcass finishes & hardware clearances.',
        body: 'Explore Slab, Shaker, Profiled, and Rail door fronts with realistic wood decors, matt laminates, '
          + 'and textured finishes. The software enforces concealed hinge rules: 110° standard hinges for regular bays '
          + 'and 155° zero-protrusion hinges where internal pull-out drawers require unobstructed clearance to slide past open doors.',
      },
      {
        title: 'Accurate dimensioned elevations, sections & workshop cutting lists.',
        body: 'Export comprehensive CAD-ready technical drawings including front elevations, sectional views, '
          + 'panel cutting schedules, and hardware lists. Hand these clear documentation sets directly to your '
          + 'carpenter or local joiner, or use them to build your custom wardrobe with precision.',
      },
    ],
    faqs: [
      [
        'Is FurniDraw completely free to design a wardrobe?',
        'Yes. You can plan rooms, configure custom wardrobes, adjust internal fittings, and save drafts in '
          + 'your browser completely free without entering payment details or creating an account.',
      ],
      [
        'Can I design wardrobes for alcoves or sloped ceilings?',
        'Yes. FurniDraw supports alcove room templates, chimney breasts, under-stairs layouts, and raked ceilings, '
          + 'automatically calculating scribing fillets and angled panel geometry.',
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
    ],
  },
  {
    slug: 'cabinet-design-software',
    label: 'Kitchen cabinet design software',
    title: 'Kitchen Cabinet Design Software — 3D Online Planner | FurniDraw',
    description: 'Plan modular kitchen cabinets in 3D with FurniDraw. '
      + 'Configure base, wall, and tall units, continuous worktops, plinths, and export dimensioned drawings and cut lists.',
    eyebrow: 'MODULAR KITCHEN CABINET PLANNING & 3D CAD',
    heading: 'Kitchen cabinet design software.\nPlan base, wall & tall units in 3D.',
    intro: 'Plan modular base, wall and tall kitchen cabinets in your browser. '
      + 'Design continuous worktops and plinths, review appliance openings, and export workshop-ready drawings.',
    shape: 'regular',
    sections: [
      {
        title: '2D and 3D kitchen room layout planner.',
        body: 'Start by drawing your kitchen perimeter, placing windows, doors, and marking fixed plumbing, gas, '
          + 'and electrical connection points. FurniDraw keeps your 2D layout and 3D interactive model synchronized '
          + 'so you can verify walkway clearances, work triangle efficiency, and ergonomic access around every unit.',
      },
      {
        title: 'Configure modular base, wall & tall cabinets.',
        body: 'Build kitchen runs using standard modular cabinet carcasses: 600 mm, 800 mm, and 1000 mm base units; '
          + 'tall pantry and appliance housings; and 720 mm or 900 mm overhead wall units. Carcasses share a continuous '
          + 'worktop with user-defined overhangs and a flush or recessed plinth (toe kick) for a seamless fitted look.',
        list: [
          'Modular base units with adjustable drawers, shelving, and pull-out organizers.',
          'Tall pantry units with internal drawer towers and appliance service recesses.',
          'Continuous worktop spans and recessed plinth runs with accurate levelling heights.',
        ],
      },
      {
        title: 'Door fronts, drawer systems & hardware clearances.',
        body: 'Choose from modern slab doors or classic shaker profiles. Configure soft-close drawer runners, '
          + 'sink base false drawers, and concealed European hinges. FurniDraw calculates door swing clearances and drawer '
          + 'travel to prevent clashes with adjacent walls, handles, or appliances.',
      },
      {
        title: 'Export dimensioned cabinet drawings & workshop cut lists.',
        body: 'Generate full kitchen elevations, top-down installation plans, and parts schedules detailing finished '
          + 'panel sizes for carcasses, shelves, and doors. Review the plans with your cabinetmaker or kitchen fitter '
          + 'to verify cut-outs, service voids, and installation tolerances before ordering materials.',
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
    ],
  },
  {
    slug: 'furniture-making-software',
    label: 'Furniture design & making software',
    title: 'Furniture Making Software — 3D CAD & Cut List Generator | FurniDraw',
    description: 'Online furniture making software for custom cabinetry and wardrobes. '
      + 'Generate 3D parametric models, dimensioned shop drawings, and workshop-ready cut lists.',
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
        body: 'Generate full documentation packets with one click. Cutting lists categorize components by board material '
          + 'and thickness (e.g. 18 mm MFC carcass, 8 mm backing board, 22 mm solid worktops). Hardware schedules list '
          + 'every concealed hinge, drawer runner, shelf pin, and plinth leg required for the build.',
      },
      {
        title: 'Joinery rules, scribing allowances & panel assembly.',
        body: 'Incorporate realistic scribing allowances and infill fillets for out-of-plumb walls and uneven floors. '
          + 'Carcass panels adhere to professional assembly standards (System 32 hole spacing and 37 mm hinge lines), '
          + 'providing an accurate foundation for CNC machining or traditional table-saw cutting.',
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
        'FurniDraw supports standard board thicknesses (18 mm, 19 mm, 16 mm, and 8 mm backs) across natural oak, '
          + 'smoked oak, chalk white laminates, and customizable surface decors.',
      ],
      [
        'Does FurniDraw support hardware specifications like hinges and drawer runners?',
        'Yes. The engine automatically calculates quantities and specifications for concealed European hinges, '
          + 'soft-close undermount drawer runners, hanging rails, and assembly fasteners.',
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
    title: 'Under Stairs Wardrobe Designer — 3D Sloped Storage | FurniDraw',
    description: 'Design custom under-stairs wardrobes and hallway storage in 3D. '
      + 'Plan angled units, pull-out drawers, and shoe racks with precise dimensioned plans.',
    eyebrow: 'SHAPED STORAGE & UNDER-STAIRS PLANNING',
    heading: 'Under-stairs wardrobe designer.\nPlan shaped storage in 3D.',
    intro: 'Maximize awkward space beneath your staircase. '
      + 'Design custom raked carcasses, pull-out shoe racks, and hanging rails that follow your exact stair angle.',
    shape: 'under-stairs',
    sections: [
      {
        title: 'Design fitted wardrobes for sloped and awkward staircase angles.',
        body: 'The triangular void beneath staircases is one of the most valuable yet difficult spaces to furnish. '
          + 'FurniDraw eliminates guesswork by allowing you to define staircase pitch, landing breaks, and vertical risers. '
          + 'The 3D model shapes each cabinet bay to follow the rake of the stringer with precision.',
      },
      {
        title: 'Zone storage for shoes, pull-out drawers & angled hanging rails.',
        body: 'Divide the angled staircase envelope into high-efficiency storage zones: full-extension pull-out drawer '
          + 'towers at the lower end for shoes and bags, and tall bays near the top for coats, jackets, and vacuum cleaners. '
          + 'Our planner calculates clear opening widths and prevents drawer runners from binding against staircase stringers.',
        list: [
          'Parametric ceiling slope following the exact staircase angle and landing profile.',
          'Deep full-extension pull-out shoe drawers in low, awkward height zones.',
          'Full-height coat hanging and utility cupboards at the tall end of the run.',
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
        'Yes. You can configure tall bays with hanging rails and shorter bays with heavy-duty full-extension drawers '
          + 'or angled shoe shelves.',
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
    title: '3D Furniture Configurator Online — Wardrobes & Cabinets | FurniDraw',
    description: 'Free online 3D furniture configurator. '
      + 'Customise wardrobes, alcove cupboards, and kitchen cabinets to the millimetre. Generate instant cut lists and 3D views.',
    eyebrow: '3D FURNITURE CONFIGURATOR & PARAMETRIC DESIGN',
    heading: '3D furniture configurator online.\nCustom wardrobes & cabinetry.',
    intro: 'Configure custom wardrobes, closets, and modular cabinetry with real-time 3D parametric controls. '
      + 'Tailor dimensions, materials, door styles, and hardware in your browser.',
    shape: 'regular',
    sections: [
      {
        title: 'Parametric 3D furniture configuration in real time.',
        body: 'FurniDraw delivers an interactive 3D configurator designed specifically for bespoke cabinetry. '
          + 'Unlike static 3D visualizers, every slider and input field is connected to real-time engineering rules. '
          + 'Adjust overall width, height, or carcass depth, and watch bays, internal partitions, shelves, and doors '
          + 'recalculate proportionally to preserve structural standards and hardware clearances.',
      },
      {
        title: 'Customise dimensions, front styles & finishes to the millimetre.',
        body: 'Choose from multiple door front styles including flat Slab, classic Shaker, Profiled shaker, and Rail designs. '
          + 'Apply realistic woodgrain decors (natural oak, smoked oak, chalk white) with grain orientation awareness. '
          + 'Configure plinth heights, top scribe infills, and end panels to match your room interior perfectly.',
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
          + 'part-by-part cutting lists, and step-by-step 3D assembly guides that make building or ordering custom furniture straightforward.',
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
    ],
  },
];
