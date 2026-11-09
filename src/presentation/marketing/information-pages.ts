import type { Guide } from './guides';
import { creditPackList, creditUseLines } from './credit-prices';

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
        body: 'FurniDraw is built to fill the gap '
          + 'between decorative room visualizers and complex desktop CAD tools like SketchUp or Fusion 360. '
          + 'While consumer visualizers only drag pre-made blocks and cannot engineer internal carcasses or hinges, '
          + 'FurniDraw generates real joinery, fitting clearances, and workshop cut lists directly in your web browser. '
          + 'Start planning in our [free online wardrobe designer](/wardrobe-designer/) or [kitchen cabinet design software](/kitchen-cabinet-design-software/).',
      },
      {
        title: 'Parametric accuracy to the millimetre.',
        body: 'Every wardrobe and cabinet is engineered with real millwork parameters: 18 mm board construction, '
          + '6 mm inset backs, 60–100 mm plinth offsets, scribing allowances for uneven walls, and '
          + 'concealed hinge calculations. Change an overall dimension or ceiling angle, and every shelf, '
          + 'partition, and cut list line updates instantly.',
      },
      {
        title: 'Drawings made to be checked and built in a workshop.',
        body: 'Hole positions follow common cabinetmaking practice (System 32 spacing and the 37 mm hinge line) '
          + 'rather than one hardware maker\'s template, so check them against the hardware you buy. Exported drawings '
          + 'give boring references for manual and line-boring setups; CNC toolpaths and G-code files are not included. '
          + 'As our [terms](/terms/) say, every dimension should be checked on site by the person who builds the piece.',
      },
      {
        title: 'Get in touch.',
        body: 'For technical questions, trade enquiries or feedback from your workshop, email support@furnidraw.com.',
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
          + 'or export a technical drawing set (dimensioned plans, elevations, sections, cutting and hardware lists '
          + 'as an A3 PDF). Credits do not expire and carry over across projects.',
        list: creditUseLines(),
      },
      {
        title: 'Available credit packages.',
        body: 'Buy a pack inside the studio when you need one. Prices include VAT where it is charged: zloty in Poland, '
          + 'euro elsewhere in the EU and US dollars everywhere else.',
        list: creditPackList(),
      },
      {
        title: 'Secure payments.',
        body: 'Payments are processed by Stripe; FurniDraw never sees or stores your card number. An AI image is '
          + 'charged only when it arrives: if it fails, its credits go back to your balance.',
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
        body: 'Are you an independent cabinetmaker, joiner, or kitchen installer? Tell us what your workshop needs '
          + 'from customer drawing handoffs and cut lists: trade@furnidraw.com.',
      },
      {
        title: 'Response time & business hours.',
        body: 'Our engineering and support team reviews messages Monday through Friday between 08:00 '
          + 'and 18:00 CET. We aim to reply to all inquiries within 24 hours. For billing inquiries, '
          + 'please include your Stripe order reference.',
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
