import { chromium } from 'playwright';
import { writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function createIco(images) {
  const headerSize = 6;
  const entrySize = 16;
  let offset = headerSize + entrySize * images.length;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  for (const img of images) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Image data size
    entry.writeUInt32LE(offset, 12); // File offset
    entries.push(entry);
    offset += img.buffer.length;
  }
  return Buffer.concat([header, ...entries, ...images.map(img => img.buffer)]);
}

export async function generateFavicons(publicDir = resolve('public')) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    // Solid charcoal background matching brand #292c25, centered wardrobe lines in #f7f6f2.
    // Solid background prevents white corner bleeding when Google crops favicons into circular search badges.
    const renderHtml = (size) => `<!DOCTYPE html>
<html>
<head><style>*{margin:0;padding:0;}html,body{width:100%;height:100%;overflow:hidden;background:transparent;}</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" style="display:block;">
  <rect width="64" height="64" fill="#292c25"/>
  <g stroke="#f7f6f2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M15 50V14h34v36M15 31h34M32 14v36M12 51h40"/>
  </g>
</svg>
</body>
</html>`;

    async function renderPng(size) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(renderHtml(size));
      return page.screenshot({ omitBackground: false });
    }

    const png16 = await renderPng(16);
    const png32 = await renderPng(32);
    const png48 = await renderPng(48);
    const png96 = await renderPng(96);
    const png180 = await renderPng(180);
    const png192 = await renderPng(192);
    const png512 = await renderPng(512);

    // Google Search specifically checks 48x48 and multi-resolution ICO at the root.
    const ico = createIco([
      { width: 16, height: 16, buffer: png16 },
      { width: 32, height: 32, buffer: png32 },
      { width: 48, height: 48, buffer: png48 },
    ]);

    await Promise.all([
      writeFile(resolve(publicDir, 'favicon.ico'), ico),
      writeFile(resolve(publicDir, 'favicon-48x48.png'), png48),
      writeFile(resolve(publicDir, 'favicon-96x96.png'), png96),
      writeFile(resolve(publicDir, 'apple-touch-icon.png'), png180),
      writeFile(resolve(publicDir, 'favicon-192x192.png'), png192),
      writeFile(resolve(publicDir, 'favicon-512x512.png'), png512),
    ]);

    const manifest = {
      name: 'FurniDraw',
      short_name: 'FurniDraw',
      description: 'Online 3D Furniture Designer for Wardrobes & Kitchens',
      start_url: '/',
      display: 'standalone',
      background_color: '#f7f6f2',
      theme_color: '#292c25',
      icons: [
        { src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
    };
    await writeFile(resolve(publicDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log('Generated favicon stack (ICO, 48x48, 96x96, 180x180, 192x192, 512x512, manifest.json)');
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/generate-favicons.mjs')) {
  await generateFavicons();
}
