import { FILLS, HATCH, PENS, fontOf, type Fill, type Mark, type Pen, type Pt } from './paper-marks';
import { pdfHex, textWidth } from './helvetica-metrics';

/** Points per paper millimetre. */
const K = 72 / 25.4;
const n = (v: number) => String(Math.round(v * 1000) / 1000);
const colour = (c: readonly number[]) => c.map(v => n(v / 255)).join(' ');
/** A circle as four Bézier quarters. */
const KAPPA = .5523;

/** The outline of a shape or circle as PDF path operators, in paper millimetres. */
function path(m: Mark): string {
  if (m.kind === 'circle') {
    const { c, r } = m, k = r * KAPPA;
    return `${n(c.x + r)} ${n(c.y)} m ${n(c.x + r)} ${n(c.y + k)} ${n(c.x + k)} ${n(c.y + r)} ${n(c.x)} ${n(c.y + r)} c `
      + `${n(c.x - k)} ${n(c.y + r)} ${n(c.x - r)} ${n(c.y + k)} ${n(c.x - r)} ${n(c.y)} c ${n(c.x - r)} ${n(c.y - k)} ${n(c.x - k)} ${n(c.y - r)} ${n(c.x)} ${n(c.y - r)} c `
      + `${n(c.x + k)} ${n(c.y - r)} ${n(c.x + r)} ${n(c.y - k)} ${n(c.x + r)} ${n(c.y)} c h`;
  }
  if (m.kind !== 'shape') return '';
  return m.points.map((p, k) => n(p.x) + ' ' + n(p.y) + (k ? ' l' : ' m')).join(' ') + (m.closed ? ' h' : '');
}
function pen(p: Pen): string {
  const s = PENS[p] as { width: number; colour: readonly number[]; dash?: readonly number[] };
  return `${n(s.width)} w ${colour(s.colour)} RG [${(s.dash ?? []).join(' ')}] 0 d`;
}
/** Hatching inside an outline: white, then thin lines at 45° clipped to it, as the SVG pattern draws. */
function hatch(outline: string, points: readonly Pt[]): string {
  const xs = points.map(p => p.x), ys = points.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const step = HATCH.gap * Math.SQRT2, lines: string[] = [];
  for (let c = x0 + y0 - step; c <= x1 + y1 + step; c += step) lines.push(`${n(c - y0)} ${n(y0)} m ${n(c - y1)} ${n(y1)} l`);
  return `q ${outline} W n 1 1 1 rg ${n(x0)} ${n(y0)} ${n(x1 - x0)} ${n(y1 - y0)} re f ${n(HATCH.width)} w ${colour(HATCH.colour)} RG [] 0 d ${lines.join(' ')} S Q`;
}
const solid = (f: Exclude<Fill, 'hatch'>) => colour(FILLS[f]) + ' rg';

/** One mark as PDF drawing operators. */
function draw(m: Mark): string {
  if (m.kind === 'text') {
    const font = fontOf(m.font), size = font.size, w = textWidth(m.text, size, font.bold);
    // Where the line of text starts: moved back for centred or right-set text, down for text set by its middle.
    const dx = m.anchor === 'middle' ? -w / 2 : m.anchor === 'end' ? -w : 0, dy = m.central ? size * .35 : 0, r = m.angle * Math.PI / 180;
    const cos = Math.cos(r), sin = Math.sin(r), x = m.at.x + dx * cos - dy * sin, y = m.at.y + dx * sin + dy * cos;
    // The page runs y down, so the text matrix turns the letters upright again.
    return `BT /${font.bold ? 'F2' : 'F1'} 1 Tf ${colour(font.colour ?? [17, 17, 17])} rg ${n(size * cos)} ${n(size * sin)} ${n(size * sin)} ${n(-size * cos)} ${n(x)} ${n(y)} Tm ${pdfHex(m.text)} Tj ET`;
  }
  const outline = path(m), stroked = m.pen !== 'none', out: string[] = [];
  if (m.fill === 'hatch') out.push(hatch(outline, m.kind === 'shape' ? m.points : [{ x: m.c.x - m.r, y: m.c.y - m.r }, { x: m.c.x + m.r, y: m.c.y + m.r }]));
  else if (m.fill) out.push(solid(m.fill) + ' ' + outline + ' f');
  if (stroked) out.push(pen(m.pen) + ' ' + outline + ' S');
  return out.join(' ');
}

