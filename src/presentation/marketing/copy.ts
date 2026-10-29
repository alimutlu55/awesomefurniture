export interface MarketingCopy {
  lang: string;
  name: string;
  title: string;
  description: string;
  nav: [string, string, string];
  start: string;
  eyebrow: string;
  headline: [string, string, string];
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
  description: "Design it. Engineer it. Build it. Plan your room and furniture in one 3D studio, then create dimensioned drawings and parts lists with FurniDraw.",
  nav: ['The experience', 'The details', 'Field notes'], start: 'Open the studio',
  eyebrow: "YOUR FURNITURE. FROM IDEA TO BUILD.",
  headline: ["Design it.", "Engineer it.", "Build it."],
  intro: "See what fits your space, work out how it goes together, and create clear plans to build from—all in one 3D studio.",
  explore: 'Make it yours', note: 'Design in your browser. No account needed to begin.',
  study: 'THE FITTING ROOM / STUDY 001', views: ['Material', 'Drawing'],
  shapes: ['Wardrobe', 'Alcove', 'Under stairs'], width: 'Width',
  finishes: ['Natural oak', 'Smoked oak', 'Chalk'], finish: 'Material study',
  dimensionCta: 'Start with these dimensions',
  illustration: 'An interactive illustration. Your dimensions carry into the studio; choose fittings and finishes there.',
  statement: ["One studio.", "From first idea to the build."],
  statementBody: "Keep your room, custom furniture designs and construction details in one project. Explore the design, work through the technical decisions, and take clear information into the workshop.",
  steps: [
    [
      "Design it.",
      "Plan your room and design furniture together in 3D. Explore custom layouts and finishes, then use an AI image to picture your design in a finished room."
    ],
    [
      "Engineer it.",
      "Refine dimensions, materials and fittings. Work through the construction and review how the parts fit together before anything is cut."
    ],
    [
      "Build it.",
      "Create dimensioned drawings, cutting lists and hardware schedules. Build it yourself or give your furniture maker or carpenter a clear plan to work from."
    ],
  ],
  detail: ["THE DETAILS THAT MAKE IT WORK", "Designed for your space.", "Engineered for the build."],
  imageAlt: 'Warm oak fitted wardrobe with open shelves, hanging storage and drawers in a sunlit interior',
  imageCaption: 'An interior inspiration study. AI visualisations are illustrative; technical drawings describe your design.',
  materials: "Make the storage work for you, from shelves and hanging space to drawers and doors. Design custom furniture tailored to your space, then refine dimensions, panel materials and fittings in the same 3D studio.",
  resourceTitle: "A clearer plan. A better build.",
  resourceIntro: "Practical guides for planning your room, designing fitted furniture and understanding the drawings and parts behind the build.",
  resourceLink: 'Explore the guide', questions: 'Before you begin.',
  faqs: [
    ['What can I design with FurniDraw?', 'Custom fitted wardrobes, shaped storage and modular kitchen cabinets. The studio includes 3D rooms, materials, '
      + 'fittings and technical drawings. The automatic starting examples here create wardrobes.'],
    ['Do I need an account or an installation?', "You can begin designing in a modern browser without creating an account or installing software. Browser drafts keep your "
      + "work locally; account and cloud features are available in the studio."],
    ['Is FurniDraw free to try?', "You can begin designing without buying credits. AI images and technical drawings use the credit system shown in the "
      + "studio. Check the current allowances and prices there before using a paid feature."],
    ['Can I use the drawings to make furniture?', "Use the dimensioned drawings to review the design with a furniture maker, joiner or cabinet maker. Confirm site measurements, materials, "
      + "clearances and hardware before manufacture. Current cutting lists give finished sizes; drilling plans are not included."],
    ['Can I use FurniDraw in my country?', "FurniDraw is a browser-based tool. These introduction pages are available in several languages, and you can choose "
      + "centimetres or inches in this preview. The studio supports seven interface languages and centimetres, millimetres or inches."],
  ],
  closing: ["Design it. Engineer it.", "Build it."],
  language: 'Language', editorLanguage: 'Studio in 7 languages · flexible units', skip: 'Skip to content', units: 'Units',
};
