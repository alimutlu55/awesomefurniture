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
  sections: readonly GuideSection[];
  faqs?: readonly [string, string][];
  author?: string;
  updated?: string;
}