/** A JPEG placed on a page: its box in paper millimetres (y down) and its pixel size. */
export interface PdfImage { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly jpeg: Uint8Array; readonly width: number; readonly height: number }

/**
 * A PDF of pages of marks, each `size` millimetres (A3 landscape for the drawings): vector lines at their ISO weights,
 * hatching as clipped lines, and text in Helvetica, which every PDF reader has. Pages are drawn in paper millimetres
 * with y down, as the marks are. `images` puts JPEG pictures on a page, under its marks. Returns the file's bytes.
 */
export function marksToPdf(pages: readonly (readonly Mark[])[], size: { w: number; h: number }, title: string, images: readonly (readonly PdfImage[] | undefined)[] = []): Uint8Array {
  const W = size.w * K, H = size.h * K, objects: (string | { head: string; bytes: Uint8Array })[] = [];
  const add = (body: string | { head: string; bytes: Uint8Array }) => { objects.push(body); return objects.length; };
  const catalog = add(''), tree = add('');
  const fonts = [add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')];
  const safe = title.replace(/[^\x20-\x7e]/g, '-').replace(/[()\\]/g, '');
  const info = add(`<< /Title (${safe}) /Producer (FurniDraw) >>`);
  const kids = pages.map((marks, page) => {
    // A picture is drawn upright in its box: the image's unit square, turned back over as the page runs y down.
    const head = (im: PdfImage) => `<< /Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /ColorSpace /DeviceRGB`
      + ` /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>`;
    const pictures = (images[page] ?? []).map((im, k) => ({ name: `Im${k}`, ref: add({ head: head(im), bytes: im.jpeg }), im }));
    const drawn = pictures.map(p => `q ${n(p.im.w)} 0 0 ${n(-p.im.h)} ${n(p.im.x)} ${n(p.im.y + p.im.h)} cm /${p.name} Do Q`).join('\n');
    const content = `q ${n(K)} 0 0 ${n(-K)} 0 ${n(H)} cm 0 J 0 j ` + drawn + '\n' + marks.map(draw).join('\n') + ' Q';
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const xobjects = pictures.length ? ` /XObject << ${pictures.map(p => `/${p.name} ${p.ref} 0 R`).join(' ')} >>` : '';
    return add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${n(W)} ${n(H)}] /Resources << /Font << /F1 ${fonts[0]} 0 R /F2 ${fonts[1]} 0 R >>${xobjects} >> /Contents ${stream} 0 R >>`);
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objects[tree - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  // Every written byte is ASCII (text goes as hex) except a picture's stream, which goes as it is: offsets count bytes.
  const chunks: Uint8Array[] = [], encoder = new TextEncoder();
  let at = 0;
  const put = (part: string | Uint8Array) => { const bytes = typeof part === 'string' ? encoder.encode(part) : part; chunks.push(bytes); at += bytes.length; };
  put('%PDF-1.4\n');
  const offsets = objects.map((body, k) => {
    const start = at;
    if (typeof body === 'string') put(`${k + 1} 0 obj\n${body}\nendobj\n`);
    else { put(`${k + 1} 0 obj\n${body.head}\nstream\n`); put(body.bytes); put('\nendstream\nendobj\n'); }
    return start;
  });
  const xref = at;
  put(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join(''));
  put(`trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const file = new Uint8Array(at);
  let o = 0;
  for (const c of chunks) { file.set(c, o); o += c.length; }
  return file;
}
