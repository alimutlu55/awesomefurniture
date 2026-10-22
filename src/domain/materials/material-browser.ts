import { decorCatalog, type BoardDecorSKU, type TargetZone } from './decor-catalog';

export const materialFilters = [
  { id: 'all', label: 'All' }, { id: 'oak', label: 'Oak & Ash' }, { id: 'dark', label: 'Walnut & Dark Wood' },
  { id: 'neutral', label: 'Warm Neutrals & Cashmere' }, { id: 'color', label: 'Colors & Greens' },
  { id: 'textile', label: 'Linen & Textile' }, { id: 'stone', label: 'Stone & Marble' },
  { id: 'glass', label: 'Glass & Mirror' }, { id: 'veneer', label: 'Real Veneer' },
  { id: 'gloss', label: 'High Gloss' }, { id: 'metal', label: 'Brushed Metals' },
] as const;
export type MaterialFilter = typeof materialFilters[number]['id'];
export function matchesMaterialFilter(s: BoardDecorSKU, filter: MaterialFilter) {
  const wood = s.category === 'wood_melamine' || s.category === 'natural_veneer';
  const neutral = /white|grey|gray|beige|cashmere|taupe|black|bromo|arizona/i.test(s.name);
  switch (filter) {
    case 'all': return true;
    case 'oak': return wood && /oak|ash|hickory/i.test(s.name);
    case 'dark': return wood && /walnut|bamenda|anthracite|brown|cognac|dark/i.test(s.name);
    case 'neutral': return s.category === 'unicolor_matte' && neutral;
    case 'color': return s.category === 'unicolor_matte' && !neutral;
    case 'textile': return s.category === 'textile_leather';
    case 'stone': return s.category === 'stone_mineral';
    case 'glass': return s.category === 'glass_mirror';
    case 'veneer': return s.category === 'natural_veneer';
    case 'gloss': return s.category === 'high_gloss';
    case 'metal': return s.category === 'metallic_brushed';
  }
}
function priority(s: BoardDecorSKU, zone: TargetZone) {
  if (zone === 'carcass' || zone === 'drawers' || zone === 'backing') {
    if (/F416|F433/.test(s.code)) return 0;
    if (s.category === 'textile_leather') return 1;
    if (/H1318|H3157|H1250|W1100|U702/.test(s.code)) return 2;
  } else if (zone === 'fronts') {
    if (s.manufacturer === 'Fenix' || s.surfaceStructure === 'PM') return 0;
    if (/ST37|ST40/.test(s.surfaceStructure)) return 1;
    if (/Walnut/.test(s.name) || s.category === 'glass_mirror') return 2;
  } else if (s.category === 'stone_mineral') return 0;
  return 3;
}
export function browseMaterials(zone: TargetZone, query = '', filter: MaterialFilter = 'all') {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return decorCatalog.filter(s => s.allowedZones.includes(zone) && matchesMaterialFilter(s, filter)
    && words.every(word => `${s.manufacturer} ${s.code} ${s.surfaceStructure} ${s.name}`.toLowerCase().includes(word)))
    .sort((a, b) => priority(a, zone) - priority(b, zone));
}
