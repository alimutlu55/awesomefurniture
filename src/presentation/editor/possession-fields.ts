import { SHELF_POSSESSIONS } from '../../domain/wardrobe/possessions';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Where the editor markup takes the generated "What do you store?" fields. */
export const POSSESSION_FIELDS_MARKER = '<!-- possession-fields -->';

/** One count field per shelf possession in the registry. The clothing fields are written in the markup
 * because they carry sub-rows (jackets, coats). Adding a possession adds its field here with no edit. */
export function possessionFields(): string {
  return SHELF_POSSESSIONS.map(p =>
    `<label class="num">${escapeHtml(p.label)} <input id="need-${p.key}" type="number" min="0" max="${p.need.max}" value="${p.need.default}"></label>`).join('\n ');
}

/** The editor markup with the generated fields in place. */
export const withPossessionFields = (markup: string) => markup.replace(POSSESSION_FIELDS_MARKER, possessionFields());
