import type { ProjectDocument } from '../../domain/project/project';

const finishes = { Oak: '#c5a477', White: '#ece9e1', Walnut: '#76553b', Graphite: '#555a59', Sage: '#9ba58c' };
/** A document-derived elevation is available even before this browser has a 3D capture. */
export function designPreview(document: ProjectDocument): string {
  const pieces: string[] = ['<rect width="256" height="192" fill="#e5dfd4"/>'];
  pieces.push('<path d="M20 35H236V162H20Z" fill="#f1ece4"/><path d="M0 162H256V192H0Z" fill="#d0b58f"/>');
  const wardrobes = document.wardrobes.slice(0, 8);
  const total = wardrobes.reduce((sum, w) => sum + w.dimensions.width, 0) || 1;
  const maxHeight = Math.max(260, ...wardrobes.map(w => w.dimensions.height));
  const scale = Math.min(208 / total, 133 / maxHeight);
  let left = (256 - total * scale) / 2;
  for (const wardrobe of wardrobes) {
    const { width, height } = wardrobe.dimensions;
    const top = wardrobe.shape?.top ?? [{ x: 0, y: height }, { x: width, y: height }];
    const points = [{ x: 0, y: 0 }, ...top, { x: width, y: 0 }];
    const path = points.map(p => `${left + p.x * scale},${162 - p.y * scale}`).join(' ');
    pieces.push(`<polygon points="${path}" fill="${finishes[wardrobe.finish]}" stroke="#8d765a" stroke-width="2"/>`);
    if (wardrobe.doors === 'none') {
      let sectionLeft = left + 2;
      for (const section of wardrobe.sections) {
        const sectionWidth = Math.max(1, section.width * scale - 2);
        pieces.push(`<path d="M${sectionLeft} ${162 - height * scale + 3}V160" stroke="#806b53"/>`);
        for (const item of section.items) {
          const y = 162 - (item.y + item.height) * scale;
          pieces.push(`<rect x="${sectionLeft + item.x * scale}" y="${y}" width="${Math.max(1, item.width * scale)}"` +
            ` height="${Math.max(2, item.height * scale)}" fill="#e4d7c4" stroke="#9a856a" stroke-width=".7"/>`);
        }
        sectionLeft += sectionWidth + 2;
      }
    } else {
      pieces.push(`<path d="M${left + width * scale / 2} ${162 - height * scale + 2}V160" stroke="#8d765a"/>`);
    }
    left += width * scale;
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 192">' + pieces.join('') + '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
