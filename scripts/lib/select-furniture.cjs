// Choosing a piece of furniture in a check, as a person does: a design opens with nothing chosen, and a tap on
// the piece chooses it (its measurements then show). Tries points over the view, the middle first, until the
// toolbar says furniture is chosen. Returns the point that worked.
const POINTS = [[.5, .5], [.5, .42], [.5, .6], [.42, .5], [.58, .5], [.5, .34], [.5, .68], [.36, .45], [.64, .45], [.36, .6], [.64, .6]];

async function selectFurniture(page, { touch = false, context = /wardrobe|kitchen/ } = {}) {
 const el = id => page.locator(`[data-editor-id="${id}"]`), bar = el('toolbar');
 await el('view').waitFor();
 if (context.test((await bar.getAttribute('data-context')) || '')) return null;
 for (const [x, y] of POINTS) {
  const v = await el('view').boundingBox(), at = { x: v.x + v.width * x, y: v.y + v.height * y };
  if (touch) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(300);
  if (await el('pop2').isVisible().catch(() => false)) { await el('px').click().catch(() => {}); await page.waitForTimeout(200); }
  if (context.test((await bar.getAttribute('data-context')) || '')) return at;
 }
 throw new Error('No furniture could be chosen with a tap; the toolbar says ' + await bar.getAttribute('data-context'));
}
/** Opens the chosen piece's Shape editor: the Shape tab of its Size panel. */
async function openShape(page) {
 const tab = page.locator('[data-size-tab="shape"]:visible');
 if (!await tab.count()) { await page.locator('[data-editor-id="toolbar"] [data-action="resize"]:visible').click(); await tab.waitFor(); }
 await tab.click(); await page.waitForTimeout(400);
}
module.exports = { selectFurniture, openShape };
