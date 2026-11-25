import type { StarterDesign } from '../../domain/project/starter-design';

export interface GuideSection {
  title: string;
  body: string;
  list?: readonly string[];
}

export interface Guide {
  slug: string;
  label: string;
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  intro: string;
  shape: 'regular' | 'alcove' | 'under-stairs';
  /** What the page's buttons open in the editor, when not a wardrobe of `shape` (a kitchen, a chest of drawers...). */
  starter?: StarterDesign;
  sections: readonly GuideSection[];
  faqs?: readonly [string, string][];
  /** Guide articles: when the guide was first published and last changed in substance (ISO dates, YYYY-MM-DD). */
  published?: string;
  updated?: string;
}
