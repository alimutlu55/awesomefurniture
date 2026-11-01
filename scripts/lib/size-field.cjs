// The Size field for one measure, as a person sees it: a wardrobe's Size drawing has Width, Height and Depth fields
// under it; anything without the drawing keeps its number box. A field applies its value when it is left (Tab).
const DRAWING = { w: 'width', h: 'height', d: 'depth' };

function sizeField(page, key) {
 return page.locator(`[data-editor-id="wardrobe-size-drawing"] [data-shape-field="${DRAWING[key]}"]:visible, [data-editor-id="${key}"]:visible`).first();
}
/** Opens Size from the toolbar (unless it is open) and waits for its fields. */
async function openSize(page) {
 const panel = page.locator('[data-editor-id="left"]');
 if (!await panel.isVisible().catch(() => false) || await panel.getAttribute('data-context-section') !== 'resize')
  await page.locator('[data-editor-id="toolbar"] [data-action="resize"]:visible').click();
 await sizeField(page, 'w').waitFor({ state: 'visible' });
}
/** Types a measure into its field and leaves it, as a person does. */
async function setSize(page, key, value) {
 const field = sizeField(page, key);
 await field.fill(String(value));
 await field.press('Tab');
}
module.exports = { sizeField, openSize, setSize };
