import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { design, wardrobe, room, kitchenDesignHash } from './design.mjs';
const output = process.env.CAPTURE_DIR || '/tmp/furnidraw-landing-frames';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const base = process.env.STUDIO_URL || 'https://awesomefurniture-dev.alimutlu535529.workers.dev/editor/?lang=en';
const wanted = process.argv.slice(2);
for (const stage of wanted.length ? wanted : ['walls', 'dimensions', 'studio', 'beauty', 'parametric', 'autolayout', 'joinery', 'drawings', 'render']) {
    const context = await browser.newContext({ viewport: { width: 1088, height: 680 }, deviceScaleFactor: 2,
        locale: 'en-US', colorScheme: 'light', storageState: process.env.FURNIDRAW_STORAGE_STATE });
    const p = await context.newPage();
    p.on('response', async (response) => { if (response.url().includes('/api/design-image')) {
        const body = await response.json().catch(() => ({}));
        console.log('Studio AI response', response.status(), body.error?.code || body.code || '', response.headers()['x-request-id'] || '');
    } });
    p.setDefaultTimeout(45000);
    const el = id => p.locator('[data-editor-id="' + id + '"]');
    const action = key => p.locator('[data-action="' + key + '"]:visible').first();
    const btn = name => p.getByRole('button', { name, exact: true });
    async function shot(key) {
        await p.waitForTimeout(700);
        await p.screenshot({ path: join(output, key + '.jpg'), type: 'jpeg', quality: 96, timeout: 60000 });
        console.log(key);
    }
    async function open(spec) {
        if (stage === 'drawings' && process.env.EMBED_DRAWINGS === '1') {
            const origin = new URL(base).origin;
            if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
                throw Error('Embedded editor needs the local development server');
            await p.route(origin + '/recording-host', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><meta charset="utf-8"><style>html,body,main{height:100%;margin:0}</style><main></main></html>' }));
            await p.goto(origin + '/recording-host');
            await p.evaluate(async (spec) => {
                const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
                const { buildFromSpec } = await import('/src/application/spec/build-from-spec.ts');
                const { projectToScene } = await import('/src/application/projects/editor-mapper.ts');
                const built = buildFromSpec(spec, 'landing-wardrobe');
                mountEditor({ root: document.querySelector('main'), initialScene: projectToScene(built.project) });
            }, spec);
        }
        else if (stage === 'joinery') {
            await p.goto(base + '#' + kitchenDesignHash, { waitUntil: 'domcontentloaded' });
            await p.waitForTimeout(2000);
            await p.evaluate(() => {
                const style = document.createElement('style');
                style.textContent = '.mobile-feedback { display: none !important; }';
                document.querySelector('#editor-root')?.shadowRoot?.appendChild(style);
            });
        }
        else
            await p.goto(base + '#spec=' + encodeURIComponent(JSON.stringify(spec)), { waitUntil: 'domcontentloaded' });
        await btn('Studio').waitFor({ timeout: 90000 });
        await p.waitForTimeout(1100);
    }
    async function select() {
        const v = await el('view').boundingBox();
        for (const [x, y] of [[.55, .45], [.5, .45], [.55, .37], [.5, .37]]) {
            await p.mouse.click(v.x + v.width * x, v.y + v.height * y);
            if (await action('resize').isVisible())
                return;
        }
        throw Error('Cabinet selection failed');
    }
    try {
        if (stage === 'dimensions') {
            await open({ ...design, room: { ...room, openings: [] }, wardrobes: [] });
            await btn('Studio').click();
            await btn('2D').click();
            for (const [wall, length] of [[1, 320], [2, 420]]) {
                await p.locator('.sp2d-wall-poly[data-wall-id="w' + wall + '"]').click({ force: true });
                await action('wall-size').click();
                const field = p.locator('input[data-room-field="length"]:visible,input[data-shape-field="width"]:visible').first();
                await field.fill(String(length));
                await field.press('Tab');
                await shot('wall-size-' + wall);
                await btn('Close settings').click();
                await p.keyboard.press('Escape');
            }
        }
        else if (stage === 'beauty') {
            await open(design);
            await select();
            await action('resize').click();
            await btn('Close settings').click();
            await shot('finished');
        }
        else if (stage === 'walls') {
            await open({ ...design, room: { ...room, openings: [] }, wardrobes: [] });
            await btn('Studio').click();
            await btn('2D').click();
            const walls = p.locator('.sp2d-wall-poly');
            const corners = await walls.evaluateAll(es => es.map(e => {
                const pts = [...e.points];
                return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
            }));
            const points = [[corners[3].x, corners[0].y], [corners[1].x, corners[0].y], [corners[1].x, corners[2].y], [corners[3].x, corners[2].y]];
            for (let i = 0; i < 4; i++) {
                await walls.first().click({ force: true });
                await p.keyboard.press('Delete');
                await p.waitForTimeout(180);
            }
            if (await walls.count())
                throw Error('Wall deletion did not produce a blank plan');
            await p.keyboard.press('w');
            for (let i = 0; i <= 4; i++) {
                const point = await p.locator('[id$="sp2d-world"]').evaluate((g, [x, y]) => { const v = new DOMPoint(x, y).matrixTransform(g.getScreenCTM()); return [v.x, v.y]; }, points[i % 4]);
                await p.mouse.move(...point, { steps: 16 });
                await p.mouse.click(...point);
                if (i)
                    await shot('wall-' + i);
            }
            await p.keyboard.press('Escape');
            if (await walls.count() !== 4)
                throw Error('Expected four drawn walls');
        }
        else if (stage === 'studio') {
            await open({ ...design, room: { ...room, openings: [] }, wardrobes: [] });
            await btn('Studio').click();
            await btn('2D').click();
            await shot('plan');
            const wall = id => p.locator('.sp2d-wall-poly[data-wall-id="w' + id + '"]');
            await wall(3).click({ force: true });
            await shot('wall');
            await action('new').click();
            await btn('Openings').click();
            await p.locator('[data-add-room="door"]:visible').first().click();
            await shot('door');
            await wall(2).click({ force: true });
            await action('new').click();
            await btn('Openings').click();
            await p.locator('[data-add-room="window"]:visible').first().click();
            await shot('window');
            // Return to the canonical measured room for the room-to-furniture cut.
            await p.goto('about:blank');
            await open({ ...design, wardrobes: [] });
            await btn('Studio').click();
            await btn('2D').click();
            await shot('plan-openings');
            await btn('3D').click();
            await shot('room3d');
            await p.mouse.move(630, 380);
            await p.mouse.down();
            await p.mouse.move(602, 370, { steps: 24 });
            await p.mouse.up();
            await shot('room-orbit');
        }
        else {
            await open(stage === 'parametric' ? { ...design, wardrobes: [{ ...wardrobe, from: 10 }] } : ['autolayout', 'joinery'].includes(stage) ? { ...design, wardrobes: [{ ...wardrobe, for: undefined, autoDesign: false }] } : design);
            await select();
            if (stage === 'overview') await shot('model');
            if (stage === 'parametric') {
                await shot('model-resize');
                await action('resize').click();
                await shot('size');
                for (const width of [300, 240]) {
                    await p.locator('[data-shape-field="width"]:visible').fill(String(width));
                    await p.locator('[data-shape-field="width"]:visible').press('Enter');
                    await p.waitForTimeout(250);
                    const actual = await p.evaluate(() => window.furnidraw.describe().wardrobes[0].width);
                    if (Math.abs(actual - width) > .1)
                        throw Error('Width constrained to ' + actual);
                    await shot('width-' + width);
                }
                await p.getByRole('button', { name: /close/i }).filter({ visible: true }).first().click();
                await action('more').click();
                await action('fronts').click();
                const swatches = p.locator('[data-decor-zone="carcass"]:visible');
                await swatches.filter({ hasText: /white/i }).first().click();
                await shot('white');
                await swatches.filter({ hasText: /oak/i }).first().click();
                await shot('oak');
            }
            if (stage === 'autolayout') {
                await shot('empty');
                await action('auto').click();
                await shot('storage');
                const fields = p.locator('input[type=number]:visible');
                for (const [i, n] of [[0, 30], [1, 0], [2, 4], [3, 0], [4, 0], [5, 12], [6, 10], [7, 0]]) {
                    await fields.nth(i).fill(String(n));
                    await fields.nth(i).press('Tab');
                }
                await shot('storage-filled');
                const use = p.getByRole('button', { name: 'Use this layout' }).first();
                await use.scrollIntoViewIfNeeded();
                await shot('proposals');
                await use.click();
                await shot('layout');
            }
            if (stage === 'joinery') {
                for (const [kind, group] of [['pan', 'drawers'], ['cutlery', 'drawers']]) {
                    await action('add-item').click();
                    const category = p.locator('[data-category="' + group + '"]:visible').first();
                    if (await category.isVisible())
                        await category.click();
                    await shot(kind === 'pan' ? 'choose-shelf' : 'choose-drawer');
                    await p.locator('[data-m="' + kind + '"]:visible:not([aria-disabled="true"])').first().click({ timeout: 8000 });
                    await shot(kind === 'pan' ? 'added-shelf' : 'added-drawer');
                    if (!await action('add-item').isVisible())
                        await select();
                }
                await action('more').click();
                await action('fronts').click();
                const hinged = p.locator('[data-d="hinged"]:visible').first();
                if (await hinged.isVisible())
                    await hinged.click();
                await shot('hinged');
                const handle = p.locator('[data-handle="kind"]:visible');
                if (await handle.isVisible())
                    await handle.selectOption('knob');
                await shot('handle');
                const closeBtn = p.getByRole('button', { name: /close/i }).filter({ visible: true }).first();
                if (await closeBtn.isVisible()) {
                    await closeBtn.click();
                    await p.waitForTimeout(400);
                }
                if (!await action('make').isVisible())
                    await select();
                await action('make').click();
                await action('make-parts').click();
                await p.locator('.make-panel [data-tab="cutting"]').click();
                await shot('joinery-cut');
            }
            if (stage === 'drawings') {
                await btn('Menu').click();
                await shot('menu');
                await p.getByRole('menuitem', { name: /Technical drawings/i }).click();
                const sheets = p.locator('.drawings-sheets img');
                await sheets.first().waitFor();
                console.log('sheets', await sheets.evaluateAll(es => es.map(e => e.alt)));
                await shot('drawing-plan');
                const wallSheet = p.locator('.drawings-sheets img[alt*="elevation" i]').first();
                await wallSheet.scrollIntoViewIfNeeded();
                await shot('elevation');
                await btn('Zoom in').click();
                await wallSheet.scrollIntoViewIfNeeded();
                await shot('elevation-detail');
                await p.locator('.drawings-sheets img[alt*="cutting" i]').first().scrollIntoViewIfNeeded();
                await shot('drawing-list');
            }
            if (stage === 'render') {
                await shot('model');
                await btn('Generate image with AI').click();
                const dialog = p.getByRole('dialog', { name: /Generate image/i });
                const style = process.env.RENDER_STYLE || 'realistic';
                await dialog.locator('[data-style="' + style + '"]').click();
                await shot('ai');
                if (process.env.FURNIDRAW_STORAGE_STATE) {
                    await dialog.locator('.ai-generate-button:visible').first().click();
                    const result = p.locator('.ai-result-figure img');
                    await Promise.race([result.waitFor({ timeout: 210000 }), p.locator('.ai-error:visible').first().waitFor({ timeout: 210000 }).then(async () => { throw Error(await p.locator('.ai-error:visible').first().innerText()); })]);
                    await result.evaluate(image => image.decode());
                    await shot('ai-result');
                    const photo = await result.evaluate(async (image) => { const bitmap = await createImageBitmap(await (await fetch(image.src)).blob()); const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext('2d').drawImage(bitmap, 0, 0); return canvas.toDataURL('image/jpeg', .96).split(',')[1]; });
                    await writeFile(join(output, 'photo.jpg'), Buffer.from(photo, 'base64'));
                }
                else
                    throw Error('AI image generation needs a signed-in test account with credits.');
            }
        }
    }
    catch (e) {
        console.error(stage, e.message, await p.locator('button:visible').allTextContents());
        process.exitCode = 1;
    }
    finally {
        await context.close();
    }
}
await browser.close();
