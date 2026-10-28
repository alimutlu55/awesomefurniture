export interface MarketingCopy {
  lang: string;
  name: string;
  title: string;
  description: string;
  nav: [string, string, string];
  start: string;
  eyebrow: string;
  headline: [string, string];
  intro: string;
  explore: string;
  note: string;
  study: string;
  views: [string, string];
  shapes: [string, string, string];
  width: string;
  finishes: [string, string, string];
  finish: string;
  dimensionCta: string;
  illustration: string;
  statement: [string, string];
  statementBody: string;
  steps: readonly [string, string][];
  detail: [string, string, string];
  imageAlt: string;
  imageCaption: string;
  materials: string;
  resourceTitle: string;
  resourceIntro: string;
  resourceLink: string;
  questions: string;
  faqs: readonly [string, string][];
  closing: [string, string];
  language: string;
  editorLanguage: string;
  skip: string;
  units: string;
}

export const english: MarketingCopy = {
  lang: 'en', name: 'English',
  title: 'FurniDraw — Online Furniture Designer for Wardrobes & Kitchens',
  description: "Design fitted wardrobes and kitchen cabinets online in 3D. Configure dimensions, materials and storage, then review technical drawings with FurniDraw.",
  nav: ["How it works","Design details","Planning guides"], start: 'Open the studio',
  eyebrow: "ONLINE 3D FURNITURE DESIGNER",
  headline: ["3D furniture design.","With precise plans."],
  intro: "Design fitted wardrobes and kitchen cabinets in 3D. Define dimensions, configure storage, and review technical drawings.",
  explore: "Explore the designer", note: 'Design in your browser. No account needed to begin.',
  study: "INTERACTIVE DESIGN PREVIEW", views: ['Material', 'Drawing'],
  shapes: ['Wardrobe', 'Alcove', 'Under stairs'], width: 'Width',
  finishes: ['Natural oak', 'Smoked oak', 'Chalk'], finish: 'Material study',
  dimensionCta: 'Start with these dimensions',
  illustration: 'An interactive illustration. Your dimensions carry into the studio; choose fittings and finishes there.',
  statement: ["One design workflow.","From layout to drawings."],
  statementBody: "Model the available space, configure the furniture and review the design with clear dimensions and material specifications.",
  steps: [
    [
      "Model the space.",
      "Define the room and cabinet dimensions. Adapt fitted wardrobes to alcoves, sloping ceilings and the space under stairs."
    ],
    [
      "Specify the materials.",
      "Review carcass and front finishes in 3D. Use an optional AI visualisation to compare the design with an interior setting."
    ],
    [
      "Review the drawings.",
      "Generate dimensioned views and parts schedules. Review the design, fittings and manufacturing details with your furniture maker."
    ]
  ],
  detail: ["FURNITURE SPECIFICATION","Design the exterior.","Configure the interior."],
  imageAlt: 'Warm oak fitted wardrobe with open shelves, hanging storage and drawers in a sunlit interior',
  imageCaption: 'An interior inspiration study. AI visualisations are illustrative; technical drawings describe your design.',
  materials: "Configure shelves, hanging rails, drawers and doors. Compare material choices and review how wardrobes and kitchen cabinets fit within the room.",
  resourceTitle: "Practical furniture planning guides.",
  resourceIntro: "Work through fitted wardrobe design, kitchen cabinet layouts, measurements and the technical information needed for fabrication.",
  resourceLink: 'Explore the guide', questions: "Product information.",
  faqs: [
    ['What can I design with FurniDraw?', 'Fitted wardrobes, shaped storage and modular kitchen cabinets. The studio includes rooms, materials, fittings and technical drawings. The automatic starting examples here create wardrobes.'],
    ['Do I need an account or an installation?', "You can begin designing in a modern browser without creating an account or installing software. Browser drafts keep your "
      + "work locally; account and cloud features are available in the studio."],
    ['Is FurniDraw free to try?', "You can begin designing without buying credits. AI images and technical drawings use the credit system shown in the "
      + "studio. Check the current allowances and prices there before using a paid feature."],
    ['Can I use the drawings to make furniture?', "Use the dimensioned drawings to review the design with a furniture maker. Confirm site measurements, materials, "
      + "clearances and hardware before manufacture. Current cutting lists give finished sizes; drilling plans are not included."],
    ['Can I use FurniDraw in my country?', "FurniDraw is a browser-based tool. These introduction pages are available in several languages, and you can choose "
      + "centimetres or inches in this preview. The full studio currently uses English and centimetres."],
  ],
  closing: ["Plan your next project.","Define the details in 3D."],
  language: 'Language', editorLanguage: 'Studio in English · dimensions in cm', skip: 'Skip to content', units: 'Units',
};
