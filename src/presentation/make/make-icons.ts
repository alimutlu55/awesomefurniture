/** The line icons of the Make view, drawn like the editor's own (24 × 24, 1.6 stroke). */
const svg = (d: string) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

export const MAKE_ICONS = {
  back: svg('M15 5l-7 7 7 7'),
  next: svg('M9 5l7 7-7 7'),
  close: svg('M6 6l12 12M18 6L6 18'),
  model: svg('M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5'),
  drawings: svg('M3 4h18v16H3zM6 8h5v8H6zM14 8h4M14 11h4M14 14h3'),
  assembled: svg('M7 7h10v10H7z'),
  apart: svg('M9 9h6v6H9zM3 3l4 4M21 3l-4 4M3 21l4-4M21 21l-4-4'),
  fronts: svg('M4 3h16v18H4zM12 3v18M10 12h.01M14 12h.01'),
  measures: svg('M3 12h18M3 8v8M21 8v8M6.5 10 3.5 12l3 2M17.5 10l3 2-3 2'),
  numbers: svg('M16 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM13 11l-8 8'),
  lines: svg('M4 4h16v16H4zM4 10h16M10 4v16'),
  material: svg('M4 4h16v16H4zM7 8c3 1 6-1 10 0M7 12c3 1 6-1 10 0M7 16c3 1 6-1 10 0'),
  xray: svg('M4 4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4M4 7V4M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z'),
  view3d: svg('M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5'),
  front: svg('M5 4h14v16H5zM5 20h14'),
  side: svg('M5 4h14v16H5zM19 4v16'),
  top: svg('M5 4h14v16H5zM5 4h14'),
  cut: svg('M6 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM18 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM8 16L19 4M16 16L5 4'),
  expand: svg('M4 10V4h6M20 14v6h-6M4 4l6 6M20 20l-6-6'),
  edit: svg('M4 20h4L19 9l-4-4L4 16zM13 7l4 4'),
  sheet: svg('M3 4h18v16H3zM7 8h10M7 12h6'),
} as const;
