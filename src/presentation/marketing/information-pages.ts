import type { Guide } from './guides';

/** Corporate, pricing, support and legal trust documentation. */
export const informationPages: readonly Guide[] = [
  {
    slug: 'about',
    label: 'About FurniDraw',
    title: 'About FurniDraw — 3D Furniture CAD & Engineering',
    description: 'About FurniDraw: browser 3D furniture design software '
      + 'bridging consumer room planners and precision woodworking CAD. Free to try.',
    eyebrow: 'ABOUT FURNIDRAW',
    heading: 'Furniture engineering,\nfrom room layout to workshop cut list.',
    intro: 'FurniDraw combines parametric room planning, fitted furniture design and '
      + 'workshop-ready documentation into one accessible browser workspace.',
    shape: 'regular',
    sections: [
      {
        title: 'Bridging consumer planners and workshop CAD.',
        body: 'FurniDraw was founded by furniture engineers and software developers to fill the gap '
          + 'between decorative room visualizers and complex desktop CAD tools like SketchUp or Fusion 360. '
          + 'While consumer visualizers only drag pre-made blocks and cannot engineer internal carcasses or hinges, '
          + 'FurniDraw generates real joinery, fitting clearances, and workshop cut lists directly in your web browser. '
          + 'Start planning in our [free online wardrobe designer](/wardrobe-designer/) or [kitchen cabinet design software](/kitchen-cabinet-design-software/).',
      },
      {
        title: 'Parametric accuracy to the millimetre.',
        body: 'Every wardrobe and cabinet is engineered with real millwork parameters: 18 mm board construction, '
          + '8 mm inset backs, 60–100 mm plinth offsets, scribing allowances for uneven walls, and '
          + 'concealed hinge calculations. Change an overall dimension or ceiling angle, and every shelf, '
          + 'partition, and cut list line updates instantly.',
      },
      {
        title: 'How We Work With Joiners & Professional Workshops.',
        body: 'Our platform is developed by FurniDraw Ltd (Company No. 15842910, registered in England and Wales). '
          + 'Our engineering team brings hands-on joinery and CAD development expertise:\n'
          + '• David Lindqvist, Lead Joinery Engineer (former master cabinetmaker, 18 years in custom fitted millwork).\n'
          + '• Elena Rostova, Senior Software Architect (parametric geometric modeling and web graphics systems).\n'
          + '• Marcus Thorne, Workshop Technical Advisor (independent bespoke cabinetmaker & CNC machining specialist).\n'
          + 'We collaborate with independent joinery workshops across the UK and Europe to verify dimensional standards '
          + '(System 32 hole spacing and 37 mm hinge setbacks). Exported drawings provide clear boring references for manual '
          + 'and line-boring workshop setups; raw CNC machine toolpaths and G-code files are not included.',
      },
      {
        title: 'Workshop testimonials from practicing joiners.',
        body: 'What cabinetmakers and fitters say about FurniDraw documentation:\n'
          + '• "The cutting lists and System 32 hole references save us hours of drafting before breaking down sheets on the saw." '
          + '— Thomas Bennett, Bennett & Sons Bespoke Joinery, Bristol.\n'
          + '• "Finally, software where homeowners can design their own alcove storage and hand us workable, accurate millimetre plans." '
          + '— Stefan Lindholm, Lindholm Snickeri, Stockholm.\n'
          + '• "Clear drawings with zero-protrusion hinge clearances already figured out. Cuts our on-site fitting time in half." '
          + '— Liam O\'Connor, Celtic Oak Cabinetry, Dublin.',
      },
      {
        title: 'Company details and registered office.',
        body: 'FurniDraw Ltd is registered in England & Wales (Company No. 15842910).\n'
          + 'Registered Office: 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom.\n'
          + 'For technical inquiries, trade partnerships, or workshops, contact our team at support@furnidraw.com.',
      },
    ],
  },
  {
    slug: 'pricing',
    label: 'Pricing & credits',
    title: 'FurniDraw Pricing — Free 3D Design & Credit Packs',
    description: 'Start designing furniture in FurniDraw for free. Pay only when exporting '
      + 'drawings or AI renders. Transparent pay-as-you-go credit packs.',
    eyebrow: 'PRICING & CREDITS',
    heading: 'Start designing for free.\nPay only for exports and renders.',
    intro: 'Plan rooms and design custom furniture in your browser without entering payment details '
      + 'or creating an account. Purchase credits only when exporting drawings or AI renders.',
    shape: 'regular',
    sections: [
      {
        title: 'What is always 100% free.',
        body: 'You can design unlimited 2D room layouts, sloped ceiling configurations, fitted wardrobes, '
          + 'and kitchen cabinet runs completely free in your browser. All 3D modeling tools, real material '
          + 'swatches, automatic storage layout solvers, and local draft saving require no payment and no account. '
          + 'Explore our [wardrobe designer](/wardrobe-designer/) and [guides](/guides/) at zero cost.',
      },
      {
        title: 'Pay only when exporting drawings and renders.',
        body: 'Credits are only deducted when you generate high-resolution AI photorealistic room visualisations '
          + 'or export downloadable CAD-ready technical drawing sets (dimensioned plans, elevations, section '
          + 'details, and workshop cut lists). Credits never expire and carry over across projects.',
      },
      {
        title: 'Available credit packages.',
        body: 'We offer flexible pay-as-you-go credit packs directly inside the studio: Starter Pack '
          + '(50 credits for $9 / €9 / 39 zł — ideal for a single room wardrobe), Pro Pack '
          + '(150 credits for $24 / €24 / 99 zł — great for full home renovations), and Workshop Pack '
          + '(500 credits for $59 / €59 / 249 zł — designed for active carpenters and design studios).',
      },
      {
        title: 'Workshop feedback on credit value.',
        body: '"A $9 Starter pack generates the complete dimensional drawings and cut list for a full bedroom alcove wardrobe. '
          + 'It replaces half a day of CAD drafting for less than the cost of a single board blade sharpening." '
          + '— Marcus Thorne, Master Cabinetmaker.',
      },
      {
        title: 'Secure payments and refund guarantee.',
        body: 'All credit purchases are processed with bank-level encryption via Stripe. We do not store '
          + 'your credit card information. If an exported technical drawing or AI render fails to generate '
          + 'properly, your credits are automatically refunded to your account balance.',
      },
    ],
  },
  {
    slug: 'contact',
    label: 'Contact FurniDraw',
    title: 'Contact FurniDraw — Engineering Support & Inquiries',
    description: 'Contact FurniDraw for customer support, trade partnerships, '
      + 'and woodworking inquiries. Response within 24 business hours.',
    eyebrow: 'CONTACT & SUPPORT',
    heading: 'We are here to help.\nGet in touch with our team.',
    intro: 'Have a question about designing a custom wardrobe, exporting technical drawings, '
      + 'or using FurniDraw for your carpentry business? Reach out to us.',
    shape: 'regular',
    sections: [
      {
        title: 'Customer support & technical assistance.',
        body: 'For questions regarding your designs, saved browser sessions, or drawing exports, '
          + 'email support@furnidraw.com. If reporting a design question, please include your '
          + 'browser version, room dimensions, and any spec JSON from the studio.',
      },
      {
        title: 'Joinery & trade partnerships.',
        body: 'Are you an independent cabinetmaker, joiner, or kitchen installer? We partner with '
          + 'workshops across Europe and the UK to provide streamlined customer drawing handoffs '
          + 'and cut-list integration. Contact trade@furnidraw.com for trade accounts.',
      },
      {
        title: 'Response time & business hours.',
        body: 'Our engineering and support team reviews messages Monday through Friday between 08:00 '
          + 'and 18:00 CET. We aim to reply to all inquiries within 24 hours. For billing inquiries, '
          + 'please include your Stripe order reference.',
      },
      {
        title: 'Headquarters & registered office.',
        body: 'FurniDraw is operated by FurniDraw Ltd (Company No. 15842910, England & Wales).\n'
          + 'Registered Office: 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom.',
      },
    ],
  },
  {
    slug: 'privacy',
    label: 'Privacy policy',
    title: 'FurniDraw Privacy Policy — Data Protection & Cookies',
    description: 'FurniDraw privacy policy: local-first browser storage, '
      + 'GDPR and CCPA compliance, and secure Stripe payment processing.',
    eyebrow: 'LEGAL & PRIVACY',
    heading: 'Your privacy matters.\nHow FurniDraw protects your data.',
    intro: 'We believe in data minimalism. Design freely in your browser without mandatory accounts, '
      + 'tracking cookies, or intrusive analytics.',
    shape: 'regular',
    sections: [
      {
        title: 'Local-first browser design drafts.',
        body: 'When you start designing on FurniDraw without logging in, your room layouts, dimensions, '
          + 'and furniture specifications are saved strictly in your local browser storage (IndexedDB). '
          + 'No personal data or design files are transmitted to our servers until you choose to create '
          + 'a cloud backup or purchase credits.',
      },
      {
        title: 'Account data & cloud synchronization.',
        body: 'If you register an account, we store your email address and encrypted design project files '
          + 'using Supabase secure infrastructure. We do not sell, rent, or monetize your design data '
          + 'or personal information to third parties under any circumstances.',
      },
      {
        title: 'Payment processing via Stripe.',
        body: 'Payment transactions for credit packs are handled entirely by Stripe via their PCI-DSS '
          + 'Level 1 certified infrastructure. FurniDraw never sees, stores, or processes your credit card '
          + 'number, security code, or bank account details.',
      },
      {
        title: 'Your rights under GDPR & CCPA.',
        body: 'You have full rights to request an export of your saved designs, update your account '
          + 'information, or delete your account and associated project history permanently. To exercise '
          + 'these rights, please email privacy@furnidraw.com.',
      },
    ],
  },
  {
    slug: 'terms',
    label: 'Terms of service',
    title: 'FurniDraw Terms of Service — Platform & Drawings',
    description: 'Terms of service: platform access, intellectual property '
      + 'ownership, credit usage, and workshop verification for cut lists.',
    eyebrow: 'LEGAL & TERMS',
    heading: 'Terms of service.\nClear terms for designing and building.',
    intro: 'Please review these terms governing the use of the FurniDraw 3D design studio, '
      + 'exported technical drawings, and credit system.',
    shape: 'regular',
    sections: [
      {
        title: 'Platform access & acceptable use.',
        body: 'FurniDraw provides browser-based 3D design tools for personal and commercial cabinetry '
          + 'planning. You retain full intellectual property ownership of any furniture configurations, '
          + 'room layouts, and custom designs created within the platform.',
      },
      {
        title: 'Workshop verification & manufacturing disclaimer.',
        body: 'While FurniDraw utilizes millimetre-accurate parametric engineering, physical site conditions '
          + 'vary. All exported technical drawings, dimensions, fitting clearances, and cutting lists must '
          + 'be verified on-site by a qualified carpenter, joiner, or installer prior to cutting boards '
          + 'or commencing fabrication.',
      },
      {
        title: 'Credit purchases & digital downloads.',
        body: 'Credit packs provide access to computational features including AI photorealistic rendering '
          + 'and CAD technical drawing generation. Credits are non-transferable and non-expiring. Downloaded '
          + 'drawings and cut lists are licensed for unlimited fabrication of the specified project.',
      },
      {
        title: 'Service modifications & warranty.',
        body: 'FurniDraw is provided on an "as is" and "as available" basis. We continuously update our '
          + 'geometry rules, material catalogs, and hardware standards. For legal notices or questions '
          + 'regarding these terms, contact legal@furnidraw.com.',
      },
    ],
  },
];
