// Renders a wardrobe's shop sheet (Front, Inside, Section A–A) to PNG for reviewing dimension layout.
// Usage: node --import tsx scripts/render-unit-sheet.mjs <out.png> [wardrobe|two-section|kitchen]
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createKitchenDesign } from '../src/domain/kitchen/kitchen-design.ts';
import { createInitialDesign } from '../src/domain/wardrobe/default-design.ts';
import { placePieces } from '../src/domain/drawings/room-pieces.ts';
import { unitDetailLegend, unitDetailViews } from '../src/domain/drawings/unit-detail.ts';
import { sheetSvg } from '../src/presentation/drawings/sheet-marks.ts';
const out = process.argv[2] ?? 'unit-sheet.png';
const kind = process.argv[3] ?? 'wardrobe';
const wardrobe = { ...createInitialDesign(), w: 88, h: 272, d: 40, secs: [[{ k: 'drawer', h: 22 }, { k: 'drawer', h: 22 }, { k: 'drawer', h: 22 }, { k: 'shelf', h: 20 }, { k: 'shelf', h: 20 }, { k: 'shelf', h: 20 }, { k: 'shelf', h: 20 }], [], [], [], [], []] };
const twoSection = { ...createInitialDesign(), w: 160, h: 230, d: 60, n: 2, wt: [50, 50, 50, 50, 50, 50], secs: [[{ k: 'drawer', h: 25 }, { k: 'drawer', h: 25 }, { k: 'shelf', h: 30 }], [{ k: 'shelf', h: 30 }, { k: 'shelf', h: 30 }], [], [], [], []], doors: 'hinged' };
const design = kind === 'kitchen' ? { ...createKitchenDesign('base', 'drawers'), sel: 0, item: -1, divider: -1, space: null, open: false } : kind === 'two-section' ? twoSection : wardrobe;
const [piece] = placePieces({ pieces: [{ id: 2, x: 0, z: 0, angle: 0, y: 0, design }] });
const sheet = { number: 9, legend: unitDetailLegend(piece), title: 'W2 Wardrobe 2', views: unitDetailViews(piece), pieces: [piece], checks: [] };
const svg = sheetSvg(sheet, { project: 'Wardrobe design', date: '2026-10-25', total: 15 });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1680, height: 1188 } });
await page.setContent(`<body style="margin:0">${svg.replace('<svg', '<svg style="width:1680px;height:auto"')}</body>`);
await page.screenshot({ path: out });
await browser.close();
