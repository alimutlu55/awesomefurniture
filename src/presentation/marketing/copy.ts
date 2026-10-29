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
  description: 'Make room for your ideas. Design fitted wardrobes and kitchen cabinets in 3D, explore AI visualisations and create dimensioned technical drawings with FurniDraw.',
  nav: ['The experience', 'The details', 'Field notes'], start: 'Open the studio',
  eyebrow: 'FURNITURE DESIGN, CONSIDERED.',
  headline: ['An idea. A perfect fit.', 'Something you made.'],
  intro: 'That awkward corner. That room you keep imagining. Turn it into furniture that belongs, down to the last millimetre.',
  explore: 'Make it yours', note: 'Design in your browser. No account needed to begin.',
  study: 'THE FITTING ROOM / STUDY 001', views: ['Material', 'Drawing'],
  shapes: ['Wardrobe', 'Alcove', 'Under stairs'], width: 'Width',
  finishes: ['Natural oak', 'Smoked oak', 'Chalk'], finish: 'Material study',
  dimensionCta: 'Start with these dimensions',
  illustration: 'An interactive illustration. Your dimensions carry into the studio; choose fittings and finishes there.',
  statement: ['Good furniture starts', 'with a little thought.'],
  statementBody: 'A place for the things you own. A shape that follows your room. And a clear plan for the person who will make it.',
  steps: [
    ['Find the fit.', 'Start with your room. Shape a fitted wardrobe around a recess, a sloping ceiling or the space under your stairs.'],
    ['Feel the finish.', 'Explore materials in 3D. When you are ready, create an AI image to imagine the design in a finished room.'],
    ['Make it tangible.', 'Take the idea into technical drawings: dimensions, elevations, parts and hardware, ready for a conversation with your maker.'],
  ],
  detail: ['ROOM FOR THE DETAILS', 'Beautiful on the outside.', 'Thought through on the inside.'],
  imageAlt: 'Warm oak fitted wardrobe with open shelves, hanging storage and drawers in a sunlit interior',
  imageCaption: 'An interior inspiration study. AI visualisations are illustrative; technical drawings describe your design.',
  materials: 'Start with the way you live. Refine the shelves, rails, drawers and doors. Bring a wardrobe or kitchen cabinet into your room, and work through the details at your own pace.',
  resourceTitle: 'A little know-how. A better beginning.',
  resourceIntro: 'Practical notes on fitted furniture, thoughtful storage and the drawings that bring an idea closer to making.',
  resourceLink: 'Explore the guide', questions: 'Before you begin.',
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
  closing: ['Your space. Your ideas.', 'Let’s make room for them.'],
  language: 'Language', editorLanguage: 'Studio in English · dimensions in cm', skip: 'Skip to content', units: 'Units',
};
