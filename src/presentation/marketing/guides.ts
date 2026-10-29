export interface Guide {
  slug: string;
  label: string;
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  intro: string;
  shape: 'regular' | 'alcove' | 'under-stairs';
  sections: readonly { title: string; body: string; list?: readonly string[] }[];
}

export const guides: readonly Guide[] = [
  {
    slug: 'wardrobe-designer', label: 'Online wardrobe designer',
    title: 'Online Wardrobe Designer — Plan Fitted Storage in 3D | FurniDraw',
    description: 'Design a fitted wardrobe online around your room and belongings. Explore shelves, drawers, rails and shaped tops, then review dimensioned drawings in FurniDraw.',
    eyebrow: 'FITTED WARDROBE PLANNING', heading: 'Online wardrobe designer.\nFitted to your room.',
    intro: 'Plan fitted storage around your room and clothing. Configure hanging space, shelves and drawers, then review the layout and dimensions in 3D.', shape: 'regular',
    sections: [
      { title: 'Define the storage requirements.', body: "Count the shirts that need hanging space, the shoes you actually wear and the knitwear you fold. In FurniDraw, Auto "
        + "design uses your clothing quantities to suggest storage layouts. Review the proposals, then adjust the arrangement "
        + "yourself. A plan that suits one person may not suit a shared wardrobe.",
        list: ['Keep everyday items within a comfortable reach.', 'Allow enough uninterrupted height for coats and dresses.', 'Compare hanging storage, shelves and drawers before settling on a layout.'] },
      { title: 'Model the room dimensions.', body: "Measure the available width, depth and height. Add the surrounding room, including openings and ceiling changes. A "
        + "rectangular wardrobe can become a sloped, stepped, recessed or custom shape. Explore it from several angles and check "
        + "how doors and nearby furniture will affect access. The preview on this page carries your chosen dimensions into the "
        + "studio as a starting cabinet." },
      { title: 'Review materials and technical drawings.', body: "Explore carcass and front materials in the editor. Use an AI visualisation to discuss the overall look, and technical "
        + "drawings to review dimensions, elevations, parts and hardware. Confirm site measurements with your furniture maker "
        + "before manufacture. Drawings currently do not include drilling plans, and cutting lists show finished dimensions without "
        + "edge-banding deductions." },
    ],
  },
  {
    slug: 'cabinet-design-software', label: 'Kitchen cabinet design software',
    title: 'Online Cabinet Design Software — Plan Kitchen Units in 3D | FurniDraw',
    description: 'Plan and design modular kitchen cabinets online with FurniDraw. Explore base, wall and tall units, materials, room layouts and dimensioned drawings in 3D.',
    eyebrow: 'MODULAR KITCHEN CABINET PLANNING', heading: 'Kitchen cabinet design.\nPlanned in 3D.',
    intro: 'Plan modular base, wall and tall kitchen units in your browser. Review cabinet dimensions, materials and room layouts before discussing the installation with your kitchen maker or installer.', shape: 'regular',
    sections: [
      { title: 'Plan the room before the run.', body: "Begin with walls, doors, windows and the space you need to move. Mark the locations of services before deciding where "
        + "cabinets belong. FurniDraw lets you work with a room in 3D, so you can compare the cabinet layout with its surroundings. "
        + "Site conditions, appliance requirements and local installation rules still need a professional review." },
      { title: 'Build with base, wall and tall units.', body: "The studio includes modular kitchen cabinets, with a shared worktop and plinth for a run. Choose units, adjust their "
        + "dimensions and explore finishes. Look at the arrangement from more than one angle: an attractive elevation can still "
        + "hide an awkward drawer or an inaccessible corner.",
        list: ['Check door and drawer opening space.', 'Review appliance dimensions with the manufacturer’s instructions.', 'Leave room for service access and installation tolerances.'] },
      { title: 'Know what the design describes.', body: "Use dimensioned technical drawings to discuss the cabinet arrangement with your cabinet maker. Kitchen runs currently do not "
        + "turn corners automatically. Placing a sink or hob does not create its worktop cut-out, and drilling plans are not "
        + "included. Ask your maker to confirm joints, fittings, cut-outs and installation details. The interactive study on this "
        + "page illustrates a wardrobe; open the studio to add kitchen units." },
    ],
  },
  {
    slug: 'furniture-making-software', label: 'Furniture design & making software',
    title: 'Furniture Making & Design Software — 3D to Workshop Plans | FurniDraw',
    description: 'Design custom furniture online and prepare workshop-ready plans. Create 3D wardrobes and cabinets, explore finishes, and generate dimensioned drawings with FurniDraw.',
    eyebrow: 'FURNITURE DESIGN & WORKSHOP DOCUMENTATION', heading: 'Furniture making software.\nFrom design to drawings.',
    intro: 'Design custom wardrobe and cabinet layouts with exact dimensions, materials and internal fittings. Produce clear technical documentation for review with your furniture maker or workshop.', shape: 'regular',
    sections: [
      { title: 'Design custom furniture with exact dimensions.', body: "In FurniDraw, designing furniture means working with real dimensions, internal fittings and board "
        + "materials in 3D. Explore wardrobes and modular cabinets directly in your browser and refine the design as "
        + "you measure your room. You can start designing custom furniture without installing software or creating an account." },
      { title: 'Separate 3D visualization from workshop construction.', body: "An AI image helps you picture finished furniture in a room, but dimensioned drawings specify the build. "
        + "Use the 3D model to review proportions and access, and rely on dimensioned elevations, section details and cutting lists "
        + "when reviewing construction with a furniture maker or joiner.",
        list: ['Use 3D views to design furniture proportions and test clearance.', 'Use AI visualisations to explore materials, decor and finishes.', 'Use dimensioned drawings, cutting lists and hardware schedules for the workshop.'] },
      { title: 'Bring clear plans to your furniture maker or workshop.', body: "FurniDraw’s technical drawing set produces elevations, cabinet sections and parts schedules to review with "
        + "your furniture maker, carpenter or joinery workshop. Cutting lists provide finished component sizes before "
        + "edge-banding deductions, giving the maker an accurate starting point for site checks, joint selection and workshop fabrication." },
    ],
  },
  {
    slug: 'under-stairs-wardrobe', label: 'Storage under the stairs',
    title: 'Under Stairs Wardrobe Designer — Plan Shaped Storage | FurniDraw',
    description: 'Explore an under-stairs wardrobe in 3D. Plan the shape, divide useful storage zones and review dimensions with FurniDraw’s online furniture designer.',
    eyebrow: 'SHAPED STORAGE PLANNING', heading: 'Under-stairs storage.\nDesigned to fit.',
    intro: 'Plan a wardrobe that follows the staircase profile. Allocate low sections to shelves or shoes, and use taller sections for hanging storage where the measurements allow.', shape: 'under-stairs',
    sections: [
      { title: 'Measure the profile, not just the width.', body: "Record the available floor width and depth, then measure the underside of the stairs at several positions. Include "
        + "landings, vertical steps, skirting and boxing. A single angle is rarely enough to describe a turning staircase. "
        + "FurniDraw supports shaped tops and ceiling profiles, which you can refine in the studio after opening an example." },
      { title: 'Match each zone to a useful job.', body: "Low sections can suit shoes or folded items; taller sections may take a rail or long garments. Check reach, door swings "
        + "and how someone will use the storage from the hallway. Auto design plans each shaped bay up to its lowest ceiling point, "
        + "so review the resulting layout and use the editor to adjust it.",
        list: ['Measure heights from the finished floor.', 'Check access to services and existing hatches.', 'Leave an appropriate fitting tolerance for your maker to confirm.'] },
      { title: 'Review the shape before making.', body: "Switch the study into drawing view to see how a profile changes the outline. This is an illustration; the actual studio "
        + "builds the design using its own geometry rules. Open the studio with the selected width and shape, refine the profile "
        + "against your measurements, then review the technical drawings with your furniture maker." },
    ],
  },
  {
    slug: 'guides/measure-for-a-fitted-wardrobe', label: 'How to measure a wardrobe space',
    title: 'How to Measure for a Fitted Wardrobe — A Practical Guide | FurniDraw',
    description: 'Measure width, height, depth and obstructions for a fitted wardrobe. A practical checklist to prepare your room measurements before designing in FurniDraw.',
    eyebrow: 'MEASURING GUIDE / 001', heading: 'Measure for a fitted wardrobe.\nA practical checklist.',
    intro: 'Record clear widths, heights, depths and obstructions before planning a fitted wardrobe. Use this checklist to prepare measurements for the design and installation review.', shape: 'alcove',
    sections: [
      { title: '01. Find the smallest clear dimensions.', body: "Measure the width at floor level, at the middle and near the ceiling. Measure height on both sides and in the centre. "
        + "Check depth at more than one position too. Walls and floors are not always straight or square: record the differences "
        + "instead of assuming one measurement represents the whole space. Note whether flooring or other finishes will change "
        + "before installation." },
      { title: '02. Draw what the tape cannot explain.', body: "Mark skirting, cornices, radiators, sockets, switches, pipes and access panels. Show which way nearby doors open and "
        + "where a window needs clearance. For a sloping ceiling or staircase, mark the height at measured positions along the "
        + "wall. Photograph the space and label the measurements on your sketch.",
        list: ['Width at three heights; height at three positions.', 'Available depth, including obstacles and door access.', 'Position and size of openings, services and changes in the ceiling.'] },
      { title: '03. Make a first design, then check it.', body: "Enter your dimensions into FurniDraw in centimetres and use the 3D model to explore the arrangement. The public preview "
        + "can display inches, but the studio currently uses centimetres; one inch equals 2.54 cm. Do not order boards from an "
        + "initial room measurement alone. Ask the installer or furniture maker to confirm site dimensions, fitting tolerances and "
        + "production details before manufacture." },
    ],
  },
];
