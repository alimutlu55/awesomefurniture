export type ImageStyle = 'realistic' | 'studio' | 'concept';

export const IMAGE_STYLES: ReadonlyArray<{
  value: ImageStyle;
  title: string;
  description: string;
  thumbnail: string;
}> = [
  {
    value: 'realistic',
    title: 'Realistic photo',
    description: 'Natural lighting, realistic materials and textures.',
    thumbnail: '/assets/realistic-photo.jpg',
  },
  {
    value: 'studio',
    title: 'Studio look',
    description: 'Clean lighting and minimal styling.',
    thumbnail: '/assets/studio-look.jpg',
  },
  {
    value: 'concept',
    title: 'Concept render',
    description: 'A clean, illustrative render.',
    thumbnail: '/assets/concept-render.jpg',
  },
];

export const SPARKLE_ICON = '<svg viewBox="0 0 28 28" aria-hidden="true" fill="none">'
  + '<path d="M13.5 2.5c.75 6.7 2.7 8.65 9.4 9.4-6.7.75-8.65 2.7-9.4 9.4-.75-6.7-2.7-8.65-9.4-9.4 6.7-.75 8.65-2.7 9.4-9.4Z" fill="currentColor"/>'
  + '<path d="M22.3 18.6c.28 2.3 1.03 3.05 3.33 3.33-2.3.28-3.05 1.03-3.33 3.33-.28-2.3-1.03-3.05-3.33-3.33 2.3-.28 3.05-1.03 3.33-3.33Z" fill="currentColor"/>'
  + '</svg>';

export const ARROW_ICON = '<svg class="ai-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-7-7 7 7-7 7"/></svg>';

export const CLOSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18"/></svg>';
