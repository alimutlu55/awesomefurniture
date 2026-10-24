/**
 * What goes on a sheet of paper, in paper millimetres with y down: shapes, circles and words, each with a named pen or
 * font. Laid out once (sheet-marks.ts) and written out twice: as SVG to show on screen (here) and as PDF to save
 * (pdf-writer.ts), so the screen and the file can never differ.
 */
export interface Pt { readonly x: number; readonly y: number }

/** Line weights on paper (ISO 128): cut 0.5, frame 0.7, outlines and rules 0.35, thin 0.18, hidden 0.25 dashed, centre
 * lines chain, swings long dashes, dimension lines 0.13 with 0.35 ticks. Colours as 0–255 grey or RGB. */
export const PENS = {
  cut: { width: .5, colour: [17, 17, 17] }, outline: { width: .35, colour: [17, 17, 17] }, thin: { width: .18, colour: [51, 51, 51] },
  overhead: { width: .13, colour: [110, 110, 110], dash: [2, 1.5] },
  hidden: { width: .25, colour: [51, 51, 51], dash: [2, 1] }, centre: { width: .18, colour: [51, 51, 51], dash: [6, 1, 1, 1] },
  swing: { width: .18, colour: [51, 51, 51], dash: [3, 1.5] }, dim: { width: .13, colour: [17, 17, 17] }, tick: { width: .35, colour: [17, 17, 17] },
  frame: { width: .7, colour: [17, 17, 17] }, rule: { width: .18, colour: [17, 17, 17] }, heavy: { width: .35, colour: [17, 17, 17] },
  ring: { width: .25, colour: [17, 17, 17] }, none: { width: 0, colour: [0, 0, 0] },
  /** The release stamp of a set that must not be used for manufacture. */
  stamp: { width: .7, colour: [179, 38, 30] },
} as const satisfies Record<string, { width: number; colour: readonly number[]; dash?: readonly number[] }>;
export type Pen = keyof typeof PENS;
export const FILLS = { white: [255, 255, 255], black: [17, 17, 17], glass: [228, 236, 242] } as const;
export type Fill = keyof typeof FILLS | 'hatch';
/** Hatching: thin lines at 45°, this far apart. */
export const HATCH = { gap: 1.4, width: .13, colour: [51, 51, 51] } as const;

/** Lettering: size is the font size (em) in paper millimetres; Helvetica, regular or bold. */
export const FONTS = {
  figure: { size: 3.5 }, note: { size: 3 }, small: { size: 2.4, colour: [68, 68, 68] }, check: { size: 2.9, bold: true, colour: [179, 38, 30] },
  tag: { size: 2.9, bold: true }, mark: { size: 3.4, bold: true }, key: { size: 2.2, colour: [85, 85, 85] }, value: { size: 3.4 },
  project: { size: 5, bold: true }, heading: { size: 4.2, bold: true }, scale: { size: 3.2 }, list: { size: 2.7 }, listMark: { size: 2.7, bold: true },
  caption: { size: 3.6, bold: true }, head: { size: 3, bold: true }, cell: { size: 3 },
  stamp: { size: 4.6, bold: true, colour: [179, 38, 30] },
} as const satisfies Record<string, { size: number; bold?: boolean; colour?: readonly number[] }>;
export type Font = keyof typeof FONTS;
export const fontOf = (f: Font) => FONTS[f] as { size: number; bold?: boolean; colour?: readonly number[] };

export interface Shape { readonly kind: 'shape'; readonly points: readonly Pt[]; readonly closed: boolean; readonly pen: Pen; readonly fill?: Fill | undefined }
export interface Circle { readonly kind: 'circle'; readonly c: Pt; readonly r: number; readonly pen: Pen; readonly fill: Fill }
/** A line of words at `at`, turned `angle` degrees clockwise on the page; `central`: `at` is its middle height. */
export interface Words { readonly kind: 'text'; readonly at: Pt; readonly text: string; readonly font: Font; readonly anchor: 'start' | 'middle' | 'end'; readonly angle: number; readonly central?: boolean | undefined }
export type Mark = Shape | Circle | Words;

export const shape = (points: readonly Pt[], pen: Pen, closed = false, fill?: Fill): Shape => ({ kind: 'shape', points, closed, pen, fill });
export const words = (at: Pt, text: string, font: Font, anchor: Words['anchor'] = 'start', angle = 0, central = false): Words => ({ kind: 'text', at, text, font, anchor, angle, central });
export const box = (x0: number, y0: number, x1: number, y1: number, pen: Pen, fill?: Fill) => shape([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], pen, true, fill);

const f = (n: number) => String(Math.round(n * 100) / 100);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rgb = (c: readonly number[]) => 'rgb(' + c.join(',') + ')';

function stroke(pen: Pen) {
  const p = PENS[pen] as { width: number; colour: readonly number[]; dash?: readonly number[] };
  return pen === 'none' ? ' stroke="none"' : ` stroke="${rgb(p.colour)}" stroke-width="${p.width}"` + (p.dash ? ` stroke-dasharray="${p.dash.join(' ')}"` : '');
}
const fill = (fl: Fill | undefined, hatch: string) => fl === 'hatch' ? `url(#${hatch})` : fl ? rgb(FILLS[fl]) : 'none';

/** A sheet's marks as one self-contained A3 SVG, its size in millimetres. */
export function marksToSvg(marks: readonly Mark[], size: { w: number; h: number }, id: string, label: string): string {
  const hatch = 'hatch-' + id, body = marks.map(m => {
    if (m.kind === 'shape') {
      const pts = m.points.map(p => f(p.x) + ',' + f(p.y)).join(' ');
      return `<${m.closed ? 'polygon' : 'polyline'} points="${pts}" fill="${fill(m.fill, hatch)}"${stroke(m.pen)}/>`;
    }
    if (m.kind === 'circle') return `<circle cx="${f(m.c.x)}" cy="${f(m.c.y)}" r="${f(m.r)}" fill="${fill(m.fill, hatch)}"${stroke(m.pen)}/>`;
    const font = fontOf(m.font);
    return `<text transform="translate(${f(m.at.x)} ${f(m.at.y)}) rotate(${f(m.angle)})" font-size="${font.size}" text-anchor="${m.anchor}"`
      + (font.bold ? ' font-weight="700"' : '') + (m.central ? ' dominant-baseline="central"' : '') + ` fill="${rgb(font.colour ?? [17, 17, 17])}">${esc(m.text)}</text>`;
  }).join('');
  const defs = `<defs><pattern id="${hatch}" width="${HATCH.gap}" height="${HATCH.gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<rect width="${HATCH.gap}" height="${HATCH.gap}" fill="#fff"/><line x1="0" y1="0" x2="0" y2="${HATCH.gap}" stroke="${rgb(HATCH.colour)}" stroke-width="${HATCH.width}"/></pattern></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.w} ${size.h}" width="${size.w}mm" height="${size.h}mm" role="img" aria-label="${esc(label)}"`
    + ` font-family="Helvetica,Arial,sans-serif" stroke-linejoin="miter">` + defs + body + '</svg>';
}
