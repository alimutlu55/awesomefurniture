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
  lang: 'en',
  name: 'English',
  title: 'Online Furniture Design Software & 3D Configurator | FurniDraw',
  description: 'Free-to-try online 2D/3D furniture design software and parametric configurator. '
    + 'Plan rooms, custom wardrobes, and kitchen cabinets with cut lists in your browser.',
  nav: ['Workflow', 'Features', 'Guides'],
  start: 'Open the studio',
  eyebrow: 'YOUR FURNITURE. FROM IDEA TO BUILD.',
  headline: ['Design it.', 'Engineer it.', 'Build it.'],
  intro: 'See what fits your space, work out how it goes together, and create clear plans to build from—all in one 3D studio.',
  explore: 'Make it yours',
  note: 'Design in your browser. No account needed to begin.',
  study: 'THE FITTING ROOM / STUDY 001',
  views: ['Material', 'Drawing'],
  shapes: ['Wardrobe', 'Alcove', 'Under stairs'],
  width: 'Width',
  finishes: ['Natural oak', 'Smoked oak', 'Chalk'],
  finish: 'Material study',
  dimensionCta: 'Start with these dimensions',
  illustration: 'An interactive illustration. Your dimensions carry into the studio; choose fittings and finishes there.',
  statement: ['One studio.', 'From first idea to the build.'],
  statementBody: 'Keep your room, custom furniture designs and construction details in one project. '
    + 'Explore the design, work through the technical decisions, and take clear information into the workshop.',
  steps: [
    [
      'Design it.',
      'Plan your room and design furniture together in 3D. Explore custom layouts and finishes, '
        + 'then use an AI image to picture your design in a finished room.',
    ],
    [
      'Engineer it.',
      'Refine dimensions, materials and fittings. Work through the construction and review how the '
        + 'parts fit together before anything is cut.',
    ],
    [
      'Build it.',
      'Create dimensioned drawings, cutting lists and hardware schedules. Build it yourself or '
        + 'give your furniture maker or carpenter a clear plan to work from.',
    ],
  ],
  detail: ['THE DETAILS THAT MAKE IT WORK', 'Designed for your space.', 'Engineered for the build.'],
  imageAlt: 'Warm oak fitted wardrobe with open shelves, hanging storage and drawers in a sunlit interior',
  imageCaption: 'An interior inspiration study. AI visualisations are illustrative; technical drawings describe your design.',
  materials: 'Make the storage work for you, from shelves and hanging space to drawers and doors. '
    + 'Design custom furniture tailored to your space, then refine dimensions, panel materials and fittings in the same 3D studio.',
  resourceTitle: 'Wardrobe & kitchen design guides',
  resourceIntro: 'Practical guides for planning your room, designing fitted furniture and '
    + 'understanding the drawings and parts behind the build.',
  resourceLink: 'Explore the guide',
  questions: 'Before you begin.',
  faqs: [
    [
      'What can I design with FurniDraw?',
      'Custom fitted wardrobes, walk-in closets, alcove cupboards, under-stairs storage, and modular kitchen cabinets. '
        + 'The studio includes 2D/3D rooms, materials, internal fittings, and dimensioned technical drawings.',
    ],
    [
      'Do I need an account or an installation?',
      'You can begin designing in any modern browser without creating an account or installing software. '
        + 'Browser drafts keep your work locally; account synchronization and cloud features are available in the studio.',
    ],
    [
      'Is FurniDraw free to try?',
      'Yes. Designing rooms, configuring wardrobes, and planning kitchen runs is 100% free with no account required. '
        + 'High-resolution AI photorealistic renders and downloadable CAD technical drawing sets use optional pay-as-you-go credits.',
    ],
    [
      'Can I use the drawings to make furniture?',
      'Yes. The dimensioned drawings, elevations, sections, and finished component cutting lists provide exact measurements '
        + 'for carpenters, joiners, and cabinetmakers. Confirm site measurements, fittings, and tolerances before cutting.',
    ],
    [
      'Can I use FurniDraw in my country?',
      'FurniDraw is a browser-based web application available worldwide. The introduction is available in several languages, '
        + 'and the studio supports seven interface languages alongside flexible measurements in centimetres, millimetres, or inches.',
    ],
  ],
  closing: ['Design it. Engineer it.', 'Build it.'],
  language: 'Language',
  editorLanguage: 'Studio in 7 languages · flexible units',
  skip: 'Skip to content',
  units: 'Units',
};
