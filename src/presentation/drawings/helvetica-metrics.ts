/**
 * Helvetica and Helvetica-Bold, two of the fonts every PDF reader has: their WinAnsi character codes and widths (1/1000
 * of the font size, from Adobe's font metrics), so text can be centred or set right exactly without embedding a font.
 */
const ASCII = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
const REGULAR = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
/** Characters beyond ASCII the drawings use: their WinAnsi code and width (the same in both weights). */
const EXTRA: Record<string, [number, number]> = { '×': [0xd7, 584], '–': [0x96, 556], '—': [0x97, 1000], '·': [0xb7, 278], '°': [0xb0, 400], '²': [0xb2, 333], '±': [0xb1, 584] };

/** A character's WinAnsi code and width; anything else becomes a question mark. */
function glyph(ch: string, bold: boolean): [number, number] {
  const k = ASCII.indexOf(ch);
  if (k >= 0) return [ch.charCodeAt(0), (bold ? BOLD : REGULAR)[k]!];
  return EXTRA[ch] ?? [0x3f, 556];
}
/** The width of a line of text at `size`. */
export const textWidth = (text: string, size: number, bold = false) => [...text].reduce((w, ch) => w + glyph(ch, bold)[1], 0) * size / 1000;
/** The text as a PDF hex string in WinAnsi encoding. */
export const pdfHex = (text: string) => '<' + [...text].map(ch => glyph(ch, false)[0].toString(16).padStart(2, '0')).join('') + '>';
